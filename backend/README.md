# AURA — Backend

**Anti-money-laundering Unified Risk Analytics** — Python backend powering the ML detection engine and FastAPI server.

---

## 📁 Folder Structure

```
backend/
├── main.py              # FastAPI app + all 9 routes
├── models.py            # Pydantic request/response schemas (API contract)
├── store.py             # In-memory dataset state manager
├── generator.py         # Synthetic transaction generator + fraud injector
├── requirements.txt     # Python dependencies
├── test_pipeline.py     # Integration test: precision/recall vs ground truth
└── engine/
    ├── features.py      # Per-account feature engineering (13 features)
    ├── anomaly.py       # IsolationForest anomaly scoring (0-100)
    ├── patterns.py      # NetworkX graph pattern detection (5 patterns)
    └── risk.py          # Risk fusion + SHAP-lite explanations
```

---

## ⚡ Quick Start

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Start the Server
```bash
# From the project root (d:\Cybersec hackathon)
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

### 3. Open Swagger Docs
Visit: [http://localhost:8000/docs](http://localhost:8000/docs)

---

## 🔌 The 9 API Endpoints

| # | Method | Endpoint | Description |
|---|---|---|---|
| 1 | POST | `/dataset/generate` | Generate synthetic dataset with injected fraud |
| 2 | POST | `/dataset/upload` | Upload a CSV of real transactions *(stretch)* |
| 3 | POST | `/analyze` | Run full ML + graph detection pipeline |
| 4 | GET | `/stats` | Dashboard KPIs |
| 5 | GET | `/accounts` | List / filter / sort accounts |
| 6 | GET | `/accounts/{account_id}` | Account detail + risk explanation |
| 7 | GET | `/graph` | Money-trail subgraph (ego or alert ring) |
| 8 | GET | `/alerts` | List detected fraud pattern alerts |
| 9 | GET | `/alerts/{alert_id}` | Alert detail + self-contained subgraph |

All endpoints return the exact JSON shapes defined in `API_CONTRACT.md`. CORS is enabled for all origins.

---

## 🧠 Detection Engine

### Synthetic Generator (`generator.py`)
Builds a realistic transaction network and injects 5 known fraud patterns:
- **Circular loop**: A → B → C → A (matching amounts within hours)
- **Layering chain**: A → B → C → D → E (90%+ pass-through)
- **Smurfing / fan-out**: 1 source → many mules (amounts just under 50,000 INR)
- **Fan-in**: Many sources → 1 collector
- **Rapid movement / mule**: Receive → forward 98% within 24 hours

### Feature Engineering (`engine/features.py`)
Extracts 13 behavioral and graph features per account:
- `total_in`, `total_out`, `txn_count`, `fan_in`, `fan_out`
- `pass_through_ratio`, `mule_ratio`, `mean_time_to_forward`
- `structuring_score`, `round_amount_ratio`
- `betweenness_centrality`, `in_degree`, `out_degree`

### Anomaly Detection (`engine/anomaly.py`)
- Unsupervised `IsolationForest` (no labels needed)
- Log-transforms volume features to emphasize behavioral ratios
- Scales output to 0–100 anomaly score

### Graph Pattern Detection (`engine/patterns.py`)
- **Circular**: `nx.simple_cycles()` + chronological validation
- **Layering**: DFS on high-mule-ratio subgraph + amount-matched chain check
- **Smurfing**: High-out-degree nodes with structured transactions
- **Fan-in**: High-in-degree nodes with unusual aggregation
- **Rapid movement**: Nodes forwarding 90%+ within 24h of receipt

### Risk Fusion (`engine/risk.py`)
```
risk_score = 0.45 × anomaly_score + 0.35 × pattern_severity + 0.20 × centrality_score
```
Generates human-readable `explanation[]` arrays for every account.

---

## ✅ Verified Accuracy (seed=42)

```
Ground Truth Dirty Accounts Injected : 23
True Positives (Flagged & Dirty)     : 23
False Positives (Flagged & Clean)    : 0
False Negatives (Missed & Dirty)     : 0
Precision                            : 100.00%
Recall (Fraud Recovery Rate)         : 100.00%
```

Run it yourself:
```bash
python backend/test_pipeline.py
```

---

## 🌿 Branch
Working branch: `backend-dev`  
Do **not** merge to `main` until the team agrees.
