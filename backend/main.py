"""
AURA — Anti-Money-Laundering Unified Risk Analytics
FastAPI Production Server

Loads pre-built artifacts at startup and serves 9 endpoints.
Training is NEVER re-run at request time — artifacts are pre-built
via engine/train.py and loaded once into module-level globals.
"""

import json
import os
import sys
from collections import deque
from contextlib import asynccontextmanager
from typing import Optional

import networkx as nx
import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

# ---------------------------------------------------------------------------
# Resolve paths — works regardless of CWD
# ---------------------------------------------------------------------------
_BACKEND_DIR  = os.path.dirname(os.path.abspath(__file__))
_ARTIFACTS    = os.path.join(_BACKEND_DIR, "artifacts")
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

from engine.risk import build_explanation  # noqa: E402 (after sys.path fix)

# ---------------------------------------------------------------------------
# Module-level globals — populated at startup, read-only at request time
# ---------------------------------------------------------------------------
ACCOUNTS:      pd.DataFrame      = pd.DataFrame()
EDGES:         pd.DataFrame      = pd.DataFrame()
ALERTS:        list              = []
ACCURACY:      dict              = {}
G:             nx.DiGraph        = nx.DiGraph()
ACCOUNT_INDEX: dict              = {}   # account_id → integer iloc position


