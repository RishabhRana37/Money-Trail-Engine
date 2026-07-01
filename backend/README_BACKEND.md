# AURA Backend — Quick Start

> **Anti-Money-Laundering Unified Risk Analytics**  
> Fuses IsolationForest anomaly detection, NetworkX graph analytics, and transparent risk-fusion scoring into a single production API.

---

## One-Command Setup

```bash
pip install -r requirements.txt
python run.py
```

That's it. `run.py` detects whether artifacts exist and:
- **First run →** trains the full ML pipeline (~60s), then starts the server
- **Subsequent runs →** loads pre-built artifacts and starts the server instantly

---

## Workflow Reference

### First time (train + serve)
```bash
pip install -r requirements.txt
python run.py                        # auto-trains if no artifacts found
```

### After training (skip retraining)
```bash
python run.py                        # detects artifacts → goes straight to server
```

### Custom dataset
```bash
python run.py path/to/your_data.csv  # train on a different CSV, then serve
```

### Force retrain (wipe artifacts)
```bash
python run.py --force                # deletes artifacts/, retrains, starts server
# or manually:
rm -rf artifacts/
python run.py
```

### Validate everything is working
```bash
python validate.py                   # checks artifacts + hits live API
```

---

## API Endpoints

| Method | Endpoint | Description |
| :----- | :------- | :---------- |
| `GET`  | `/ping` | Health check — confirms server + artifact counts |
| `GET`  | `/stats` | Dashboard KPIs: totals, high-risk counts, top accounts |
| `GET`  | `/accounts` | Paginated account list with filtering & sorting |
| `GET`  | `/accounts/{id}` | Full account detail + SHAP-lite explanation + timeline |
| `GET`  | `/graph` | Money trail subgraph (ego-network or alert ring) |
| `GET`  | `/alerts` | All detected fraud pattern alerts |
| `GET`  | `/alerts/{id}` | Alert detail + isolated ring graph + narrative |
| `GET`  | `/accuracy` | Model precision / recall / F1 vs ground truth labels |
| `POST` | `/dataset/generate` | Dataset summary (pre-loaded, no generation at runtime) |
| `POST` | `/analyze` | Pipeline summary from pre-built artifacts |

### Query parameters

**`GET /accounts`**
| Param | Type | Default | Description |
|---|---|---|---|
| `sort` | str | `risk_desc` | `risk_desc` / `risk_asc` / `amount_desc` |
| `min_risk` | int | `0` | Filter accounts with `risk_score >=` this |
| `limit` | int | `50` | Page size (max 200) |
| `offset` | int | `0` | Pagination offset |

**`GET /graph`**
| Param | Type | Description |
|---|---|---|
| `account_id` | str | Centre of BFS ego-network |
| `alert_id` | str | Alert ring members (mutually exclusive with account_id) |
| `depth` | int | BFS depth 1–3 (default 2, capped at 80 nodes) |

**`GET /alerts`**
| Param | Type | Description |
|---|---|---|
| `min_severity` | int | Only return alerts with severity ≥ this (0–100) |
| `pattern_type` | str | Filter by: `circular` / `fan_in` / `fan_out` / `rapid` |

---

## Auto-generated API Docs

```
http://localhost:8000/docs      ← Swagger UI (interactive)
http://localhost:8000/redoc     ← ReDoc (clean reference)
```

---

## Artifacts Directory

After training, `artifacts/` contains:

| File | Contents |
|---|---|
| `model.pkl` | Fitted IsolationForest (200 estimators) |
| `scaler.pkl` | Fitted MinMaxScaler (applied before inference) |
| `ml_features.pkl` | Ordered list of 13 feature names |
| `accounts.parquet` | 111K+ scored accounts (all features + risk_score) |
| `edges.parquet` | Aggregated transaction graph (from→to, amount, count) |
| `alerts.json` | All detected fraud alerts, severity-sorted |
| `accuracy.json` | Precision / Recall / F1 vs ground truth labels |

> All artifact files are git-ignored. Run `python run.py` to regenerate them.

---

## Engine Modules

```
engine/
  loader.py    ← CSV ingestion, column auto-detection, chunked reading
  features.py  ← 13 account-level features (flow, graph, structuring)
  anomaly.py   ← IsolationForest training + scoring (0–100)
  patterns.py  ← Graph pattern detection (circular, fan-in/out, rapid)
  risk.py      ← Risk fusion (0.45×anomaly + 0.35×pattern + 0.20×centrality)
  train.py     ← Master pipeline (calls all modules, saves artifacts)
  serialize.py ← Artifact load/save helpers
```

---

## Risk Score Formula

```
risk_score = 0.45 × anomaly_score      (IsolationForest — behavioural outlier)
           + 0.35 × pattern_score      (graph topology flags)
           + 0.20 × centrality_score   (betweenness — network transit role)
```

| Level | Threshold | Colour |
|---|---|---|
| Critical | ≥ 90 | `#E24B4A` |
| High | ≥ 70 | `#F0883E` |
| Medium | ≥ 40 | `#D29922` |
| Low | < 40 | `#3FB950` |
