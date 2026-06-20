import pandas as pd
import numpy as np
import networkx as nx
from datetime import datetime
from typing import Dict, List, Any

def compute_features(accounts: Dict[str, Dict[str, Any]], transactions: List[Dict[str, Any]]) -> pd.DataFrame:
    # Initialize feature dict for each account
    feature_dict = {}
    for acc_id in accounts.keys():
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
        
    # Process transactions to populate basic counters
    for txn in transactions:
        from_acc = txn["from_account"]
        to_acc = txn["to_account"]
        amount = float(txn["amount"])
        
        # Parse timestamp
        try:
            ts = datetime.strptime(txn["timestamp"], "%Y-%m-%dT%H:%M:%SZ")
        except ValueError:
            ts = datetime.fromisoformat(txn["timestamp"].replace("Z", "+00:00"))
            
        # Structuring check (just under 50,000 threshold, e.g. [45000, 49999.99])
        is_structured = 45000.0 <= amount < 50000.0
        
        # Round amount check (multiple of 5000 or 10000)
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
            if "location" in txn and txn["location"]:
                f["locations"].add(txn["location"])
            if "device_used" in txn and txn["device_used"]:
                f["devices"].add(txn["device_used"])
            if "ip_address" in txn and txn["ip_address"]:
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
            if "location" in txn and txn["location"]:
                f["locations"].add(txn["location"])
            if "device_used" in txn and txn["device_used"]:
                f["devices"].add(txn["device_used"])
            if "ip_address" in txn and txn["ip_address"]:
                f["ips"].add(txn["ip_address"])

    # NetworkX Graph construction for centrality
    G = nx.DiGraph()
    for acc_id in accounts.keys():
        G.add_node(acc_id)
        
    # Aggregate transfers for weighted edges
    edges_agg = {}
    for txn in transactions:
        key = (txn["from_account"], txn["to_account"])
        edges_agg[key] = edges_agg.get(key, 0.0) + float(txn["amount"])
        
    for (src, tgt), wt in edges_agg.items():
        if src in accounts and tgt in accounts:
            G.add_edge(src, tgt, weight=wt)
            
    # Calculate centralities
    try:
        betweenness = nx.betweenness_centrality(G, normalized=True)
    except Exception:
        betweenness = {acc_id: 0.0 for acc_id in accounts.keys()}
        
    in_degree = dict(G.in_degree())
    out_degree = dict(G.out_degree())
    
    # Compile final features
    rows = []
    for acc_id, f in feature_dict.items():
        total_in = f["total_in"]
        total_out = f["total_out"]
        txn_count = f["txn_count"]
        
        # 1. pass_through_ratio
        pass_through_ratio = total_out / total_in if total_in > 0 else 0.0
        # Clamp to realistic levels (can go slightly above 1 if account depletes initial balance)
        pass_through_ratio = min(1.5, pass_through_ratio)
        
        # 2. mean_time_to_forward & mule_ratio
        in_txns = sorted(f["in_txns"], key=lambda x: x[0])
        out_txns = sorted(f["out_txns"], key=lambda x: x[0])
        
        forward_times = []
        forwarded_count = 0
        
        # For each incoming transaction, find if there's an outgoing transaction
        # that happens after it, within a 24 hour window
        for in_ts, in_amt in in_txns:
            found_forward = False
            for out_ts, out_amt in out_txns:
                if out_ts > in_ts:
                    diff_hours = (out_ts - in_ts).total_seconds() / 3600.0
                    if diff_hours <= 24.0:
                        # Also check if amount is relatively similar (e.g. at least 50% of incoming or similar)
                        # We don't restrict too much, but typical mule passes most money
                        forward_times.append(diff_hours)
                        forwarded_count += 1
                        found_forward = True
                        break # match with the earliest forward
            
        mule_ratio = forwarded_count / len(in_txns) if len(in_txns) > 0 else 0.0
        mean_time_to_forward = np.mean(forward_times) if forward_times else 24.0
        
        # 3. structuring_score & round_amount_ratio
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
        
    df = pd.DataFrame(rows)
    return df
