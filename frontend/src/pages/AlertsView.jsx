import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import RiskBadge from '../components/RiskBadge';

function formatIndianCurrency(amount) {
  if (amount >= 10000000) {
    const crVal = amount / 10000000;
    const formatted = Number(crVal.toFixed(2));
    return `₹${formatted} Cr`;
  } else if (amount >= 100000) {
    const lVal = amount / 100000;
    const formatted = Number(lVal.toFixed(2));
    return `₹${formatted}L`;
  }
  return `₹${amount.toLocaleString('en-IN')}`;
}

function SeverityPill({ score }) {
  let style = "bg-slate-800 text-slate-300 border-slate-700/50";
  if (score >= 90) style = "bg-[#FCEBEB] text-[#A32D2D] border-[#E24B4A]/20";
  else if (score >= 70) style = "bg-[#FAEEDA] text-[#854F0B] border-[#F0883E]/20";
  else if (score >= 40) style = "bg-[#FAEEDA] text-[#634000] border-[#D29922]/20";
  else style = "bg-[#EAF3DE] text-[#3B6D11] border-[#3FB950]/20";
  
  return (
    <span className={`inline-flex items-center justify-center font-mono text-[10px] font-bold px-2 py-0.5 border rounded-full ${style}`}>
      {score}
    </span>
  );
}

