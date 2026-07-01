"""
engine/features.py
==================
Builds one feature row per account from the raw edges DataFrame.
These features are the input to IsolationForest (unsupervised anomaly
detection) and any supervised classifier trained on ground-truth labels.

Thresholds for "structuring" and "round amount" are computed
AUTOMATICALLY from the dataset's own amount distribution, so the
feature engineering adapts correctly whether amounts are in the
hundreds (login/session datasets) or hundreds-of-thousands (PaySim /
bank-transfer datasets).

Public API:
    build_account_features(edges_df) -> (feat_df, ML_FEATURES)
"""

import math
import pandas as pd
import numpy as np

# ---------------------------------------------------------------------------
# Canonical ML feature list — ORDER MATTERS for model serialisation
# ---------------------------------------------------------------------------
ML_FEATURES: list[str] = [
    "total_in",
    "total_out",
    "txn_count",
    "fan_in",
    "fan_out",
    "pass_through_ratio",
    "flow_imbalance",
    "round_amount_ratio",
    "structuring_score",
    "avg_in",
    "avg_out",
    "max_in",
    "max_out",
]


# ---------------------------------------------------------------------------
# Adaptive threshold helper
# ---------------------------------------------------------------------------
def _compute_thresholds(amounts: pd.Series) -> dict:
    """Derive data-driven thresholds for structuring and round-amount detection.

    All thresholds scale automatically with the dataset's amount distribution
    so that feature engineering is meaningful regardless of currency or scale.

    Parameters
    ----------
    amounts : pd.Series
        The ``amount`` column from the full edges DataFrame (all rows).

    Returns
    -------
    dict with keys:
        ``struct_lower``  — lower bound of the structuring band (85th percentile)
        ``struct_upper``  — upper bound of the structuring band (95th percentile)
        ``round_modulus`` — divisor used to detect suspiciously round amounts
        ``scale_label``   — human-readable scale description for logging

    Notes
    -----
    **Structuring band** — captures amounts that sit just below the local
    "large transaction" threshold (p85–p95).  In a PaySim-style dataset this
    maps to ~45k–50k INR; in a low-value session dataset it maps to the
    top-decile range of that dataset.

    **Round-amount modulus** — we want amounts that are "suspiciously round"
    for the scale.  We compute:
        magnitude = floor(log10(p50))          e.g.  log10(138) → 2
        round_modulus = 10 ** magnitude        e.g.  10^2 = 100
    So for a median of ~138, amounts divisible by 100 are flagged.
    For a median of ~50 000, amounts divisible by 10 000 are flagged.
    Minimum modulus is 10 (never flag anything below that granularity).
    """
    nonzero = amounts[amounts > 0].dropna()

    # --- Structuring band: p85 → p95 --------------------------------------
    struct_lower = float(np.percentile(nonzero, 85))
    struct_upper = float(np.percentile(nonzero, 95))

    # --- Round-amount modulus ---------------------------------------------
    median_amt = float(np.percentile(nonzero, 50))
    if median_amt > 0:
        magnitude = math.floor(math.log10(median_amt))   # e.g. log10(138)=2.14 → 2
        round_modulus = max(10, 10 ** magnitude)          # e.g. 10^2 = 100
    else:
        round_modulus = 10

    # --- Human-readable scale label for logs ------------------------------
    max_amt = float(nonzero.max())
    if max_amt < 1_000:
        scale_label = "low-value (< 1k)"
    elif max_amt < 100_000:
        scale_label = "mid-value (1k – 100k)"
    elif max_amt < 10_000_000:
        scale_label = "high-value (100k – 10M)"
    else:
        scale_label = "very-high-value (> 10M)"

    return {
        "struct_lower":  struct_lower,
        "struct_upper":  struct_upper,
        "round_modulus": round_modulus,
        "scale_label":   scale_label,
    }


