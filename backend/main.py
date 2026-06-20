import time
from fastapi import FastAPI, HTTPException, UploadFile, File, Query, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from typing import List, Dict, Any, Optional
import io
import csv
from datetime import datetime

from backend.models import (
    GenerateDatasetRequest, GenerateDatasetResponse,
    UploadDatasetResponse, AnalyzeRequest, AnalyzeResponse,
    StatsResponse, TopRiskAccount, AccountsListResponse, AccountSummary,
    AccountDetailResponse, ExplanationFactor, CounterpartySummary, TimelineItem,
    GraphResponse, GraphNode, GraphEdge, AlertsListResponse, AlertSummary,
    AlertAccountInfo, AlertDetailResponse, ErrorResponse,
    LoadRealDatasetRequest
)
from backend.store import DATASETS, DatasetState
from backend.generator import generate_synthetic_dataset
from backend.engine.features import compute_features
from backend.engine.anomaly import compute_anomaly_scores
from backend.engine.patterns import detect_patterns
from backend.engine.risk import fuse_risk_scores

import os

app = FastAPI(
    title="AURA API — Anti-money-laundering Unified Risk Analytics",
    description="Backend API exposing synthetic generation, unsupervised anomaly detection, and graph analytics.",
    version="1.0.0",
    root_path="/api" if os.environ.get("VERCEL") else ""
)

# CORS Configuration - essential for frontend connectivity
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Seed default dataset on startup so the UI works immediately
try:
    print("[AURA] Seeding default dataset 'ds_001' on startup...")
    default_state = generate_synthetic_dataset(num_accounts=150, num_transactions=1400, fraud_intensity="medium", seed=42)
    default_state.dataset_id = "ds_001"
    
    # Run analysis
    features_df = compute_features(default_state.accounts, default_state.transactions)
    anomaly_scores = compute_anomaly_scores(features_df)
    alerts = detect_patterns(default_state.accounts, default_state.transactions, features_df)
    
    # Format alerts as dict for storage
    alerts_dict = {}
    for alert in alerts:
        alerts_dict[alert["alert_id"]] = alert
        
    # Fuse risk
    risk_results = fuse_risk_scores(features_df, anomaly_scores, alerts)
    
    # Compute stats
    total_amount = sum(float(t["amount"]) for t in default_state.transactions)
    high_risk_accounts = sum(1 for acc in risk_results.values() if acc["risk_score"] >= 70)
    amount_flagged = sum(a["amount_involved"] for a in alerts)
    
    patterns_found = {
        "circular": 0, "layering": 0, "smurfing": 0,
        "rapid_movement": 0, "fan_in": 0, "fan_out": 0
    }
    for alert in alerts:
        ptype = alert["pattern_type"]
        if ptype in patterns_found:
            patterns_found[ptype] += 1
            
    default_state.stats = {
        "dataset_id": default_state.dataset_id,
        "total_accounts": len(default_state.accounts),
        "total_transactions": len(default_state.transactions),
        "total_amount": round(total_amount, 2),
        "high_risk_accounts": high_risk_accounts,
        "amount_flagged": round(amount_flagged, 2),
        "alerts_by_type": patterns_found
    }
    
    default_state.features_df = features_df
    default_state.accounts_scored = risk_results
    default_state.alerts = alerts_dict
    default_state.analyzed = True
    
    DATASETS["ds_001"] = default_state
    print("[AURA] Default dataset 'ds_001' successfully seeded.")
except Exception as e:
    print(f"[AURA] Warning: Error seeding default dataset on startup: {e}")

# Exception handlers for clean JSON errors matching API Contract
@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    # If the detail is a dict, parse it directly, otherwise treat as simple string
    error_code = "bad_request"
    message = str(exc.detail)
    
    if isinstance(exc.detail, dict):
        error_code = exc.detail.get("error", "bad_request")
        message = exc.detail.get("message", message)
        
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": error_code, "message": message}
    )

