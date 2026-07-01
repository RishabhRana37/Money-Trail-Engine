"""
engine/patterns.py
==================
Graph-based money-laundering pattern detection.

Builds a directed transaction graph (DiGraph) from the edge list and
runs five detection passes to surface suspicious topologies:

    1. build_graph             — aggregate edges → nx.DiGraph
    2. compute_centrality      — betweenness centrality per node
    3. detect_circular_patterns — cyclic laundering loops
    4. detect_fan_patterns     — high fan-in / fan-out hubs
    5. detect_rapid_movement   — pass-through / mule accounts
    6. build_alerts            — consolidate all patterns into alert dicts

Imports: networkx, pandas, numpy
"""

import numpy as np
import pandas as pd
import networkx as nx


# ---------------------------------------------------------------------------
# FUNCTION 1 — build_graph
# ---------------------------------------------------------------------------
def build_graph(
    edges_df: pd.DataFrame,
    suspicious_accounts: set,
) -> nx.DiGraph:
    """Build a directed transaction graph restricted to suspicious accounts.

    Aggregates individual transactions into weighted edges (sum of amount,
    count of transactions), then keeps only edges where at least one endpoint
    is in *suspicious_accounts*.

    Parameters
    ----------
    edges_df : pd.DataFrame
        Cleaned edge list with columns ``from_account``, ``to_account``,
        ``amount`` (at minimum).
    suspicious_accounts : set
        Set of account IDs flagged by the anomaly or feature stage.
        Only edges touching these accounts are included in the graph.

    Returns
    -------
    nx.DiGraph
        Directed graph where each edge carries ``amount`` (total INR/USD
        transferred) and ``txn_count`` (number of raw transactions) attributes.
    """
    # ── Aggregate multi-edges into single weighted edges ──────────────────
    agg = (
        edges_df
        .groupby(["from_account", "to_account"], sort=False)
        .agg(amount=("amount", "sum"), txn_count=("amount", "count"))
        .reset_index()
    )

    # ── Filter: keep only rows touching at least one suspicious account ───
    mask = (
        agg["from_account"].isin(suspicious_accounts) |
        agg["to_account"].isin(suspicious_accounts)
    )
    agg = agg[mask]

    # ── Build DiGraph ─────────────────────────────────────────────────────
    G = nx.DiGraph()
    for row in agg.itertuples(index=False):
        G.add_edge(
            row.from_account,
            row.to_account,
            amount=row.amount,
            txn_count=row.txn_count,
        )

    print(f"Graph: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges")
    return G


# ---------------------------------------------------------------------------
# FUNCTION 2 — compute_centrality
# ---------------------------------------------------------------------------
def compute_centrality(G: nx.DiGraph, k: int = 500) -> dict:
    """Compute approximate betweenness centrality for all nodes in *G*.

    Uses a k-sample approximation (Brandes algorithm) on the undirected
    projection of *G* for efficiency on large graphs.

    Parameters
    ----------
    G : nx.DiGraph
        Directed transaction graph produced by :func:`build_graph`.
    k : int, optional
        Number of pivot nodes sampled for the approximation (default 500).
        Higher k → more accurate but slower.

    Returns
    -------
    dict
        Mapping ``{node_id: centrality_score}`` where scores are normalised
        to [0, 1] (1 = node sits on the most shortest paths in the graph).
    """
    # Work on the undirected projection so both sender and receiver roles
    # contribute to a node's centrality score.
    U = G.to_undirected()

    # Clamp k to the number of nodes to avoid ValueError on small graphs
    k_eff = min(k, U.number_of_nodes())

    centrality = nx.betweenness_centrality(U, k=k_eff, normalized=True)

    print(f"Centrality computed for {len(centrality)} nodes")
    return centrality


# ---------------------------------------------------------------------------
# FUNCTION 3 — detect_circular_patterns
# ---------------------------------------------------------------------------
def detect_circular_patterns(
    G: nx.DiGraph,
    max_len: int = 6,
    cap: int = 500,
) -> list[list[str]]:
    """Detect cyclic laundering loops in the directed graph.

    A circular pattern (A → B → C → A) is a classic money-laundering
    topology used to obscure the origin of funds through repeated cycling.

    Parameters
    ----------
    G : nx.DiGraph
        Directed transaction graph.
    max_len : int, optional
        Maximum cycle length to include (default 6). Self-loops (length 1)
        and trivial back-edges (length 2) are excluded.
    cap : int, optional
        Stop collecting after this many cycles to bound runtime (default 500).

    Returns
    -------
    list[list[str]]
        Each inner list is one cycle: an ordered sequence of account ID
        strings. The cycle wraps back to the first element.
    """
    cycles: list[list[str]] = []

    for cycle in nx.simple_cycles(G):
        if len(cycles) >= cap:
            break
        # Exclude trivial cycles (self-loops, length-2 back-edges)
        if 2 < len(cycle) <= max_len:
            cycles.append([str(n) for n in cycle])

    print(f"Circular patterns found: {len(cycles)}")
    return cycles


