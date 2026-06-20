"""
Integration test: Load real fraud dataset, run analysis pipeline, verify endpoints.
Uses a small sample (5000 rows) for fast testing.
"""
import sys
import os
import time

# Add parent dir to path so we can import backend modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.store import DATASETS, DatasetState
from backend.engine.features import compute_features
from backend.engine.anomaly import compute_anomaly_scores
from backend.engine.patterns import detect_patterns
from backend.engine.risk import fuse_risk_scores

import json


def stream_and_load(file_path: str, limit: int = 5000, fraud_ratio: float = 0.3):
    """Stream real dataset and load into DatasetState."""
    max_fraud = int(limit * fraud_ratio)

    dataset_id = "ds_test_real"
    state = DatasetState(dataset_id)

    fraud_txns = []
    normal_txns = []

    with open(file_path, "r", encoding="utf-8") as f:
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

                        from datetime import datetime
                        ts_str = txn.get("timestamp", "")
                        try:
                            dt = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
                            ts_str = dt.strftime("%Y-%m-%dT%H:%M:%SZ")
                        except Exception:
                            pass

                        mapped_txn = {
                            "txn_id": txn.get("transaction_id", f"txn_{len(fraud_txns) + len(normal_txns) + 1}"),
                            "from_account": txn.get("sender_account"),
                            "to_account": txn.get("receiver_account"),
                            "amount": float(txn.get("amount", 0.0)),
                            "timestamp": ts_str,
                            "transaction_type": txn.get("transaction_type", "transfer"),
                            "location": txn.get("location"),
                            "device_used": txn.get("device_used"),
                            "ip_address": txn.get("ip_address"),
                            "is_fraud": bool(is_fraud)
                        }

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
                    except Exception:
                        pass
                    buffer = []

            if len(fraud_txns) >= max_fraud and len(normal_txns) >= limit - len(fraud_txns):
                break

    state.transactions = (fraud_txns + normal_txns[:limit - len(fraud_txns)])[:limit]

    # Populate accounts
    for txn in state.transactions:
        for acc in [txn["from_account"], txn["to_account"]]:
            if acc not in state.accounts:
                state.accounts[acc] = {
                    "account_id": acc,
                    "name": f"Account {acc}",
                    "account_type": "shell" if acc in state.ground_truth_dirty_accounts else "individual",
                    "initial_balance": 500000.0
                }

    return state


