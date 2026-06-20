from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Literal

# Allowed Enums according to API Contract
AccountType = Literal["individual", "business", "shell"]
RiskLevel = Literal["low", "medium", "high", "critical"]
PatternType = Literal["circular", "layering", "smurfing", "rapid_movement", "fan_in", "fan_out"]
FraudIntensity = Literal["low", "medium", "high"]
DirectionType = Literal["in", "out"]

# Error Response
class ErrorResponse(BaseModel):
    error: str
    message: str

# 1. /dataset/generate
class GenerateDatasetRequest(BaseModel):
    num_accounts: Optional[int] = Field(default=200, ge=1)
    num_transactions: Optional[int] = Field(default=2500, ge=1)
    fraud_intensity: Optional[FraudIntensity] = Field(default="medium")
    seed: Optional[int] = Field(default=42)

class GenerateDatasetResponse(BaseModel):
    dataset_id: str
    num_accounts: int
    num_transactions: int
    fraud_rings_injected: int
    ready: bool

# 2. /dataset/upload
class UploadDatasetResponse(BaseModel):
    dataset_id: str
    num_accounts: int
    num_transactions: int
    fraud_rings_injected: int
    ready: bool
    warnings: List[str] = []

# 3. /analyze
class AnalyzeRequest(BaseModel):
    dataset_id: str

class AnalyzeResponse(BaseModel):
    dataset_id: str
    accounts_scored: int
    alerts_generated: int
    patterns_found: Dict[str, int] = Field(
        description="Must contain all 6 PatternType keys"
    )
    duration_ms: int
    ready: bool

# Helper for stats and top risk accounts
class TopRiskAccount(BaseModel):
    account_id: str
    name: str
    risk_score: int
    risk_level: RiskLevel

# 4. /stats
class StatsResponse(BaseModel):
    dataset_id: str
    total_accounts: int
    total_transactions: int
    total_amount: float
    high_risk_accounts: int
    amount_flagged: float
    alerts_by_type: Dict[str, int]
    top_risk_accounts: List[TopRiskAccount]

# Helper for list accounts
class AccountSummary(BaseModel):
    account_id: str
    name: str
    account_type: AccountType
    risk_score: int
    risk_level: RiskLevel
    flags: List[str]  # e.g., ["circular", "rapid_movement"]
    total_in: float
    total_out: float
    txn_count: int

# 5. /accounts
class AccountsListResponse(BaseModel):
    total: int
    accounts: List[AccountSummary]

# Helpers for account details
class ExplanationFactor(BaseModel):
    factor: str
    detail: str
    contribution: int

class CounterpartySummary(BaseModel):
    account_id: str
    name: str
    amount: float
    direction: DirectionType

class TimelineItem(BaseModel):
    timestamp: str  # ISO 8601 UTC string
    amount: float
    direction: DirectionType
    counterparty_id: str

# 6. /accounts/{account_id}
class AccountDetailResponse(BaseModel):
    account_id: str
    name: str
    account_type: AccountType
    risk_score: int
    risk_level: RiskLevel
    flags: List[str]
    total_in: float
    total_out: float
    txn_count: int
    fan_in: int
    fan_out: int
    explanation: List[ExplanationFactor]
    top_counterparties: List[CounterpartySummary]
    timeline: List[TimelineItem]

# Helpers for graph
class GraphNode(BaseModel):
    id: str
    label: str
    account_type: AccountType
    risk_score: int
    risk_level: RiskLevel
    is_center: bool
    flagged: bool

class GraphEdge(BaseModel):
    id: str
    source: str
    target: str
    amount: float
    txn_count: int
    last_timestamp: str  # ISO 8601 UTC
    suspicious: bool

# 7. /graph
class GraphResponse(BaseModel):
    center_id: Optional[str] = None
    nodes: List[GraphNode]
    edges: List[GraphEdge]

# Helper for alerts list
class AlertSummary(BaseModel):
    alert_id: str
    pattern_type: PatternType
    title: str
    severity: int
    risk_level: RiskLevel
    account_ids: List[str]
    amount_involved: float
    summary: str
    detected_at: str  # ISO 8601 UTC

# 8. /alerts
class AlertsListResponse(BaseModel):
    total: int
    alerts: List[AlertSummary]

# Helper for alert detail
class AlertAccountInfo(BaseModel):
    account_id: str
    name: str
    risk_score: int
    risk_level: RiskLevel
    role: str

# 9. /alerts/{alert_id}
class AlertDetailResponse(BaseModel):
    alert_id: str
    pattern_type: PatternType
    title: str
    severity: int
    risk_level: RiskLevel
    amount_involved: float
    summary: str
    narrative: str
    accounts: List[AlertAccountInfo]
    graph: GraphResponse