# Helper to fetch dataset state
def get_dataset(dataset_id: str) -> DatasetState:
    if not dataset_id:
        raise HTTPException(
            status_code=400,
            detail={"error": "bad_request", "message": "dataset_id parameter is required."}
        )
    if dataset_id not in DATASETS:
        raise HTTPException(
            status_code=404,
            detail={"error": "dataset_not_found", "message": f"No dataset with id {dataset_id}. Generate one first."}
        )
    return DATASETS[dataset_id]

# --- Endpoints ---

# 1. POST /dataset/generate
@app.post("/dataset/generate", response_model=GenerateDatasetResponse)
def generate_dataset(req: GenerateDatasetRequest = None):
    if req is None:
        req = GenerateDatasetRequest()
        
    # Generate dataset
    state = generate_synthetic_dataset(
        num_accounts=req.num_accounts,
        num_transactions=req.num_transactions,
        fraud_intensity=req.fraud_intensity,
        seed=req.seed
    )
    
    # Store globally
    DATASETS[state.dataset_id] = state
    
    return GenerateDatasetResponse(
        dataset_id=state.dataset_id,
        num_accounts=len(state.accounts),
        num_transactions=len(state.transactions),
        fraud_rings_injected=len(state.ground_truth_rings),
        ready=True
    )

# New Endpoint: POST /dataset/load_real
@app.post("/dataset/load_real", response_model=UploadDatasetResponse)
def load_real_dataset(req: LoadRealDatasetRequest = None):
    if req is None:
        req = LoadRealDatasetRequest()
        
    import os
    if not os.path.exists(req.file_path):
        raise HTTPException(
            status_code=404,
            detail={"error": "file_not_found", "message": f"Real dataset file not found at {req.file_path}."}
        )
        
    dataset_id = f"ds_real_{int(time.time()) % 1000:03d}"
    state = DatasetState(dataset_id)
    
    # Streaming parser to sample file and prioritize fraud
    import json
    limit = req.limit
    max_fraud = int(limit * req.fraud_priority_ratio)
    
    fraud_txns = []
    normal_txns = []
    warnings = []
    
    try:
        with open(req.file_path, "r", encoding="utf-8") as f:
            # Skip opening bracket
            char = f.read(1)
            while char and char != '[':
                char = f.read(1)
                
            buffer = []
            in_object = False
            
            for line in f:
                stripped = line.strip()
                if stripped == "{" or stripped == "{,":
                    in_object = True
                    buffer = ["{"]
                elif in_object:
                    buffer.append(line)
                    if stripped == "}" or stripped == "}," or stripped == "},":
                        in_object = False
                        obj_str = "".join(buffer).rstrip(" \t\r\n,")
                        try:
                            txn = json.loads(obj_str)
                            is_fraud = txn.get("is_fraud", False)
                            
                            mapped_txn = {
                                "txn_id": txn.get("transaction_id", f"txn_{len(fraud_txns) + len(normal_txns) + 1}"),
                                "from_account": txn.get("sender_account"),
                                "to_account": txn.get("receiver_account"),
                                "amount": float(txn.get("amount", 0.0)),
                                "timestamp": txn.get("timestamp"),
                                "transaction_type": txn.get("transaction_type", "transfer"),
                                "location": txn.get("location"),
                                "device_used": txn.get("device_used"),
                                "ip_address": txn.get("ip_address"),
                                "is_fraud": bool(is_fraud)
                            }
                            
                            try:
                                ts_str = mapped_txn["timestamp"]
                                if ts_str:
                                    dt = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
                                    mapped_txn["timestamp"] = dt.strftime("%Y-%m-%dT%H:%M:%SZ")
                            except ValueError:
                                pass
                                
                            if not mapped_txn["from_account"] or not mapped_txn["to_account"]:
                                continue
                                
                            if is_fraud:
                                if len(fraud_txns) < max_fraud:
                                    fraud_txns.append(mapped_txn)
                                    state.ground_truth_dirty_accounts.add(mapped_txn["from_account"])
                                    state.ground_truth_dirty_accounts.add(mapped_txn["to_account"])
                            else:
                                if len(normal_txns) < limit:
                                    normal_txns.append(mapped_txn)
                        except Exception as e:
                            warnings.append(f"Skipped invalid transaction JSON: {str(e)}")
                        buffer = []
                        
                if len(fraud_txns) >= max_fraud and len(normal_txns) >= limit - len(fraud_txns):
                    break
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"error": "ingestion_failed", "message": f"Error reading dataset file: {str(e)}"}
        )
        
    state.transactions = (fraud_txns + normal_txns[:limit - len(fraud_txns)])[:limit]
    
    # Populate accounts in DatasetState
    for txn in state.transactions:
        from_acc = txn["from_account"]
        to_acc = txn["to_account"]
        
        for acc in [from_acc, to_acc]:
            if acc not in state.accounts:
                state.accounts[acc] = {
                    "account_id": acc,
                    "name": f"Account {acc}",
                    "account_type": "shell" if acc in state.ground_truth_dirty_accounts else "individual",
                    "initial_balance": 500000.0
                }
                
    fraud_rings_injected = sum(1 for t in state.transactions if t.get("is_fraud"))
    
    DATASETS[dataset_id] = state
    
    return UploadDatasetResponse(
        dataset_id=dataset_id,
        num_accounts=len(state.accounts),
        num_transactions=len(state.transactions),
        fraud_rings_injected=fraud_rings_injected,
        ready=True,
        warnings=warnings[:10]
    )