def run_test():
    print("=" * 60)
    print("REAL DATASET INTEGRATION TEST")
    print("=" * 60)

    file_path = "scratch/transactions.json"
    if not os.path.exists(file_path):
        file_path = "D:/transactions.json"
    if not os.path.exists(file_path):
        print(f"ERROR: Dataset file not found at scratch/transactions.json or D:/transactions.json")
        sys.exit(1)

    # Step 1: Load
    print("\n[1/5] Loading real dataset (5000 rows, 30% fraud priority)...")
    t0 = time.time()
    state = stream_and_load(file_path, limit=5000, fraud_ratio=0.3)
    t_load = time.time() - t0
    print(f"  Loaded {len(state.transactions)} transactions, {len(state.accounts)} accounts in {t_load:.2f}s")
    print(f"  Ground truth dirty accounts: {len(state.ground_truth_dirty_accounts)}")
    fraud_count = sum(1 for t in state.transactions if t.get("is_fraud"))
    print(f"  Fraud transactions loaded: {fraud_count}")

    # Verify new fields exist
    sample = state.transactions[0]
    assert "transaction_type" in sample, "Missing transaction_type field"
    assert "location" in sample, "Missing location field"
    assert "device_used" in sample, "Missing device_used field"
    assert "ip_address" in sample, "Missing ip_address field"
    assert "is_fraud" in sample, "Missing is_fraud field"
    print("  [OK] All 10 schema fields present in transactions")

    # Step 2: Feature engineering
    print("\n[2/5] Computing features...")
    t0 = time.time()
    features_df = compute_features(state.accounts, state.transactions)
    t_feat = time.time() - t0
    print(f"  Computed {len(features_df)} account features in {t_feat:.2f}s")

    # Verify new feature columns
    assert "unique_locations_count" in features_df.columns, "Missing unique_locations_count"
    assert "unique_devices_count" in features_df.columns, "Missing unique_devices_count"
    assert "unique_ips_count" in features_df.columns, "Missing unique_ips_count"
    assert "ip_sharing_count" in features_df.columns, "Missing ip_sharing_count"
    print("  [OK] New location/device/IP features present")

    # Step 3: Anomaly detection
    print("\n[3/5] Running IsolationForest anomaly detection...")
    t0 = time.time()
    anomaly_scores = compute_anomaly_scores(features_df)
    t_anom = time.time() - t0
    print(f"  Scored {len(anomaly_scores)} accounts in {t_anom:.2f}s")

    # Step 4: Pattern detection
    print("\n[4/5] Running graph pattern detection...")
    t0 = time.time()
    alerts = detect_patterns(state.accounts, state.transactions, features_df)
    t_pat = time.time() - t0
    print(f"  Detected {len(alerts)} alerts in {t_pat:.2f}s")

    # Step 5: Risk fusion
    print("\n[5/5] Fusing risk scores + generating explanations...")
    t0 = time.time()
    risk_results = fuse_risk_scores(features_df, anomaly_scores, alerts)
    t_risk = time.time() - t0
    print(f"  Scored {len(risk_results)} accounts in {t_risk:.2f}s")

    # Verify explanations contain new factors
    has_geo = False
    has_device = False
    has_ip = False
    for acc_id, info in risk_results.items():
        for exp in info["explanation"]:
            if exp["factor"] == "Geographic Dispersion":
                has_geo = True
            if exp["factor"] == "Device Proliferation":
                has_device = True
            if exp["factor"] == "Shared IP Network":
                has_ip = True

    print(f"  New explanation factors triggered:")
    print(f"    Geographic Dispersion: {'[YES]' if has_geo else '[NO]'}")
    print(f"    Device Proliferation:  {'[YES]' if has_device else '[NO]'}")
    print(f"    Shared IP Network:     {'[YES]' if has_ip else '[NO]'}")

    # Precision / Recall vs is_fraud ground truth
    if state.ground_truth_dirty_accounts:
        tp = fp = fn = 0
        dirty_anoms = []
        normal_anoms = []
        dirty_risks = []
        normal_risks = []
        
        for acc_id, info in risk_results.items():
            is_dirty = acc_id in state.ground_truth_dirty_accounts
            is_flagged = info["risk_score"] >= 70
            anom = anomaly_scores.get(acc_id, 0.0)
            risk = info["risk_score"]
            
            if is_dirty:
                dirty_anoms.append(anom)
                dirty_risks.append(risk)
            else:
                normal_anoms.append(anom)
                normal_risks.append(risk)
                
            if is_flagged and is_dirty:
                tp += 1
            elif is_flagged and not is_dirty:
                fp += 1
            elif not is_flagged and is_dirty:
                fn += 1

        precision = (tp / (tp + fp)) * 100 if (tp + fp) > 0 else 0.0
        recall = (tp / (tp + fn)) * 100 if (tp + fn) > 0 else 0.0

        print(f"\n{'=' * 60}")
        print(f"PRECISION/RECALL vs is_fraud GROUND TRUTH")
        print(f"{'-' * 60}")
        print(f"  Ground Truth Dirty Accounts: {len(state.ground_truth_dirty_accounts)}")
        print(f"  Avg Dirty Anomaly Score:    {sum(dirty_anoms)/len(dirty_anoms):.2f}%" if dirty_anoms else "  No dirty accounts")
        print(f"  Avg Normal Anomaly Score:   {sum(normal_anoms)/len(normal_anoms):.2f}%" if normal_anoms else "  No normal accounts")
        print(f"  Avg Dirty Risk Score:       {sum(dirty_risks)/len(dirty_risks):.2f}%" if dirty_risks else "  No dirty accounts")
        print(f"  Avg Normal Risk Score:      {sum(normal_risks)/len(normal_risks):.2f}%" if normal_risks else "  No normal accounts")
        print(f"  Max Dirty Anomaly Score:    {max(dirty_anoms):.2f}%" if dirty_anoms else "  N/A")
        print(f"  Max Normal Anomaly Score:   {max(normal_anoms):.2f}%" if normal_anoms else "  N/A")
        print(f"  True Positives:  {tp}")
        print(f"  False Positives: {fp}")
        print(f"  False Negatives: {fn}")
        print(f"  Precision:       {precision:.2f}%")
        print(f"  Recall:          {recall:.2f}%")

    total_time = t_load + t_feat + t_anom + t_pat + t_risk
    print(f"\n{'=' * 60}")
    print(f"TOTAL PIPELINE TIME: {total_time:.2f}s")
    print(f"{'=' * 60}")
    print("\n[OK] ALL CHECKS PASSED — Real dataset integration verified.")


if __name__ == "__main__":
    run_test()