# ---------------------------------------------------------------------------
# Lifespan — load all artifacts once at startup
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load pre-built artifacts into memory at startup."""
    global ACCOUNTS, EDGES, ALERTS, ACCURACY, G, ACCOUNT_INDEX

    required = ["accounts.parquet", "edges.parquet",
                 "alerts.json", "model.pkl"]
    missing = [f for f in required
               if not os.path.exists(os.path.join(_ARTIFACTS, f))]
    if missing:
        msg = (
            f"❌ Artifacts not found: {missing}. "
            "Run: python -m engine.train first."
        )
        print(msg)
        raise RuntimeError(msg)

    try:
        # ── DataFrames ────────────────────────────────────────────────────
        ACCOUNTS = pd.read_parquet(os.path.join(_ARTIFACTS, "accounts.parquet"))
        EDGES    = pd.read_parquet(os.path.join(_ARTIFACTS, "edges.parquet"))

        # Normalise column types for safe JSON serialisation later
        for col in ["risk_score", "txn_count", "fan_in", "fan_out",
                    "txn_in_count", "txn_out_count"]:
            if col in ACCOUNTS.columns:
                ACCOUNTS[col] = ACCOUNTS[col].astype(int)

        # ── O(1) account lookup index ─────────────────────────────────────
        ACCOUNT_INDEX = {
            aid: idx
            for idx, aid in enumerate(ACCOUNTS["account_id"].tolist())
        }

        # ── Alerts ────────────────────────────────────────────────────────
        with open(os.path.join(_ARTIFACTS, "alerts.json")) as f:
            ALERTS = json.load(f)

        # ── Accuracy report (optional) ────────────────────────────────────
        acc_path = os.path.join(_ARTIFACTS, "accuracy.json")
        if os.path.exists(acc_path):
            with open(acc_path) as f:
                ACCURACY = json.load(f)

        # ── NetworkX DiGraph — built once from the aggregated edge table ──
        G = nx.DiGraph()
        for row in EDGES.itertuples(index=False):
            G.add_edge(
                row.from_account,
                row.to_account,
                amount=float(row.amount),
                txn_count=int(row.txn_count),
            )

        print(
            f"✅ AURA API ready — "
            f"{len(ACCOUNTS):,} accounts, "
            f"{len(ALERTS)} alerts loaded"
        )

    except Exception as exc:
        print(f"❌ Startup error: {exc}")
        raise

    yield  # ← server runs here


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------
root_path = "/api" if os.environ.get("VERCEL") == "1" else ""
app = FastAPI(
    title="AURA — Anti-Money-Laundering Unified Risk Analytics",
    description=(
        "AI-powered financial crime investigation platform. "
        "Fuses IsolationForest anomaly detection, NetworkX graph analytics, "
        "and a transparent risk-fusion HUD."
    ),
    version="2.0.0",
    lifespan=lifespan,
    root_path=root_path,
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# HELPER FUNCTIONS
# ---------------------------------------------------------------------------

def risk_level_color(level: str) -> str:
    """Map a risk level string to its hex colour code."""
    return {
        "critical": "#E24B4A",
        "high":     "#F0883E",
        "medium":   "#D29922",
        "low":      "#3FB950",
    }.get(level, "#3FB950")


def classify_account_type(row: pd.Series) -> str:
    """Classify an account as shell, business, or individual."""
    if (
        row.get("pass_through_ratio", 0) > 0.9
        and row.get("fan_in", 0) > 5
        and row.get("fan_out", 0) > 5
    ):
        return "shell"
    if row.get("txn_count", 0) > 100:
        return "business"
    return "individual"


def get_account_flags(row: pd.Series) -> list:
    """Return a list of fraud-pattern flag strings for an account row."""
    flags = []
    if row.get("in_cycle", 0) > 0:
        flags.append("circular")
    if row.get("pass_through_ratio", 0) > 0.85:
        flags.append("rapid_movement")
    if row.get("structuring_score", 0) > 0.3:
        flags.append("smurfing")
    if row.get("fan_in", 0) > 20:
        flags.append("fan_in")
    if row.get("fan_out", 0) > 20:
        flags.append("fan_out")
    return flags


def format_account_dict(row: pd.Series) -> dict:
    """Serialise one ACCOUNTS row into the API contract shape."""
    return {
        "account_id":          str(row["account_id"]),
        "name":                str(row["account_id"]),
        "account_type":        classify_account_type(row),
        "risk_score":          int(row["risk_score"]),
        "risk_level":          str(row.get("risk_level", "low")),
        "color":               risk_level_color(str(row.get("risk_level", "low"))),
        "flags":               get_account_flags(row),
        "total_in":            round(float(row.get("total_in", 0)), 2),
        "total_out":           round(float(row.get("total_out", 0)), 2),
        "txn_count":           int(row.get("txn_count", 0)),
        "fan_in":              int(row.get("fan_in", 0)),
        "fan_out":             int(row.get("fan_out", 0)),
        "pass_through_ratio":  round(float(row.get("pass_through_ratio", 0)), 4),
        "structuring_score":   round(float(row.get("structuring_score", 0)), 4),
        "anomaly_score":       round(float(row.get("anomaly_score", 0)), 2),
        "pattern_score":       round(float(row.get("pattern_score", 0)), 2),
        "centrality_score":    round(float(row.get("centrality_score", 0)), 2),
    }


def get_subgraph_nodes_edges(
    member_ids: set,
    center_id: Optional[str] = None,
) -> tuple:
    """Build node and edge lists for a subgraph of member_ids.

    Parameters
    ----------
    member_ids : set
        Account IDs to include in the subgraph.
    center_id : str, optional
        Account to mark as is_center=True.

    Returns
    -------
    (nodes, edges) : tuple[list, list]
    """
    # ── Nodes ─────────────────────────────────────────────────────────────
    nodes = []
    for mid in member_ids:
        if mid in ACCOUNT_INDEX:
            row = ACCOUNTS.iloc[ACCOUNT_INDEX[mid]]
            nodes.append({
                "id":           str(mid),
                "label":        str(mid),
                "account_type": classify_account_type(row),
                "risk_score":   int(row["risk_score"]),
                "risk_level":   str(row.get("risk_level", "low")),
                "color":        risk_level_color(str(row.get("risk_level", "low"))),
                "is_center":    (str(mid) == str(center_id)),
                "flagged":      int(row["risk_score"]) >= 70,
            })
        else:
            # Node exists in graph but not in accounts table (edge-only node)
            nodes.append({
                "id":           str(mid),
                "label":        str(mid),
                "account_type": "individual",
                "risk_score":   0,
                "risk_level":   "low",
                "color":        risk_level_color("low"),
                "is_center":    (str(mid) == str(center_id)),
                "flagged":      False,
            })

    # ── Build suspicious edge lookup from alerts ───────────────────────────
    suspicious_pairs: set = set()
    for alert in ALERTS:
        ids = alert.get("account_ids", [])
        for j in range(len(ids)):
            suspicious_pairs.add((str(ids[j]), str(ids[(j + 1) % len(ids)])))

    # ── Edges ─────────────────────────────────────────────────────────────
    mask = (
        EDGES["from_account"].isin(member_ids) &
        EDGES["to_account"].isin(member_ids)
    )
    sub_edges = EDGES[mask]

    edges = []
    for i, erow in enumerate(sub_edges.itertuples(index=False)):
        src = str(erow.from_account)
        tgt = str(erow.to_account)
        edges.append({
            "id":         f"e{i}",
            "source":     src,
            "target":     tgt,
            "amount":     round(float(erow.amount), 2),
            "txn_count":  int(erow.txn_count),
            "suspicious": (src, tgt) in suspicious_pairs,
        })

    return nodes, edges


def _severity_to_level(severity: int) -> str:
    """Convert a numeric severity (0-100) to a risk level label."""
    if severity >= 90:
        return "critical"
    if severity >= 70:
        return "high"
    return "medium"


def _count_alerts_by_type() -> dict:
    """Count ALERTS by pattern_type, returning all 6 expected keys."""
    counts = {
        "circular": 0, "layering": 0, "smurfing": 0,
        "rapid_movement": 0, "fan_in": 0, "fan_out": 0,
    }
    for a in ALERTS:
        pt = a.get("pattern_type", "")
        if pt in counts:
            counts[pt] += 1
    return counts


# ---------------------------------------------------------------------------
# REQUEST BODIES
# ---------------------------------------------------------------------------

class GenerateBody(BaseModel):
    num_accounts:     Optional[int]   = None
    num_transactions: Optional[int]   = None
    fraud_intensity:  Optional[float] = None
    seed:             Optional[int]   = None


class AnalyzeBody(BaseModel):
    dataset_id: Optional[str] = "ds_001"


# ---------------------------------------------------------------------------
# ENDPOINT 1 — POST /dataset/generate
# ---------------------------------------------------------------------------
@app.post("/dataset/generate", tags=["Dataset"])
async def dataset_generate(body: GenerateBody = GenerateBody()):
    """Return dataset summary (data is pre-loaded, no generation at runtime)."""
    return {
        "dataset_id":            "ds_001",
        "num_accounts":          len(ACCOUNTS),
        "num_transactions":      int(EDGES["txn_count"].sum()),
        "fraud_rings_injected":  sum(
            1 for a in ALERTS if a.get("pattern_type") == "circular"
        ),
        "ready":                 True,
    }


# ---------------------------------------------------------------------------
# ENDPOINT 2 — POST /analyze
# ---------------------------------------------------------------------------
@app.post("/analyze", tags=["Analysis"])
async def analyze(body: AnalyzeBody = AnalyzeBody()):
    """Return analysis summary from pre-built artifacts."""
    patterns = _count_alerts_by_type()
    return {
        "dataset_id":       "ds_001",
        "accounts_scored":  len(ACCOUNTS),
        "alerts_generated": len(ALERTS),
        "patterns_found":   patterns,
        "duration_ms":      0,
        "ready":            True,
    }


# ---------------------------------------------------------------------------
# ENDPOINT 3 — GET /stats
# ---------------------------------------------------------------------------
@app.get("/stats", tags=["Dashboard"])
async def stats(dataset_id: Optional[str] = Query(None)):
    """Return dashboard KPI statistics."""
    high_risk_ids = set(
        ACCOUNTS[ACCOUNTS["risk_score"] >= 70]["account_id"].tolist()
    )
    amount_flagged = round(
        float(
            EDGES[EDGES["from_account"].isin(high_risk_ids)]["amount"].sum()
        ),
        2,
    )
    top5 = ACCOUNTS.nlargest(5, "risk_score")[
        ["account_id", "risk_score", "risk_level"]
    ]
    top5_list = [
        {
            "account_id": str(r["account_id"]),
            "name":       str(r["account_id"]),
            "risk_score": int(r["risk_score"]),
            "risk_level": str(r["risk_level"]),
        }
        for _, r in top5.iterrows()
    ]
    return {
        "dataset_id":         "ds_001",
        "total_accounts":     len(ACCOUNTS),
        "total_transactions": int(EDGES["txn_count"].sum()),
        "total_amount":       round(float(EDGES["amount"].sum()), 2),
        "high_risk_accounts": int((ACCOUNTS["risk_score"] >= 70).sum()),
        "amount_flagged":     amount_flagged,
        "alerts_by_type":     _count_alerts_by_type(),
        "top_risk_accounts":  top5_list,
    }


# ---------------------------------------------------------------------------
# ENDPOINT 4 — GET /accounts
# ---------------------------------------------------------------------------
@app.get("/accounts", tags=["Accounts"])
async def list_accounts(
    dataset_id: Optional[str]  = Query(None),
    sort:       Optional[str]  = Query("risk_desc"),
    min_risk:   Optional[int]  = Query(0),
    limit:      int            = Query(50, ge=1, le=200),
    offset:     int            = Query(0, ge=0),
):
    """List accounts with filtering, sorting, and pagination."""
    df = ACCOUNTS[ACCOUNTS["risk_score"] >= min_risk]
    total = len(df)

    # Sort
    sort_map = {
        "risk_desc":    ("risk_score",  False),
        "risk_asc":     ("risk_score",  True),
        "amount_desc":  ("total_out",   False),
    }
    col, asc = sort_map.get(sort, ("risk_score", False))
    df = df.sort_values(col, ascending=asc)

    # Paginate
    page = df.iloc[offset: offset + limit]

    return {
        "total":    total,
        "accounts": [format_account_dict(row) for _, row in page.iterrows()],
    }


# ---------------------------------------------------------------------------
# ENDPOINT 5 — GET /accounts/{account_id}
# ---------------------------------------------------------------------------
@app.get("/accounts/{account_id}", tags=["Accounts"])
async def get_account(
    account_id: str,
    dataset_id: Optional[str] = Query(None),
):
    """Retrieve full account detail with SHAP-lite explanation."""
    if account_id not in ACCOUNT_INDEX:
        raise HTTPException(
            status_code=404,
            detail={"error": "not_found", "message": f"Account '{account_id}' not found."},
        )

    row      = ACCOUNTS.iloc[ACCOUNT_INDEX[account_id]]
    acct     = format_account_dict(row)
    expl     = build_explanation(row)

    # ── Top 5 counterparties by total amount (in + out) ──────────────────
    out_cp = (
        EDGES[EDGES["from_account"] == account_id]
        .groupby("to_account")["amount"].sum()
        .reset_index()
        .rename(columns={"to_account": "counterparty_id", "amount": "amount"})
        .assign(direction="out")
    )
    in_cp = (
        EDGES[EDGES["to_account"] == account_id]
        .groupby("from_account")["amount"].sum()
        .reset_index()
        .rename(columns={"from_account": "counterparty_id", "amount": "amount"})
        .assign(direction="in")
    )
    all_cp = (
        pd.concat([out_cp, in_cp])
        .sort_values("amount", ascending=False)
        .head(5)
    )
    top_counterparties = [
        {
            "account_id": str(r["counterparty_id"]),
            "direction":  r["direction"],
            "amount":     round(float(r["amount"]), 2),
        }
        for _, r in all_cp.iterrows()
    ]

    # ── Transaction timeline — last 20 edges involving this account ───────
    involved = EDGES[
        (EDGES["from_account"] == account_id) |
        (EDGES["to_account"]   == account_id)
    ].sort_values("amount", ascending=False).head(20)

    timeline = [
        {
            "from_account": str(r["from_account"]),
            "to_account":   str(r["to_account"]),
            "amount":       round(float(r["amount"]), 2),
            "txn_count":    int(r["txn_count"]),
        }
        for _, r in involved.iterrows()
    ]

    return {
        **acct,
        "explanation":       expl,
        "top_counterparties": top_counterparties,
        "timeline":          timeline,
    }


# ---------------------------------------------------------------------------
# ENDPOINT 6 — GET /graph
# ---------------------------------------------------------------------------
@app.get("/graph", tags=["Graph"])
async def get_graph(
    dataset_id: Optional[str] = Query(None),
    account_id: Optional[str] = Query(None),
    alert_id:   Optional[str] = Query(None),
    depth:      int           = Query(2, ge=1, le=3),
):
    """Return a graph subgraph for an alert or account neighbourhood."""
    center_id = None

    if alert_id:
        # ── Alert-centric subgraph ─────────────────────────────────────────
        alert = next((a for a in ALERTS if a["alert_id"] == alert_id), None)
        if not alert:
            raise HTTPException(
                status_code=404,
                detail={"error": "not_found", "message": f"Alert '{alert_id}' not found."},
            )
        alert_members = set(str(aid) for aid in alert["account_ids"])
        
        # Query edges where at least one side is in the alert accounts
        mask = (
            EDGES["from_account"].isin(alert_members) |
            EDGES["to_account"].isin(alert_members)
        )
        sub_edges = EDGES[mask].sort_values(by="amount", ascending=False).head(30)
        
        # Union the members set with all connected counterparties
        members = set(alert_members)
        for row in sub_edges.itertuples(index=False):
            members.add(str(row.from_account))
            members.add(str(row.to_account))
            
        center_id = alert_id

    elif account_id:
        # ── Account ego-network via BFS ───────────────────────────────────
        if account_id not in G:
            raise HTTPException(
                status_code=404,
                detail={"error": "not_found", "message": f"Account '{account_id}' not in graph."},
            )
        center_id = account_id
        members: set = set()
        queue = deque([(account_id, 0)])
        visited = {account_id}

        while queue and len(members) < 80:
            node, d = queue.popleft()
            members.add(node)
            if d < depth:
                for nb in list(G.successors(node)) + list(G.predecessors(node)):
                    if nb not in visited:
                        visited.add(nb)
                        queue.append((nb, d + 1))
                        if len(members) >= 80:
                            break

    else:
        raise HTTPException(
            status_code=400,
            detail={
                "error":   "bad_request",
                "message": "Provide either account_id or alert_id query param.",
            },
        )

    nodes, edges = get_subgraph_nodes_edges(members, center_id=center_id)
    return {
        "center_id": center_id,
        "nodes":     nodes,
        "edges":     edges,
    }


# ---------------------------------------------------------------------------
# ENDPOINT 7 — GET /alerts
# ---------------------------------------------------------------------------
@app.get("/alerts", tags=["Alerts"])
async def list_alerts(
    dataset_id:   Optional[str] = Query(None),
    min_severity: int           = Query(0, ge=0, le=100),
    pattern_type: Optional[str] = Query(None),
):
    """List all alerts with optional severity and type filtering."""
    filtered = [
        a for a in ALERTS
        if a.get("severity", 0) >= min_severity
        and (pattern_type is None or a.get("pattern_type") == pattern_type)
    ]
    filtered = sorted(filtered, key=lambda a: a.get("severity", 0), reverse=True)

    # Enrich with risk_level
    enriched = [
        {**a, "risk_level": _severity_to_level(a.get("severity", 0))}
        for a in filtered
    ]
    return {"total": len(enriched), "alerts": enriched}


# ---------------------------------------------------------------------------
# ENDPOINT 8 — GET /alerts/{alert_id}
# ---------------------------------------------------------------------------
@app.get("/alerts/{alert_id}", tags=["Alerts"])
async def get_alert(
    alert_id:   str,
    dataset_id: Optional[str] = Query(None),
):
    """Return full alert detail including subgraph and narrative."""
    alert = next((a for a in ALERTS if a["alert_id"] == alert_id), None)
    if not alert:
        raise HTTPException(
            status_code=404,
            detail={"error": "not_found", "message": f"Alert '{alert_id}' not found."},
        )

    members        = set(str(aid) for aid in alert.get("account_ids", []))
    nodes, edges   = get_subgraph_nodes_edges(members, center_id=alert_id)

    narrative = (
        f"Funds moved through a {alert.get('pattern_type', 'unknown')} pattern "
        f"involving {len(alert.get('account_ids', []))} accounts, "
        f"totaling ₹{float(alert.get('amount_involved', 0)) / 100_000:.1f}L."
    )

    return {
        **alert,
        "risk_level": _severity_to_level(alert.get("severity", 0)),
        "narrative":  narrative,
        "graph": {
            "center_id": alert_id,
            "nodes":     nodes,
            "edges":     edges,
        },
    }


# ---------------------------------------------------------------------------
# ENDPOINT 9 — GET /accuracy (bonus)
# ---------------------------------------------------------------------------
@app.get("/accuracy", tags=["Evaluation"])
async def accuracy():
    """Return model accuracy metrics vs ground truth fraud labels."""
    if not ACCURACY:
        return {"message": "No ground truth labels in dataset"}
    return ACCURACY


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------
@app.get("/ping", tags=["Health"])
async def ping():
    """Quick health check."""
    return {
        "status":   "ok",
        "message":  "AURA backend running",
        "accounts": len(ACCOUNTS),
        "alerts":   len(ALERTS),
    }


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