# 2. POST /dataset/upload
@app.post("/dataset/upload", response_model=UploadDatasetResponse)
async def upload_dataset(file: UploadFile = File(...)):
    content = await file.read()
    decoded = content.decode('utf-8')
    csv_reader = csv.reader(io.StringIO(decoded))
    
    # Read headers
    try:
        headers = next(csv_reader)
        # Strip whitespaces and force lowercase for flexible matching
        headers = [h.strip().lower() for h in headers]
    except StopIteration:
        raise HTTPException(
            status_code=400,
            detail={"error": "bad_request", "message": "Uploaded CSV file is empty."}
        )
        
    required_cols = ["from_account", "to_account", "amount", "timestamp"]
    for col in required_cols:
        if col not in headers:
            raise HTTPException(
                status_code=400,
                detail={"error": "bad_request", "message": f"Missing required column: {col} in CSV headers."}
            )
            
    # Map column headers to indices
    idx_from = headers.index("from_account")
    idx_to = headers.index("to_account")
    idx_amt = headers.index("amount")
    idx_ts = headers.index("timestamp")
    
    dataset_id = f"ds_{int(time.time()) % 1000:03d}"
    state = DatasetState(dataset_id)
    
    warnings = []
    row_count = 0
    txn_id_counter = 1
    
    for row_idx, row in enumerate(csv_reader, start=2):
        if not row:
            continue
        if len(row) < len(required_cols):
            warnings.append(f"Row {row_idx} skipped: Insufficient columns.")
            continue
            
        from_acc = row[idx_from].strip()
        to_acc = row[idx_to].strip()
        amount_str = row[idx_amt].strip()
        ts_str = row[idx_ts].strip()
        
        # Validation checks
        if not from_acc or not to_acc:
            warnings.append(f"Row {row_idx} skipped: Empty account identifier.")
            continue
            
        try:
            amount = float(amount_str)
            if amount <= 0:
                warnings.append(f"Row {row_idx} skipped: Non-positive amount.")
                continue
        except ValueError:
            warnings.append(f"Row {row_idx} skipped: Unparseable amount '{amount_str}'.")
            continue
            
        # Parse timestamp
        try:
            # Check format
            dt = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
            formatted_ts = dt.strftime("%Y-%m-%dT%H:%M:%SZ")
        except ValueError:
            warnings.append(f"Row {row_idx} skipped: Unparseable timestamp '{ts_str}'.")
            continue
            
        # Add accounts to dataset state if not present
        for acc in [from_acc, to_acc]:
            if acc not in state.accounts:
                state.accounts[acc] = {
                    "account_id": acc,
                    "name": f"Account {acc}",
                    "account_type": "individual", # Default type
                    "initial_balance": 100000.0
                }
                
        state.transactions.append({
            "txn_id": f"txn_{txn_id_counter:05d}",
            "from_account": from_acc,
            "to_account": to_acc,
            "amount": amount,
            "timestamp": formatted_ts
        })
        txn_id_counter += 1
        row_count += 1
        
    if row_count == 0:
        raise HTTPException(
            status_code=400,
            detail={"error": "bad_request", "message": "No valid transaction rows found in CSV."}
        )
        
    DATASETS[dataset_id] = state
    
    return UploadDatasetResponse(
        dataset_id=dataset_id,
        num_accounts=len(state.accounts),
        num_transactions=len(state.transactions),
        fraud_rings_injected=0,
        ready=True,
        warnings=warnings
    )

