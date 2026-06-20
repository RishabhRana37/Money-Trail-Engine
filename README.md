# AURA — Anti-Money-Laundering Unified Risk Analytics
### AI-Powered Financial Crime Investigation & Interactive Money Trail Engine

---

> [!IMPORTANT]
> **Production Live Link:** The integrated application is deployed and live at **[https://frontend-two-pi-24.vercel.app](https://frontend-two-pi-24.vercel.app)**.
> 
> **Cold Start Mitigation:** The FastAPI backend is configured to automatically pre-seed a default transaction network (`ds_001` with 150 accounts and 1,400 transactions) on startup. Evaluators can immediately access the dashboard HUD, trace alerts, and view live graphs without any manual configuration or database cold starts.

*A hybrid anti-money laundering (AML) detection platform. AURA fuses supervised Random Forest behavior classifiers (17 features) and unsupervised IsolationForest with NetworkX graph traversal to pinpoint complex financial crime rings—explaining every flag through a math-backed risk-fusion HUD.*

---

[![Status](https://img.shields.io/badge/Status-Production%20Ready-27ae60?style=for-the-badge)](https://frontend-two-pi-24.vercel.app)
[![Deployment](https://img.shields.io/badge/Deployed-Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://frontend-two-pi-24.vercel.app)
[![ML Engine](https://img.shields.io/badge/ML%20Engine-Random%20Forest%20%26%20Isolation%20Forest-9b59b6?style=for-the-badge&logo=scikitlearn&logoColor=white)](#-detection-engine--ml)
[![Graph Backend](https://img.shields.io/badge/Graph-NetworkX-e67e22?style=for-the-badge&logo=networkx&logoColor=white)](#-graph-pattern-detection)

[![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?logo=vite&logoColor=white)](https://vite.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-38B2AC?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![GSAP](https://img.shields.io/badge/Animations-GSAP-88CE02?logo=greensock&logoColor=white)](https://gsap.com/)

**[ The Problem](#-the-problem) · [ Core Features](#-core-features) · [ Architecture](#-architecture-and-data-flow) · [ Detection Engine & ML](#-detection-engine--ml) · [ API Endpoints](#-api-endpoints) · [ Quick Start](#-quick-start) · [ Roadmap](#-roadmap)**

---

## The Problem

Traditional anti-money laundering (AML) platforms suffer from structural flaws that compromise security operations:
* **The Static Rule Trap:** Basic threshold limits (e.g., flagging transactions over 50,000 INR) are easily evaded by split transactions (**smurfing**).
* **Massive False Positives:** Compliance teams are overwhelmed by basic rule-based alerts, leading to alert fatigue and missed money-laundering operations.
* **Black-Box AI Models:** Deep learning classifiers flag accounts as "suspicious" but provide no explanation or trail of evidence, leaving compliance officers to audit manually.
* **Invisible Money Trails:** Multi-hop transactions (**circular routing** or **layering**) are virtually impossible to track through traditional tables and logs without relational graph visualization.

**AURA** solves this by combining **supervised Random Forest behavioral scoring**, **unsupervised anomaly detection**, and **NetworkX structural graph analytics** into a unified, high-performance, dark-themed dashboard.

---

##  Core Features

| Feature | Description | Implementation Details |
| :--- | :--- | :--- |
| **Interactive Money Trail Map** | Force-directed D3/SVG graph canvas visualization showing account node connections, direction of flows, and transaction sizes. | Dynamic ego-networks, alert subgraphs, and node sizing scaled by betweenness centrality. |
| **17-Feature ML Risk Model** | Supervised Random Forest Classifier trained on network behavioral statistics, yielding high-precision ROC AUC. | Automatic fallback to an unsupervised `IsolationForest` model if a pre-trained pickle model is missing. |
| **Multi-Hop Pattern Recognition** | Network graph analysis algorithms identifying 5 complex money-laundering topologies. | Implements chronological cycle checking, DFS path traversals, and structured deposit checks. |
| **SHAP-Lite Explainability** | Transparent risk-fusion calculations breaking down why an account was flagged. | Visual contribution bar-graphs splitting risk into Behavioral Anomaly (45%), Patterns (35%), and Centrality (20%). |
| **Device & IP Intelligence** | Threat intelligence mapping account access signatures across multiple devices, locations, and shared IPs. | Custom flags for credential sharing, device farms, and high-velocity geographic jumps. |
| **Startup Seeding & Cache** | Automatic synthetic data generation and score calculation on startup. | Pre-seeds `ds_001` with 150 accounts and 1400 transactions, preventing dashboard latency or serverless timeout errors. |
| **Glassmorphism HUD Console** | Advanced, dark-themed dashboard with responsive grids, interactive tables, and GSAP micro-animations. | Slide-over inspection drawers, custom gauge components, and live toast notification feeds. |

---

##  Architecture and Data Flow

```mermaid
graph TD
    User([Compliance Officer]) -->|Interacts| UI[React + Vite Frontend Client]
    UI -->|Router Context| State[API Client Context]
    
    State -->|Fetch API Call| Backend[FastAPI Serverless / Vercel API]
    
    subgraph Data Seeding & Storage
        Backend -->|Auto-Seed/Load| Store[In-Memory Dataset Store]
        Store -->|State Managed| DefaultDS[(Seeded ds_001 dataset)]
    end
    
    subgraph Detection Pipeline (engine/)
        Store -->|Raw Transactions| Features[Feature Engineering - 17 features]
        Features -->|Account Vector| ML[Supervised Random Forest / IsolationForest Anomaly Score]
        Features -->|NetworkX Digraph| Patterns[Graph Pattern Engine - 5 topologies]
        
        ML & Patterns -->|Combine metrics| Fusion[Risk Fusion - 45% ML + 35% Patterns + 20% Centrality]
        Fusion -->|JSON Payload| Response[API Response Schemas]
    end
    
    Response -->|API JSON Contract| State
    UI -->|Render Graph| GraphCanvas[Interactive D3/SVG Money Trail Map]
    UI -->|Render Detail| Drawer[Account Slide-Over Detail with SHAP explanations]
```

---

##  Detection Engine & ML

AURA features a dual-layer detection pipeline utilizing custom feature engineering, machine learning classifiers, and NetworkX structural analysis.

### 1. The 17-Feature Behavioral Vector
For every account, AURA constructs a behavioral profile from the global transaction history:

* **Transactional Volumes:** `total_in`, `total_out`, `txn_count`
* **Graph Centrality & Degree:** `fan_in`, `fan_out`, `in_degree`, `out_degree`, `betweenness_centrality` (measuring bottleneck and transit roles in the network)
* **Velocity Metrics:** `pass_through_ratio` (outflow/inflow ratio), `mule_ratio` (forwarded txns / total incoming txns), `mean_time_to_forward` (average time in hours to forward received funds, up to 24h)
* **Evasion Signatures:** `structuring_score` (ratio of transactions in the 45k-50k threshold evasion window), `round_amount_ratio` (percentage of large, rounded deposits)
* **Threat Intel Callouts:** `unique_locations_count`, `unique_devices_count`, `unique_ips_count`, `ip_sharing_count` (number of other accounts sharing the same login IPs)

### 2. Graph Pattern Recognition
AURA traverses the transaction directed graph (DiGraph) to isolate 5 specific topologies:
1. **Circular Loop (`circular`):** Chronological flow returning back to origin (A → B → C → A) with matching amounts within 24-48 hours.
2. **Layering Chain (`layering`):** Linear flow designed to obscure sources (A → B → C → D → E) with >90% pass-through ratios.
3. **Smurfing / Fan-Out (`smurfing`):** A single source dividing money into multiple structured transfers (under 50k INR) to "mule" accounts.
4. **Fan-In / Collection (`fan_in`):** Multiple mule accounts aggregating small, structured deposits into a single destination vault.
5. **Rapid Movement / Mule (`rapid_movement`):** High-velocity account receiving and forwarding >90% of funds within 24 hours of receipt.

### 3. Risk Score Fusion & SHAP-Lite Explanations
To prevent black-box decisions, AURA fuses anomalies and graph patterns using a transparent blending formula:
$$\text{Risk Score} = 0.45 \times \text{ML Anomaly Score} + 0.35 \times \text{Pattern Severity} + 0.20 \times \text{Centrality Score}$$

The UI renders these contributions as **SHAP-Lite** bar graphs, explaining precisely which factor (Behavioral, Pattern, or Centrality) contributed to the risk level (Low, Medium, High, Critical).

---

##  Repository Layout

```
Money-Trail-Engine/
├── backend/               # FastAPI Backend & Detection Pipeline
│   ├── engine/            # Core Analytics Engine
│   │   ├── anomaly.py     # IsolationForest & Supervised RF Inference
│   │   ├── features.py    # 17-Feature Engineering
│   │   ├── patterns.py    # NetworkX Graph Pattern Detection
│   │   └── risk.py        # Risk Fusion & SHAP Explanation Compiler
│   ├── main.py            # FastAPI Application & REST Routing
│   ├── generator.py       # Synthetic Transaction Network Generator
│   ├── store.py           # In-memory session manager
│   ├── models.py          # Pydantic Request/Response API contracts
│   └── train.py           # Machine Learning training pipeline script
│
├── frontend/              # React + Vite + TailwindCSS Frontend App
│   ├── src/
│   │   ├── components/    # Reusable UI elements (RiskGauge, SideOver)
│   │   ├── pages/         # Dashboard views (Landing, AlertsView, GraphView)
│   │   ├── App.jsx        # Routing & Context Setup
│   │   ├── api.js         # Axios Client with automatic production fallbacks
│   │   └── index.css      # Custom scrollbars & Glassmorphism themes
│
├── api/                   # Vercel Serverless API wrappers
│   └── index.py           # Vercel entry point
│
├── vercel.json            # Deployment routing mapping backend and frontend
├── render.yaml            # Render Web Service Blueprint
└── README.md              # Documentation
```

---

##  API Endpoints

AURA exposes a comprehensive set of REST APIs defined in `backend/models.py`:

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/dataset/generate` | Generates a new synthetic transaction network with custom sizes. |
| `POST` | `/api/dataset/upload` | Uploads a custom CSV of real transactions for analysis. |
| `POST` | `/api/analyze` | Runs feature engineering, ML models, and pattern search on the dataset. |
| `GET` | `/api/stats` | Fetches dashboard KPIs (Total amounts, Flagged transactions, Alert counts). |
| `GET` | `/api/accounts` | Lists, filters, and sorts accounts by risk level and volumes. |
| `GET` | `/api/accounts/{account_id}` | Retrieves account metadata, counterparty transactions, and SHAP explanations. |
| `GET` | `/api/graph` | Generates global or local subgraphs (ego networks) in nodes/edges format. |
| `GET` | `/api/alerts` | Lists all detected money laundering alerts and fraud rings. |
| `GET` | `/api/alerts/{alert_id}` | Details specific alerts with their isolated subgraph and accounts involved. |

---

##  Quick Start

### Prerequisites
* **Node.js:** v18.0 or higher
* **Python:** v3.11 or higher
* **Package Managers:** `npm` (frontend) and `pip` (backend)

### 1. Run the Backend locally
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a virtual environment:
   ```bash
   python -m venv .venv
   source .venv/bin/activate  # Windows: .venv\Scripts\activate
   ```
3. Install Python requirements:
   ```bash
   pip install -r requirements.txt
   ```
4. Start the backend development server:
   ```bash
   uvicorn main:app --reload --port 8000
   ```
   *The interactive Swagger UI documentation will be available at [http://localhost:8000/docs](http://localhost:8000/docs).*

### 2. Run the Frontend locally
1. Open a new terminal in the root directory and navigate to the frontend:
   ```bash
   cd frontend
   ```
2. Install npm dependencies:
   ```bash
   npm install
   ```
3. Run the Vite development server:
   ```bash
   npm run dev
   ```
4. Open your browser and navigate to `http://localhost:5173`.

### 3. Training the ML Model
If you have a local dataset in `scratch/transactions.json` and want to re-train the Random Forest classifier:
```bash
python backend/train.py
```
This saves `trained_model.pkl` directly inside `backend/engine/`, which AURA will automatically detect and prioritize over the IsolationForest fallback.

---

##  Roadmap

- [x] **Phase 1: Hybrid AML Detection Core**
  - Directed Graph traversal algorithms for circular routing and layering detection.
  - Multi-hop visualization canvas using SVG force layouts.
  - Fusion Risk Score combining IsolationForest and NetworkX centrality.
- [x] **Phase 2: Supervised ML Integration & Startup Seeding**
  - Engineer 17 robust behavioral features covering transaction speed, location dispersion, and IP/Device farms.
  - Integrate a trained Random Forest model with automatic failover safety checks.
  - Deploy pre-seeding startup routines to Vercel to bypass serverless cold starts.
- [ ] **Phase 3: Real-Time Stream Processing & Entity Resolution**
  - Implement Kafka/Redis streaming listeners to update risk scores incrementally as transactions arrive.
  - Integrate AI-based Entity Resolution to link accounts across separate banks using fuzzy matching of names/phones.
  - Configure automated webhook notifications for compliance officers when Critical-level alerts trigger.

---

##  License
This project is licensed under the MIT License.

---
**AURA Platform — Fusing Graph Intelligence with Advanced Machine Learning to Keep the Financial System Secure.**
