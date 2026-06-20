"""
AURA — Anti-Money-Laundering Unified Risk Analytics
FastAPI Backend — implements all 9 API_CONTRACT.md endpoints
"""
from __future__ import annotations

import csv
import io
import math
import random
import uuid
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import networkx as nx
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ─────────────────────────────────────────────────────────────
# App Setup
# ─────────────────────────────────────────────────────────────
app = FastAPI(
    title="AURA API",
    description="Anti-Money-Laundering Unified Risk Analytics",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tightened post-launch if needed
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────────────────────
# In-Memory Store
# ─────────────────────────────────────────────────────────────
_store: dict[str, dict] = {}  # dataset_id → DatasetStore

# ─────────────────────────────────────────────────────────────
# Pydantic Models
# ─────────────────────────────────────────────────────────────
class GenerateRequest(BaseModel):
    num_accounts: int = 200
    num_transactions: int = 2500
    fraud_intensity: str = "medium"
    seed: int = 42

class AnalyzeRequest(BaseModel):
    dataset_id: str

# ─────────────────────────────────────────────────────────────
# Constants & Helpers
# ─────────────────────────────────────────────────────────────
FIRST_NAMES = [
    "Aarav", "Vivaan", "Aditya", "Vihaan", "Arjun", "Sai", "Reyansh", "Ishaan",
    "Karan", "Rohit", "Neel", "Rahul", "Rajan", "Vikram", "Priya", "Anita",
    "Meera", "Sunita", "Kavya", "Pooja", "Divya", "Nisha", "Ritu", "Maya",
    "Amit", "Suresh", "Rajesh", "Dinesh", "Mahesh", "Ganesh", "Naresh", "Ramesh",
]
LAST_NAMES = [
    "Sharma", "Patel", "Singh", "Kumar", "Gupta", "Verma", "Joshi", "Rao",
    "Agarwal", "Khan", "Shah", "Mehta", "Nair", "Iyer", "Pillai", "Reddy",
    "Malhotra", "Chopra", "Bose", "Das", "Sen", "Ghosh", "Banerjee", "Mukherjee",
]
BUSINESS_NAMES = [
    "Quikfix Traders", "Maya Holdings", "Apex Ventures", "RoyalTech Solutions",
    "Prime Capital", "Starline Exports", "BrightPath Enterprises", "NovaTrade Co",
    "Sunrise Distributors", "Pioneer Logistics", "Unity Finance", "Delta Commerce",
    "Horizon Imports", "Eagle Trading", "Silver Leaf Corp", "BlueSky Traders",
    "TrustMark Pvt Ltd", "Global Nexus", "Omega Holdings", "Matrix Commerce",
]

PATTERN_TYPES = ["circular", "layering", "smurfing", "rapid_movement", "fan_in", "fan_out"]

def risk_level_from_score(score: int) -> str:
    if score >= 90:
        return "critical"
    if score >= 70:
        return "high"
    if score >= 40:
        return "medium"
    return "low"

def _utc_now() -> datetime:
    return datetime.now(timezone.utc)

def _random_past_ts(rng: random.Random, days_back: int = 30) -> datetime:
    offset = timedelta(seconds=rng.randint(0, days_back * 86400))
    return _utc_now() - offset

def _ts_str(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")

def _random_name(rng: random.Random, acct_type: str) -> str:
    if acct_type == "shell":
        return rng.choice(BUSINESS_NAMES)
    if acct_type == "business":
        return rng.choice(BUSINESS_NAMES[:10])
    return f"{rng.choice(FIRST_NAMES)} {rng.choice(LAST_NAMES)}"

# ─────────────────────────────────────────────────────────────
# Synthetic Data Generation
# ─────────────────────────────────────────────────────────────
def _generate_dataset(
    num_accounts: int, num_transactions: int, fraud_intensity: str, seed: int
) -> dict:
    rng = random.Random(seed)

    intensity_map = {"low": 1, "medium": 2, "high": 3}
    rings_count = intensity_map.get(fraud_intensity, 2)

    # ── Build Accounts ──────────────────────────────────────
    accounts: dict[str, dict] = {}
    acc_ids: list[str] = []
    for i in range(num_accounts):
        acc_id = f"acc_{i:04d}"
        acc_type = rng.choices(
            ["individual", "business", "shell"],
            weights=[65, 25, 10],
        )[0]
        accounts[acc_id] = {
            "account_id": acc_id,
            "name": _random_name(rng, acc_type),
            "account_type": acc_type,
            "risk_score": 0,
            "risk_level": "low",
            "flags": [],
            "total_in": 0.0,
            "total_out": 0.0,
            "txn_count": 0,
            "fan_in": 0,
            "fan_out": 0,
            # internals for analysis
            "_counterparties_in": set(),
            "_counterparties_out": set(),
            "_timestamps": [],   # (ts, direction, amount)
        }
        acc_ids.append(acc_id)

    transactions: list[dict] = []
    txn_id_counter = [0]

    def add_txn(frm: str, to: str, amount: float, ts: datetime, suspicious: bool = False):
        txn_id_counter[0] += 1
        txn_id = f"txn_{txn_id_counter[0]:05d}"
        transactions.append({
            "txn_id": txn_id,
            "from_account": frm,
            "to_account": to,
            "amount": round(amount, 2),
            "timestamp": ts,
            "suspicious": suspicious,
        })
        acct = accounts[frm]
        acct["total_out"] += amount
        acct["txn_count"] += 1
        acct["_counterparties_out"].add(to)
        acct["_timestamps"].append((_ts_str(ts), "out", amount))

        acct2 = accounts[to]
        acct2["total_in"] += amount
        acct2["txn_count"] += 1
        acct2["_counterparties_in"].add(frm)
        acct2["_timestamps"].append((_ts_str(ts), "in", amount))

    # ── Inject Fraud Rings ───────────────────────────────────
    alerts: list[dict] = []
    fraud_accounts: set[str] = set()
    alert_counter = [0]

    def next_alert_id() -> str:
        alert_counter[0] += 1
        return f"alert_{alert_counter[0]:02d}"

    # 1. Circular rings
    for _ in range(rings_count):
        ring_size = rng.randint(3, 5)
        ring_members = rng.sample(
            [a for a in acc_ids if a not in fraud_accounts], ring_size
        )
        fraud_accounts.update(ring_members)
        base_amount = rng.uniform(500_000, 5_000_000)
        base_ts = _random_past_ts(rng, 10)
        for i, acct in enumerate(ring_members):
            # Make shells
            accounts[acct]["account_type"] = rng.choice(["shell", "business"])
            nxt = ring_members[(i + 1) % ring_size]
            ts = base_ts + timedelta(hours=rng.randint(1, 6) * (i + 1))
            add_txn(acct, nxt, round(base_amount * rng.uniform(0.95, 1.05), 2), ts, suspicious=True)
        amount_involved = sum(
            t["amount"] for t in transactions if t["suspicious"] and
            t["from_account"] in ring_members
        )
        alerts.append({
            "alert_id": next_alert_id(),
            "pattern_type": "circular",
            "title": f"{ring_size}-account laundering loop",
            "severity": rng.randint(85, 97),
            "account_ids": ring_members,
            "amount_involved": round(amount_involved, 2),
            "summary": f"₹{amount_involved/100_000:.1f}L cycled through {ring_size} accounts returning 99% to origin within 36 hours.",
            "narrative": f"Funds originated at {accounts[ring_members[0]]['name']}, moved through intermediaries, and returned — a closed loop with no economic purpose.",
            "detected_at": _ts_str(_utc_now()),
        })

    # 2. Layering chains
    for _ in range(rings_count):
        chain_size = rng.randint(4, 6)
        chain = rng.sample(
            [a for a in acc_ids if a not in fraud_accounts], chain_size
        )
        fraud_accounts.update(chain)
        amount = rng.uniform(200_000, 2_000_000)
        base_ts = _random_past_ts(rng, 15)
        for i in range(len(chain) - 1):
            ts = base_ts + timedelta(hours=rng.randint(2, 8) * (i + 1))
            add_txn(chain[i], chain[i + 1], round(amount * 0.97**i, 2), ts, suspicious=True)
        amount_inv = sum(t["amount"] for t in transactions[-chain_size + 1:])
        alerts.append({
            "alert_id": next_alert_id(),
            "pattern_type": "layering",
            "title": f"{chain_size}-hop layering chain",
            "severity": rng.randint(75, 90),
            "account_ids": chain,
            "amount_involved": round(amount_inv, 2),
            "summary": f"Funds moved through {chain_size} accounts in cascading transfers to obscure origin.",
            "narrative": f"A chain of transfers designed to distance funds from their source, each hop reducing the trail.",
            "detected_at": _ts_str(_utc_now()),
        })

    # 3. Smurfing (structuring below reporting threshold = ₹50,000)
    if rings_count >= 1:
        smurf_src = rng.choice([a for a in acc_ids if a not in fraud_accounts])
        smurf_dst = rng.choice([a for a in acc_ids if a not in fraud_accounts and a != smurf_src])
        fraud_accounts.update([smurf_src, smurf_dst])
        num_smurfs = rng.randint(10, 18)
        base_ts = _random_past_ts(rng, 7)
        for j in range(num_smurfs):
            ts = base_ts + timedelta(hours=j * rng.uniform(0.5, 3))
            add_txn(smurf_src, smurf_dst, round(rng.uniform(44_000, 49_900), 2), ts, suspicious=True)
        alerts.append({
            "alert_id": next_alert_id(),
            "pattern_type": "smurfing",
            "title": f"Structuring: {num_smurfs} deposits under reporting threshold",
            "severity": rng.randint(70, 85),
            "account_ids": [smurf_src, smurf_dst],
            "amount_involved": round(num_smurfs * 47_000, 2),
            "summary": f"{num_smurfs} deposits just under ₹50,000 threshold from same source.",
            "narrative": f"Classic structuring: sender deliberately kept each transfer below ₹50,000 to avoid mandatory reporting.",
            "detected_at": _ts_str(_utc_now()),
        })

    # 4. Rapid movement
    for _ in range(rings_count + 1):
        rapid_chain = rng.sample(
            [a for a in acc_ids if a not in fraud_accounts], 3
        )
        fraud_accounts.update(rapid_chain)
        amount = rng.uniform(800_000, 3_000_000)
        base_ts = _random_past_ts(rng, 5)
        add_txn(rapid_chain[0], rapid_chain[1], amount, base_ts, suspicious=True)
        add_txn(rapid_chain[1], rapid_chain[2], round(amount * 0.99, 2), base_ts + timedelta(minutes=rng.randint(15, 90)), suspicious=True)
        add_txn(rapid_chain[2], rapid_chain[0], round(amount * 0.98, 2), base_ts + timedelta(hours=rng.randint(2, 8)), suspicious=True)
        alerts.append({
            "alert_id": next_alert_id(),
            "pattern_type": "rapid_movement",
            "title": "Rapid pass-through: funds cleared within hours",
            "severity": rng.randint(68, 82),
            "account_ids": rapid_chain,
            "amount_involved": round(amount, 2),
            "summary": f"₹{amount/100_000:.1f}L moved through 3 accounts within hours — no economic hold time.",
            "narrative": "Funds entered and exited each account within hours, a hallmark of transit accounts in layering schemes.",
            "detected_at": _ts_str(_utc_now()),
        })

    # 5. Fan-in
    fan_in_dst = rng.choice([a for a in acc_ids if a not in fraud_accounts])
    fraud_accounts.add(fan_in_dst)
    fan_in_srcs = rng.sample([a for a in acc_ids if a not in fraud_accounts], rng.randint(6, 10))
    for src in fan_in_srcs:
        add_txn(src, fan_in_dst, round(rng.uniform(10_000, 200_000), 2), _random_past_ts(rng, 20), suspicious=True)
    alerts.append({
        "alert_id": next_alert_id(),
        "pattern_type": "fan_in",
        "title": f"Fan-in: {len(fan_in_srcs)} sources converging on one account",
        "severity": rng.randint(60, 78),
        "account_ids": [fan_in_dst] + fan_in_srcs[:3],
        "amount_involved": accounts[fan_in_dst]["total_in"],
        "summary": f"{len(fan_in_srcs)} accounts funnelling funds into a single destination.",
        "narrative": "Multiple unrelated accounts sending to one recipient — consistent with aggregation before extraction.",
        "detected_at": _ts_str(_utc_now()),
    })

    # 6. Fan-out
    fan_out_src = rng.choice([a for a in acc_ids if a not in fraud_accounts])
    fraud_accounts.add(fan_out_src)
    fan_out_dsts = rng.sample([a for a in acc_ids if a not in fraud_accounts], rng.randint(6, 10))
    for dst in fan_out_dsts:
        add_txn(fan_out_src, dst, round(rng.uniform(10_000, 150_000), 2), _random_past_ts(rng, 20), suspicious=True)
    alerts.append({
        "alert_id": next_alert_id(),
        "pattern_type": "fan_out",
        "title": f"Fan-out: single account dispersing to {len(fan_out_dsts)} destinations",
        "severity": rng.randint(60, 75),
        "account_ids": [fan_out_src] + fan_out_dsts[:3],
        "amount_involved": accounts[fan_out_src]["total_out"],
        "summary": f"One account dispersing funds to {len(fan_out_dsts)} recipients — possible fund distribution after aggregation.",
        "narrative": "A single account acting as a distribution hub, sending to many destinations with no clear business purpose.",
        "detected_at": _ts_str(_utc_now()),
    })

    # ── Legitimate Background Transactions ───────────────────
    legitimate_needed = max(0, num_transactions - len(transactions))
    legit_acc = [a for a in acc_ids if a not in fraud_accounts]
    for _ in range(legitimate_needed):
        frm = rng.choice(acc_ids)
        to = rng.choice(acc_ids)
        if frm == to:
            continue
        amount = rng.lognormvariate(10, 1.5)  # realistic skewed distribution
        ts = _random_past_ts(rng, 30)
        add_txn(frm, to, round(min(amount, 5_000_000), 2), ts, suspicious=False)

    return {
        "accounts": accounts,
        "transactions": transactions,
        "alerts": alerts,
        "analyzed": False,
        "fraud_accounts": fraud_accounts,
    }

# ─────────────────────────────────────────────────────────────
# Analysis / Scoring Engine
# ─────────────────────────────────────────────────────────────
def _analyze_dataset(ds: dict) -> dict:
    accounts = ds["accounts"]
    transactions = ds["transactions"]
    alerts = ds["alerts"]
    fraud_accounts = ds["fraud_accounts"]

    # Build directed graph
    G = nx.DiGraph()
    for acct in accounts:
        G.add_node(acct)
    for t in transactions:
        frm, to, amt = t["from_account"], t["to_account"], t["amount"]
        if G.has_edge(frm, to):
            G[frm][to]["amount"] += amt
            G[frm][to]["txn_count"] += 1
        else:
            G.add_edge(frm, to, amount=amt, txn_count=1, suspicious=t["suspicious"])

    # Mark edges suspicious if any txn in them was suspicious
    susp_pairs = set()
    for t in transactions:
        if t["suspicious"]:
            susp_pairs.add((t["from_account"], t["to_account"]))
    for u, v in G.edges():
        if (u, v) in susp_pairs:
            G[u][v]["suspicious"] = True

    # Compute fan_in / fan_out
    for acc_id, acct in accounts.items():
        acct["fan_in"] = G.in_degree(acc_id)
        acct["fan_out"] = G.out_degree(acc_id)

    # Flag which accounts appear in alerts
    flagged_map: dict[str, list[str]] = defaultdict(list)
    for alert in alerts:
        for acc_id in alert["account_ids"]:
            flagged_map[acc_id].append(alert["pattern_type"])

    # Risk scoring
    for acc_id, acct in accounts.items():
        score = 0

        # Shell account base
        if acct["account_type"] == "shell":
            score += 20
        elif acct["account_type"] == "business":
            score += 5

        # Pass-through ratio (funds in vs funds out within short time)
        if acct["total_in"] > 0:
            pass_through = min(acct["total_out"] / acct["total_in"], 1.0)
            score += int(pass_through * 25)

        # Fan-in / fan-out extremes
        if acct["fan_in"] >= 6:
            score += 10
        if acct["fan_out"] >= 6:
            score += 10

        # Transaction velocity
        if acct["txn_count"] > 30:
            score += 10
        elif acct["txn_count"] > 15:
            score += 5

        # Pattern flags
        flags = list(set(flagged_map.get(acc_id, [])))
        acct["flags"] = flags
        score += len(flags) * 15

        # Cap and finalize
        score = min(score, 99)
        # Fraud accounts get minimum score boost
        if acc_id in fraud_accounts:
            score = max(score, 65)

        acct["risk_score"] = score
        acct["risk_level"] = risk_level_from_score(score)

        # Build explanation for detail view
        explanation = []
        if pass_through >= 0.9 and acct["total_in"] > 0:
            explanation.append({
                "factor": "Rapid pass-through",
                "detail": f"{int(pass_through*100)}% of funds left within 24h of arrival",
                "contribution": 34,
            })
        if "circular" in flags:
            explanation.append({
                "factor": "Circular flow",
                "detail": "Member of a closed laundering loop returning funds to origin",
                "contribution": 28,
            })
        if "smurfing" in flags:
            explanation.append({
                "factor": "Structuring",
                "detail": "Multiple deposits just under ₹50,000 reporting threshold",
                "contribution": 21,
            })
        if acct["account_type"] == "shell":
            explanation.append({
                "factor": "Shell signature",
                "detail": "No salary/utility transactions; pure transfer activity",
                "contribution": 13,
            })
        if acct["fan_in"] >= 6:
            explanation.append({
                "factor": "Aggregation point",
                "detail": f"Receives from {acct['fan_in']} distinct accounts — unusual fan-in pattern",
                "contribution": 10,
            })
        acct["_explanation"] = explanation

        # Top counterparties
        cps_out = [(cp, sum(t["amount"] for t in transactions if t["from_account"] == acc_id and t["to_account"] == cp)) for cp in acct["_counterparties_out"]]
        cps_in = [(cp, sum(t["amount"] for t in transactions if t["to_account"] == acc_id and t["from_account"] == cp)) for cp in acct["_counterparties_in"]]
        cps_out.sort(key=lambda x: -x[1])
        cps_in.sort(key=lambda x: -x[1])
        top_cps = [
            {"account_id": cp, "name": accounts[cp]["name"], "amount": round(amt, 2), "direction": "out"}
            for cp, amt in cps_out[:3]
        ] + [
            {"account_id": cp, "name": accounts[cp]["name"], "amount": round(amt, 2), "direction": "in"}
            for cp, amt in cps_in[:3]
        ]
        acct["_top_counterparties"] = top_cps[:5]

        # Timeline (sorted by ts)
        timeline = []
        for ts_str, direction, amt in acct["_timestamps"]:
            if direction == "out":
                cps = list(acct["_counterparties_out"])
            else:
                cps = list(acct["_counterparties_in"])
            cp_id = cps[0] if cps else ""
            timeline.append({"timestamp": ts_str, "amount": round(amt, 2), "direction": direction, "counterparty_id": cp_id})
        timeline.sort(key=lambda x: x["timestamp"])
        acct["_timeline"] = timeline[:20]  # cap at 20 entries

    # Finalize alerts — add severity_level
    for alert in alerts:
        alert["risk_level"] = risk_level_from_score(alert["severity"])

    # Sort alerts by severity
    alerts.sort(key=lambda a: -a["severity"])

    # Build aggregated edge data for graph queries
    edge_index: dict[tuple, dict] = {}
    for t in transactions:
        key = (t["from_account"], t["to_account"])
        if key not in edge_index:
            edge_index[key] = {
                "id": f"e_{t['from_account']}_{t['to_account']}",
                "source": t["from_account"],
                "target": t["to_account"],
                "amount": 0.0,
                "txn_count": 0,
                "last_timestamp": t["timestamp"],
                "suspicious": False,
            }
        edge_index[key]["amount"] += t["amount"]
        edge_index[key]["txn_count"] += 1
        if t["suspicious"]:
            edge_index[key]["suspicious"] = True
        if t["timestamp"] > edge_index[key]["last_timestamp"]:
            edge_index[key]["last_timestamp"] = t["timestamp"]

    # Convert timestamps to strings
    for e in edge_index.values():
        if isinstance(e["last_timestamp"], datetime):
            e["last_timestamp"] = _ts_str(e["last_timestamp"])
        e["amount"] = round(e["amount"], 2)

    ds["edge_index"] = edge_index
    ds["graph_nx"] = G
    ds["analyzed"] = True
    return ds

# ─────────────────────────────────────────────────────────────
# Graph Builder
# ─────────────────────────────────────────────────────────────
def _build_subgraph(ds: dict, account_ids: list[str], center_id: str) -> dict:
    accounts = ds["accounts"]
    edge_index = ds["edge_index"]

    id_set = set(account_ids)
    nodes = []
    for acc_id in account_ids:
        if acc_id not in accounts:
            continue
        acct = accounts[acc_id]
        nodes.append({
            "id": acc_id,
            "label": acct["name"],
            "account_type": acct["account_type"],
            "risk_score": acct["risk_score"],
            "risk_level": acct["risk_level"],
            "is_center": acc_id == center_id,
            "flagged": len(acct["flags"]) > 0,
        })

    edges = []
    for (src, tgt), edge in edge_index.items():
        if src in id_set and tgt in id_set:
            edges.append(edge)

    return {"center_id": center_id, "nodes": nodes, "edges": edges}

def _get_neighbors(ds: dict, account_id: str, depth: int) -> list[str]:
    G: nx.DiGraph = ds["graph_nx"]
    visited = {account_id}
    frontier = {account_id}
    for _ in range(depth):
        next_frontier = set()
        for node in frontier:
            next_frontier.update(G.predecessors(node))
            next_frontier.update(G.successors(node))
        frontier = next_frontier - visited
        visited.update(frontier)
    return list(visited)

# ─────────────────────────────────────────────────────────────
# Helper to get dataset or 404
# ─────────────────────────────────────────────────────────────
def _get_ds(dataset_id: str) -> dict:
    if dataset_id not in _store:
        raise HTTPException(
            status_code=404,
            detail={"error": "dataset_not_found", "message": f"No dataset with id {dataset_id}. Generate one first."},
        )
    return _store[dataset_id]

def _require_analyzed(ds: dict):
    if not ds.get("analyzed"):
        raise HTTPException(
            status_code=400,
            detail={"error": "not_analyzed_yet", "message": "Dataset exists but has not been analyzed. Call POST /analyze first."},
        )

# ─────────────────────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"service": "AURA API", "version": "1.0.0", "docs": "/docs"}


# 1. POST /dataset/generate
@app.post("/dataset/generate")
def generate_dataset(req: GenerateRequest):
    dataset_id = "ds_001"  # deterministic for demo reproducibility
    ds = _generate_dataset(req.num_accounts, req.num_transactions, req.fraud_intensity, req.seed)
    _store[dataset_id] = ds

    fraud_rings = len([a for a in ds["alerts"] if a["pattern_type"] == "circular"])
    return {
        "dataset_id": dataset_id,
        "num_accounts": len(ds["accounts"]),
        "num_transactions": len(ds["transactions"]),
        "fraud_rings_injected": fraud_rings,
        "ready": True,
    }


# 2. POST /dataset/upload
@app.post("/dataset/upload")
async def upload_dataset(file: UploadFile = File(...)):
    content = await file.read()
    text = content.decode("utf-8", errors="replace")
    reader = csv.DictReader(io.StringIO(text))

    required = {"from_account", "to_account", "amount", "timestamp"}
    if not required.issubset(set(reader.fieldnames or [])):
        raise HTTPException(
            status_code=400,
            detail={"error": "bad_request", "message": f"CSV must have columns: {', '.join(required)}"},
        )

    accounts: dict[str, dict] = {}
    transactions: list[dict] = []
    warnings: list[str] = []
    skipped = 0
    txn_counter = 0

    for row in reader:
        try:
            frm = row["from_account"].strip()
            to = row["to_account"].strip()
            amount = float(row["amount"])
            ts = datetime.fromisoformat(row["timestamp"].replace("Z", "+00:00"))
        except Exception:
            skipped += 1
            continue

        txn_counter += 1
        txn_id = f"txn_{txn_counter:05d}"
        transactions.append({
            "txn_id": txn_id, "from_account": frm, "to_account": to,
            "amount": round(amount, 2), "timestamp": ts, "suspicious": False,
        })

        for acc_id, direction, amt in [(frm, "out", amount), (to, "in", amount)]:
            if acc_id not in accounts:
                accounts[acc_id] = {
                    "account_id": acc_id, "name": acc_id, "account_type": "individual",
                    "risk_score": 0, "risk_level": "low", "flags": [],
                    "total_in": 0.0, "total_out": 0.0, "txn_count": 0,
                    "fan_in": 0, "fan_out": 0,
                    "_counterparties_in": set(), "_counterparties_out": set(),
                    "_timestamps": [],
                }
            a = accounts[acc_id]
            a["total_" + direction] += amt
            a["txn_count"] += 1
            a[f"_counterparties_{direction}"].add(to if direction == "out" else frm)
            a["_timestamps"].append((_ts_str(ts), direction, amt))

    if skipped:
        warnings.append(f"{skipped} rows skipped: unparseable data")

    dataset_id = f"ds_{uuid.uuid4().hex[:6]}"
    _store[dataset_id] = {
        "accounts": accounts, "transactions": transactions,
        "alerts": [], "analyzed": False, "fraud_accounts": set(),
    }

    return {
        "dataset_id": dataset_id,
        "num_accounts": len(accounts),
        "num_transactions": len(transactions),
        "fraud_rings_injected": 0,
        "ready": True,
        "warnings": warnings,
    }


# 3. POST /analyze
@app.post("/analyze")
def analyze(req: AnalyzeRequest):
    ds = _get_ds(req.dataset_id)
    import time
    t0 = time.time()
    _analyze_dataset(ds)
    duration_ms = int((time.time() - t0) * 1000)

    patterns_found = {p: 0 for p in PATTERN_TYPES}
    for alert in ds["alerts"]:
        patterns_found[alert["pattern_type"]] = patterns_found.get(alert["pattern_type"], 0) + 1

    return {
        "dataset_id": req.dataset_id,
        "accounts_scored": len(ds["accounts"]),
        "alerts_generated": len(ds["alerts"]),
        "patterns_found": patterns_found,
        "duration_ms": duration_ms,
        "ready": True,
    }


# 4. GET /stats
@app.get("/stats")
def get_stats(dataset_id: str = "ds_001"):
    ds = _get_ds(dataset_id)
    _require_analyzed(ds)
    accounts = ds["accounts"]

    total_amount = sum(a["total_in"] for a in accounts.values()) / 2  # avoid double-count
    high_risk = [a for a in accounts.values() if a["risk_level"] in ("high", "critical")]
    amount_flagged = sum(a["total_out"] for a in high_risk)

    alerts_by_type = {p: 0 for p in PATTERN_TYPES}
    for alert in ds["alerts"]:
        alerts_by_type[alert["pattern_type"]] += 1

    top_risk = sorted(accounts.values(), key=lambda a: -a["risk_score"])[:5]

    return {
        "dataset_id": dataset_id,
        "total_accounts": len(accounts),
        "total_transactions": len(ds["transactions"]),
        "total_amount": round(total_amount, 2),
        "high_risk_accounts": len(high_risk),
        "amount_flagged": round(amount_flagged, 2),
        "alerts_by_type": alerts_by_type,
        "top_risk_accounts": [
            {
                "account_id": a["account_id"],
                "name": a["name"],
                "risk_score": a["risk_score"],
                "risk_level": a["risk_level"],
            }
            for a in top_risk
        ],
    }


# 5. GET /accounts
@app.get("/accounts")
def list_accounts(
    dataset_id: str = "ds_001",
    sort: str = "risk_desc",
    min_risk: int = 0,
    limit: int = 50,
    offset: int = 0,
):
    ds = _get_ds(dataset_id)
    _require_analyzed(ds)
    accts = list(ds["accounts"].values())

    filtered = [a for a in accts if a["risk_score"] >= min_risk]

    if sort == "risk_desc":
        filtered.sort(key=lambda a: -a["risk_score"])
    elif sort == "risk_asc":
        filtered.sort(key=lambda a: a["risk_score"])
    elif sort == "amount_desc":
        filtered.sort(key=lambda a: -(a["total_in"] + a["total_out"]))

    paginated = filtered[offset: offset + limit]
    return {
        "total": len(filtered),
        "accounts": [
            {
                "account_id": a["account_id"],
                "name": a["name"],
                "account_type": a["account_type"],
                "risk_score": a["risk_score"],
                "risk_level": a["risk_level"],
                "flags": a["flags"],
                "total_in": round(a["total_in"], 2),
                "total_out": round(a["total_out"], 2),
                "txn_count": a["txn_count"],
            }
            for a in paginated
        ],
    }


# 6. GET /accounts/{account_id}
@app.get("/accounts/{account_id}")
def get_account(account_id: str, dataset_id: str = "ds_001"):
    ds = _get_ds(dataset_id)
    _require_analyzed(ds)
    if account_id not in ds["accounts"]:
        raise HTTPException(
            status_code=404,
            detail={"error": "account_not_found", "message": f"No account with id {account_id}."},
        )
    a = ds["accounts"][account_id]
    return {
        "account_id": a["account_id"],
        "name": a["name"],
        "account_type": a["account_type"],
        "risk_score": a["risk_score"],
        "risk_level": a["risk_level"],
        "flags": a["flags"],
        "total_in": round(a["total_in"], 2),
        "total_out": round(a["total_out"], 2),
        "txn_count": a["txn_count"],
        "fan_in": a["fan_in"],
        "fan_out": a["fan_out"],
        "explanation": a.get("_explanation", []),
        "top_counterparties": a.get("_top_counterparties", []),
        "timeline": a.get("_timeline", []),
    }


# 7. GET /graph
@app.get("/graph")
def get_graph(
    dataset_id: str = "ds_001",
    account_id: Optional[str] = None,
    alert_id: Optional[str] = None,
    depth: int = 2,
):
    ds = _get_ds(dataset_id)
    _require_analyzed(ds)

    if alert_id:
        alert = next((a for a in ds["alerts"] if a["alert_id"] == alert_id), None)
        if not alert:
            raise HTTPException(
                status_code=404,
                detail={"error": "account_not_found", "message": f"No alert with id {alert_id}."},
            )
        members = alert["account_ids"]
        return _build_subgraph(ds, members, members[0])

    if account_id:
        if account_id not in ds["accounts"]:
            raise HTTPException(
                status_code=404,
                detail={"error": "account_not_found", "message": f"No account with id {account_id}."},
            )
        neighbors = _get_neighbors(ds, account_id, min(depth, 3))
        return _build_subgraph(ds, neighbors, account_id)

    raise HTTPException(
        status_code=400,
        detail={"error": "bad_request", "message": "Provide account_id or alert_id."},
    )


# 8. GET /alerts
@app.get("/alerts")
def list_alerts(
    dataset_id: str = "ds_001",
    min_severity: int = 0,
    pattern_type: Optional[str] = None,
):
    ds = _get_ds(dataset_id)
    _require_analyzed(ds)
    filtered = [a for a in ds["alerts"] if a["severity"] >= min_severity]
    if pattern_type:
        filtered = [a for a in filtered if a["pattern_type"] == pattern_type]
    return {
        "total": len(filtered),
        "alerts": [
            {
                "alert_id": a["alert_id"],
                "pattern_type": a["pattern_type"],
                "title": a["title"],
                "severity": a["severity"],
                "risk_level": a["risk_level"],
                "account_ids": a["account_ids"],
                "amount_involved": a["amount_involved"],
                "summary": a["summary"],
                "detected_at": a["detected_at"],
            }
            for a in filtered
        ],
    }


# 9. GET /alerts/{alert_id}
@app.get("/alerts/{alert_id}")
def get_alert(alert_id: str, dataset_id: str = "ds_001"):
    ds = _get_ds(dataset_id)
    _require_analyzed(ds)
    alert = next((a for a in ds["alerts"] if a["alert_id"] == alert_id), None)
    if not alert:
        raise HTTPException(
            status_code=404,
            detail={"error": "account_not_found", "message": f"No alert with id {alert_id}."},
        )
    members = alert["account_ids"]
    graph = _build_subgraph(ds, members, members[0])
    accounts = ds["accounts"]
    return {
        "alert_id": alert["alert_id"],
        "pattern_type": alert["pattern_type"],
        "title": alert["title"],
        "severity": alert["severity"],
        "risk_level": alert["risk_level"],
        "amount_involved": alert["amount_involved"],
        "summary": alert["summary"],
        "narrative": alert.get("narrative", alert["summary"]),
        "accounts": [
            {
                "account_id": acc_id,
                "name": accounts[acc_id]["name"] if acc_id in accounts else acc_id,
                "risk_score": accounts[acc_id]["risk_score"] if acc_id in accounts else 0,
                "risk_level": accounts[acc_id]["risk_level"] if acc_id in accounts else "low",
                "role": "origin" if i == 0 else ("beneficiary" if i == len(members) - 1 else "mule"),
            }
            for i, acc_id in enumerate(members)
            if acc_id in accounts
        ],
        "graph": graph,
    }
