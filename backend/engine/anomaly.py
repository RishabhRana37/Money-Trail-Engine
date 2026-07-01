"""
engine/anomaly.py
=================
Unsupervised anomaly detection using IsolationForest.

Exports two functions:
    train_isolation_forest  — fits scaler + model, returns normalised scores
    score_new_accounts      — scores a new feature DataFrame using a
                              previously fitted model + scaler pair
"""

import time

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import MinMaxScaler


# ---------------------------------------------------------------------------
# Internal helper
# ---------------------------------------------------------------------------
def _normalize_scores(raw: np.ndarray) -> np.ndarray:
    """Min-max normalise *raw* scores to the [0, 100] range.

    Parameters
    ----------
    raw : np.ndarray
        1-D array of raw (positive) anomaly scores.

    Returns
    -------
    np.ndarray
        Values rescaled to [0, 100] where 100 = most anomalous.
    """
    r_min, r_max = raw.min(), raw.max()
    if r_max == r_min:
        # Degenerate case: all scores identical → return 0s
        return np.zeros_like(raw, dtype=float)
    return (raw - r_min) / (r_max - r_min) * 100.0


# ---------------------------------------------------------------------------
# Function 1 — train
# ---------------------------------------------------------------------------
def train_isolation_forest(
    feat_df: pd.DataFrame,
    ml_features: list[str],
) -> tuple[IsolationForest, MinMaxScaler, pd.Series]:
    """Fit a MinMaxScaler and IsolationForest on the account feature matrix.

    The model is trained in the unsupervised setting (no fraud labels
    required). IsolationForest assigns every account a raw anomaly score;
    these are inverted and normalised to a 0–100 scale where **100 is the
    most anomalous**.

    Parameters
    ----------
    feat_df : pd.DataFrame
        Account-level feature DataFrame produced by
        ``features.build_account_features``.  Must contain all columns
        listed in *ml_features*.
    ml_features : list[str]
        Ordered list of feature column names to use (matches
        ``features.ML_FEATURES``).

    Returns
    -------
    model : IsolationForest
        Fitted IsolationForest instance.
    scaler : MinMaxScaler
        Fitted MinMaxScaler (must be passed to ``score_new_accounts``).
    anomaly_scores : pd.Series
        Per-account anomaly scores in [0, 100], indexed by ``feat_df.index``,
        named ``"anomaly_score"``.
    """
    t0 = time.time()

    # ── Step 1: extract feature matrix ────────────────────────────────────
    X = feat_df[ml_features].fillna(0).values  # (n_accounts, n_features)

    # ── Step 2: scale features to [0, 1] ──────────────────────────────────
    scaler = MinMaxScaler()
    X_scaled = scaler.fit_transform(X)

    # ── Step 3: fit IsolationForest ────────────────────────────────────────
    model = IsolationForest(
        n_estimators=200,
        contamination=0.05,
        max_features=0.8,
        random_state=42,
        n_jobs=-1,
    )
    model.fit(X_scaled)

    # ── Step 4: compute raw anomaly scores ────────────────────────────────
    # score_samples returns negative values; higher (less negative) = normal.
    # Negate so that higher = more anomalous.
    raw = -model.score_samples(X_scaled)      # shape: (n_accounts,)

    # ── Step 5: normalise to [0, 100] ─────────────────────────────────────
    normalised = _normalize_scores(raw)

    # ── Step 6: wrap in a named Series ────────────────────────────────────
    anomaly_scores = pd.Series(
        normalised,
        index=feat_df.index,
        name="anomaly_score",
    )

    elapsed = time.time() - t0

    # ── Summary print ─────────────────────────────────────────────────────
    print(f"IsolationForest trained in {elapsed:.1f}s")
    print(
        f"Anomaly score stats — "
        f"min: {normalised.min():.2f}, "
        f"max: {normalised.max():.2f}, "
        f"mean: {normalised.mean():.2f}"
    )

    return model, scaler, anomaly_scores


# ---------------------------------------------------------------------------
# Function 2 — inference
# ---------------------------------------------------------------------------
def score_new_accounts(
    feat_df: pd.DataFrame,
    ml_features: list[str],
    model: IsolationForest,
    scaler: MinMaxScaler,
) -> pd.Series:
    """Score new accounts using a previously fitted IsolationForest + scaler.

    Applies the same scaling and scoring pipeline used during training so
    that scores remain comparable across calls.

    Parameters
    ----------
    feat_df : pd.DataFrame
        Account-level feature DataFrame for the accounts to score.  Must
        contain all columns listed in *ml_features*.
    ml_features : list[str]
        Ordered list of feature column names (must match the list used
        when the model was trained).
    model : IsolationForest
        Fitted IsolationForest returned by ``train_isolation_forest``.
    scaler : MinMaxScaler
        Fitted MinMaxScaler returned by ``train_isolation_forest``.

    Returns
    -------
    pd.Series
        Per-account anomaly scores in [0, 100], indexed by ``feat_df.index``,
        named ``"anomaly_score"``.

    Notes
    -----
    Scores are normalised independently within this batch (min-max over the
    *new* accounts), so they should be interpreted relative to each other
    rather than compared directly to scores from the training run.
    """
    # ── Step 1: extract + clean feature matrix ────────────────────────────
    X = feat_df[ml_features].fillna(0).values

    # ── Step 2: apply the fitted scaler (no re-fitting) ───────────────────
    X_scaled = scaler.transform(X)

    # ── Step 3: compute raw anomaly scores ────────────────────────────────
    raw = -model.score_samples(X_scaled)

    # ── Step 4: normalise to [0, 100] ─────────────────────────────────────
    normalised = _normalize_scores(raw)

    return pd.Series(
        normalised,
        index=feat_df.index,
        name="anomaly_score",
    )
