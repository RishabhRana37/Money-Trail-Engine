import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAlerts } from '../api';

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

export default function AlertsView() {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [minSeverity, setMinSeverity] = useState(0);
  const [patternType, setPatternType] = useState(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const fetchAlertsData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getAlerts(minSeverity, patternType);
      setAlerts(res.alerts || []);
    } catch (err) {
      console.error(err);
      setError('Failed to load alerts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlertsData();
  }, [minSeverity, patternType]);

  const handleClearFilters = () => {
    setMinSeverity(0);
    setPatternType(null);
  };

  return (
    <div className={`transition-opacity duration-100 ease-in-out ${isMounted ? 'opacity-100' : 'opacity-0'} flex-1 p-6 space-y-6 max-w-5xl mx-auto w-full text-aura-textLight font-mono select-none`}>
      {/* Title */}
      <div className="border-b border-aura-border pb-4">
        <h1 className="text-xl font-bold text-white tracking-widest uppercase">Anomaly Threat Directory</h1>
        <p className="text-xs text-aura-textMuted mt-1">Classification and triage logs for identified transactional vectors.</p>
      </div>

      {error && (
        <div className="p-3 border border-red-500/30 bg-red-500/10 text-red-400 text-xs text-center uppercase tracking-wide">
          {error}
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 bg-aura-panel/50 border border-aura-border rounded">
        {/* Pattern chips */}
        <div className="flex-1 overflow-x-auto scrollbar-none flex items-center gap-2 pb-2 md:pb-0">
          {[
            { id: null, label: 'All' },
            { id: 'circular', label: 'circular' },
            { id: 'layering', label: 'layering' },
            { id: 'smurfing', label: 'smurfing' },
            { id: 'rapid_movement', label: 'rapid movement' },
            { id: 'fan_in', label: 'fan-in' },
            { id: 'fan_out', label: 'fan-out' }
          ].map(chip => (
            <button
              key={chip.id}
              onClick={() => setPatternType(chip.id)}
              className={`px-3 py-1.5 border text-xs font-bold whitespace-nowrap rounded transition-all ${
                patternType === chip.id
                  ? 'bg-white text-black border-white'
                  : 'bg-transparent border-aura-border/60 text-aura-textMuted hover:text-white hover:border-white'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Severity Slider */}
        <div className="flex items-center gap-3 text-xs font-mono min-w-[240px]">
          <span className="text-aura-textMuted whitespace-nowrap">Min severity: {minSeverity}</span>
          <input
            type="range"
            min="0"
            max="100"
            step="10"
            value={minSeverity}
            onChange={(e) => setMinSeverity(Number(e.target.value))}
            className="w-full accent-aura-accent bg-black/40 border border-aura-border h-1 rounded-lg appearance-none cursor-pointer"
          />
        </div>
      </div>

      {/* Main List */}
      <div className="space-y-4">
        {loading ? (
          // 3 Skeleton placeholders
          Array.from({ length: 3 }).map((_, idx) => (
            <div key={idx} className="p-5 border border-aura-border bg-aura-panel/40 animate-pulse space-y-3 h-40">
              <div className="flex items-center gap-3">
                <div className="h-5 bg-gray-700 rounded w-12"></div>
                <div className="h-5 bg-gray-700 rounded w-24"></div>
                <div className="h-5 bg-gray-700 rounded flex-1"></div>
              </div>
              <div className="h-4 bg-gray-700 rounded w-full"></div>
              <div className="h-4 bg-gray-700 rounded w-5/6"></div>
            </div>
          ))
        ) : alerts.length === 0 ? (
          /* Empty State */
          <div className="p-12 text-center border border-aura-border bg-black/20 text-aura-textMuted text-xs flex flex-col items-center gap-3">
            <span>No alerts match this filter</span>
            <button
              onClick={handleClearFilters}
              className="px-3 py-1.5 bg-aura-accent/15 border border-aura-accent/40 text-xs font-mono font-bold text-aura-accent hover:bg-aura-accent/30 active:scale-95 transition-all"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {alerts.map(alert => {
              const score = alert.severity || 0;
              const severityBg = score >= 90 ? 'bg-[#E24B4A] text-white' : score >= 70 ? 'bg-[#F0883E] text-white' : 'bg-slate-800 text-slate-300';
              return (
                <div
                  key={alert.alert_id}
                  onClick={() => navigate(`/ring/${alert.alert_id}`)}
                  className="p-5 border border-aura-border bg-aura-panel/60 hover:bg-aura-panelLight/40 hover:border-aura-accent/50 cursor-pointer transition-all duration-200 relative"
                >
                  <span className="hud-corner-tl">[LOG_DOCKET: {alert.alert_id}]</span>
                  
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-aura-border/40 pb-3 mb-3 mt-1">
                    <div className="flex-1 flex items-center gap-2 flex-wrap">
                      {/* Severity number pill */}
                      <span className={`inline-flex items-center justify-center font-mono text-[10px] font-bold px-2 py-0.5 rounded-full ${severityBg}`}>
                        {score}
                      </span>
                      {/* Pattern Type badge */}
                      <span className="inline-flex text-[9px] font-bold border border-aura-border/60 bg-black/40 text-aura-textMuted px-1.5 py-0.5 rounded uppercase">
                        {alert.pattern_type.replace('_', ' ')}
                      </span>
                      {/* Title */}
                      <span className="font-medium text-white text-sm flex-1">{alert.title}</span>
                    </div>
                    {/* Amount */}
                    <span className="text-xs font-mono text-aura-textMuted font-bold">
                      {formatIndianCurrency(alert.amount_involved)}
                    </span>
                  </div>
                  
                  {/* Summary */}
                  <p className="text-xs text-aura-textLight leading-relaxed">{alert.summary}</p>
                  
                  {/* Footer details */}
                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-aura-border/40 text-[10px] text-aura-textMuted">
                    <span>EXPOSURE: {formatIndianCurrency(alert.amount_involved)}</span>
                    <span className="font-bold text-white uppercase">{ (alert.account_ids || []).length } accounts</span>
                    <span>CAPTURED: {new Date(alert.detected_at).toLocaleDateString()}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