# ---------------------------------------------------------------------------
# FUNCTION 4 — detect_fan_patterns
# ---------------------------------------------------------------------------
def detect_fan_patterns(
    G: nx.DiGraph,
    percentile: int = 95,
) -> tuple[set, set]:
    """Identify high fan-in and high fan-out hub accounts.

    Fan-in hubs (aggregators) collect money from many senders — a signal
    for collection accounts in smurfing networks.
    Fan-out hubs (distributors) send to many receivers — a signal for
    layering / dispersion accounts.

    Parameters
    ----------
    G : nx.DiGraph
        Directed transaction graph.
    percentile : int, optional
        Degree percentile threshold (default 95). Nodes above this
        threshold in in-degree or out-degree are flagged.

    Returns
    -------
    fan_in_accounts : set
        Account IDs whose in-degree exceeds the *percentile*-th percentile.
    fan_out_accounts : set
        Account IDs whose out-degree exceeds the *percentile*-th percentile.
    """
    nodes = list(G.nodes())

    in_degrees  = np.array([G.in_degree(n)  for n in nodes])
    out_degrees = np.array([G.out_degree(n) for n in nodes])

    fan_in_threshold  = float(np.percentile(in_degrees,  percentile))
    fan_out_threshold = float(np.percentile(out_degrees, percentile))

    fan_in_accounts  = {
        nodes[i] for i, d in enumerate(in_degrees)  if d > fan_in_threshold
    }
    fan_out_accounts = {
        nodes[i] for i, d in enumerate(out_degrees) if d > fan_out_threshold
    }

    print(
        f"Fan-in accounts: {len(fan_in_accounts)}, "
        f"Fan-out accounts: {len(fan_out_accounts)}"
    )
    return fan_in_accounts, fan_out_accounts


# ---------------------------------------------------------------------------
# FUNCTION 5 — detect_rapid_movement
# ---------------------------------------------------------------------------
def detect_rapid_movement(
    feat_df: pd.DataFrame,
    threshold: float = 0.85,
) -> set:
    """Detect rapid pass-through (mule) accounts.

    These accounts receive funds and immediately forward the majority
    onward — a key indicator of money-mule behaviour in layering schemes.

    Parameters
    ----------
    feat_df : pd.DataFrame
        Account feature DataFrame from ``features.build_account_features``.
        Must contain ``account_id`` and ``pass_through_ratio`` columns.
    threshold : float, optional
        Minimum pass-through ratio to flag an account (default 0.85).
        An account forwarding ≥ 85% of everything it receives is flagged.

    Returns
    -------
    set
        Account IDs with ``pass_through_ratio > threshold``.
    """
    mask   = feat_df["pass_through_ratio"] > threshold
    rapid  = set(feat_df.loc[mask, "account_id"].tolist())

    print(f"Rapid movement accounts: {len(rapid)}")
    return rapid


