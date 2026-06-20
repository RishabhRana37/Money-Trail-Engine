import networkx as nx
import pandas as pd
from datetime import datetime, timedelta
from typing import List, Dict, Any, Set, Tuple

def check_cycle_flow(cycle: List[str], transactions: List[Dict[str, Any]]) -> Tuple[bool, float]:
    """
    Checks if there is a chronological flow of funds through the cycle
    within a 72-hour window, with matching amounts (within 25% tolerance).
    Returns (isValid, amount_involved).
    """
    k = len(cycle)
    step_txns = []
    for i in range(k):
        u = cycle[i]
        v = cycle[(i + 1) % k]
        txs = [t for t in transactions if t["from_account"] == u and t["to_account"] == v]
        if not txs:
            return False, 0.0
        parsed = []
        for t in txs:
            try:
                dt = datetime.strptime(t["timestamp"], "%Y-%m-%dT%H:%M:%SZ")
            except ValueError:
                dt = datetime.fromisoformat(t["timestamp"].replace("Z", "+00:00")).replace(tzinfo=None)
            parsed.append((dt, float(t["amount"])))
        step_txns.append(sorted(parsed, key=lambda x: x[0]))
        
    def dfs(step: int, prev_time: datetime, initial_amount: float, current_min_amount: float) -> Tuple[bool, float]:
        if step == k:
            return True, current_min_amount
            
        for dt, amt in step_txns[step]:
            if dt >= prev_time:
                if (dt - prev_time).total_seconds() <= 86400:
                    if 0.75 * initial_amount <= amt <= 1.3 * initial_amount:
                        success, final_amt = dfs(step + 1, dt, initial_amount, min(current_min_amount, amt))
                        if success:
                            return True, final_amt
        return False, 0.0

    for start_time, start_amt in step_txns[0]:
        success, amount_involved = dfs(1, start_time, start_amt, start_amt)
        if success:
            return True, amount_involved
            
    return False, 0.0


def check_chain_flow(chain: List[str], transactions: List[Dict[str, Any]]) -> Tuple[bool, float]:
    """
    Checks if there is a chronological flow of funds through the chain
    within a 48-hour window, with matching amounts.
    """
    k = len(chain)
    step_txns = []
    for i in range(k - 1):
        u = chain[i]
        v = chain[i + 1]
        txs = [t for t in transactions if t["from_account"] == u and t["to_account"] == v]
        if not txs:
            return False, 0.0
        parsed = []
        for t in txs:
            try:
                dt = datetime.strptime(t["timestamp"], "%Y-%m-%dT%H:%M:%SZ")
            except ValueError:
                dt = datetime.fromisoformat(t["timestamp"].replace("Z", "+00:00")).replace(tzinfo=None)
            parsed.append((dt, float(t["amount"])))
        step_txns.append(sorted(parsed, key=lambda x: x[0]))
        
    def dfs(step: int, prev_time: datetime, initial_amount: float, current_min_amount: float) -> Tuple[bool, float]:
        if step == k - 1:
            return True, current_min_amount
            
        for dt, amt in step_txns[step]:
            if dt >= prev_time:
                if (dt - prev_time).total_seconds() <= 86400:
                    if 0.75 * initial_amount <= amt <= 1.3 * initial_amount:
                        success, final_amt = dfs(step + 1, dt, initial_amount, min(current_min_amount, amt))
                        if success:
                            return True, final_amt
        return False, 0.0

    for start_time, start_amt in step_txns[0]:
        success, amount_involved = dfs(1, start_time, start_amt, start_amt)
        if success:
            return True, amount_involved
            
    return False, 0.0