export default function AlertsView({ datasetId }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialType = searchParams.get('type') || '';

  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Filter states
  const [selectedType, setSelectedType] = useState(initialType);
  const [minSeverity, setMinSeverity] = useState(0);

  const patternTypes = [
    { id: '', label: 'All' },
    { id: 'circular', label: 'Circular' },
    { id: 'layering', label: 'Layering' },
    { id: 'smurfing', label: 'Smurfing' },
    { id: 'rapid_movement', label: 'Rapid movement' },
    { id: 'fan_in', label: 'Fan-in' },
    { id: 'fan_out', label: 'Fan-out' },
  ];

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getAlerts({
        datasetId,
        min_severity: minSeverity,
        pattern_type: selectedType || undefined
      });
      setAlerts(res.alerts || []);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch alerts list.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, [datasetId, selectedType, minSeverity]);

  const handleTypeSelect = (type) => {
    setSelectedType(type);
    if (type) {
      setSearchParams({ type });
    } else {
      setSearchParams({});
    }
  };

  const getSeverityBorder = (score) => {
    if (score >= 90) return 'border-l-4 border-l-aura-critical';
    if (score >= 70) return 'border-l-4 border-l-aura-high';
    if (score >= 40) return 'border-l-4 border-l-aura-medium';
    return 'border-l-4 border-l-aura-low';
  };

  return (
    <div className="flex-1 p-6 space-y-6 max-w-7xl mx-auto w-full text-aura-textLight font-mono select-none">
      
      {/* Title */}
      <div className="border-b border-aura-border pb-4">
        <h1 className="text-xl font-bold text-white tracking-widest uppercase">Anomaly Threat Directory</h1>
        <p className="text-xs text-aura-textMuted mt-1">Classification and triage logs for identified transactional vectors.</p>
      </div>

      {error && (
        <div className="p-3 border border-aura-critical/30 bg-aura-critical/10 text-aura-critical text-xs">
          &gt; ERROR: {error}
        </div>
      )}

      {/* Grid workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Sidebar Filters */}
        <div className="space-y-6 lg:col-span-1 hud-panel p-5 shadow-lg h-fit">
          <span className="hud-corner-tl">[TRIAGE_CONSOLE]</span>
          
          {/* Pattern Chips */}
          <div className="space-y-2.5 mt-1">
            <label className="text-[9px] text-aura-textMuted uppercase font-bold">Threat Pattern Type</label>
            <div className="flex flex-col gap-1.5">
              {patternTypes.map(p => (
                <button
                  key={p.id}
                  onClick={() => handleTypeSelect(p.id)}
                  className={`w-full text-left px-3 py-1.5 border text-[10px] font-bold tracking-wider transition-all ${
                    selectedType === p.id 
                      ? 'bg-aura-accent/10 border-aura-accent text-aura-accent' 
                      : 'bg-black/20 border-aura-border/40 text-aura-textMuted hover:border-aura-border hover:text-white'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Severity Slider */}
          <div className="space-y-2 pt-2 border-t border-aura-border/40">
            <div className="flex justify-between items-center text-[9px] font-bold text-aura-textMuted">
              <span>MIN_SEVERITY</span>
              <span className="text-white">{minSeverity.toString().padStart(3, '0')}</span>
            </div>
            <input 
              type="range"
              min="0"
              max="100"
              value={minSeverity}
              onChange={(e) => setMinSeverity(Number(e.target.value))}
              className="w-full h-1 bg-aura-border rounded-none appearance-none cursor-pointer accent-aura-accent"
            />
            <div className="flex justify-between text-[8px] text-aura-textMuted">
              <span>LOW</span>
              <span>CRIT</span>
            </div>
          </div>
        </div>

        {/* Alerts List */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between text-[9px] text-aura-textMuted pb-1">
            <span>QUERY_RESULT: {alerts.length.toString().padStart(3, '0')} THREATS MATCHED</span>
            <span>SYSTEM: ONLINE</span>
          </div>

          {loading ? (
            <div className="h-64 flex flex-col items-center justify-center gap-3">
              <svg className="animate-spin h-5 w-5 text-aura-accent" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="text-[10px] text-aura-textMuted">SEARCHING CHANNELS...</span>
            </div>
          ) : alerts.length === 0 ? (
            <div className="p-12 text-center border border-aura-border bg-black/20 text-aura-textMuted text-xs shadow">
              &gt; NO ANOMALIES RECORDED MATCHING THRESHOLDS.
            </div>
          ) : (
            <div className="space-y-4">
              {alerts.map(alert => (
                <div
                  key={alert.alert_id}
                  onClick={() => navigate(`/graph?alertId=${alert.alert_id}`)}
                  className={`p-5 hud-panel hover:bg-aura-panelLight/40 hover:border-aura-accent/50 cursor-pointer transition-all duration-200 shadow-lg ${getSeverityBorder(alert.severity)}`}
                >
                  <span className="hud-corner-tl">[LOG_DOCKET: {alert.alert_id}]</span>
                  
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-aura-border/40 pb-3 mb-3 mt-1">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <SeverityPill score={alert.severity} />
                        <span className="inline-flex text-[8px] font-bold border border-aura-indigo/40 bg-aura-indigo/5 text-aura-indigo px-1.5 py-0.2 tracking-wider">
                          {alert.pattern_type.replace('_', ' ').toUpperCase()}
                        </span>
                        <span className="font-bold text-white text-sm">{alert.title}</span>
                      </div>
                    </div>
                    <span className="text-xs font-mono text-aura-textMuted font-bold">
                      {formatIndianCurrency(alert.amount_involved)} involved
                    </span>
                  </div>
                  
                  <p className="text-xs text-aura-textLight leading-relaxed">{alert.summary}</p>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4 pt-3 border-t border-aura-border/40 text-[10px] text-aura-textMuted">
                    <div>
                      <span className="block text-[8px]">EXPOSED_VOLUME</span>
                      <span className="font-bold text-white text-xs">{formatIndianCurrency(alert.amount_involved)}</span>
                    </div>
                    <div>
                      <span className="block text-[8px]">ONTOLOGY_MEMBERS</span>
                      <span className="font-bold text-white text-xs">{(alert.account_ids || []).length} NODES</span>
                    </div>
                    <div className="sm:text-right">
                      <span className="block text-[8px]">TIME_COMMITTED</span>
                      <span className="font-bold text-white text-xs">{new Date(alert.detected_at).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