# 3. POST /analyze
@app.post("/analyze", response_model=AnalyzeResponse)
def analyze_dataset(req: AnalyzeRequest):
    state = get_dataset(req.dataset_id)
    
    start_time = time.time()
    
    # 1. Feature Engineering
    features_df = compute_features(state.accounts, state.transactions)
    
    # 2. Anomaly Scoring
    anomaly_scores = compute_anomaly_scores(features_df)
    
    # 3. Pattern Detection (Graph alerts)
    alerts = detect_patterns(state.accounts, state.transactions, features_df)
    
    # 4. Score Fusion & Explanations
    risk_results = fuse_risk_scores(features_df, anomaly_scores, alerts)
    
    # Save back to state
    state.accounts_scored = risk_results
    state.alerts = {alert["alert_id"]: alert for alert in alerts}
    state.analyzed = True
    
    # Pre-cache stats
    total_amount = sum(float(t["amount"]) for t in state.transactions)
    high_risk_accounts = sum(1 for acc in risk_results.values() if acc["risk_score"] >= 70)
    
    # Amount flagged: sum of involved alert volumes (deduplicating transaction overlaps if needed,
    # but simplest is sum of alert amount_involved)
    amount_flagged = sum(a["amount_involved"] for a in alerts)
    
    # Counters for patterns_found (fill all 6 keys)
    patterns_found = {
        "circular": 0, "layering": 0, "smurfing": 0,
        "rapid_movement": 0, "fan_in": 0, "fan_out": 0
    }
    for alert in alerts:
        ptype = alert["pattern_type"]
        if ptype in patterns_found:
            patterns_found[ptype] += 1
            
    state.stats = {
        "dataset_id": state.dataset_id,
        "total_accounts": len(state.accounts),
        "total_transactions": len(state.transactions),
        "total_amount": round(total_amount, 2),
        "high_risk_accounts": high_risk_accounts,
        "amount_flagged": round(amount_flagged, 2),
        "alerts_by_type": patterns_found
    }
    
    # Calculate precision/recall against ground truth for developers console
    if state.ground_truth_dirty_accounts:
        tp = 0
        fp = 0
        fn = 0
        for acc_id, acc_info in state.accounts_scored.items():
            is_dirty = acc_id in state.ground_truth_dirty_accounts
            is_flagged = acc_info["risk_score"] >= 70
            
            if is_flagged and is_dirty:
                tp += 1
            elif is_flagged and not is_dirty:
                fp += 1
            elif not is_flagged and is_dirty:
                fn += 1
                
        precision = (tp / (tp + fp)) * 100 if (tp + fp) > 0 else 0.0
        recall = (tp / (tp + fn)) * 100 if (tp + fn) > 0 else 0.0
        
        print("\n" + "="*50)
        print(f"ANALYTICS ENGINE REPORT (Dataset: {state.dataset_id})")
        print("-"*50)
        print(f"Ground Truth Dirty Accounts Injected: {len(state.ground_truth_dirty_accounts)}")
        print(f"True Positives (Flagged & Dirty)  : {tp}")
        print(f"False Positives (Flagged & Clean) : {fp}")
        print(f"False Negatives (Missed & Dirty)  : {fn}")
        print(f"Precision                         : {precision:.2f}%")
        print(f"Recall (Fraud Ring Recovery Rate) : {recall:.2f}%")
        print("="*50 + "\n")
        
    duration_ms = int((time.time() - start_time) * 1000)
    
    return AnalyzeResponse(
        dataset_id=state.dataset_id,
        accounts_scored=len(state.accounts_scored),
        alerts_generated=len(state.alerts),
        patterns_found=patterns_found,
        duration_ms=duration_ms,
        ready=True
    )