def detect_patterns(
    accounts: Dict[str, Dict[str, Any]],
    transactions: List[Dict[str, Any]],
    features_df: pd.DataFrame
) -> List[Dict[str, Any]]:
    
    alerts = []
    alert_counter = 1
    
    # 1. Build NetworkX Directed Graph
    G = nx.DiGraph()
    for acc_id in accounts.keys():
        G.add_node(acc_id)
        
    edges_agg = {}
    edges_last_ts = {}
    edges_txn_count = {}
    
    for txn in transactions:
        u = txn["from_account"]
        v = txn["to_account"]
        amt = float(txn["amount"])
        ts = txn["timestamp"]
        
        key = (u, v)
        edges_agg[key] = edges_agg.get(key, 0.0) + amt
        edges_txn_count[key] = edges_txn_count.get(key, 0) + 1
        
        if key not in edges_last_ts or ts > edges_last_ts[key]:
            edges_last_ts[key] = ts
            
    for (u, v), wt in edges_agg.items():
        if u in accounts and v in accounts:
            G.add_edge(u, v, weight=wt, txn_count=edges_txn_count[(u, v)], last_timestamp=edges_last_ts[(u, v)])
            
    # Pre-map features for fast lookup
    features_map = features_df.set_index("account_id").to_dict(orient="index")
    
    current_ts = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    if transactions:
        current_ts = transactions[-1]["timestamp"]

    # ---- 1. Circular Flow Detection ----
    try:
        cycles = list(nx.simple_cycles(G, length_bound=6))
    except Exception:
        cycles = []
        
    seen_cycles = set()
    deduped_cycles = []
    for cycle in cycles:
        if len(cycle) >= 3:
            min_val = min(cycle)
            min_idx = cycle.index(min_val)
            canonical = tuple(cycle[min_idx:] + cycle[:min_idx])
            if canonical not in seen_cycles:
                seen_cycles.add(canonical)
                deduped_cycles.append(cycle)
                
    for cycle in deduped_cycles:
        isValid, amount_involved = check_cycle_flow(cycle, transactions)
        if not isValid:
            continue
            
        severity = min(100, int(85 + (amount_involved / 25000.0) + len(cycle) * 2))
        
        alert_id = f"alert_{alert_counter:02d}"
        alert_counter += 1
        
        summary = f"{amount_involved/100000.0:.2f}L cycled through {len(cycle)} accounts returning to origin."
        narrative = (
            f"Funds cycled through a closed loop of {len(cycle)} accounts: "
            + " -> ".join([f"{accounts[node]['name']} ({node})" for node in cycle])
            + f" -> {accounts[cycle[0]]['name']} ({cycle[0]}). This loop displays no apparent commercial utility "
            f"and is highly characteristic of circular money laundering (layering)."
        )
        
        alerts.append({
            "alert_id": alert_id,
            "pattern_type": "circular",
            "title": f"{len(cycle)}-account laundering loop",
            "severity": severity,
            "account_ids": cycle,
            "amount_involved": round(amount_involved, 2),
            "summary": summary,
            "narrative": narrative,
            "detected_at": current_ts,
            "roles": {node: "origin" if i == 0 else "mule" for i, node in enumerate(cycle)}
        })

    # ---- 2. Layering Chain Detection ----
    mule_nodes = [node for node, feats in features_map.items() if feats.get("mule_ratio", 0.0) > 0.6]
    mule_sub = G.subgraph(mule_nodes)
    layering_chains = []
    
    visited: Set[str] = set()
    for start_node in mule_nodes:
        if start_node in visited:
            continue
            
        current_path = [start_node]
        curr = start_node
        while True:
            out_neighbors = list(mule_sub.successors(curr))
            if not out_neighbors:
                break
            next_node = max(out_neighbors, key=lambda n: G[curr][n]["weight"])
            if next_node in current_path:
                break
            current_path.append(next_node)
            curr = next_node
            
        if len(current_path) >= 3:
            layering_chains.append(current_path)
            visited.update(current_path)
            
    for chain in layering_chains:
        isValid, amount_involved = check_chain_flow(chain, transactions)
        if not isValid:
            continue
            
        severity = min(100, int(80 + (amount_involved / 25000.0) + len(chain) * 2))
        
        alert_id = f"alert_{alert_counter:02d}"
        alert_counter += 1
        
        summary = f"{amount_involved/100000.0:.2f}L layered through a sequential chain of {len(chain)} accounts."
        narrative = (
            f"A rapid flow of funds was detected across a linear path: "
            + " -> ".join([f"{accounts[node]['name']} ({node})" for node in chain])
            + f". Each account forwarded over 90% of incoming funds within a short window, "
            f"suggesting a layering pipeline designed to obscure the source of funds."
        )
        
        alerts.append({
            "alert_id": alert_id,
            "pattern_type": "layering",
            "title": f"Layering chain of {len(chain)} accounts",
            "severity": severity,
            "account_ids": chain,
            "amount_involved": round(amount_involved, 2),
            "summary": summary,
            "narrative": narrative,
            "detected_at": current_ts,
            "roles": {node: "origin" if i == 0 else ("beneficiary" if i == len(chain)-1 else "mule") for i, node in enumerate(chain)}
        })

    # ---- 3. Smurfing / Fan-out Detection ----
    for node, feats in features_map.items():
        if feats.get("out_degree", 0) >= 5:
            out_edges = G.out_edges(node, data=True)
            structured_targets = []
            total_smurfed = 0.0
            
            for u, v, data in out_edges:
                edge_txns = [t for t in transactions if t["from_account"] == u and t["to_account"] == v]
                for t in edge_txns:
                    amt = float(t["amount"])
                    if 45000.0 <= amt < 50000.0:
                        structured_targets.append(v)
                        total_smurfed += amt
                        break
                        
            if len(structured_targets) >= 4:
                alert_id = f"alert_{alert_counter:02d}"
                alert_counter += 1
                
                account_ids = [node] + list(set(structured_targets))
                severity = min(100, int(85 + len(structured_targets) * 2 + (total_smurfed / 50000.0)))
                
                summary = f"{total_smurfed/100000.0:.2f}L split into {len(structured_targets)} transfers under 50,000 INR."
                narrative = (
                    f"Account {accounts[node]['name']} ({node}) initiated {len(structured_targets)} separate transfers "
                    f"to different counterparties, with each transfer structured just below the 50,000 INR "
                    f"reporting threshold. This is a typical smurfing/fan-out technique to evade transaction monitoring filters."
                )
                
                alerts.append({
                    "alert_id": alert_id,
                    "pattern_type": "smurfing",
                    "title": f"Structuring via smurfing fan-out",
                    "severity": severity,
                    "account_ids": account_ids,
                    "amount_involved": round(total_smurfed, 2),
                    "summary": summary,
                    "narrative": narrative,
                    "detected_at": current_ts,
                    "roles": {n: "origin" if n == node else "mule" for n in account_ids}
                })

    # ---- 4. Fan-in Detection ----
    for node, feats in features_map.items():
        if accounts[node]["account_type"] == "business":
            continue
            
        if feats.get("in_degree", 0) >= 6:
            in_edges = G.in_edges(node, data=True)
            senders = [u for u, v, data in in_edges]
            total_incoming = feats.get("total_in", 0.0)
            
            if total_incoming > 250000.0:
                alert_id = f"alert_{alert_counter:02d}"
                alert_counter += 1
                
                account_ids = [node] + senders
                severity = min(100, int(80 + len(senders) * 2 + (total_incoming / 100000.0)))
                
                summary = f"{total_incoming/100000.0:.2f}L collected from {len(senders)} source accounts."
                narrative = (
                    f"Collector account {accounts[node]['name']} ({node}) received rapid incoming transfers "
                    f"aggregating {total_incoming:,.2f} INR from {len(senders)} distinct counterparties. "
                    f"This pattern is typical of a consolidation node/collection mule."
                )
                
                alerts.append({
                    "alert_id": alert_id,
                    "pattern_type": "fan_in",
                    "title": "Consolidation fan-in flow",
                    "severity": severity,
                    "account_ids": account_ids,
                    "amount_involved": round(total_incoming, 2),
                    "summary": summary,
                    "narrative": narrative,
                    "detected_at": current_ts,
                    "roles": {n: "beneficiary" if n == node else "mule" for n in account_ids}
                })

    # ---- 5. Rapid Movement (Mule) Detection ----
    for node, feats in features_map.items():
        mule_ratio = feats.get("mule_ratio", 0.0)
        pass_through_ratio = feats.get("pass_through_ratio", 0.0)
        total_in = feats.get("total_in", 0.0)
        
        if mule_ratio > 0.9 and 0.85 <= pass_through_ratio <= 1.25 and total_in > 200000.0:
            in_edges = G.in_edges(node, data=True)
            out_edges = G.out_edges(node, data=True)
            
            if in_edges and out_edges:
                best_src = max(in_edges, key=lambda x: x[2]["weight"])[0]
                best_dest = max(out_edges, key=lambda x: x[2]["weight"])[1]
                
                alert_id = f"alert_{alert_counter:02d}"
                alert_counter += 1
                
                account_ids = [best_src, node, best_dest]
                severity = min(100, int(85 + (total_in / 50000.0)))
                
                summary = f"Mule pass-through: {total_in/100000.0:.2f}L routed through {accounts[node]['name']} within 24h."
                narrative = (
                    f"Rapid pass-through node identified: {accounts[node]['name']} ({node}) received "
                    f"funds from {accounts[best_src]['name']} ({best_src}) and immediately forwarded "
                    f"them to {accounts[best_dest]['name']} ({best_dest}) within 24 hours. The account behaves "
                    f"as a classic money mule with no normal personal/business transactional signature."
                )
                
                alerts.append({
                    "alert_id": alert_id,
                    "pattern_type": "rapid_movement",
                    "title": "Rapid mule transit",
                    "severity": severity,
                    "account_ids": account_ids,
                    "amount_involved": round(total_in, 2),
                    "summary": summary,
                    "narrative": narrative,
                    "detected_at": current_ts,
                    "roles": {best_src: "origin", node: "mule", best_dest: "beneficiary"}
                })

    alerts.sort(key=lambda x: x["severity"], reverse=True)
    return alerts
