import os
import pickle
import pandas as pd
import numpy as np
from sklearn.ensemble import IsolationForest
from typing import Dict

def compute_anomaly_scores(df: pd.DataFrame) -> Dict[str, float]:
    """
    Computes anomaly/fraud scores for each account.
    If a supervised trained model exists (trained_model.pkl), it uses it to make
    highly accurate predictions. Otherwise, it falls back to an unsupervised IsolationForest.
    """
    if df.empty:
        return {}
        
    account_ids = df["account_id"].tolist()
    
    # 1. Try to load supervised trained model
    model_path = os.path.join(os.path.dirname(__file__), "trained_model.pkl")
    if os.path.exists(model_path):
        try:
            print(f"[AURA ML] Loading supervised trained model from {model_path}...")
            with open(model_path, "rb") as f:
                data = pickle.load(f)
                
            model = data["model"]
            feature_cols = data["feature_cols"]
            
            # Extract features matching the model columns
            X = df[feature_cols].copy().fillna(0)
            
            # Predict probabilities
            probabilities = model.predict_proba(X)[:, 1] * 100.0
            
            result = {}
            for i, acc_id in enumerate(account_ids):
                result[acc_id] = float(probabilities[i])
            return result
            
        except Exception as e:
            print(f"[AURA ML] Warning: Failed to load trained model: {e}. Falling back to unsupervised IsolationForest.")
            
    # 2. Unsupervised Fallback (IsolationForest)
    print("[AURA ML] Running unsupervised IsolationForest fallback...")
    
    feature_cols = [
        "total_in", "total_out", "txn_count", "fan_in", "fan_out",
        "pass_through_ratio", "mean_time_to_forward", "mule_ratio",
        "structuring_score", "round_amount_ratio", "betweenness_centrality",
        "in_degree", "out_degree",
        "unique_locations_count", "unique_devices_count", "unique_ips_count", "ip_sharing_count"
    ]
    
    X = df[feature_cols].copy().fillna(0)
    
    # Apply log-transformation to raw volume features so that ratio/centrality features stand out
    X["total_in"] = np.log1p(X["total_in"])
    X["total_out"] = np.log1p(X["total_out"])
    X["txn_count"] = np.log1p(X["txn_count"])
    
    if len(X) < 2:
        return {acc_id: 50.0 for acc_id in account_ids}
        
    model = IsolationForest(contamination=0.08, random_state=42)
    model.fit(X)
    
    raw_scores = -model.score_samples(X) # Higher score = more anomalous
    
    min_val = raw_scores.min()
    max_val = raw_scores.max()
    
    if max_val - min_val > 1e-6:
        scaled_scores = (raw_scores - min_val) / (max_val - min_val) * 100
    else:
        scaled_scores = np.ones_like(raw_scores) * 50.0
        
    result = {}
    for i, acc_id in enumerate(account_ids):
        result[acc_id] = float(scaled_scores[i])
        
    return result