# 4. GET /stats
@app.get("/stats", response_model=StatsResponse)
def get_stats(dataset_id: str):
    state = get_dataset(dataset_id)
    if not state.analyzed:
        raise HTTPException(
            status_code=400,
            detail={"error": "not_analyzed_yet", "message": "Dataset has not been analyzed yet. Call /analyze first."}
        )
        
    # Compile Top Risk Accounts (max 5)
    top_accounts_list = []
    for acc_id, info in state.accounts_scored.items():
        top_accounts_list.append(TopRiskAccount(
            account_id=acc_id,
            name=state.accounts[acc_id]["name"],
            risk_score=info["risk_score"],
            risk_level=info["risk_level"]
        ))
    # Sort by risk score desc
    top_accounts_list.sort(key=lambda x: x.risk_score, reverse=True)
    top_5 = top_accounts_list[:5]
    
    return StatsResponse(
        dataset_id=state.dataset_id,
        total_accounts=state.stats["total_accounts"],
        total_transactions=state.stats["total_transactions"],
        total_amount=state.stats["total_amount"],
        high_risk_accounts=state.stats["high_risk_accounts"],
        amount_flagged=state.stats["amount_flagged"],
        alerts_by_type=state.stats["alerts_by_type"],
        top_risk_accounts=top_5
    )

# 5. GET /accounts
@app.get("/accounts", response_model=AccountsListResponse)
def get_accounts(
    dataset_id: str,
    sort: str = "risk_desc",
    min_risk: int = 0,
    limit: int = 50,
    offset: int = 0
):
    state = get_dataset(dataset_id)
    if not state.analyzed:
        raise HTTPException(
            status_code=400,
            detail={"error": "not_analyzed_yet", "message": "Dataset has not been analyzed yet. Call /analyze first."}
        )
        
    # Build full list first
    full_list = []
    
    # Calculate account specific transactions totals
    # (Since we already did this in features.py, let's cache and extract it, or quick aggregate here)
    totals_in = {}
    totals_out = {}
    counts = {}
    for t in state.transactions:
        u, v, amt = t["from_account"], t["to_account"], float(t["amount"])
        totals_out[u] = totals_out.get(u, 0.0) + amt
        totals_in[v] = totals_in.get(v, 0.0) + amt
        counts[u] = counts.get(u, 0) + 1
        counts[v] = counts.get(v, 0) + 1
        
    for acc_id, risk_info in state.accounts_scored.items():
        if risk_info["risk_score"] < min_risk:
            continue
            
        full_list.append(AccountSummary(
            account_id=acc_id,
            name=state.accounts[acc_id]["name"],
            account_type=state.accounts[acc_id]["account_type"],
            risk_score=risk_info["risk_score"],
            risk_level=risk_info["risk_level"],
            flags=risk_info["flags"],
            total_in=round(totals_in.get(acc_id, 0.0), 2),
            total_out=round(totals_out.get(acc_id, 0.0), 2),
            txn_count=counts.get(acc_id, 0)
        ))
        
    # Sort
    if sort == "risk_desc":
        full_list.sort(key=lambda x: x.risk_score, reverse=True)
    elif sort == "risk_asc":
        full_list.sort(key=lambda x: x.risk_score)
    elif sort == "amount_desc":
        full_list.sort(key=lambda x: x.total_in + x.total_out, reverse=True)
        
    total_count = len(full_list)
    paginated = full_list[offset : offset + limit]
    
    return AccountsListResponse(
        total=total_count,
        accounts=paginated
    )

