"""
run.py
======
AURA one-command launcher.

  python run.py          → train if needed, then start the server
  python run.py --force  → delete artifacts and retrain from scratch

Workflow:
  1. Check if artifacts/accounts.parquet already exists
     YES → skip training, go straight to server
     NO  → run full training pipeline, then start server
"""

import os
import sys
import shutil

# ---------------------------------------------------------------------------
# Resolve paths
# ---------------------------------------------------------------------------
_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
_ARTIFACTS   = os.path.join(_BACKEND_DIR, "artifacts")
_MARKER      = os.path.join(_ARTIFACTS, "accounts.parquet")
_CSV_DEFAULT = os.path.join(_BACKEND_DIR, "dataset_small.csv")

# Ensure engine/ is importable
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

SEP = "═" * 52

# ---------------------------------------------------------------------------
# --force flag: wipe artifacts so training is re-run
# ---------------------------------------------------------------------------
if "--force" in sys.argv:
    if os.path.isdir(_ARTIFACTS):
        shutil.rmtree(_ARTIFACTS)
        print("🗑️   Artifacts deleted. Retraining from scratch...")
    else:
        print("ℹ️   No artifacts folder found — will train fresh.")

# ---------------------------------------------------------------------------
# Resolve CSV path (first non-flag CLI arg, else default)
# ---------------------------------------------------------------------------
csv_args = [a for a in sys.argv[1:] if not a.startswith("--")]
csv_path = csv_args[0] if csv_args else _CSV_DEFAULT

# ---------------------------------------------------------------------------
# STEP 1 — Check for existing artifacts
# ---------------------------------------------------------------------------
if os.path.exists(_MARKER):
    print(SEP)
    print("  ✅  Artifacts found — skipping training.")
    print("      Delete artifacts/ to retrain,  or run:")
    print("      python run.py --force")
    print(SEP)
else:
    # ── STEP 2 — Run training ────────────────────────────────────────────
    if not os.path.exists(csv_path):
        print(f"❌  Dataset not found: {csv_path}")
        print("    Place your CSV at backend/dataset_small.csv or pass a path:")
        print("    python run.py path/to/data.csv")
        sys.exit(1)

    print(SEP)
    print("  Starting training pipeline...")
    print(f"  Dataset : {csv_path}")
    print(SEP)

    from engine.train import run_full_training
    run_full_training(
        csv_path=csv_path,
        output_dir=_ARTIFACTS,
    )
    print("\n  Training complete. Starting server...")

# ---------------------------------------------------------------------------
# STEP 3 — Start FastAPI server
# ---------------------------------------------------------------------------
print(SEP)
print("  🚀  AURA API Server")
print("  →   http://localhost:8000")
print("  →   http://localhost:8000/docs  (Swagger UI)")
print("  →   http://localhost:8000/ping  (health check)")
print("  Press Ctrl+C to stop.")
print(SEP + "\n")

import uvicorn
uvicorn.run(
    "main:app",
    host="0.0.0.0",
    port=8000,
    reload=False,
    app_dir=_BACKEND_DIR,
)
