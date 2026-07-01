"""
engine/train.py
===============
Master training pipeline for AURA.

Orchestrates all engine modules in the correct order:
    loader → features → anomaly → graph → patterns → risk → serialize

Saves all artifacts to the output_dir (default: artifacts/) so that
the FastAPI server can load them at startup without re-training.

Usage (CLI):
    python engine/train.py                          # uses dataset_small.csv
    python engine/train.py path/to/custom.csv       # custom dataset
"""

import os
import json
import pickle
import sys
import time

# Ensure the backend/ directory (parent of engine/) is on sys.path so
# that `from engine.xxx import yyy` works whether this module is imported
# by FastAPI or run directly as a script.
_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

import pandas as pd


# ---------------------------------------------------------------------------
# Master training function
# ---------------------------------------------------------------------------
def run_full_training(
    csv_path: str = "dataset_small.csv",
    output_dir: str = "artifacts/",
) -> dict:
    """Run the full AURA training pipeline and persist all artifacts.

    Calls every engine module in dependency order, then writes the
    resulting model, scaler, feature list, scored account table,
    aggregated edge table, alerts, and accuracy report to *output_dir*.

    Parameters
    ----------
    csv_path : str
        Path to the raw transaction CSV file.
        Defaults to ``"dataset_small.csv"`` (relative to the working dir).
    output_dir : str
        Directory where all artifact files will be written.
        Created automatically if it does not exist.

    Returns
    -------
    dict
        Summary containing:
        ``elapsed_seconds``, ``num_accounts``, ``num_alerts``,
        ``critical_accounts``, ``high_risk_accounts``, ``output_dir``,
        and the full ``accuracy_report`` sub-dict.
    """
    os.makedirs(output_dir, exist_ok=True)
    t_total = time.time()

    print("═" * 50)
    print("  AURA Training Pipeline")
    print("═" * 50)

    # ------------------------------------------------------------------
    # STEP 1 — Load data
    # ------------------------------------------------------------------
    print("\n[1/7] Loading data...")
    from engine.loader import load_and_aggregate
    edges_df, gt_df, col_map = load_and_aggregate(csv_path)

    # ------------------------------------------------------------------
    # STEP 2 — Feature engineering
    # ------------------------------------------------------------------
    print("\n[2/7] Building account features...")
    from engine.features import build_account_features
    feat_df, ML_FEATURES = build_account_features(edges_df)

    # ------------------------------------------------------------------
    # STEP 3 — Anomaly detection
    # ------------------------------------------------------------------
    print("\n[3/7] Training IsolationForest...")
    from engine.anomaly import train_isolation_forest
    model, scaler, anomaly_scores = train_isolation_forest(feat_df, ML_FEATURES)
    feat_df["anomaly_score"] = anomaly_scores.values

    # ------------------------------------------------------------------
    # STEP 4 — Build transaction graph
    # ------------------------------------------------------------------
    print("\n[4/7] Building transaction graph...")
    suspicious_accounts = set(feat_df[feat_df["anomaly_score"] > 40]["account_id"])
    print(f"    Suspicious seed accounts: {len(suspicious_accounts):,}")

    from engine.patterns import (
        build_graph,
        compute_centrality,
        detect_circular_patterns,
        detect_fan_patterns,
        detect_rapid_movement,
        build_alerts,
    )
    G = build_graph(edges_df, suspicious_accounts)

    # ------------------------------------------------------------------
    # STEP 5 — Detect fraud patterns
    # ------------------------------------------------------------------
    print("\n[5/7] Detecting fraud patterns...")
    centrality      = compute_centrality(G)
    cycles          = detect_circular_patterns(G)
    fan_in, fan_out = detect_fan_patterns(G)
    rapid           = detect_rapid_movement(feat_df)

    # ------------------------------------------------------------------
    # STEP 6 — Fuse risk scores
    # ------------------------------------------------------------------
    print("\n[6/7] Fusing risk scores...")
    from engine.risk import fuse_risk_scores, evaluate_accuracy
    feat_df = fuse_risk_scores(
        feat_df, anomaly_scores, centrality,
        cycles, fan_in, fan_out, rapid,
    )

    # Evaluate against ground truth labels if available
    accuracy_report: dict = {}
    if not gt_df.empty:
        print("\n    Evaluating against ground truth labels...")
        accuracy_report = evaluate_accuracy(feat_df, gt_df)

    # Build structured alert list
    alerts = build_alerts(cycles, fan_in, fan_out, rapid, G, feat_df)

    # ------------------------------------------------------------------
    # STEP 7 — Save artifacts
    # ------------------------------------------------------------------
    print("\n[7/7] Saving artifacts...")

    # IsolationForest model
    with open(f"{output_dir}/model.pkl", "wb") as f:
        pickle.dump(model, f)
    print("    ✅ saved model.pkl")

    # MinMaxScaler
    with open(f"{output_dir}/scaler.pkl", "wb") as f:
        pickle.dump(scaler, f)
    print("    ✅ saved scaler.pkl")

    # Ordered ML feature list (must match model training order)
    with open(f"{output_dir}/ml_features.pkl", "wb") as f:
        pickle.dump(ML_FEATURES, f)
    print("    ✅ saved ml_features.pkl")

    # Scored account table (one row per account, all features + risk)
    feat_df.to_parquet(f"{output_dir}/accounts.parquet", index=False)
    print("    ✅ saved accounts.parquet")

    # Aggregated edge table (sum amount + count per sender→receiver pair)
    edges_agg = (
        edges_df
        .groupby(["from_account", "to_account"], sort=False)
        .agg(amount=("amount", "sum"), txn_count=("amount", "count"))
        .reset_index()
    )
    edges_agg.to_parquet(f"{output_dir}/edges.parquet", index=False)
    print("    ✅ saved edges.parquet")

    # Alerts JSON
    json.dump(alerts, open(f"{output_dir}/alerts.json", "w"), indent=2)
    print("    ✅ saved alerts.json")

    # Accuracy report JSON
    json.dump(accuracy_report, open(f"{output_dir}/accuracy.json", "w"), indent=2)
    print("    ✅ saved accuracy.json")

    # ------------------------------------------------------------------
    # Final summary
    # ------------------------------------------------------------------
    elapsed        = time.time() - t_total
    num_accounts   = len(feat_df)
    num_alerts     = len(alerts)
    critical_count = int((feat_df["risk_score"] >= 90).sum())
    high_count     = int((feat_df["risk_score"] >= 70).sum())

    print("\n" + "═" * 50)
    print(f"✅ Training complete in {elapsed:.0f}s")
    print(f"   Accounts scored   : {num_accounts:,}")
    print(f"   Alerts generated  : {num_alerts}")
    print(f"   Critical accounts : {critical_count}")
    print(f"   High risk accounts: {high_count}")
    print(f"   Artifacts saved → {output_dir}")
    print("═" * 50)

    return {
        "elapsed_seconds":   round(elapsed, 1),
        "num_accounts":      num_accounts,
        "num_alerts":        num_alerts,
        "critical_accounts": critical_count,
        "high_risk_accounts": high_count,
        "output_dir":        output_dir,
        "accuracy_report":   accuracy_report,
    }


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import sys
    csv_path = sys.argv[1] if len(sys.argv) > 1 else "dataset_small.csv"
    run_full_training(csv_path=csv_path)