# 6. GET /accounts/{account_id}
@app.get("/accounts/{account_id}", response_model=AccountDetailResponse)
def get_account_detail(account_id: str, dataset_id: str):
    state = get_dataset(dataset_id)
    if not state.analyzed:
        raise HTTPException(
            status_code=400,
            detail={"error": "not_analyzed_yet", "message": "Dataset has not been analyzed yet. Call /analyze first."}
        )
    if account_id not in state.accounts:
        raise HTTPException(
            status_code=404,
            detail={"error": "account_not_found", "message": f"Account with id {account_id} does not exist."}
        )
        
    acc = state.accounts[account_id]
    risk_info = state.accounts_scored[account_id]
    
    # Calculate counts, counterparties, timeline
    counterparties = {}
    timeline = []
    
    fan_in_set = set()
    fan_out_set = set()
    total_in = 0.0
    total_out = 0.0
    txn_count = 0
    
    for t in state.transactions:
        u, v, amt = t["from_account"], t["to_account"], float(t["amount"])
        if u == account_id or v == account_id:
            txn_count += 1
            direction = "out" if u == account_id else "in"
            other_id = v if u == account_id else u
            
            # Fan set
            if direction == "in":
                fan_in_set.add(other_id)
                total_in += amt
            else:
                fan_out_set.add(other_id)
                total_out += amt
                
            # Counterparty aggregation
            if other_id not in counterparties:
                counterparties[other_id] = {"in": 0.0, "out": 0.0}
            counterparties[other_id][direction] += amt
            
            # Timeline list
            timeline.append(TimelineItem(
                timestamp=t["timestamp"],
                amount=amt,
                direction=direction,
                counterparty_id=other_id,
                transaction_type=t.get("transaction_type"),
                location=t.get("location"),
                device_used=t.get("device_used"),
                ip_address=t.get("ip_address")
            ))
            
    # Format counterparties (combine directions or show dominant? shape expects amount + direction)
    # The API contract has counterparties list:
    # {"account_id", "name", "amount", "direction"}
    cp_list = []
    for other_id, amts in counterparties.items():
        name = state.accounts.get(other_id, {}).get("name", f"Account {other_id}")
        if amts["in"] > 0:
            cp_list.append(CounterpartySummary(
                account_id=other_id,
                name=name,
                amount=round(amts["in"], 2),
                direction="in"
            ))
        if amts["out"] > 0:
            cp_list.append(CounterpartySummary(
                account_id=other_id,
                name=name,
                amount=round(amts["out"], 2),
                direction="out"
            ))
            
    # Sort counterparties by amount desc
    cp_list.sort(key=lambda x: x.amount, reverse=True)
    
    # Sort timeline: oldest first (API contract note: timeline is sorted oldest-first)
    timeline.sort(key=lambda x: x.timestamp)
    
    return AccountDetailResponse(
        account_id=account_id,
        name=acc["name"],
        account_type=acc["account_type"],
        risk_score=risk_info["risk_score"],
        risk_level=risk_info["risk_level"],
        flags=risk_info["flags"],
        total_in=round(total_in, 2),
        total_out=round(total_out, 2),
        txn_count=txn_count,
        fan_in=len(fan_in_set),
        fan_out=len(fan_out_set),
        explanation=[ExplanationFactor(**exp) for exp in risk_info["explanation"]],
        top_counterparties=cp_list[:10], # Cap at 10 counterparties
        timeline=timeline
    )

