import { fakeStats, fakeGraph, fakeAccount, fakeAccountsList, fakeAlerts } from './fixtures';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const USE_REAL_API = import.meta.env.VITE_USE_REAL_API === 'true';

// Delay helper to make the mock mode feel like a real API with loading states
const delay = (ms = 500) => new Promise(resolve => setTimeout(resolve, ms));

export const api = {
  // 1. POST /dataset/generate
  generateDataset: async (params = {}) => {
    if (USE_REAL_API) {
      const response = await fetch(`${BASE_URL}/dataset/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
      if (!response.ok) throw new Error((await response.json()).message || 'Failed to generate dataset');
      return response.json();
    } else {
      await delay(1200); // longer delay for generation simulation
      return {
        dataset_id: "ds_001",
        num_accounts: params.num_accounts || 200,
        num_transactions: params.num_transactions || 2500,
        fraud_rings_injected: 3,
        ready: true
      };
    }
  },

  // 2. POST /dataset/upload
  uploadDataset: async (file) => {
    if (USE_REAL_API) {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch(`${BASE_URL}/dataset/upload`, {
        method: 'POST',
        body: formData
      });
      if (!response.ok) throw new Error((await response.json()).message || 'Failed to upload file');
      return response.json();
    } else {
      await delay(1500);
      return {
        dataset_id: "ds_002",
        num_accounts: 87,
        num_transactions: 1004,
        fraud_rings_injected: 0,
        ready: true,
        warnings: []
      };
    }
  },

  // 3. POST /analyze
  analyzeDataset: async (datasetId) => {
    if (USE_REAL_API) {
      const response = await fetch(`${BASE_URL}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataset_id: datasetId })
      });
      if (!response.ok) throw new Error((await response.json()).message || 'Analysis failed');
      return response.json();
    } else {
      await delay(2000); // realistic time for AI pipeline
      return {
        dataset_id: datasetId,
        accounts_scored: 200,
        alerts_generated: 11,
        patterns_found: {
          circular: 2,
          layering: 3,
          smurfing: 1,
          rapid_movement: 4,
          fan_in: 1,
          fan_out: 0
        },
        duration_ms: 840,
        ready: true
      };
    }
  },

  // 4. GET /stats
  getStats: async (datasetId = 'ds_001') => {
    if (USE_REAL_API) {
      const response = await fetch(`${BASE_URL}/stats?dataset_id=${datasetId}`);
      if (!response.ok) throw new Error((await response.json()).message || 'Failed to fetch stats');
      return response.json();
    } else {
      await delay();
      return { ...fakeStats, dataset_id: datasetId };
    }
  },

  // 5. GET /accounts
  getAccounts: async ({ datasetId = 'ds_001', sort = 'risk_desc', min_risk = 0, limit = 50, offset = 0 } = {}) => {
    if (USE_REAL_API) {
      const params = new URLSearchParams({
        dataset_id: datasetId,
        sort,
        min_risk: String(min_risk),
        limit: String(limit),
        offset: String(offset)
      });
      const response = await fetch(`${BASE_URL}/accounts?${params.toString()}`);
      if (!response.ok) throw new Error((await response.json()).message || 'Failed to fetch accounts');
      return response.json();
    } else {
      await delay();
      let filtered = fakeAccountsList.filter(a => a.risk_score >= min_risk);
      
      if (sort === 'risk_desc') {
        filtered.sort((a, b) => b.risk_score - a.risk_score);
      } else if (sort === 'risk_asc') {
        filtered.sort((a, b) => a.risk_score - b.risk_score);
      } else if (sort === 'amount_desc') {
        filtered.sort((a, b) => Math.max(b.total_in, b.total_out) - Math.max(a.total_in, a.total_out));
      }

      const paginated = filtered.slice(offset, offset + limit);
      return {
        total: filtered.length,
        accounts: paginated
      };
    }
  },

  // 6. GET /accounts/{account_id}
  getAccountDetail: async (accountId, datasetId = 'ds_001') => {
    if (USE_REAL_API) {
      const response = await fetch(`${BASE_URL}/accounts/${accountId}?dataset_id=${datasetId}`);
      if (!response.ok) throw new Error((await response.json()).message || 'Failed to fetch account details');
      return response.json();
    } else {
      await delay();
      // Look up in list
      const matched = fakeAccountsList.find(a => a.account_id === accountId);
      if (matched) {
        return {
          ...fakeAccount,
          account_id: accountId,
          name: matched.name,
          account_type: matched.account_type,
          risk_score: matched.risk_score,
          risk_level: matched.risk_level,
          flags: matched.flags,
          total_in: matched.total_in,
          total_out: matched.total_out,
          txn_count: matched.txn_count,
        };
      }
      return fakeAccount;
    }
  },

  // 7. GET /graph
  getGraph: async ({ datasetId = 'ds_001', accountId, alertId, depth = 2 } = {}) => {
    if (USE_REAL_API) {
      const params = new URLSearchParams({ dataset_id: datasetId, depth: String(depth) });
      if (accountId) params.append('account_id', accountId);
      if (alertId) params.append('alert_id', alertId);
      
      const response = await fetch(`${BASE_URL}/graph?${params.toString()}`);
      if (!response.ok) throw new Error((await response.json()).message || 'Failed to fetch graph data');
      return response.json();
    } else {
      await delay();
      if (alertId) {
        const alert = fakeAlerts.find(a => a.alert_id === alertId);
        if (alert) return alert.graph;
      }
      if (accountId) {
        return {
          ...fakeGraph,
          center_id: accountId,
          nodes: fakeGraph.nodes.map(n => n.id === accountId ? { ...n, is_center: true } : { ...n, is_center: false })
        };
      }
      return fakeGraph;
    }
  },

  // 8. GET /alerts
  getAlerts: async ({ datasetId = 'ds_001', min_severity = 0, pattern_type } = {}) => {
    if (USE_REAL_API) {
      const params = new URLSearchParams({ dataset_id: datasetId, min_severity: String(min_severity) });
      if (pattern_type) params.append('pattern_type', pattern_type);
      
      const response = await fetch(`${BASE_URL}/alerts?${params.toString()}`);
      if (!response.ok) throw new Error((await response.json()).message || 'Failed to fetch alerts');
      return response.json();
    } else {
      await delay();
      let filtered = fakeAlerts.filter(a => a.severity >= min_severity);
      if (pattern_type) {
        filtered = filtered.filter(a => a.pattern_type === pattern_type);
      }
      return {
        total: filtered.length,
        alerts: filtered
      };
    }
  },

  // 9. GET /alerts/{alert_id}
  getAlertDetail: async (alertId, datasetId = 'ds_001') => {
    if (USE_REAL_API) {
      const response = await fetch(`${BASE_URL}/alerts/${alertId}?dataset_id=${datasetId}`);
      if (!response.ok) throw new Error((await response.json()).message || 'Failed to fetch alert details');
      return response.json();
    } else {
      await delay();
      const matched = fakeAlerts.find(a => a.alert_id === alertId);
      if (matched) return matched;
      throw new Error('Alert not found');
    }
  }
};