# ---------------------------------------------------------------------------
# FUNCTION 6 — build_alerts
# ---------------------------------------------------------------------------
def build_alerts(
    cycles: list[list[str]],
    fan_in_accounts: set,
    fan_out_accounts: set,
    rapid_accounts: set,
    G: nx.DiGraph,
    feat_df: pd.DataFrame,
) -> list[dict]:
    """Consolidate all detected patterns into structured alert dictionaries.

    Each alert represents one detected money-laundering pattern and carries
    enough metadata for the frontend to render a detailed alert card and
    highlight the involved accounts on the graph canvas.

    Parameters
    ----------
    cycles : list[list[str]]
        Circular cycles returned by :func:`detect_circular_patterns`.
    fan_in_accounts : set
        High fan-in hubs returned by :func:`detect_fan_patterns`.
    fan_out_accounts : set
        High fan-out distributors returned by :func:`detect_fan_patterns`.
    rapid_accounts : set
        Mule accounts returned by :func:`detect_rapid_movement`.
    G : nx.DiGraph
        Directed graph (used to look up edge amounts for circular alerts).
    feat_df : pd.DataFrame
        Account feature DataFrame (used to aggregate amounts for hub alerts).

    Returns
    -------
    list[dict]
        Alert dicts sorted by ``severity`` descending, re-numbered as
        ``alert_0001``, ``alert_0002``, … The dict schema is::

            {
                "alert_id":        str,
                "pattern_type":    str,   # circular | fan_in | fan_out | rapid
                "account_ids":     list[str],
                "amount_involved": float,
                "severity":        int,   # 0–100
                "title":           str,
                "summary":         str,
            }
    """
    alerts: list[dict] = []

    # ── Circular alerts (one per detected cycle) ──────────────────────────
    n_circular = 0
    for i, cycle in enumerate(cycles):
        # Sum amounts along the cycle edges (wrap-around: last → first)
        amount_involved = round(
            sum(
                G[cycle[j]][cycle[(j + 1) % len(cycle)]].get("amount", 0.0)
                for j in range(len(cycle))
                if G.has_edge(cycle[j], cycle[(j + 1) % len(cycle)])
            ),
            2,
        )
        severity = min(100, 65 + len(cycle) * 5)

        alerts.append({
            "alert_id":        f"_tmp_{i}",          # re-numbered at the end
            "pattern_type":    "circular",
            "account_ids":     cycle,
            "amount_involved": amount_involved,
            "severity":        severity,
            "title":           f"{len(cycle)}-account laundering loop",
            "summary": (
                f"₹{amount_involved / 100_000:.1f}L cycled through "
                f"{len(cycle)} accounts."
            ),
        })
        n_circular += 1

    # ── Fan-in alert (one aggregate alert for all hub collectors) ─────────
    n_fan_in = 0
    if fan_in_accounts:
        amt = round(
            float(
                feat_df[feat_df["account_id"].isin(fan_in_accounts)]["total_in"].sum()
            ),
            2,
        )
        alerts.append({
            "alert_id":        "_tmp_fan_in",
            "pattern_type":    "fan_in",
            "account_ids":     list(fan_in_accounts)[:20],
            "amount_involved": amt,
            "severity":        75,
            "title":           f"{len(fan_in_accounts)} high fan-in collector accounts",
            "summary":         "Accounts receiving from an unusually large number of senders.",
        })
        n_fan_in = 1

    # ── Fan-out alert (one aggregate alert for all distributors) ──────────
    n_fan_out = 0
    if fan_out_accounts:
        amt = round(
            float(
                feat_df[feat_df["account_id"].isin(fan_out_accounts)]["total_out"].sum()
            ),
            2,
        )
        alerts.append({
            "alert_id":        "_tmp_fan_out",
            "pattern_type":    "fan_out",
            "account_ids":     list(fan_out_accounts)[:20],
            "amount_involved": amt,
            "severity":        72,
            "title":           f"{len(fan_out_accounts)} high fan-out distributor accounts",
            "summary":         "Accounts sending to an unusually large number of receivers.",
        })
        n_fan_out = 1

    # ── Rapid movement alert (one aggregate alert for mule accounts) ──────
    n_rapid = 0
    if rapid_accounts:
        amt = round(
            float(
                feat_df[feat_df["account_id"].isin(rapid_accounts)]["total_out"].sum()
            ),
            2,
        )
        alerts.append({
            "alert_id":        "_tmp_rapid",
            "pattern_type":    "rapid",
            "account_ids":     list(rapid_accounts)[:20],
            "amount_involved": amt,
            "severity":        78,
            "title":           f"{len(rapid_accounts)} rapid pass-through (mule) accounts",
            "summary":         "Accounts forwarding 85%+ of received funds immediately.",
        })
        n_rapid = 1

    # ── Sort by severity descending and re-number IDs ─────────────────────
    alerts.sort(key=lambda a: a["severity"], reverse=True)
    for idx, alert in enumerate(alerts, start=1):
        alert["alert_id"] = f"alert_{idx:04d}"

    print(
        f"Total alerts built: {len(alerts)} "
        f"(circular: {n_circular}, "
        f"fan_in: {n_fan_in}, "
        f"fan_out: {n_fan_out}, "
        f"rapid: {n_rapid})"
    )
    return alerts
