import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import RiskBadge from '../components/RiskBadge';

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
    { id: '', label: 'All Patterns' },
    { id: 'circular', label: 'Circular Loop' },
    { id: 'layering', label: 'Layering' },
    { id: 'smurfing', label: 'Smurfing' },
    { id: 'rapid_movement', label: 'Rapid Move' },
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

  // Update query params when filter type changes (keeps browser history synced)
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
    <div className="flex-1 p-6 space-y-6 max-w-7xl mx-auto w-full text-aura-textLight">
      {/* Title */}
      <div className="border-b border-aura-border pb-5">
        <h1 className="text-2xl font-bold text-white tracking-tight">Pattern Alerts & Investigations</h1>
        <p className="text-sm text-aura-textMuted">Triage isolated suspicious networks and circular flow anomalies.</p>
      </div>

      {error && (
        <div className="p-4 rounded border border-aura-critical/30 bg-aura-critical/10 text-aura-critical text-sm font-mono">
          {error}
        </div>
      )}

      {/* Filter and Content Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Filters Sidebar */}
        <div className="space-y-6 lg:col-span-1 glass-panel p-5 rounded-lg border border-aura-border h-fit">
          <h3 className="text-xs font-bold uppercase tracking-wider text-white border-b border-aura-border pb-2">Filter Console</h3>
          
          {/* Pattern Chips */}
          <div className="space-y-2">
            <label className="text-[10px] text-aura-textMuted font-mono uppercase">Pattern Vector</label>
            <div className="flex flex-col gap-1.5">
              {patternTypes.map(p => (
                <button
                  key={p.id}
                  onClick={() => handleTypeSelect(p.id)}
                  className={`w-full text-left px-3 py-2 rounded text-xs font-medium border transition-all ${
                    selectedType === p.id 
                      ? 'bg-aura-accent/15 border-aura-accent text-aura-accent' 
                      : 'bg-aura-panelLight/40 border-aura-border/40 text-aura-textMuted hover:border-aura-border hover:text-white'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Severity Slider */}
          <div className="space-y-2 pt-2 border-t border-aura-border/50">
            <div className="flex justify-between items-center text-[10px] font-mono text-aura-textMuted">
              <span>MIN SEVERITY</span>
              <span className="text-white font-bold">{minSeverity} / 100</span>
            </div>
            <input 
              type="range"
              min="0"
              max="100"
              value={minSeverity}
              onChange={(e) => setMinSeverity(Number(e.target.value))}
              className="w-full h-1 bg-aura-border rounded-lg appearance-none cursor-pointer accent-aura-accent"
            />
            <div className="flex justify-between text-[9px] font-mono text-aura-textMuted">
              <span>0 (Low)</span>
              <span>100 (Critical)</span>
            </div>
          </div>
        </div>

        {/* Alerts List feed */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between text-xs font-mono text-aura-textMuted pb-2">
            <span>SHOWING: {alerts.length} ALERTS MATCHING CRITERIA</span>
            <span>DATASET_REF: {datasetId}</span>
          </div>

          {loading ? (
            <div className="h-64 flex flex-col items-center justify-center gap-3">
              <svg className="animate-spin h-8 w-8 text-aura-accent" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="text-sm font-mono text-aura-textMuted">Scanning networks...</span>
            </div>
          ) : alerts.length === 0 ? (
            <div className="p-12 text-center border border-aura-border rounded-lg bg-aura-panel text-aura-textMuted font-mono text-sm shadow">
              No anomalies found matching current filters. Try relaxing the severity slider.
            </div>
          ) : (
            <div className="space-y-4">
              {alerts.map(alert => (
                <div
                  key={alert.alert_id}
                  onClick={() => navigate(`/graph?alertId=${alert.alert_id}`)}
                  className={`p-5 rounded-lg bg-aura-panel hover:bg-aura-panelLight/65 border border-aura-border hover:border-aura-accent/50 cursor-pointer transition-all duration-200 shadow-lg ${getSeverityBorder(alert.severity)}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-aura-border/70 pb-3 mb-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-aura-accent">{alert.alert_id}</span>
                        <h3 className="font-bold text-white text-base leading-snug">{alert.title}</h3>
                      </div>
                      <span className="inline-flex text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-aura-indigo/10 border border-aura-indigo/30 text-aura-indigo tracking-wider">
                        {alert.pattern_type.replace('_', ' ')}
                      </span>
                    </div>
                    <RiskBadge score={alert.severity} />
                  </div>
                  
                  <p className="text-sm text-aura-textLight leading-relaxed">{alert.summary}</p>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4 pt-3 border-t border-aura-border/40 text-xs font-mono text-aura-textMuted">
                    <div>
                      <span className="block text-[10px]">TOTAL EXPOSED VOLUME</span>
                      <span className="font-bold text-white text-sm">₹{alert.amount_involved.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="block text-[10px]">MEMBER ACCOUNTS</span>
                      <span className="font-bold text-white text-sm">{(alert.account_ids || []).length} accounts</span>
                    </div>
                    <div className="sm:text-right">
                      <span className="block text-[10px]">DETECTION TIMESTAMP</span>
                      <span className="font-bold text-white text-sm">{new Date(alert.detected_at).toLocaleString()}</span>
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