# 7. GET /graph
@app.get("/graph", response_model=GraphResponse)
def get_graph(
    dataset_id: str,
    account_id: Optional[str] = None,
    alert_id: Optional[str] = None,
    depth: int = Query(default=2, ge=1, le=3)
):
    state = get_dataset(dataset_id)
    if not state.analyzed:
        raise HTTPException(
            status_code=400,
            detail={"error": "not_analyzed_yet", "message": "Dataset has not been analyzed yet. Call /analyze first."}
        )
        
    selected_node_ids = set()
    center_id = None
    
    # Case 1: Alert Graph
    if alert_id:
        if alert_id not in state.alerts:
            raise HTTPException(
                status_code=404,
                detail={"error": "alert_not_found", "message": f"Alert with id {alert_id} not found."}
            )
        alert = state.alerts[alert_id]
        selected_node_ids.update(alert["account_ids"])
        # center is first account in cycle/ring
        if alert["account_ids"]:
            center_id = alert["account_ids"][0]
            
    # Case 2: Ego Graph (centered on account_id)
    elif account_id:
        if account_id not in state.accounts:
            raise HTTPException(
                status_code=404,
                detail={"error": "account_not_found", "message": f"Account with id {account_id} not found."}
            )
        center_id = account_id
        selected_node_ids.add(account_id)
        
        # Simple BFS traversal up to depth
        current_layer = {account_id}
        for _ in range(depth):
            next_layer = set()
            for u in current_layer:
                # Find all neighbors in transactions
                for t in state.transactions:
                    fr, to = t["from_account"], t["to_account"]
                    if fr == u:
                        next_layer.add(to)
                    elif to == u:
                        next_layer.add(fr)
            # Add to selected nodes
            selected_node_ids.update(next_layer)
            current_layer = next_layer
            
    # Case 3: Empty query (let's return top risk nodes)
    else:
        # Just return the top 20 risk accounts and their connections
        top_accounts = sorted(
            state.accounts_scored.items(),
            key=lambda x: x[1]["risk_score"],
            reverse=True
        )[:20]
        selected_node_ids.update([acc_id for acc_id, _ in top_accounts])
        
    # Generate graph nodes
    nodes = []
    for node_id in selected_node_ids:
        if node_id in state.accounts:
            acc = state.accounts[node_id]
            risk = state.accounts_scored[node_id]
            
            # Aggregate unique locations, devices, IPs for this node
            node_locs = set()
            node_devs = set()
            node_ips = set()
            for t in state.transactions:
                if t["from_account"] == node_id or t["to_account"] == node_id:
                    if t.get("location"): node_locs.add(t["location"])
                    if t.get("device_used"): node_devs.add(t["device_used"])
                    if t.get("ip_address"): node_ips.add(t["ip_address"])
                    
            nodes.append(GraphNode(
                id=node_id,
                label=acc["name"],
                account_type=acc["account_type"],
                risk_score=risk["risk_score"],
                risk_level=risk["risk_level"],
                is_center=(node_id == center_id),
                flagged=(risk["risk_score"] >= 70),
                locations=list(node_locs) if node_locs else None,
                devices=list(node_devs) if node_devs else None,
                ip_addresses=list(node_ips) if node_ips else None
            ))
            
    # Generate graph edges (aggregate transactions between selected nodes)
    edges_map = {}
    for t in state.transactions:
        u = t["from_account"]
        v = t["to_account"]
        
        # Only include edges connecting selected nodes
        if u in selected_node_ids and v in selected_node_ids:
            key = (u, v)
            amt = float(t["amount"])
            if key not in edges_map:
                edges_map[key] = {
                    "amount": 0.0,
                    "txn_count": 0,
                    "last_ts": t["timestamp"],
                    "locations": set(),
                    "devices": set(),
                    "ip_addresses": set(),
                    "transaction_types": set()
                }
            edges_map[key]["amount"] += amt
            edges_map[key]["txn_count"] += 1
            if t["timestamp"] > edges_map[key]["last_ts"]:
                edges_map[key]["last_ts"] = t["timestamp"]
                
            if t.get("location"): edges_map[key]["locations"].add(t["location"])
            if t.get("device_used"): edges_map[key]["devices"].add(t["device_used"])
            if t.get("ip_address"): edges_map[key]["ip_addresses"].add(t["ip_address"])
            if t.get("transaction_type"): edges_map[key]["transaction_types"].add(t["transaction_type"])
                
    edges = []
    for (u, v), data in edges_map.items():
        # Check if this edge connects accounts in any common alert (suspicious edge)
        suspicious = False
        for alert in state.alerts.values():
            if u in alert["account_ids"] and v in alert["account_ids"]:
                # Ensure the flow direction matches cycle if circular, or just label it suspicious
                suspicious = True
                break
                
        edge_id = f"e_{u}_{v}"
        edges.append(GraphEdge(
            id=edge_id,
            source=u,
            target=v,
            amount=round(data["amount"], 2),
            txn_count=data["txn_count"],
            last_timestamp=data["last_ts"],
            suspicious=suspicious,
            locations=list(data["locations"]) if data["locations"] else None,
            devices=list(data["devices"]) if data["devices"] else None,
            ip_addresses=list(data["ip_addresses"]) if data["ip_addresses"] else None,
            transaction_types=list(data["transaction_types"]) if data["transaction_types"] else None
        ))
        
    return GraphResponse(
        center_id=center_id,
        nodes=nodes,
        edges=edges
    )

