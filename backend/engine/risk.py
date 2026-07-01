"""
engine/risk.py
==============
Risk score fusion and explainability layer.

Takes the outputs of every prior engine stage (features, anomaly scores,
centrality, pattern flags) and fuses them into a single 0-100 risk score
per account, a human-readable risk level, and a SHAP-lite explanation list.

Exports:
    fuse_risk_scores   — fuse all signals → risk_score + risk_level columns
    build_explanation  — per-account SHAP-lite explanation list
    evaluate_accuracy  — precision / recall / F1 against ground truth labels
"""

from typing import Optional

import numpy as np
import pandas as pd


# ---------------------------------------------------------------------------
# FUNCTION 1 — fuse_risk_scores
# ---------------------------------------------------------------------------
def fuse_risk_scores(
    feat_df: pd.DataFrame,
    anomaly_scores: pd.Series,
    centrality_dict: dict,
    cycles: list[list[str]],
    fan_in_accounts: set,
    fan_out_accounts: set,
    rapid_accounts: set,
) -> pd.DataFrame:
    """Fuse anomaly, pattern, and centrality signals into a unified risk score.

    Combines three independent detection signals using a weighted formula::

        risk_score = 0.45 × anomaly_score
                   + 0.35 × pattern_score
                   + 0.20 × centrality_score

    All component scores are normalised to [0, 100] before fusion so that
    no single signal dominates by scale.

    Parameters
    ----------
    feat_df : pd.DataFrame
        Account feature DataFrame from ``features.build_account_features``.
        Must contain ``account_id`` as a regular column.
    anomaly_scores : pd.Series
        Per-account anomaly scores (0–100) from ``anomaly.train_isolation_forest``,
        indexed by ``feat_df.index``.
    centrality_dict : dict
        Raw betweenness centrality values from ``patterns.compute_centrality``,
        keyed by account_id string.
    cycles : list[list[str]]
        Circular cycles from ``patterns.detect_circular_patterns``.
    fan_in_accounts : set
        High fan-in hub accounts from ``patterns.detect_fan_patterns``.
    fan_out_accounts : set
        High fan-out distributor accounts from ``patterns.detect_fan_patterns``.
    rapid_accounts : set
        Rapid pass-through accounts from ``patterns.detect_rapid_movement``.

    Returns
    -------
    pd.DataFrame
        Copy of *feat_df* with additional columns:
        ``anomaly_score``, ``centrality_score``, ``in_cycle``, ``is_fan_in``,
        ``is_fan_out``, ``is_rapid``, ``pattern_score``, ``risk_score``,
        ``risk_level``.
    """
    df = feat_df.copy()

    # ── Anomaly score (from IsolationForest, already 0-100) ───────────────
    df["anomaly_score"] = anomaly_scores.values

    # ── Centrality score: normalise raw betweenness → 0-100 ──────────────
    raw_c = df["account_id"].map(centrality_dict).fillna(0.0)
    c_min, c_max = raw_c.min(), raw_c.max()
    df["centrality_score"] = ((raw_c - c_min) / (c_max - c_min + 1e-9) * 100)

    # ── Pattern membership flags ──────────────────────────────────────────

    # Flatten all cycle members into a single set
    cycle_members: set = {acct for cycle in cycles for acct in cycle}

    df["in_cycle"]   = df["account_id"].isin(cycle_members).astype(float)
    df["is_fan_in"]  = df["account_id"].isin(fan_in_accounts).astype(float)
    df["is_fan_out"] = df["account_id"].isin(fan_out_accounts).astype(float)
    df["is_rapid"]   = df["account_id"].isin(rapid_accounts).astype(float)

    # ── Pattern score: weighted sum of membership flags, clipped 0-100 ────
    df["pattern_score"] = (
        df["in_cycle"]   * 50
        + df["is_fan_in"]  * 25
        + df["is_fan_out"] * 25
        + df["is_rapid"]   * 20
    ).clip(0, 100)

    # ── Final fused risk score ─────────────────────────────────────────────
    df["risk_score"] = (
        0.45 * df["anomaly_score"]
        + 0.35 * df["pattern_score"]
        + 0.20 * df["centrality_score"]
    ).clip(0, 100).round().astype(int)

    # ── Risk level labels ─────────────────────────────────────────────────
    def _score_to_level(s: int) -> str:
        if s >= 90:
            return "critical"
        if s >= 70:
            return "high"
        if s >= 40:
            return "medium"
        return "low"

    df["risk_level"] = df["risk_score"].map(_score_to_level)

    # ── Print distribution ────────────────────────────────────────────────
    counts = df["risk_level"].value_counts()
    print("Risk distribution:")
    for level in ("critical", "high", "medium", "low"):
        n = int(counts.get(level, 0))
        print(f"  {level:<8} : {n:,} accounts")

    return df


