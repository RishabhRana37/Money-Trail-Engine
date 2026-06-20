# pip install pandas numpy lightgbm scikit-learn joblib pyarrow

import os
import sys
import time
import json
import warnings
import numpy as np
import pandas as pd
import lightgbm as lgb
from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score, average_precision_score, precision_recall_fscore_support, confusion_matrix
from sklearn.calibration import CalibratedClassifierCV
import joblib

# Suppress warnings for cleaner logs
warnings.filterwarnings("ignore")

# =====================================================================
# CONFIGURATION
# =====================================================================
SAMPLE_ROWS = 200_000  # Set to None for full run (5M+ rows)
DATA_DIR = "./data"
CSV_PATH = os.path.join(DATA_DIR, "dataset.csv")
PARQUET_PATH = os.path.join(DATA_DIR, "dataset.parquet")
TARGET_COL = "target_column_name"
MODEL_SAVE_PATH = "./models/risk_model.joblib"

# =====================================================================
# SYNTHETIC DATA GENERATOR (Runs if no data is found)
# =====================================================================
def generate_synthetic_data(path, num_rows=250000):
    print("=" * 70)
    print(f"DATASET NOT FOUND: Generating synthetic dataset at {path}...")
    print("=" * 70)
    np.random.seed(42)
    
    data = {
        "transaction_id": [f"TXN_{i:09d}" for i in range(num_rows)],
        "timestamp": pd.date_range(start="2026-01-01", periods=num_rows, freq="s").strftime("%Y-%m-%dT%H:%M:%SZ"),
        "user_id": [f"USR_{np.random.randint(1000, 50000):05d}" for _ in range(num_rows)],
        "login_ip": [f"192.168.{np.random.randint(1, 255)}.{np.random.randint(1, 255)}" for _ in range(num_rows)],
        "amount": np.random.exponential(scale=200, size=num_rows).astype(np.float32),
        "failed_attempts": np.random.poisson(lam=0.2, size=num_rows).astype(np.int32),
        "device_type": np.random.choice(["mobile", "desktop", "tablet", "smart_tv"], size=num_rows),
        "location": np.random.choice(["US", "IN", "DE", "CN", "RU", "BR", "GB", "FR"], size=num_rows, p=[0.4, 0.2, 0.1, 0.1, 0.05, 0.05, 0.05, 0.05]),
        "connection_speed": np.random.normal(loc=50, scale=15, size=num_rows).astype(np.float32),
        "is_vpn": np.random.choice([0, 1], size=num_rows, p=[0.92, 0.08]).astype(np.int8),
        "hour_of_day": np.random.randint(0, 24, size=num_rows).astype(np.int32),
        "target_column_name": np.random.choice([0, 1], size=num_rows, p=[0.97, 0.03]).astype(np.int8)
    }
    
    df = pd.DataFrame(data)
    
    # Correlate VPN + Failed Attempts + specific locations with fraud
    fraud_mask = (df["is_vpn"] == 1) & (df["failed_attempts"] > 1) & (df["location"].isin(["RU", "CN"]))
    df.loc[fraud_mask, "target_column_name"] = np.random.choice([0, 1], size=fraud_mask.sum(), p=[0.2, 0.8])
    
    # Correlate large amounts + VPN with fraud
    high_amt_mask = (df["amount"] > 1000) & (df["is_vpn"] == 1)
    df.loc[high_amt_mask, "target_column_name"] = np.random.choice([0, 1], size=high_amt_mask.sum(), p=[0.4, 0.6])
    
    os.makedirs(os.path.dirname(path), exist_ok=True)
    df.to_csv(path, index=False)
    print(f"Synthetic dataset of {num_rows} rows generated successfully.\n")

