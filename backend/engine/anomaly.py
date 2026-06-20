import pandas as pd
import numpy as np
from sklearn.ensemble import IsolationForest
from typing import Dict

def compute_anomaly_scores(df: pd.DataFrame) -> Dict[str, float]:
    """
    Fits an IsolationForest on the feature dataframe and returns a mapping
    from account_id -> anomaly_score (scaled to 0-100).
    """
    if df.empty:
        return {}
        
    account_ids = df["account_id"].tolist()
    
    # Select numeric features for training
    feature_cols = [
        "total_in", "total_out", "txn_count", "fan_in", "fan_out",
        "pass_through_ratio", "mean_time_to_forward", "mule_ratio",
        "structuring_score", "round_amount_ratio", "betweenness_centrality",
        "in_degree", "out_degree",
        "unique_locations_count", "unique_devices_count", "unique_ips_count", "ip_sharing_count"
    ]
    
    # Fill any NaNs with 0
    X = df[feature_cols].copy().fillna(0)
    
    # Apply log-transformation to raw volume features so that ratio/centrality features stand out
    X["total_in"] = np.log1p(X["total_in"])
    X["total_out"] = np.log1p(X["total_out"])
    X["txn_count"] = np.log1p(X["txn_count"])
    
    # IsolationForest needs at least some rows to train
    if len(X) < 2:
        return {acc_id: 50.0 for acc_id in account_ids}
        
    # Fit unsupervised IsolationForest
    model = IsolationForest(contamination=0.08, random_state=42)
    model.fit(X)
    
    # Decision function returns average anomaly score of a sample (lower = more anomalous)
    # score_samples returns opposite of anomaly score (higher = normal, lower = anomalous)
    raw_scores = -model.score_samples(X) # Higher score = more anomalous
    
    # Min-max scale to 0-100 range
    min_val = raw_scores.min()
    max_val = raw_scores.max()
    
    if max_val - min_val > 1e-6:
        scaled_scores = (raw_scores - min_val) / (max_val - min_val) * 100
    else:
        scaled_scores = np.ones_like(raw_scores) * 50.0 # fallback if all identical
        
    # Return as dict mapping account_id -> score
    result = {}
    for i, acc_id in enumerate(account_ids):
        result[acc_id] = float(scaled_scores[i])
        
    return result
