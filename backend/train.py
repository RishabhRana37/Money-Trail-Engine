import os
import sys
import json
import pickle
import numpy as np
import pandas as pd
import networkx as nx
from datetime import datetime
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, roc_auc_score

def compute_fast_features(accounts_set, transactions):
    print(f"Engineering features for {len(accounts_set)} accounts from {len(transactions)} transactions...")
    
    # Initialize features
    feature_dict = {}
    for acc_id in accounts_set:
        feature_dict[acc_id] = {
            "account_id": acc_id,
            "total_in": 0.0,
            "total_out": 0.0,
            "txn_count": 0,
            "fan_in_set": set(),
            "fan_out_set": set(),
            "in_txns": [],
            "out_txns": [],
            "structuring_count": 0,
            "round_amount_count": 0,
            "locations": set(),
            "devices": set(),
            "ips": set()
        }
        
    # Map IP to accounts
    ip_to_accounts = {}
        
    # Process transactions
    for txn in transactions:
        from_acc = txn["from_account"]
        to_acc = txn["to_account"]
        amount = float(txn["amount"])
        
        # Fast timestamp parsing (ISO 8601)
        ts_str = txn["timestamp"]
        try:
            ts = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
        except Exception:
            ts = datetime.utcnow()
            
        is_structured = 45000.0 <= amount < 50000.0
        is_round = (amount % 5000 == 0) or (amount % 10000 == 0)
        
        # Track IP sharing
        ip = txn.get("ip_address")
        if ip:
            if ip not in ip_to_accounts:
                ip_to_accounts[ip] = set()
            ip_to_accounts[ip].add(from_acc)
            ip_to_accounts[ip].add(to_acc)
        
        if from_acc in feature_dict:
            f = feature_dict[from_acc]
            f["total_out"] += amount
            f["txn_count"] += 1
            f["fan_out_set"].add(to_acc)
            f["out_txns"].append((ts, amount))
            if is_structured:
                f["structuring_count"] += 1
            if is_round:
                f["round_amount_count"] += 1
            if txn.get("location"):
                f["locations"].add(txn["location"])
            if txn.get("device_used"):
                f["devices"].add(txn["device_used"])
            if txn.get("ip_address"):
                f["ips"].add(txn["ip_address"])
                
        if to_acc in feature_dict:
            f = feature_dict[to_acc]
            f["total_in"] += amount
            f["txn_count"] += 1
            f["fan_in_set"].add(from_acc)
            f["in_txns"].append((ts, amount))
            if is_structured:
                f["structuring_count"] += 1
            if is_round:
                f["round_amount_count"] += 1
            if txn.get("location"):
                f["locations"].add(txn["location"])
            if txn.get("device_used"):
                f["devices"].add(txn["device_used"])
            if txn.get("ip_address"):
                f["ips"].add(txn["ip_address"])

    # NetworkX Graph construction for centrality
    G = nx.DiGraph()
    for acc_id in accounts_set:
        G.add_node(acc_id)
        
    edges_agg = {}
    for txn in transactions:
        key = (txn["from_account"], txn["to_account"])
        edges_agg[key] = edges_agg.get(key, 0.0) + float(txn["amount"])
        
    for (src, tgt), wt in edges_agg.items():
        if src in accounts_set and tgt in accounts_set:
            G.add_edge(src, tgt, weight=wt)
            
    # Fast approximated betweenness centrality (k=20 is extremely fast)
    print("Computing approximated betweenness centrality...")
    try:
        betweenness = nx.betweenness_centrality(G, k=min(len(G), 20), normalized=True, seed=42)
    except Exception as e:
        print(f"Warning: centrality failed: {e}")
        betweenness = {acc_id: 0.0 for acc_id in accounts_set}
        
    in_degree = dict(G.in_degree())
    out_degree = dict(G.out_degree())
    
    # Compile final features
    rows = []
    for acc_id, f in feature_dict.items():
        total_in = f["total_in"]
        total_out = f["total_out"]
        txn_count = f["txn_count"]
        
        pass_through_ratio = total_out / total_in if total_in > 0 else 0.0
        pass_through_ratio = min(1.5, pass_through_ratio)
        
        in_txns = sorted(f["in_txns"], key=lambda x: x[0])
        out_txns = sorted(f["out_txns"], key=lambda x: x[0])
        
        forward_times = []
        forwarded_count = 0
        
        for in_ts, in_amt in in_txns:
            for out_ts, out_amt in out_txns:
                if out_ts > in_ts:
                    diff_hours = (out_ts - in_ts).total_seconds() / 3600.0
                    if diff_hours <= 24.0:
                        forward_times.append(diff_hours)
                        forwarded_count += 1
                        break
            
        mule_ratio = forwarded_count / len(in_txns) if len(in_txns) > 0 else 0.0
        mean_time_to_forward = np.mean(forward_times) if forward_times else 24.0
        
        structuring_score = f["structuring_count"] / txn_count if txn_count > 0 else 0.0
        round_amount_ratio = f["round_amount_count"] / txn_count if txn_count > 0 else 0.0
        
        # IP sharing count
        ip_sharing_count = 0
        for ip in f["ips"]:
            ip_sharing_count += len(ip_to_accounts.get(ip, set())) - 1
            
        rows.append({
            "account_id": acc_id,
            "total_in": total_in,
            "total_out": total_out,
            "txn_count": txn_count,
            "fan_in": len(f["fan_in_set"]),
            "fan_out": len(f["fan_out_set"]),
            "pass_through_ratio": pass_through_ratio,
            "mean_time_to_forward": mean_time_to_forward,
            "mule_ratio": mule_ratio,
            "structuring_score": structuring_score,
            "round_amount_ratio": round_amount_ratio,
            "betweenness_centrality": betweenness.get(acc_id, 0.0),
            "in_degree": in_degree.get(acc_id, 0),
            "out_degree": out_degree.get(acc_id, 0),
            "unique_locations_count": len(f["locations"]) if f["locations"] else 1,
            "unique_devices_count": len(f["devices"]) if f["devices"] else 1,
            "unique_ips_count": len(f["ips"]) if f["ips"] else 1,
            "ip_sharing_count": ip_sharing_count
        })
        
    return pd.DataFrame(rows)