# =====================================================================
# DATA PIPELINE HELPERS
# =====================================================================
def auto_drop_leakage_and_ids(df, target_col):
    print("Scanning for ID columns and raw timestamps...")
    cols_to_drop = []
    n_rows = len(df)
    
    for col in df.columns:
        if col == target_col:
            continue
            
        n_unique = df[col].nunique()
        is_string_like = df[col].dtype == 'object' or isinstance(df[col].dtype, pd.CategoricalDtype)
        
        # Drop high-cardinality string IDs
        if is_string_like and n_unique > 0.95 * n_rows:
            cols_to_drop.append((col, f"Near-unique string ID ({n_unique} unique values for {n_rows} rows)"))
            continue
            
        # Drop patterns commonly matching IDs
        if any(term in col.lower() for term in ["uuid", "guid", "session_id", "txn_id", "transaction_id"]) and n_unique > 0.5 * n_rows:
            cols_to_drop.append((col, f"ID-like name pattern with high cardinality ({n_unique} unique values)"))
            continue
            
        # Drop datetime types
        if pd.api.types.is_datetime64_any_dtype(df[col]):
            cols_to_drop.append((col, "Datetime column"))
            continue
            
        # Drop object timestamps
        if df[col].dtype == 'object':
            sample = df[col].dropna().head(100)
            if len(sample) > 0:
                try:
                    parsed = pd.to_datetime(sample, errors='coerce')
                    if parsed.notna().sum() > 0.8 * len(sample):
                        cols_to_drop.append((col, "String formatted datetime/timestamp"))
                        continue
                except:
                    pass
                    
    for col, reason in cols_to_drop:
        print(f"  -> Dropping column '{col}': {reason}")
        df = df.drop(columns=[col])
        
    return df

def optimize_dtypes(df, target_col):
    print("Downcasting numeric types and optimizing categories...")
    mem_before = df.memory_usage(deep=True).sum() / 1e6
    
    for col in df.columns:
        if col == target_col:
            df[col] = df[col].astype(np.int8)
            continue
            
        if pd.api.types.is_integer_dtype(df[col]):
            c_min = df[col].min()
            c_max = df[col].max()
            if c_min >= 0:
                if c_max < 255:
                    df[col] = df[col].astype(np.uint8)
                elif c_max < 65535:
                    df[col] = df[col].astype(np.uint16)
                elif c_max < 4294967295:
                    df[col] = df[col].astype(np.uint32)
                else:
                    df[col] = df[col].astype(np.uint64)
            else:
                if c_min > -128 and c_max < 127:
                    df[col] = df[col].astype(np.int8)
                elif c_min > -32768 and c_max < 32767:
                    df[col] = df[col].astype(np.int16)
                elif c_min > -2147483648 and c_max < 2147483647:
                    df[col] = df[col].astype(np.int32)
                else:
                    df[col] = df[col].astype(np.int64)
                    
        elif pd.api.types.is_float_dtype(df[col]):
            df[col] = df[col].astype(np.float32)
            
        elif df[col].dtype == 'object':
            # Check if binary boolean represented as string
            unique_vals = df[col].dropna().unique()
            if len(unique_vals) <= 2 and all(str(v).lower() in ['true', 'false', '1', '0', 'y', 'n', 't', 'f'] for v in unique_vals):
                df[col] = df[col].map(lambda x: 1 if str(x).lower() in ['true', '1', 'y', 't'] else 0).astype(np.int8)
            else:
                df[col] = df[col].astype('category')
                
    mem_after = df.memory_usage(deep=True).sum() / 1e6
    reduction = ((mem_before - mem_after) / mem_before) * 100
    print(f"  -> Memory usage reduced from {mem_before:.2f} MB to {mem_after:.2f} MB ({reduction:.1f}% reduction)")
    return df