# 8. GET /alerts
@app.get("/alerts", response_model=AlertsListResponse)
def get_alerts(
    dataset_id: str,
    min_severity: int = 0,
    pattern_type: Optional[str] = None
):
    state = get_dataset(dataset_id)
    if not state.analyzed:
        raise HTTPException(
            status_code=400,
            detail={"error": "not_analyzed_yet", "message": "Dataset has not been analyzed yet. Call /analyze first."}
        )
        
    alerts_list = []
    for alert in state.alerts.values():
        if alert["severity"] < min_severity:
            continue
        if pattern_type and alert["pattern_type"] != pattern_type:
            continue
            
        # Determine risk level from severity
        sev = alert["severity"]
        if sev <= 39:
            lvl = "low"
        elif sev <= 69:
            lvl = "medium"
        elif sev <= 89:
            lvl = "high"
        else:
            lvl = "critical"
            
        alerts_list.append(AlertSummary(
            alert_id=alert["alert_id"],
            pattern_type=alert["pattern_type"],
            title=alert["title"],
            severity=sev,
            risk_level=lvl,
            account_ids=alert["account_ids"],
            amount_involved=alert["amount_involved"],
            summary=alert["summary"],
            detected_at=alert["detected_at"]
        ))
        
    # Sort alerts by severity descending
    alerts_list.sort(key=lambda x: x.severity, reverse=True)
    
    return AlertsListResponse(
        total=len(alerts_list),
        alerts=alerts_list
    )

# 9. GET /alerts/{alert_id}
@app.get("/alerts/{alert_id}", response_model=AlertDetailResponse)
def get_alert_detail(alert_id: str, dataset_id: str):
    state = get_dataset(dataset_id)
    if not state.analyzed:
        raise HTTPException(
            status_code=400,
            detail={"error": "not_analyzed_yet", "message": "Dataset has not been analyzed yet. Call /analyze first."}
        )
    if alert_id not in state.alerts:
        raise HTTPException(
            status_code=404,
            detail={"error": "alert_not_found", "message": f"Alert with id {alert_id} not found."}
        )
        
    alert = state.alerts[alert_id]
    
    # Calculate severity risk level
    sev = alert["severity"]
    if sev <= 39:
        lvl = "low"
    elif sev <= 69:
        lvl = "medium"
    elif sev <= 89:
        lvl = "high"
    else:
        lvl = "critical"
        
    # Member details
    accounts_info = []
    for node_id in alert["account_ids"]:
        if node_id in state.accounts:
            name = state.accounts[node_id]["name"]
            score_info = state.accounts_scored[node_id]
            role = alert.get("roles", {}).get(node_id, "mule")
            
            accounts_info.append(AlertAccountInfo(
                account_id=node_id,
                name=name,
                risk_score=score_info["risk_score"],
                risk_level=score_info["risk_level"],
                role=role
            ))
            
    # Self contained graph for the alert ring
    graph = get_graph(dataset_id=dataset_id, alert_id=alert_id)
    
    return AlertDetailResponse(
        alert_id=alert_id,
        pattern_type=alert["pattern_type"],
        title=alert["title"],
        severity=sev,
        risk_level=lvl,
        amount_involved=alert["amount_involved"],
        summary=alert["summary"],
        narrative=alert["narrative"],
        accounts=accounts_info,
        graph=graph
    )
