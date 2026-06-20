import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import RiskBadge from './RiskBadge';
import RiskGauge from './RiskGauge';

export default function AccountSlideOver({ accountId, onClose }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!accountId) return;

    setLoading(true);
    setError(null);
    api.getAccountDetail(accountId)
      .then(res => {
        setData(res);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setError('Failed to load account details.');
        setLoading(false);
      });
  }, [accountId]);

  if (!accountId) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:max-w-md z-50 flex select-none">
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />

      {/* Slide drawer body styled as classified HUD docket */}
      <div className="relative w-full max-w-md bg-aura-panel border-l border-aura-border shadow-2xl flex flex-col h-full z-10 text-aura-textLight font-mono hud-panel">
        <span className="hud-corner-tl">[SEC_DOCKET: TARGET_LOCK]</span>
        
        {/* Header */}
        <div className="p-4 border-b border-aura-border flex items-center justify-between bg-black/40 mt-1">
          <div>
            <h2 className="text-sm font-bold text-white tracking-widest leading-tight">INVESTIGATION_DOSSIER</h2>
            <p className="text-[10px] text-aura-accent select-all mt-0.5">{accountId}</p>
          </div>
          <button 
            onClick={onClose}
            className="p-1 border border-aura-border hover:border-aura-accent text-aura-textMuted hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {loading ? (
            <div className="h-64 flex flex-col items-center justify-center gap-3">
              <svg className="animate-spin h-5 w-5 text-aura-accent" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <p className="text-[10px] text-aura-textMuted">QUERYING INTEL SYSTEM...</p>
            </div>
          ) : error ? (
            <div className="p-3 border border-aura-critical/30 bg-aura-critical/10 text-aura-critical text-xs">
              {error}
            </div>
          ) : data ? (
            <>
              {/* Profile Card */}
              <div className="flex items-center gap-4 p-4 border border-aura-border bg-black/20">
                <div className="flex-1 space-y-1.5 overflow-hidden">
                  <h3 className="text-xs font-bold text-white truncate uppercase">{data.name}</h3>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[8px] border border-aura-border px-1.5 py-0.2 text-aura-textLight uppercase select-none">
                      {data.account_type}
                    </span>
                    <RiskBadge score={data.risk_score} showScore={false} />
                  </div>
                  <div className="pt-2">
                    <Link 
                      to={`/account/${data.account_id}`}
                      className="text-[10px] text-aura-accent hover:underline flex items-center gap-1 font-bold"
                    >
                      OPEN_DOSSIER_DECK &gt;&gt;
                    </Link>
                  </div>
                </div>
                <RiskGauge score={data.risk_score} size={70} />
              </div>

              {/* Stats telemetry */}
              <div className="grid grid-cols-2 gap-3 text-[10px]">
                <div className="p-3 border border-aura-border bg-black/10">
                  <span className="text-[8px] text-aura-textMuted block">TOTAL_INFLOW</span>
                  <span className="font-bold text-emerald-400 block mt-0.5">₹{data.total_in.toLocaleString()}</span>
                </div>
                <div className="p-3 border border-aura-border bg-black/10">
                  <span className="text-[8px] text-aura-textMuted block">TOTAL_OUTFLOW</span>
                  <span className="font-bold text-orange-400 block mt-0.5">₹{data.total_out.toLocaleString()}</span>
                </div>
                <div className="p-3 border border-aura-border bg-black/10">
                  <span className="text-[8px] text-aura-textMuted block">TRANSFERS</span>
                  <span className="font-bold text-white block mt-0.5">{data.txn_count} txs</span>
                </div>
                <div className="p-3 border border-aura-border bg-black/10">
                  <span className="text-[8px] text-aura-textMuted block">FAN_IN/OUT</span>
                  <span className="font-bold text-white block mt-0.5">{data.fan_in} / {data.fan_out}</span>
                </div>
              </div>

              {/* Explainability vector bars */}
              <div className="space-y-3">
                <h4 className="text-[9px] font-bold uppercase tracking-wider text-aura-textMuted">Threat Attribution Logs</h4>
                <div className="space-y-3.5 border border-aura-border bg-black/10 p-4 rounded-none">
                  {data.explanation && data.explanation.map((item, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between text-[10px]">
                        <span className="font-bold text-white">{item.factor}</span>
                        <span className="text-aura-accent">+{item.contribution}%</span>
                      </div>
                      <p className="text-[9px] text-aura-textMuted leading-relaxed">{item.detail}</p>
                      <div className="h-1 w-full bg-aura-border rounded-none overflow-hidden">
                        <div 
                          className="h-full bg-aura-accent rounded-none transition-all duration-1000"
                          style={{ width: `${item.contribution}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top counterparties table */}
              <div className="space-y-3">
                <h4 className="text-[9px] font-bold uppercase tracking-wider text-aura-textMuted">Primary Linkages</h4>
                <div className="border border-aura-border bg-black/10 divide-y divide-aura-border">
                  {data.top_counterparties && data.top_counterparties.map((cp, idx) => (
                    <div key={idx} className="p-3 flex items-center justify-between text-[10px]">
                      <div>
                        <span className="font-bold text-white block truncate uppercase">{cp.name}</span>
                        <span className="text-[8px] text-aura-textMuted">{cp.account_id}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold block text-white">
                          ₹{cp.amount.toLocaleString()}
                        </span>
                        <span className={`text-[8px] font-bold ${cp.direction === 'in' ? 'text-emerald-400' : 'text-orange-400'}`}>
                          {cp.direction === 'in' ? '[INBOUND]' : '[OUTBOUND]'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
