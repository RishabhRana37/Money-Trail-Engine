import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import RiskBadge from '../components/RiskBadge';

export default function Dashboard({ datasetId, onDatasetGenerated }) {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [analyzingState, setAnalyzingState] = useState(''); // 'generating', 'analyzing', ''
  
  const fetchDashboardData = async (id) => {
    try {
      setLoading(true);
      setError(null);
      const statsRes = await api.getStats(id);
      setStats(statsRes);
      const alertsRes = await api.getAlerts({ datasetId: id });
      setAlerts(alertsRes.alerts || []);
    } catch (err) {
      console.error(err);
      setError('Failed to pull intelligence records. Ensure backend is running.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData(datasetId);
  }, [datasetId]);

  const handleLoadDemoDataset = async () => {
    try {
      setError(null);
      setAnalyzingState('generating');
      // Step 1: Generate dataset
      const genRes = await api.generateDataset({ num_accounts: 200, num_transactions: 2500, fraud_intensity: 'medium', seed: 42 });
      
      setAnalyzingState('analyzing');
      // Step 2: Run pipeline analysis
      const anaRes = await api.analyzeDataset(genRes.dataset_id);
      
      setAnalyzingState('');
      onDatasetGenerated(genRes.dataset_id);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Data fusion pipeline failed.');
      setAnalyzingState('');
    }
  };

  if (analyzingState) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-aura-bg min-h-[80vh] px-4">
        <div className="w-full max-w-md p-8 rounded-lg border border-aura-border bg-aura-panel flex flex-col items-center text-center space-y-6 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-aura-indigo via-aura-accent to-aura-indigo animate-pulse" />
          
          <div className="w-16 h-16 rounded-full bg-aura-accent/10 border border-aura-accent/30 flex items-center justify-center">
            <svg className="animate-spin h-8 w-8 text-aura-accent" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>

          <div className="space-y-2">
            <h3 className="text-xl font-bold text-white font-mono uppercase tracking-wider">
              {analyzingState === 'generating' ? 'SYSTEM_SEEDING' : 'ANALYSIS_PIPELINE_RUNNING'}
            </h3>
            <p className="text-sm text-aura-textMuted leading-relaxed">
              {analyzingState === 'generating' 
                ? 'Synthesizing 200 accounts and 2,500 transfers with seeds...' 
                : 'Fusing anomaly profiles, evaluating transaction timelines, and isolating loops...'}
            </p>
          </div>

          {/* Loading bar */}
          <div className="w-full bg-aura-border h-2 rounded-full overflow-hidden">
            <div 
              className={`h-full bg-aura-accent rounded-full transition-all duration-1000 ${
                analyzingState === 'generating' ? 'w-1/2' : 'w-11/12 animate-pulse'
              }`}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 space-y-6 max-w-7xl mx-auto w-full">
      {/* Welcome header & loader button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-aura-border pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Security Command Dashboard</h1>
          <p className="text-sm text-aura-textMuted">Operational status for active money laundering and fraud trail alerts.</p>
        </div>
        <button
          onClick={handleLoadDemoDataset}
          className="px-4 py-2 bg-gradient-to-r from-aura-indigo to-aura-indigo/90 border border-aura-border text-sm font-semibold rounded text-white shadow-lg hover:from-indigo-600 hover:to-indigo-500 active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          Load Demo Dataset
        </button>
      </div>

      {error && (
        <div className="p-4 rounded border border-aura-critical/30 bg-aura-critical/10 text-aura-critical text-sm font-mono flex items-center gap-2">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="h-64 flex flex-col items-center justify-center gap-3">
          <svg className="animate-spin h-8 w-8 text-aura-accent" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-sm font-mono text-aura-textMuted">Compiling metrics...</span>
        </div>
      ) : stats ? (
        <>
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-lg bg-aura-panel border border-aura-border shadow">
              <span className="text-xs text-aura-textMuted font-mono block">MONITORED ACCOUNTS</span>
              <span className="font-mono text-3xl font-bold text-white block mt-1">{stats.total_accounts}</span>
            </div>
            
            <div className="p-4 rounded-lg bg-aura-panel border border-aura-border shadow">
              <span className="text-xs text-aura-textMuted font-mono block">PROCESSED TRANSFERS</span>
              <span className="font-mono text-3xl font-bold text-white block mt-1">{stats.total_transactions.toLocaleString()}</span>
            </div>

            <div className="p-4 rounded-lg bg-aura-panel border border-aura-border shadow">
              <span className="text-xs text-aura-textMuted font-mono block">TOTAL VOLUME</span>
              <span className="font-mono text-3xl font-bold text-white block mt-1">₹{stats.total_amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            </div>

            <div className="p-4 rounded-lg bg-aura-panel border border-aura-critical/30 shadow relative overflow-hidden">
              <div className="absolute right-0 top-0 w-16 h-16 bg-aura-critical/5 rounded-bl-full flex items-center justify-center border-l border-b border-aura-critical/20">
                <span className="font-mono text-xs font-bold text-aura-critical">{stats.high_risk_accounts}</span>
              </div>
              <span className="text-xs text-aura-critical font-mono block font-bold">TOTAL SUSPICIOUS VOLUME</span>
              <span className="font-mono text-3xl font-bold text-aura-critical block mt-1">
                ₹{stats.amount_flagged.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
            </div>
          </div>

          {/* Pattern-Type Counter Strip */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-aura-textMuted">Detected Fraud Patterns</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {Object.entries(stats.alerts_by_type).map(([key, value]) => (
                <div 
                  key={key} 
                  onClick={() => navigate(`/alerts?type=${key}`)}
                  className={`p-3 rounded-lg border text-center cursor-pointer transition-all duration-200 ${
                    value > 0 
                      ? 'bg-aura-panel border-aura-high/40 hover:border-aura-high/80 hover:bg-aura-panelLight' 
                      : 'bg-aura-panel/40 border-aura-border/40 opacity-60 hover:opacity-100'
                  }`}
                >
                  <span className="text-xs text-aura-textMuted font-mono block capitalize">
                    {key.replace('_', ' ')}
                  </span>
                  <span className={`font-mono text-2xl font-bold block mt-1 ${value > 0 ? 'text-aura-high' : 'text-white'}`}>
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Top Risk & Alerts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Top Risk Accounts */}
            <div className="lg:col-span-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-aura-textMuted">Top Risk Targets</h3>
                <span className="text-[10px] text-aura-textMuted font-mono">SORT: RISK_SCORE_DESC</span>
              </div>
              
              <div className="divide-y divide-aura-border bg-aura-panel border border-aura-border rounded-lg overflow-hidden">
                {stats.top_risk_accounts && stats.top_risk_accounts.map((acc) => (
                  <div 
                    key={acc.account_id}
                    onClick={() => navigate(`/graph?accountId=${acc.account_id}`)}
                    className="p-3.5 flex items-center justify-between hover:bg-aura-panelLight cursor-pointer transition-colors"
                  >
                    <div>
                      <span className="font-bold text-white block text-sm">{acc.name}</span>
                      <span className="font-mono text-xs text-aura-textMuted">{acc.account_id}</span>
                    </div>
                    <div>
                      <RiskBadge score={acc.risk_score} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Alert Activity Feed */}
            <div className="lg:col-span-7 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-aura-textMuted">Active Suspicious Alerts</h3>
                <span className="text-[10px] text-aura-accent hover:underline cursor-pointer font-mono" onClick={() => navigate('/alerts')}>
                  VIEW_ALL_ALERTS
                </span>
              </div>

              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                {alerts.length === 0 ? (
                  <div className="p-8 text-center border border-aura-border rounded-lg bg-aura-panel text-aura-textMuted font-mono text-sm">
                    No threat vector alerts isolated yet.
                  </div>
                ) : (
                  alerts.map((alert) => (
                    <div 
                      key={alert.alert_id}
                      onClick={() => navigate(`/graph?alertId=${alert.alert_id}`)}
                      className="p-4 rounded-lg border border-aura-border hover:border-aura-accent/50 bg-aura-panel hover:bg-aura-panelLight/80 cursor-pointer transition-all duration-200"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-aura-border pb-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-aura-accent">{alert.alert_id}</span>
                          <span className="text-xs font-sans font-semibold text-white">{alert.title}</span>
                        </div>
                        <RiskBadge score={alert.severity} showScore={false} />
                      </div>
                      <p className="text-xs text-aura-textLight leading-relaxed">{alert.summary}</p>
                      <div className="flex items-center justify-between gap-4 mt-3 text-[10px] font-mono text-aura-textMuted">
                        <span>VOLUME: ₹{alert.amount_involved.toLocaleString()}</span>
                        <span>{new Date(alert.detected_at).toLocaleString()}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