def main():
    print("="*60)
    print("AURA FAST MACHINE LEARNING TRAINING PIPELINE")
    print("="*60)
    
    data_path = "scratch/transactions.json"
    if not os.path.exists(data_path):
        print(f"Error: {data_path} not found.")
        return
        
    print(f"Loading transaction dataset from {data_path}...")
    with open(data_path, "r") as f:
        raw_txns = json.load(f)
        
    print(f"Loaded {len(raw_txns)} transactions total.")
    
    # 1. Identify all fraud-involved accounts
    print("Identifying fraud-involved accounts...")
    fraud_accounts = set()
    for t in raw_txns:
        if t.get("is_fraud", False):
            fraud_accounts.add(t["sender_account"])
            fraud_accounts.add(t["receiver_account"])
            
    print(f"Fraud-involved accounts: {len(fraud_accounts)}")
    
    # 2. Extract all transactions involving these fraud accounts (Preserves transaction history!)
    print("Extracting full sub-network transactions...")
    selected_txns = []
    for t in raw_txns:
        from_acc = t["sender_account"]
        to_acc = t["receiver_account"]
        if from_acc in fraud_accounts or to_acc in fraud_accounts:
            selected_txns.append({
                "txn_id": t["transaction_id"],
                "from_account": from_acc,
                "to_account": to_acc,
                "amount": float(t["amount"]),
                "timestamp": t["timestamp"],
                "location": t.get("location"),
                "device_used": t.get("device_used"),
                "ip_address": t.get("ip_address"),
                "is_fraud": t.get("is_fraud", False)
            })
            
    print(f"Sub-network size: {len(selected_txns)} transactions.")
    
    # 3. Extract unique accounts in the sub-network
    selected_accounts = set()
    for t in selected_txns:
        selected_accounts.add(t["from_account"])
        selected_accounts.add(t["to_account"])
        
    print(f"Total sub-network accounts: {len(selected_accounts)}")
    print(f"Clean counterparties: {len(selected_accounts - fraud_accounts)}")
    
    # Compute features
    features_df = compute_fast_features(selected_accounts, selected_txns)
    
    # Set targets
    features_df["is_fraud"] = features_df["account_id"].apply(lambda x: 1 if x in fraud_accounts else 0)
    
    feature_cols = [
        "total_in", "total_out", "txn_count", "fan_in", "fan_out",
        "pass_through_ratio", "mean_time_to_forward", "mule_ratio",
        "structuring_score", "round_amount_ratio", "betweenness_centrality",
        "in_degree", "out_degree",
        "unique_locations_count", "unique_devices_count", "unique_ips_count", "ip_sharing_count"
    ]
    
    X = features_df[feature_cols].fillna(0)
    y = features_df["is_fraud"]
    
    # Split
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
    
    # Train RandomForest
    print("\nTraining RandomForestClassifier...")
    model = RandomForestClassifier(n_estimators=100, max_depth=8, random_state=42, class_weight="balanced")
    model.fit(X_train, y_train)
    
    # Evaluate
    y_pred = model.predict(X_test)
    y_pred_proba = model.predict_proba(X_test)[:, 1]
    
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred))
    
    auc = roc_auc_score(y_test, y_pred_proba)
    print(f"ROC AUC Score: {auc:.4f}")
    
    # Feature Importances
    importances = pd.Series(model.feature_importances_, index=feature_cols).sort_values(ascending=False)
    print("\nFeature Importances:")
    print(importances)
    
    # Save model
    model_dir = "backend/engine"
    os.makedirs(model_dir, exist_ok=True)
    model_path = os.path.join(model_dir, "trained_model.pkl")
    
    print(f"\nSaving trained model to {model_path}...")
    with open(model_path, "wb") as f:
        pickle.dump({
            "model": model,
            "feature_cols": feature_cols
        }, f)
        
    print("Model saved successfully!")
    print("="*60)

if __name__ == "__main__":
    main()
