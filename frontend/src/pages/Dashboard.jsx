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
      const genRes = await api.generateDataset({ num_accounts: 200, num_transactions: 2500, fraud_intensity: 'medium', seed: 42 });
      
      setAnalyzingState('analyzing');
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
      <div className="flex-1 flex flex-col items-center justify-center bg-aura-bg min-h-[85vh] px-4 select-none">
        <div className="w-full max-w-lg p-8 hud-panel flex flex-col items-center text-center space-y-6 shadow-2xl scanline terminal-active">
          {/* Tactical Coordinate tag */}
          <span className="hud-corner-tl">[SEC_DECK: SCANNER_INIT]</span>
          
          {/* Sonar Radar Screen */}
          <div className="relative w-48 h-48 rounded-full border border-aura-accent/20 bg-black/50 flex items-center justify-center overflow-hidden radar-sweep-effect">
            {/* Concentric rings */}
            <div className="absolute inset-4 rounded-full border border-aura-accent/10" />
            <div className="absolute inset-10 rounded-full border border-aura-accent/5" />
            <div className="absolute inset-20 rounded-full border border-aura-accent/5" />
            
            {/* Grid axis lines */}
            <div className="absolute inset-y-0 left-1/2 w-[0.5px] bg-aura-accent/10" />
            <div className="absolute inset-x-0 top-1/2 h-[0.5px] bg-aura-accent/10" />
            
            {/* Radar Sweep center dot */}
            <div className="w-2.5 h-2.5 bg-aura-accent shadow-[0_0_10px_#00E5FF] z-10" />
            
            {/* Detected threat pings */}
            <div className="absolute top-12 left-16 w-1.5 h-1.5 bg-aura-critical animate-ping rounded-none" />
            <div className="absolute bottom-16 right-12 w-1.5 h-1.5 bg-aura-high animate-ping rounded-none" style={{ animationDelay: '1s' }} />
            <div className="absolute top-28 right-24 w-1.5 h-1.5 bg-aura-medium animate-ping rounded-none" style={{ animationDelay: '2.5s' }} />
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-bold text-white font-mono uppercase tracking-widest">
              {analyzingState === 'generating' ? 'SYNTHESIZING_NETWORK' : 'PARSING_GRAPH_ONTOLOGY'}
            </h3>
            <p className="text-xs text-aura-textMuted font-mono leading-relaxed">
              {analyzingState === 'generating' 
                ? 'Populating node list and seeding transactions...' 
                : 'Traversing ledger loops and matching suspicious cycles...'}
            </p>
          </div>

          {/* Console readout logs */}
          <div className="w-full bg-black/60 p-3 border border-aura-border text-[9px] font-mono text-aura-accent text-left h-20 overflow-y-auto space-y-1">
            <div>&gt; INITIALIZING SPATIAL ANALYZER...</div>
            {analyzingState === 'generating' ? (
              <>
                <div>&gt; ALLOCATING MEMORY BLOCKS... SUCCESS</div>
                <div>&gt; GENERATING 2500 SCATTERED TRANSFERS...</div>
              </>
            ) : (
              <>
                <div>&gt; INGESTING TRANSACTION TELEMETRY... DONE</div>
                <div>&gt; RUNNING ANOMALY DETECTION PIPELINE...</div>
                <div>&gt; CRITICAL THREAT LOOPS MATCHED: 3</div>
              </>
            )}
            <div className="animate-pulse">&gt; PROCESSING_DATA_ STREAM_</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 space-y-6 max-w-7xl mx-auto w-full text-aura-textLight select-none">
      
      {/* HUD Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-aura-border pb-4">
        <div>
          <h1 className="text-xl font-bold text-white font-mono tracking-widest uppercase">System Threat Directory</h1>
          <p className="text-xs text-aura-textMuted font-mono mt-1">Telemetry overview of transactional networks and loop anomalies.</p>
        </div>
        <button
          onClick={handleLoadDemoDataset}
          className="px-4 py-2 bg-aura-accent/10 border border-aura-accent/40 text-xs font-mono font-bold text-aura-accent hover:bg-aura-accent/20 active:scale-95 transition-all flex items-center justify-center gap-1.5"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          RUN_SEED_SIMULATOR
        </button>
      </div>

      {error && (
        <div className="p-3 border border-aura-critical/30 bg-aura-critical/10 text-aura-critical text-xs font-mono">
          &gt; ERROR: {error}
        </div>
      )}

      {loading ? (
        <div className="h-64 flex flex-col items-center justify-center gap-3">
          <svg className="animate-spin h-6 w-6 text-aura-accent" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-xs font-mono text-aura-textMuted">TRAVERSING SYSTEM REGISTRY...</span>
        </div>
      ) : stats ? (
        <>
          {/* KPI Matrix Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            <div className="p-4 hud-panel shadow-lg">
              <span className="hud-corner-tl">[KPI_01]</span>
              <span className="text-[10px] text-aura-textMuted font-mono block">MONITORED_NODES</span>
              <span className="font-mono text-2xl font-bold text-white block mt-2">{stats.total_accounts}</span>
            </div>
            
            <div className="p-4 hud-panel shadow-lg">
              <span className="hud-corner-tl">[KPI_02]</span>
              <span className="text-[10px] text-aura-textMuted font-mono block">EDGES_VERIFIED</span>
              <span className="font-mono text-2xl font-bold text-white block mt-2">{stats.total_transactions.toLocaleString()}</span>
            </div>

            <div className="p-4 hud-panel shadow-lg">
              <span className="hud-corner-tl">[KPI_03]</span>
              <span className="text-[10px] text-aura-textMuted font-mono block">TOTAL_SYSTEM_CAP</span>
              <span className="font-mono text-2xl font-bold text-white block mt-2">₹{stats.total_amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            </div>

            <div className="p-4 hud-panel border-aura-critical/40 shadow-lg bg-aura-critical/5">
              <span className="hud-corner-tl" style={{ color: '#FF3B30' }}>[KPI_ALERT]</span>
              <span className="text-[10px] text-aura-critical font-mono block font-bold">FLAGGED_EXPOSURE_VAL</span>
              <span className="font-mono text-2xl font-bold text-aura-critical block mt-2">
                ₹{stats.amount_flagged.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
            </div>
          </div>

          {/* Patterns telemetry counters */}
          <div className="space-y-2">
            <h3 className="text-[10px] font-mono font-bold uppercase tracking-wider text-aura-textMuted">Triage Threat Profiles</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {Object.entries(stats.alerts_by_type).map(([key, value]) => (
                <div 
                  key={key} 
                  onClick={() => navigate(`/alerts?type=${key}`)}
                  className={`p-3 border text-center cursor-pointer transition-all duration-200 relative ${
                    value > 0 
                      ? 'bg-aura-panelLight/40 border-aura-high/40 hover:border-aura-high text-aura-high' 
                      : 'bg-black/20 border-aura-border/40 opacity-50 hover:opacity-100'
                  }`}
                >
                  <span className="text-[8px] font-mono block uppercase">
                    {key.replace('_', ' ')}
                  </span>
                  <span className={`font-mono text-xl font-bold block mt-1.5 ${value > 0 ? 'text-aura-high' : 'text-white'}`}>
                    {value.toString().padStart(2, '0')}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Threat List Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Top Risk Targets */}
            <div className="lg:col-span-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-mono font-bold uppercase tracking-wider text-aura-textMuted">Classified Risk Targets</h3>
                <span className="text-[8px] text-aura-textMuted font-mono">D_RANK: HIGHEST_SCORE</span>
              </div>
              
              <div className="divide-y divide-aura-border bg-black/40 border border-aura-border rounded-none overflow-hidden">
                {stats.top_risk_accounts && stats.top_risk_accounts.map((acc) => (
                  <div 
                    key={acc.account_id}
                    onClick={() => navigate(`/graph?accountId=${acc.account_id}`)}
                    className="p-3 flex items-center justify-between hover:bg-aura-panelLight/50 cursor-pointer transition-colors border-b border-aura-border last:border-b-0"
                  >
                    <div>
                      <span className="font-mono text-xs font-bold text-white block">{acc.name}</span>
                      <span className="font-mono text-[9px] text-aura-textMuted">{acc.account_id}</span>
                    </div>
                    <div>
                      <RiskBadge score={acc.risk_score} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Active alert logs */}
            <div className="lg:col-span-7 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-mono font-bold uppercase tracking-wider text-aura-textMuted">Tactical Threat Feed</h3>
                <span className="text-[8px] text-aura-accent hover:underline cursor-pointer font-mono" onClick={() => navigate('/alerts')}>
                  OPEN_THREAT_DIRECTORY
                </span>
              </div>

              <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                {alerts.length === 0 ? (
                  <div className="p-8 text-center border border-aura-border bg-black/20 text-aura-textMuted font-mono text-xs">
                    No active threat profiles parsed. Seeding required.
                  </div>
                ) : (
                  alerts.map((alert) => (
                    <div 
                      key={alert.alert_id}
                      onClick={() => navigate(`/graph?alertId=${alert.alert_id}`)}
                      className="p-4 hud-panel hover:bg-aura-panelLight/50 hover:border-aura-accent/50 cursor-pointer transition-all duration-200"
                    >
                      <span className="hud-corner-tl">[SEC_VEC: {alert.alert_id}]</span>
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-aura-border/40 pb-2 mb-2">
                        <span className="text-xs font-mono font-bold text-white mt-2 block">{alert.title}</span>
                        <RiskBadge score={alert.severity} showScore={false} />
                      </div>
                      <p className="text-[11px] text-aura-textLight font-mono leading-relaxed">{alert.summary}</p>
                      <div className="flex items-center justify-between gap-4 mt-3 text-[9px] font-mono text-aura-textMuted">
                        <span>CAP_EXPOSURE: ₹{alert.amount_involved.toLocaleString()}</span>
                        <span>DATE_CAPTURED: {new Date(alert.detected_at).toLocaleDateString()}</span>
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