# ---------------------------------------------------------------------------
# Public function
# ---------------------------------------------------------------------------
def build_account_features(
    edges_df: pd.DataFrame,
) -> tuple[pd.DataFrame, list[str]]:
    """Build one feature row per account from the raw transaction edge list.

    Parameters
    ----------
    edges_df : pd.DataFrame
        Cleaned transaction DataFrame produced by ``loader.load_and_aggregate``.
        Must contain columns: ``from_account``, ``to_account``, ``amount``.

    Returns
    -------
    feat_df : pd.DataFrame
        One row per unique account. Contains ``account_id`` as a regular
        column (not the index) plus all features in :data:`ML_FEATURES` and
        several auxiliary columns used for downstream scoring.
    ML_FEATURES : list[str]
        Ordered list of column names to pass to the ML model.

    Notes
    -----
    All NaN values produced by left-joins (accounts that only appear on one
    side of the graph) are filled with 0 before derived features are computed.
    Structuring and round-amount thresholds are auto-detected from the data.
    """

    # ------------------------------------------------------------------
    # Guard: verify required columns are present
    # ------------------------------------------------------------------
    required = {"from_account", "to_account", "amount"}
    missing = required - set(edges_df.columns)
    if missing:
        raise ValueError(
            f"edges_df is missing required columns: {missing}. "
            f"Found: {list(edges_df.columns)}"
        )

    # Convenience aliases
    src = edges_df["from_account"]
    dst = edges_df["to_account"]
    amt = edges_df["amount"]

    # ------------------------------------------------------------------
    # AUTO-DETECT THRESHOLDS from this dataset's amount distribution
    # ------------------------------------------------------------------
    thresholds = _compute_thresholds(amt)
    struct_lower  = thresholds["struct_lower"]
    struct_upper  = thresholds["struct_upper"]
    round_modulus = thresholds["round_modulus"]

    print(f"[features] Dataset scale  : {thresholds['scale_label']}")
    print(f"[features] Amount p50/p85/p95/max : "
          f"{np.percentile(amt[amt>0], 50):.2f} / "
          f"{struct_lower:.2f} / {struct_upper:.2f} / {amt.max():.2f}")
    print(f"[features] Structuring band : [{struct_lower:.2f}, {struct_upper:.2f}]")
    print(f"[features] Round modulus    : {round_modulus:,}  "
          f"(flags amounts divisible by {round_modulus:,})")

    # ==================================================================
    # STEP 1 — IN-FLOW AGGREGATION  (group by to_account)
    # ==================================================================
    in_grp = edges_df.groupby("to_account", sort=False)

    in_agg = in_grp["amount"].agg(
        total_in="sum",
        txn_in_count="count",
        avg_in="mean",
        max_in="max",
    )

    # Number of distinct senders to each receiving account
    in_agg["unique_senders"] = in_grp["from_account"].nunique()

    # ------------------------------------------------------------------
    # STEP 2 — OUT-FLOW AGGREGATION  (group by from_account)
    # ------------------------------------------------------------------
    out_grp = edges_df.groupby("from_account", sort=False)

    out_agg = out_grp["amount"].agg(
        total_out="sum",
        txn_out_count="count",
        avg_out="mean",
        max_out="max",
    )

    # Number of distinct receivers from each sending account
    out_agg["unique_receivers"] = out_grp["to_account"].nunique()

    # ------------------------------------------------------------------
    # STEP 3 — STRUCTURING SCORE
    # Amounts in the [struct_lower, struct_upper] band are suspicious —
    # they sit just below the "large transaction" threshold for this
    # dataset, mimicking classic structuring / smurfing behaviour.
    # ------------------------------------------------------------------
    struct_mask = amt.between(struct_lower, struct_upper)
    struct_txns = (
        edges_df.loc[struct_mask]
        .groupby("from_account", sort=False)
        .size()
        .rename("structuring_txns")
    )

    # ------------------------------------------------------------------
    # STEP 4 — ROUND AMOUNT RATIO
    # Amounts divisible by round_modulus (auto-scaled to dataset) are
    # a red flag for manufactured / scripted transfers.
    # Ratio = round_txn_count / (txn_out_count + 1)
    # ------------------------------------------------------------------
    round_mask  = (amt % round_modulus == 0)
    round_counts = (
        edges_df.loc[round_mask]
        .groupby("from_account", sort=False)
        .size()
        .rename("round_txn_count")
    )

    # ------------------------------------------------------------------
    # STEP 5 — BUILD MASTER FEATURE TABLE
    # Index = union of all unique account IDs across both graph sides
    # ------------------------------------------------------------------
    all_accounts = pd.Index(
        pd.concat([src, dst]).unique(), name="account_id"
    )
    feat_df = pd.DataFrame(index=all_accounts)

    # Left-join in-flow stats (indexed by to_account)
    feat_df = feat_df.join(in_agg, how="left")

    # Left-join out-flow stats (indexed by from_account)
    feat_df = feat_df.join(out_agg, how="left")

    # Left-join structuring counts (indexed by from_account)
    feat_df = feat_df.join(struct_txns, how="left")

    # Left-join round-amount counts (indexed by from_account)
    feat_df = feat_df.join(round_counts, how="left")

    # Fill NaN → 0 (accounts only seen on one side of the graph)
    feat_df = feat_df.fillna(0)

    # ------------------------------------------------------------------
    # STEP 6 — DERIVED FEATURES
    # ------------------------------------------------------------------

    # Degree signals (fan-in / fan-out)
    feat_df["fan_in"]  = feat_df["unique_senders"]
    feat_df["fan_out"] = feat_df["unique_receivers"]

    # Combined transaction volume
    feat_df["txn_count"] = feat_df["txn_in_count"] + feat_df["txn_out_count"]

    # Pass-through ratio — fraction of received money immediately re-sent.
    # Clipped to [0, 1]. High value (≈1) = transit / mule behaviour.
    feat_df["pass_through_ratio"] = np.where(
        feat_df["total_in"] > 0,
        (feat_df["total_out"] / feat_df["total_in"]).clip(0, 1),
        0.0,
    )

    # Flow imbalance — low value = equal in & out = shell account signal.
    # Range [0, 1]; 0 = perfectly balanced (suspicious), 1 = one-sided.
    feat_df["flow_imbalance"] = (
        (feat_df["total_in"] - feat_df["total_out"]).abs()
        / (feat_df["total_in"] + feat_df["total_out"] + 1.0)
    )

    # Structuring score — normalised by outgoing transaction count
    feat_df["structuring_score"] = (
        feat_df["structuring_txns"] / (feat_df["txn_out_count"] + 1.0)
    )

    # Round amount ratio — normalised by outgoing transaction count
    feat_df["round_amount_ratio"] = (
        feat_df["round_txn_count"] / (feat_df["txn_out_count"] + 1.0)
    )

    # ------------------------------------------------------------------
    # STEP 7 — Enforce ML_FEATURES are all present (safety check)
    # ------------------------------------------------------------------
    for col in ML_FEATURES:
        if col not in feat_df.columns:
            raise RuntimeError(
                f"BUG: expected feature column '{col}' was not built. "
                "Check the aggregation steps above."
            )

    # ------------------------------------------------------------------
    # STEP 8 — RETURN
    # Reset index so account_id becomes a regular column
    # ------------------------------------------------------------------
    feat_df = feat_df.reset_index()  # account_id → regular column

    # ------------------------------------------------------------------
    # Summary diagnostics
    # ------------------------------------------------------------------
    n_accounts = len(feat_df)
    n_features  = len(ML_FEATURES)

    pt_high  = int((feat_df["pass_through_ratio"] > 0.9).sum())
    st_high  = int((feat_df["structuring_score"]   > 0.3).sum())
    rnd_high = int((feat_df["round_amount_ratio"]  > 0.3).sum())

    print(f"Feature matrix: {n_accounts:,} accounts × {n_features} features")
    print(f"Pass-through > 0.9      : {pt_high:,} accounts")
    print(f"Structuring score > 0.3 : {st_high:,} accounts")
    print(f"Round amount ratio > 0.3: {rnd_high:,} accounts")

    return feat_df, ML_FEATURES