# ---------------------------------------------------------------------------
# FUNCTION 2 — build_explanation
# ---------------------------------------------------------------------------
def build_explanation(row: pd.Series) -> list[dict]:
    """Build a SHAP-lite explanation list for a single account row.

    Evaluates up to five heuristic conditions and returns the top-4
    contributing factors sorted by their estimated contribution to the
    account's risk score. This surfaces *why* an account was flagged
    without requiring a full SHAP computation.

    Parameters
    ----------
    row : pd.Series
        One row from the DataFrame returned by :func:`fuse_risk_scores`.
        Expected fields: ``pass_through_ratio``, ``in_cycle``,
        ``structuring_score``, ``centrality_score``, ``flow_imbalance``,
        ``txn_count``, ``anomaly_score``, ``pattern_score``.

    Returns
    -------
    list[dict]
        Up to 4 dicts, each with keys:
        - ``factor``       : short label (str)
        - ``detail``       : one-sentence explanation (str)
        - ``contribution`` : estimated score contribution (int, 0-100)

        Sorted by ``contribution`` descending.
        Falls back to a generic anomaly entry if no specific condition fires.
    """
    explanations: list[dict] = []

    # ── Condition 1: rapid pass-through (mule) ────────────────────────────
    if row.get("pass_through_ratio", 0) > 0.5:
        explanations.append({
            "factor":       "Rapid pass-through",
            "detail":       (
                f"{int(row['pass_through_ratio'] * 100)}% of funds "
                "forwarded after receipt"
            ),
            "contribution": int(row.get("anomaly_score", 0) * 0.35),
        })

    # ── Condition 2: circular flow membership ─────────────────────────────
    if row.get("in_cycle", 0) > 0:
        explanations.append({
            "factor":       "Circular flow",
            "detail":       (
                "Member of a closed transaction loop returning "
                "funds to origin"
            ),
            "contribution": int(row.get("pattern_score", 0) * 0.5),
        })

    # ── Condition 3: structuring (smurfing) ───────────────────────────────
    if row.get("structuring_score", 0) > 0.1:
        explanations.append({
            "factor":       "Structuring",
            "detail":       (
                "Multiple transactions clustered near reporting threshold"
            ),
            "contribution": int(row.get("structuring_score", 0) * 60),
        })

    # ── Condition 4: high network centrality ─────────────────────────────
    if row.get("centrality_score", 0) > 20:
        explanations.append({
            "factor":       "High network centrality",
            "detail":       (
                "Sits on many transaction paths — classic mule signature"
            ),
            "contribution": int(row.get("centrality_score", 0) * 0.3),
        })

    # ── Condition 5: shell account signature ─────────────────────────────
    if row.get("flow_imbalance", 1) < 0.1 and row.get("txn_count", 0) > 10:
        explanations.append({
            "factor":       "Shell signature",
            "detail":       (
                "Near-equal inflow and outflow with no economic "
                "activity pattern"
            ),
            "contribution": int(row.get("anomaly_score", 0) * 0.15),
        })

    # ── Sort by contribution descending, keep top 4 ──────────────────────
    explanations.sort(key=lambda x: x["contribution"], reverse=True)
    explanations = explanations[:4]

    # ── Fallback if no condition fired ────────────────────────────────────
    if not explanations:
        explanations = [{
            "factor":       "Anomaly pattern",
            "detail":       (
                "Unusual transaction behaviour detected by ML model"
            ),
            "contribution": int(row.get("anomaly_score", 0)),
        }]

    return explanations


# ---------------------------------------------------------------------------
# FUNCTION 3 — evaluate_accuracy
# ---------------------------------------------------------------------------
def evaluate_accuracy(
    feat_df: pd.DataFrame,
    gt_df: Optional[pd.DataFrame],
) -> dict:
    """Evaluate detection accuracy against ground-truth fraud labels.

    Uses a fixed threshold of ``risk_score >= 70`` to convert continuous
    scores into binary predictions, then computes precision, recall, and F1.

    Parameters
    ----------
    feat_df : pd.DataFrame
        Account DataFrame after :func:`fuse_risk_scores` — must contain
        ``account_id`` and ``risk_score`` columns.
    gt_df : pd.DataFrame or None
        Ground-truth table with columns ``account_id`` and ``is_fraud_gt``
        (bool). Returned by ``loader.load_and_aggregate``.
        Pass ``None`` or an empty DataFrame to skip evaluation.

    Returns
    -------
    dict
        Keys: ``precision``, ``recall``, ``f1``, ``true_positives``,
        ``false_positives``, ``false_negatives``, ``threshold``.
        Returns ``{}`` if *gt_df* is absent or empty.
    """
    # Guard: skip if no ground truth is available
    if gt_df is None or len(gt_df) == 0:
        return {}

    # ── Merge predictions with ground truth ──────────────────────────────
    merged = feat_df[["account_id", "risk_score"]].merge(
        gt_df[["account_id", "is_fraud_gt"]],
        on="account_id",
        how="left",
    )
    merged["is_fraud_gt"] = merged["is_fraud_gt"].fillna(False).infer_objects(copy=False)

    # ── Binary classification at threshold 70 ────────────────────────────
    predicted = merged["risk_score"] >= 70
    actual    = merged["is_fraud_gt"].astype(bool)

    tp = int((predicted &  actual).sum())
    fp = int((predicted & ~actual).sum())
    fn = int((~predicted & actual).sum())

    precision = tp / (tp + fp + 1e-9)
    recall    = tp / (tp + fn + 1e-9)
    f1        = 2 * precision * recall / (precision + recall + 1e-9)

    # ── Print report ──────────────────────────────────────────────────────
    print("══════════════════════════════")
    print("AURA DETECTION ACCURACY")
    print("══════════════════════════════")
    print(f"Threshold : risk_score >= 70")
    print(f"Precision : {precision:.3f}")
    print(f"Recall    : {recall:.3f}")
    print(f"F1 Score  : {f1:.3f}")
    print(f"True Positives  : {tp}")
    print(f"False Positives : {fp}")
    print(f"False Negatives : {fn}")
    print("══════════════════════════════")

    return {
        "precision":       round(precision, 3),
        "recall":          round(recall, 3),
        "f1":              round(f1, 3),
        "true_positives":  tp,
        "false_positives": fp,
        "false_negatives": fn,
        "threshold":       70,
    }
