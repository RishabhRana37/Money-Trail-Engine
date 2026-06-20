from typing import Dict, List, Set, Any, Optional
from datetime import datetime

class DatasetState:
    def __init__(self, dataset_id: str):
        self.dataset_id: str = dataset_id
        
        # Initial generated/uploaded data
        self.accounts: Dict[str, Dict[str, Any]] = {}  # account_id -> {account_id, name, account_type, ...}
        self.transactions: List[Dict[str, Any]] = []    # list of {txn_id, from_account, to_account, amount, timestamp}
        
        # Ground truth (for scoring precision/recall)
        self.ground_truth_dirty_accounts: Set[str] = set()
        self.ground_truth_rings: List[Dict[str, Any]] = []  # list of {pattern_type, account_ids}
        
        # Detection pipeline state
        self.analyzed: bool = False
        self.accounts_scored: Dict[str, Dict[str, Any]] = {} # account_id -> computed stats (risk_score, explanations, etc.)
        self.alerts: Dict[str, Dict[str, Any]] = {}         # alert_id -> alert detail
        self.stats: Dict[str, Any] = {}                      # cache for dashboard KPIs
        
    def reset_analysis(self):
        self.analyzed = False
        self.accounts_scored = {}
        self.alerts = {}
        self.stats = {}

# Global store
DATASETS: Dict[str, DatasetState] = {}