# =====================================================================
# FAST PREPROCESSOR CLASS
# =====================================================================
class FastPreprocessor:
    def __init__(self, target_col):
        self.target_col = target_col
        self.medians = {}
        self.categorical_cols = []
        self.numeric_cols = []
        
    def fit(self, df):
        for col in df.columns:
            if col == self.target_col:
                continue
            if isinstance(df[col].dtype, pd.CategoricalDtype) or df[col].dtype == 'object':
                self.categorical_cols.append(col)
            else:
                self.numeric_cols.append(col)
                # Compute median
                self.medians[col] = df[col].median()
                if pd.isna(self.medians[col]):
                    self.medians[col] = 0.0
                    
    def transform(self, df):
        df_out = df.copy()
        # Impute numeric
        for col in self.numeric_cols:
            if col in df_out.columns:
                df_out[col] = df_out[col].fillna(self.medians[col]).astype(np.float32)
                
        # Fill categorical
        for col in self.categorical_cols:
            if col in df_out.columns:
                if isinstance(df_out[col].dtype, pd.CategoricalDtype):
                    if 'MISSING' not in df_out[col].cat.categories:
                        df_out[col] = df_out[col].cat.add_categories('MISSING')
                df_out[col] = df_out[col].fillna('MISSING').astype('category')
                
        return df_out

# =====================================================================
# RISK SCORE MAPPER
# =====================================================================
def get_risk_band(score):
    if score <= 24:
        return "LOW"
    elif score <= 49:
        return "MEDIUM"
    elif score <= 74:
        return "HIGH"
    else:
        return "CRITICAL"

def predict_theft_risk(calibrator, X):
    # Predict calibrated probabilities
    probs = calibrator.predict_proba(X)[:, 1]
    scores = np.round(probs * 100).astype(int)
    bands = [get_risk_band(s) for s in scores]
    return scores, bands

