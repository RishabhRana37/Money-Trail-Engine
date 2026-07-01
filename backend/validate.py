"""
validate.py
===========
AURA backend validation script.
Checks artifacts on disk, prints a full diagnostic report,
then hits the live API to confirm the server is healthy.

Run with:
    python validate.py
"""

import json
import os
import sys

import pandas as pd

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
_ARTIFACTS   = os.path.join(_BACKEND_DIR, "artifacts")
_API_BASE    = "http://localhost:8000"

SEP  = "═" * 52
SEP2 = "─" * 52


def _ok(msg):  print(f"  ✅  {msg}")
def _fail(msg): print(f"  ❌  {msg}")
def _hdr(title): print(f"\n{SEP}\n  {title}\n{SEP}")


# ===========================================================================
# 1. ARTIFACT FILE CHECK
# ===========================================================================
_hdr("1 / 5 — Artifact File Check")

REQUIRED_ARTIFACTS = [
    "model.pkl",
    "scaler.pkl",
    "ml_features.pkl",
    "accounts.parquet",
    "edges.parquet",
    "alerts.json",
    "accuracy.json",
]

all_present = True
for fname in REQUIRED_ARTIFACTS:
    path = os.path.join(_ARTIFACTS, fname)
    size = os.path.getsize(path) if os.path.exists(path) else None
    if size is not None:
        _ok(f"{fname:<25}  ({size/1024:.1f} KB)")
    else:
        _fail(f"{fname:<25}  MISSING")
        all_present = False

if not all_present:
    print("\n❌  Some artifacts are missing. Run: python run.py")
    sys.exit(1)


# ===========================================================================
# 2. ACCOUNTS.PARQUET ANALYSIS
# ===========================================================================
_hdr("2 / 5 — accounts.parquet Analysis")

accounts = pd.read_parquet(os.path.join(_ARTIFACTS, "accounts.parquet"))
print(f"\n  Total accounts : {len(accounts):,}")

# Risk distribution
print(f"\n  {'Level':<10}  {'Count':>8}  {'Pct':>7}")
print(f"  {SEP2[:36]}")
for level in ("critical", "high", "medium", "low"):
    n   = int((accounts["risk_level"] == level).sum())
    pct = n / len(accounts) * 100
    bar = "█" * int(pct / 2)
    print(f"  {level:<10}  {n:>8,}  {pct:>6.2f}%  {bar}")

# Top 10 riskiest
print(f"\n  Top 10 highest risk accounts:")
print(f"  {'account_id':<25}  {'risk_score':>10}  {'risk_level':<10}")
print(f"  {SEP2[:50]}")
top10 = accounts.nlargest(10, "risk_score")[["account_id","risk_score","risk_level"]]
for _, row in top10.iterrows():
    print(f"  {str(row['account_id']):<25}  {int(row['risk_score']):>10}  {str(row['risk_level']):<10}")

# Feature sanity checks
print(f"\n  Feature sanity checks:")
for col in ("pass_through_ratio", "anomaly_score", "risk_score"):
    lo = accounts[col].min()
    hi = accounts[col].max()
    print(f"  {col} range: {lo:.4f} – {hi:.4f}")

zero_risk = int((accounts["risk_score"] == 0).sum())
pct_zero  = zero_risk / len(accounts) * 100
flag = "✅" if pct_zero < 50 else "⚠️ "
print(f"\n  {flag}  Accounts with risk_score=0: {zero_risk:,} ({pct_zero:.1f}%)"
      f"  (should be near 0 for flagged accounts)")


# ===========================================================================
# 3. ALERTS.JSON ANALYSIS
# ===========================================================================
_hdr("3 / 5 — alerts.json Analysis")

with open(os.path.join(_ARTIFACTS, "alerts.json")) as f:
    alerts = json.load(f)

print(f"\n  Total alerts: {len(alerts)}")

# Counts by pattern type
from collections import Counter
type_counts = Counter(a.get("pattern_type", "unknown") for a in alerts)
print(f"\n  By pattern type:")
for pt, cnt in sorted(type_counts.items()):
    print(f"    {pt:<20}: {cnt}")

# Top 3 by severity
print(f"\n  Top 3 highest severity alerts:")
print(f"  {'alert_id':<14}  {'severity':>8}  {'pattern_type':<15}  title")
print(f"  {SEP2[:52]}")
top3 = sorted(alerts, key=lambda a: a.get("severity", 0), reverse=True)[:3]
for a in top3:
    title_short = a.get("title","")[:35]
    print(f"  {a['alert_id']:<14}  {a.get('severity',0):>8}  {a.get('pattern_type',''):<15}  {title_short}")


# ===========================================================================
# 4. ACCURACY.JSON
# ===========================================================================
_hdr("4 / 5 — accuracy.json Report")

acc_path = os.path.join(_ARTIFACTS, "accuracy.json")
if os.path.exists(acc_path):
    with open(acc_path) as f:
        accuracy = json.load(f)
    if accuracy:
        print()
        for k, v in accuracy.items():
            print(f"  {k:<20}: {v}")
    else:
        print("\n  (empty — no ground-truth labels in dataset)")
else:
    print("\n  ❌  accuracy.json not found")


# ===========================================================================
# 5. LIVE API HEALTH CHECK
# ===========================================================================
_hdr("5 / 5 — Live API Health Check")

try:
    import urllib.request
    import urllib.error

    # /ping
    try:
        with urllib.request.urlopen(f"{_API_BASE}/ping", timeout=3) as resp:
            ping_data = json.loads(resp.read())
        _ok(f"Backend is running  →  {ping_data.get('message','ok')}")
        print(f"       accounts={ping_data.get('accounts',0):,}  "
              f"alerts={ping_data.get('alerts',0)}")
    except (urllib.error.URLError, OSError):
        _fail("Backend not reachable  (run: python run.py)")
        print()
        sys.exit(0)          # not a fatal error — artifacts are fine

    # /stats
    try:
        with urllib.request.urlopen(f"{_API_BASE}/stats", timeout=5) as resp:
            stats = json.loads(resp.read())
        _ok("/stats endpoint responding")
        print(f"       total_accounts    : {stats.get('total_accounts',0):,}")
        print(f"       total_transactions: {stats.get('total_transactions',0):,}")
        print(f"       total_amount      : {stats.get('total_amount',0):,.2f}")
        print(f"       high_risk_accounts: {stats.get('high_risk_accounts',0):,}")
        print(f"       alerts_by_type    : {stats.get('alerts_by_type',{})}")
    except Exception as e:
        _fail(f"/stats failed: {e}")

except Exception as e:
    _fail(f"Unexpected error during API check: {e}")

print(f"\n{SEP}")
print("  ✅  Validation complete")
print(SEP)
