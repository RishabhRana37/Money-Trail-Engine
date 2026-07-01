export const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

async function request(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, options);
  if (!response.ok) {
    let message = "API Error";
    try {
      const errorJson = await response.json();
      if (typeof errorJson.detail === "string") {
        message = errorJson.detail;
      } else if (Array.isArray(errorJson.detail)) {
        message = errorJson.detail.map(d => `${d.loc ? d.loc.join('.') : 'error'}: ${d.msg || JSON.stringify(d)}`).join(', ');
      } else if (errorJson.detail && typeof errorJson.detail === "object") {
        message = errorJson.detail.message || JSON.stringify(errorJson.detail);
      } else {
        message = errorJson.message || JSON.stringify(errorJson) || message;
      }
    } catch (e) {
      // Fallback if response is not JSON
    }
    throw new Error(message);
  }
  return response.json();
}

export async function getStats() {
  return request("/stats");
}

export async function getAccounts(sort = "risk_desc", minRisk = 0, limit = 50, offset = 0) {
  return request(`/accounts?sort=${sort}&min_risk=${minRisk}&limit=${limit}&offset=${offset}`);
}

export async function getAccount(accountId) {
  return request(`/accounts/${accountId}`);
}

export async function getGraph(accountId, depth = 2) {
  return request(`/graph?account_id=${accountId}&depth=${depth}`);
}

export async function getGraphByAlert(alertId) {
  return request(`/graph?alert_id=${alertId}`);
}

export async function getAlerts(minSeverity = 0, patternType = null) {
  let path = `/alerts?min_severity=${minSeverity}`;
  if (patternType !== null) {
    path += `&pattern_type=${patternType}`;
  }
  return request(path);
}

export async function getAlert(alertId) {
  return request(`/alerts/${alertId}`);
}

export async function generateDataset(params) {
  const payload = { ...params };
  if (payload.fraud_intensity === 'medium') payload.fraud_intensity = 0.5;
  if (payload.fraud_intensity === 'high') payload.fraud_intensity = 0.8;
  if (payload.fraud_intensity === 'low') payload.fraud_intensity = 0.2;
  
  return request("/dataset/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export async function analyzeDataset(datasetId) {
  return request("/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dataset_id: datasetId })
  });
}

export const api = {
  getStats,
  getAccounts,
  getAccount,
  getGraph,
  getGraphByAlert,
  getAlerts,
  getAlert,
  generateDataset,
  analyzeDataset
};

