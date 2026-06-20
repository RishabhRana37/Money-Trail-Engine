import sys
import os

# Add parent directory to path so we can import modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.generator import generate_synthetic_dataset
from backend.engine.features import compute_features
from backend.engine.anomaly import compute_anomaly_scores
from backend.engine.patterns import detect_patterns
from backend.engine.risk import fuse_risk_scores

def run_tests():
    print("="*60)
    print("RUNNING AURA DETECTOR PIPELINE INTEGRATION TEST")
    print("="*60)
    
    # 1. Generate dataset
    print("[1/5] Generating Synthetic Dataset...")
    state = generate_synthetic_dataset(num_accounts=150, num_transactions=1500, fraud_intensity="medium", seed=42)
    
    assert len(state.accounts) >= 150, f"Expected >= 150 accounts, got {len(state.accounts)}"
    assert len(state.transactions) >= 1000, f"Expected transactions, got {len(state.transactions)}"
    assert len(state.ground_truth_rings) > 0, "Expected some injected fraud rings"
    
    print(f"  Generated {len(state.accounts)} accounts and {len(state.transactions)} transactions.")
    print(f"  Injected {len(state.ground_truth_rings)} fraud rings.")
    print(f"  Ground truth dirty accounts: {len(state.ground_truth_dirty_accounts)}")
    
    # 2. Compute Features
    print("[2/5] Engineering Account Features...")
    features_df = compute_features(state.accounts, state.transactions)
    
    assert not features_df.empty, "Features dataframe is empty"
    assert "pass_through_ratio" in features_df.columns, "pass_through_ratio missing"
    assert "betweenness_centrality" in features_df.columns, "betweenness_centrality missing"
    print(f"  Feature matrix size: {features_df.shape}")
    
    # 3. Anomaly Scores
    print("[3/5] Scoring Behavior Anomaly (IsolationForest)...")
    anomaly_scores = compute_anomaly_scores(features_df)
    
    assert len(anomaly_scores) == len(state.accounts), "Mismatch in anomaly scores count"
    assert any(score > 0 for score in anomaly_scores.values()), "All anomaly scores are zero"
    print("  IsolationForest scored successfully.")
    
    # 4. Pattern Detection
    print("[4/5] Detecting Graph Patterns (NetworkX)...")
    alerts = detect_patterns(state.accounts, state.transactions, features_df)
    
    print(f"  Generated {len(alerts)} alerts.")
    for alert in alerts:
        print(f"    - [{alert['pattern_type'].upper()}] Severity: {alert['severity']}, Amount: INR {alert['amount_involved']:,.2f}")
        
    # 5. Risk Fusion & Explanations
    print("[5/5] Fusing Scores & Generating Explanations...")
    results = fuse_risk_scores(features_df, anomaly_scores, alerts)
    
    assert len(results) == len(state.accounts), "Mismatch in risk results count"
    
    # Analyze accuracy
    tp = 0
    fp = 0
    fn = 0
    
    for acc_id, res in results.items():
        is_dirty = acc_id in state.ground_truth_dirty_accounts
        is_flagged = res["risk_score"] >= 70
        
        if is_flagged and is_dirty:
            tp += 1
        elif is_flagged and not is_dirty:
            fp += 1
        elif not is_flagged and is_dirty:
            fn += 1
            
    precision = (tp / (tp + fp)) * 100 if (tp + fp) > 0 else 0.0
    recall = (tp / (tp + fn)) * 100 if (tp + fn) > 0 else 0.0
    
    print("\n" + "="*60)
    print("DETECTOR ACCURACY METRICS")
    print("-"*60)
    print(f"True Positives (Flagged & Dirty)  : {tp}")
    print(f"False Positives (Flagged & Clean) : {fp}")
    print(f"False Negatives (Missed & Dirty)  : {fn}")
    print(f"Precision                         : {precision:.2f}%")
    print(f"Recall (Fraud Recovery Rate)      : {recall:.2f}%")
    print("="*60)
    
    # Assert sensible recovery rate (recall should be > 50% for seed=42)
    assert recall >= 50.0, f"Recall too low: {recall:.2f}%"
    print("\nAll integration tests passed successfully!")

if __name__ == "__main__":
    run_tests()