# =====================================================================
# MAIN RUNNER
# =====================================================================
def main():
    total_start = time.time()
    
    # Check for dataset
    has_parquet = os.path.exists(PARQUET_PATH)
    has_csv = os.path.exists(CSV_PATH)
    
    if not (has_parquet or has_csv):
        generate_synthetic_data(CSV_PATH)
        has_csv = True
        
    target_path = PARQUET_PATH if has_parquet else CSV_PATH
    
    # Print Run Banner
    print("=" * 70)
    if SAMPLE_ROWS is not None:
        print(f" RUN MODE: DRY RUN / SUBSAMPLE ({SAMPLE_ROWS:,} rows limit)")
    else:
        print(" RUN MODE: FULL RUN (5,000,000+ rows)")
    print(f" Source File: {target_path}")
    print("=" * 70)
    
    # 1. DATA LOADING
    load_start = time.time()
    print("Loading data...")
    
    if target_path.endswith('.parquet'):
        # Parquet loading (fast)
        if SAMPLE_ROWS is not None:
            # We must load row-limited if possible, or sample from the parquet file
            df = pd.read_parquet(target_path).head(SAMPLE_ROWS)
        else:
            df = pd.read_parquet(target_path)
    else:
        # CSV loading (optimized with pyarrow if installed)
        csv_kwargs = {}
        try:
            import pyarrow
            csv_kwargs['engine'] = 'pyarrow'
            print("  Using pyarrow engine for CSV parsing...")
        except ImportError:
            pass
            
        if SAMPLE_ROWS is not None:
            csv_kwargs['nrows'] = SAMPLE_ROWS
            if 'engine' in csv_kwargs:
                del csv_kwargs['engine']
            
        df = pd.read_csv(target_path, **csv_kwargs)
        
    load_time = time.time() - load_start
    print(f"Loaded {df.shape[0]:,} rows, {df.shape[1]} columns in {load_time:.2f} seconds.")
    
    # Check if target column exists
    if TARGET_COL not in df.columns:
        # Fallback search if TARGET_COL mismatch
        possible_targets = [col for col in df.columns if 'target' in col.lower() or col in ['is_theft', 'is_fraud', 'compromise', 'fraud']]
        if possible_targets:
            actual_target = possible_targets[0]
            print(f"Target column '{TARGET_COL}' not found. Auto-detected target: '{actual_target}'")
        else:
            raise KeyError(f"Target column name '{TARGET_COL}' not found in dataset columns: {list(df.columns)}")
    else:
        actual_target = TARGET_COL
        
    # Print Nulls Summary
    null_counts = df.isnull().sum()
    total_nulls = null_counts.sum()
    print(f"Total null values: {total_nulls:,}")
    if total_nulls > 0:
        print("Null Summary (top 5 columns):")
        print(null_counts[null_counts > 0].sort_values(ascending=False).head(5))
        
    # Auto-drop Leakage/IDs
    df = auto_drop_leakage_and_ids(df, actual_target)
    
    # Optimize Data Types
    df = optimize_dtypes(df, actual_target)
    
    # 2. SPLIT & PREPROCESS
    print("Splitting train and validation sets (80/20)...")
    train_df, val_df = train_test_split(
        df, test_size=0.2, random_state=42, stratify=df[actual_target]
    )
    
    # Calculate imbalance weights
    negatives = (train_df[actual_target] == 0).sum()
    positives = (train_df[actual_target] == 1).sum()
    pos_ratio = positives / len(train_df)
    scale_pos_weight = negatives / positives if positives > 0 else 1.0
    print(f"Positive class ratio: {pos_ratio*100:.3f}% (Imbalance multiplier: {scale_pos_weight:.2f})")
    
    print("Preprocessing datasets...")
    preprocessor = FastPreprocessor(actual_target)
    preprocessor.fit(train_df)
    
    train_prep = preprocessor.transform(train_df)
    val_prep = preprocessor.transform(val_df)
    
    # Separate features and targets
    feature_cols = [c for c in train_prep.columns if c != actual_target]
    X_train = train_prep[feature_cols]
    y_train = train_prep[actual_target]
    X_val = val_prep[feature_cols]
    y_val = val_prep[actual_target]
    
    # 3. TRAIN LIGHTGBM
    train_start = time.time()
    print("Configuring LightGBM Classifier...")
    
    params = {
        'objective': 'binary',
        'n_estimators': 1500,
        'learning_rate': 0.05,
        'num_leaves': 63,
        'feature_fraction': 0.8,
        'bagging_fraction': 0.8,
        'bagging_freq': 1,
        'n_jobs': -1,
        'random_state': 42,
        'scale_pos_weight': scale_pos_weight
    }
    
    # Attempt GPU training with CPU fallback
    model = None
    try:
        print("  Attempting training on GPU device...")
        model = lgb.LGBMClassifier(**params, device='gpu')
        model.fit(
            X_train, y_train,
            eval_set=[(X_val, y_val)],
            eval_metric='auc',
            callbacks=[lgb.early_stopping(stopping_rounds=50, verbose=False)]
        )
        print("  -> GPU training successful.")
    except Exception as e:
        print(f"  -> GPU training failed ({e}). Falling back to CPU...")
        model = lgb.LGBMClassifier(**params, device='cpu')
        model.fit(
            X_train, y_train,
            eval_set=[(X_val, y_val)],
            eval_metric='auc',
            callbacks=[lgb.early_stopping(stopping_rounds=50, verbose=False)]
        )
        print("  -> CPU training completed successfully.")
        
    train_time = time.time() - train_start
    print(f"Model trained in {train_time:.2f} seconds.")
    
    # 4. CALIBRATION
    print("Calibrating predicted probabilities (Isotonic, CV Prefit)...")
    calibrator = CalibratedClassifierCV(estimator=model, method='isotonic', cv='prefit')
    calibrator.fit(X_val, y_val)
    
    # 5. EVALUATION
    probs = calibrator.predict_proba(X_val)[:, 1]
    roc_auc = roc_auc_score(y_val, probs)
    pr_auc = average_precision_score(y_val, probs)
    
    print("\n" + "=" * 70)
    print(" MODEL PERFORMANCE EVALUATION")
    print("=" * 70)
    print(f"ROC-AUC Score: {roc_auc:.5f}")
    print(f"PR-AUC Score (Average Precision): {pr_auc:.5f}")
    
    # Threshold Analysis
    print(f"\n{'Threshold':<12}{'Precision':<12}{'Recall':<12}{'F1-Score':<12}")
    print("-" * 48)
    thresholds = np.arange(0.1, 1.0, 0.1)
    threshold_metrics = []
    
    for t in thresholds:
        preds = (probs >= t).astype(int)
        precision, recall, f1, _ = precision_recall_fscore_support(y_val, preds, average='binary', zero_division=0)
        t_str = f"{t:.1f}"
        print(f"{t_str:<12}{precision*100:.2f}%     {recall*100:.2f}%     {f1*100:.2f}%")
        threshold_metrics.append({
            "threshold": float(t),
            "precision": float(precision),
            "recall": float(recall),
            "f1_score": float(f1)
        })
        
    # Confusion Matrix
    cm = confusion_matrix(y_val, (probs >= 0.5).astype(int))
    print("\nConfusion Matrix (at Default 0.5 Threshold):")
    print(f"  Actual Negative (0) -> TN: {cm[0,0]:<8} | FP: {cm[0,1]}")
    print(f"  Actual Positive (1) -> FN: {cm[1,0]:<8} | TP: {cm[1,1]}")
    
    # Feature Importance
    importance_gain = model.booster_.feature_importance(importance_type='gain')
    importance_df = pd.DataFrame({
        'Feature': feature_cols,
        'Gain': importance_gain
    }).sort_values(by='Gain', ascending=False).head(15)
    
    print("\nTop 15 Feature Importances by Gain:")
    for idx, row in importance_df.iterrows():
        print(f"  - {row['Feature']}: {row['Gain']:.2f}")
        
    # Save Metrics to JSON
    metrics_json = {
        "roc_auc": float(roc_auc),
        "pr_auc": float(pr_auc),
        "confusion_matrix_0.5": {
            "tn": int(cm[0, 0]),
            "fp": int(cm[0, 1]),
            "fn": int(cm[1, 0]),
            "tp": int(cm[1, 1])
        },
        "thresholds": threshold_metrics,
        "top_features": importance_df.to_dict(orient='records')
    }
    with open("metrics.json", "w") as f:
        json.dump(metrics_json, f, indent=4)
    print("\nAll performance metrics exported to ./metrics.json")
    
    # 6. PERSISTENCE
    os.makedirs(os.path.dirname(MODEL_SAVE_PATH), exist_ok=True)
    print(f"Saving artifacts to {MODEL_SAVE_PATH}...")
    joblib.dump({
        "preprocessor": preprocessor,
        "calibrator": calibrator,
        "feature_cols": feature_cols
    }, MODEL_SAVE_PATH)
    print("Model pipeline saved successfully.")
    
    # 7. INFERENCE SMOKE TEST
    print("\n" + "=" * 70)
    print(" BUILT-IN INFERENCE SMOKE TEST")
    print("=" * 70)
    # Load model
    saved_pipeline = joblib.load(MODEL_SAVE_PATH)
    loaded_prep = saved_pipeline["preprocessor"]
    loaded_calib = saved_pipeline["calibrator"]
    loaded_features = saved_pipeline["feature_cols"]
    
    # Sample 3 validation rows
    sample_rows = val_df.sample(3, random_state=42)
    sample_prep = loaded_prep.transform(sample_rows)
    X_sample = sample_prep[loaded_features]
    
    scores, bands = predict_theft_risk(loaded_calib, X_sample)
    
    for idx, (score, band) in enumerate(zip(scores, bands)):
        actual_lbl = sample_rows.iloc[idx][actual_target]
        print(f"  Sample {idx+1}: Score = {score:<3} | Band = {band:<8} | True Label = {actual_lbl}")
        
    total_time = time.time() - total_start
    print(f"\nTiming summary: Data-load: {load_time:.2f}s | Train: {train_time:.2f}s | Total: {total_time:.2f}s")
    print("=" * 70)

if __name__ == "__main__":
    main()
