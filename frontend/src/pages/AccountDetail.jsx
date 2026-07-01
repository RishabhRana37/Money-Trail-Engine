import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getAccount } from '../api';
import RiskBadge from '../components/RiskBadge';
import { useToast } from '../components/Toast';

const riskColor = (level) => {
  switch (level?.toLowerCase()) {
    case 'critical': return '#E24B4A';
    case 'high': return '#F0883E';
    case 'medium': return '#D29922';
    case 'low': return '#3FB950';
    default: return '#3FB950';
  }
};

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

export default function AccountDetail() {
  const { accountId } = useParams();
  const navigate = useNavigate();
  const showToast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [animate, setAnimate] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (data) {
      const t = setTimeout(() => setAnimate(true), 50);
      return () => clearTimeout(t);
    } else {
      setAnimate(false);
    }
  }, [data]);

  useEffect(() => {
    if (!accountId) return;

    const loadDossier = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await getAccount(accountId);
        setData(res);
      } catch (err) {
        console.error(err);
        setError('Account not found');
        showToast('Account not found', 'error');
      } finally {
        setLoading(false);
      }
    };

    loadDossier();
  }, [accountId]);

  if (loading) {
    return (
      <div className="flex-1 p-6 space-y-6 max-w-7xl mx-auto w-full text-aura-textLight font-mono select-none animate-pulse">
        {/* Header Skeleton */}
        <div className="border-b border-aura-border pb-4 space-y-2">
          <div className="flex items-center gap-3">
            <div className="h-8 bg-gray-700 rounded w-1/3"></div>
            <div className="h-5 bg-gray-700 rounded w-16"></div>
          </div>
          <div className="h-4 bg-gray-700 rounded w-1/4"></div>
        </div>

        {/* Body Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Col Skeleton */}
          <div className="lg:col-span-1 space-y-6">
            <div className="p-6 hud-panel bg-aura-panel/85 space-y-4">
              <div className="h-4 bg-gray-700 rounded w-1/3"></div>
              <div className="h-8 bg-gray-700 rounded w-1/2"></div>
              <div className="h-4 bg-gray-700 rounded w-full"></div>
            </div>
            <div className="p-6 hud-panel bg-aura-panel/85 space-y-4">
              <div className="h-4 bg-gray-700 rounded w-1/3"></div>
              <div className="h-4 bg-gray-700 rounded w-full"></div>
              <div className="h-4 bg-gray-700 rounded w-5/6"></div>
            </div>
          </div>

          {/* Right Col Skeleton */}
          <div className="lg:col-span-2 space-y-6">
            <div className="p-6 hud-panel bg-aura-panel/85 h-48 space-y-4">
              <div className="h-4 bg-gray-700 rounded w-1/4"></div>
              <div className="h-4 bg-gray-700 rounded w-full"></div>
              <div className="h-4 bg-gray-700 rounded w-5/6"></div>
            </div>
            <div className="p-6 hud-panel bg-aura-panel/85 h-48 space-y-4">
              <div className="h-4 bg-gray-700 rounded w-1/4"></div>
              <div className="h-4 bg-gray-700 rounded w-full"></div>
              <div className="h-4 bg-gray-700 rounded w-full"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex-1 p-6 max-w-md mx-auto w-full text-center space-y-4 pt-20">
        <div className="p-4 border border-red-500/30 bg-red-500/10 text-red-400 text-sm font-mono uppercase tracking-wider">
          Account not found
        </div>
        <button
          onClick={() => navigate('/')}
          className="px-4 py-2 bg-aura-accent/10 border border-aura-accent/40 text-xs font-mono font-bold text-aura-accent hover:bg-aura-accent/20 active:scale-95 transition-all"
        >
          ← Back to dashboard
        </button>
      </div>
    );
  }

  return (
    <div className={`transition-opacity duration-100 ease-in-out ${isMounted ? 'opacity-100' : 'opacity-0'} flex-1 p-6 space-y-6 max-w-7xl mx-auto w-full text-aura-textLight font-mono select-none`}>
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-aura-border pb-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-medium text-white tracking-wide">{data.name || data.account_id}</h1>
            <span className="text-[10px] font-mono px-2 py-0.5 border border-aura-border bg-black/40 text-aura-textMuted uppercase rounded">
              {data.account_type}
            </span>
          </div>
          <p className="text-xs text-aura-textMuted font-mono">
            ID: <span className="select-all text-white font-mono">{data.account_id}</span>
          </p>
          {data.flags && data.flags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {data.flags.map(f => (
                <span key={f} className="text-[9px] font-mono px-2 py-0.5 bg-black/40 border border-aura-border/40 text-aura-textMuted uppercase font-medium rounded-full">
                  {f.replace('_', ' ')}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Risk Score and Action Buttons */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 bg-black/30 border border-aura-border/40 p-3 rounded">
            <div className="text-right">
              <span className="text-[9px] text-aura-textMuted block uppercase font-mono">Risk Profile</span>
              <span 
                className="text-[28px] font-bold font-mono leading-none block mt-1" 
                style={{ color: riskColor(data.risk_level) }}
              >
                {data.risk_score}%
              </span>
            </div>
            <div className="flex-shrink-0">
              <RiskBadge score={data.risk_score} showScore={false} />
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Col: Stat Tiles */}
        <div className="space-y-6 lg:col-span-1">
          <div className="p-5 hud-panel space-y-4 shadow-xl">
            <span className="hud-corner-tl">[TELEMETRY_LOGS]</span>
            <h3 className="text-[9px] font-bold uppercase tracking-wider text-aura-textMuted mt-1">Operational Metrics</h3>
            <div className="grid grid-cols-2 gap-3 text-[10px]">
              <div className="p-3 bg-black/10 border border-aura-border/40">
                <span className="text-[8px] text-aura-textMuted block">TOTAL_IN</span>
                <span className="text-xs font-bold text-emerald-400 mt-0.5 block">{formatIndianCurrency(data.total_in)}</span>
              </div>
              <div className="p-3 bg-black/10 border border-aura-border/40">
                <span className="text-[8px] text-aura-textMuted block">TOTAL_OUT</span>
                <span className="text-xs font-bold text-red-400 mt-0.5 block">{formatIndianCurrency(data.total_out)}</span>
              </div>
              <div className="p-3 bg-black/10 border border-aura-border/40 col-span-2">
                <span className="text-[8px] text-aura-textMuted block">TOTAL TRANSACTION COUNT</span>
                <span className="text-xs font-bold text-white mt-0.5 block">{data.txn_count} completed transfers</span>
              </div>
              <div className="p-3 bg-black/10 border border-aura-border/40 col-span-2">
                <span className="text-[8px] text-aura-textMuted block">Fan-in / Fan-out</span>
                <span className="text-xs font-bold text-white mt-0.5 block">{data.fan_in || 0} / {data.fan_out || 0} nodes</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Col: Why Flagged and Counterparties */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Why Flagged Panel */}
          <div className="p-6 hud-panel space-y-4 shadow-xl">
            <span className="hud-corner-tl">[WHY_FLAGGED]</span>
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-aura-textMuted mt-1">Why this score</h3>
            <div className="divide-y divide-aura-border/30">
              {data.explanation && data.explanation.length > 0 ? (
                data.explanation.map((item, idx) => (
                  <div key={idx} className="py-3 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 border-b border-aura-border/20 last:border-b-0">
                    <div className="text-xs font-medium text-white" style={{ width: '130px', minWidth: '130px' }}>
                      {item.factor}
                    </div>
                    <div className="text-[11px] text-aura-textMuted flex-1 font-sans">
                      {item.detail}
                    </div>
                    <div className="w-full sm:w-28 bg-black/40 border border-aura-border/30 h-2 overflow-hidden rounded-full flex-shrink-0 relative">
                      <div 
                        className="h-full rounded-full transition-all duration-[400ms] ease-out" 
                        style={{ 
                          width: animate ? `${item.contribution}%` : '0%',
                          backgroundColor: '#E24B4A'
                        }} 
                      />
                    </div>
                    <div className="text-xs font-mono font-bold text-[#E24B4A] min-w-[30px] text-right">
                      +{item.contribution}
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-4 text-center text-xs text-aura-textMuted">
                  No specific factors identified
                </div>
              )}
            </div>
          </div>

          {/* Top Counterparties */}
          <div className="p-6 hud-panel space-y-4 shadow-xl">
            <span className="hud-corner-tl">[COUNTERPARTY_DIRECTORY]</span>
            <h3 className="text-[9px] font-bold uppercase tracking-wider text-aura-textMuted mt-1">Known Counterparties</h3>
            <div className="divide-y divide-aura-border/30">
              {data.top_counterparties && data.top_counterparties.length > 0 ? (
                data.top_counterparties.map((cp, idx) => {
                  const isOut = cp.direction === 'out';
                  return (
                    <div 
                      key={idx} 
                      onClick={() => navigate(`/account/${cp.account_id}`)}
                      className="py-3 flex items-center justify-between hover:bg-aura-panelLight/30 px-2 cursor-pointer transition-colors"
                    >
                      <div className="space-y-1 min-w-0">
                        <span className="font-bold text-white text-xs block uppercase truncate">
                          {cp.name || cp.account_id}
                        </span>
                        <span className="text-[10px] text-aura-textMuted font-mono block">
                          {cp.account_id}
                        </span>
                      </div>
                      <div className="text-right flex items-center gap-4 flex-shrink-0">
                        <div>
                          <span className="text-xs font-bold text-white block">{formatIndianCurrency(cp.amount)}</span>
                          <span className={`text-[8px] font-bold px-1.5 py-0.2 border ${
                            !isOut 
                              ? 'bg-emerald-950/20 border-emerald-500/20 text-emerald-400' 
                              : 'bg-red-950/20 border-red-500/20 text-red-400'
                          }`}>
                            {!isOut ? 'INBOUND' : 'OUTBOUND'}
                          </span>
                        </div>
                        <span 
                          className={`text-xl font-bold font-mono ${!isOut ? 'text-green-500' : 'text-red-500'}`}
                        >
                          {!isOut ? '↓' : '↑'}
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-4 text-center text-xs text-aura-textMuted">
                  No counterparties found
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Action Buttons Toolbar */}
      <div className="flex flex-wrap gap-4 pt-4 border-t border-aura-border/40">
        <button
          onClick={() => navigate('/')}
          className="px-4 py-2 border border-aura-border text-xs font-mono font-bold text-aura-textLight hover:bg-white/10 active:scale-95 transition-all flex items-center gap-1.5"
        >
          ← Back to dashboard
        </button>
        <button
          onClick={() => navigate(`/graph/${data.account_id}`)}
          className="px-4 py-2 bg-aura-accent/15 border border-aura-accent/40 text-xs font-mono font-bold text-aura-accent hover:bg-aura-accent/30 active:scale-95 transition-all flex items-center gap-1.5"
        >
          View in graph →
        </button>
      </div>
    </div>
  );
}
