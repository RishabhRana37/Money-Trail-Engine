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
    <div className="fixed inset-y-0 right-0 w-full sm:max-w-md z-50 flex">
      {/* Backdrop (clicks outside to close) */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />

      {/* Drawer body */}
      <div className="relative w-full max-w-md bg-aura-panel border-l border-aura-border shadow-2xl flex flex-col h-full z-10 animate-slide-in text-aura-textLight">
        {/* Header */}
        <div className="p-4 border-b border-aura-border flex items-center justify-between bg-aura-panelLight">
          <div>
            <h2 className="text-lg font-bold text-white leading-tight">Investigator Dossier</h2>
            <p className="font-mono text-xs text-aura-accent select-all mt-0.5">{accountId}</p>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded hover:bg-aura-border text-aura-textMuted hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {loading ? (
            <div className="h-64 flex flex-col items-center justify-center gap-3">
              <svg className="animate-spin h-8 w-8 text-aura-accent" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <p className="text-sm text-aura-textMuted font-mono">Analyzing credentials...</p>
            </div>
          ) : error ? (
            <div className="p-4 rounded border border-aura-critical/30 bg-aura-critical/10 text-aura-critical text-sm font-mono">
              {error}
            </div>
          ) : data ? (
            <>
              {/* Account Header Card */}
              <div className="flex items-center gap-4 p-4 rounded-lg bg-aura-panelLight border border-aura-border">
                <div className="flex-1 space-y-2">
                  <h3 className="text-base font-bold text-white truncate">{data.name}</h3>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] px-2 py-0.5 rounded bg-aura-border font-mono text-aura-textLight uppercase">
                      {data.account_type}
                    </span>
                    <RiskBadge score={data.risk_score} showScore={false} />
                  </div>
                  <div className="pt-2">
                    <Link 
                      to={`/account/${data.account_id}`}
                      className="text-xs text-aura-accent hover:underline flex items-center gap-1 font-semibold"
                    >
                      Open Full Dossier
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </Link>
                  </div>
                </div>
                <RiskGauge score={data.risk_score} size={80} />
              </div>

              {/* Stats Tiles */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded bg-aura-panelLight/40 border border-aura-border/50">
                  <span className="text-[10px] text-aura-textMuted font-mono block">TOTAL INFLOW</span>
                  <span className="font-mono text-sm font-bold text-aura-low">₹{data.total_in.toLocaleString()}</span>
                </div>
                <div className="p-3 rounded bg-aura-panelLight/40 border border-aura-border/50">
                  <span className="text-[10px] text-aura-textMuted font-mono block">TOTAL OUTFLOW</span>
                  <span className="font-mono text-sm font-bold text-aura-high">₹{data.total_out.toLocaleString()}</span>
                </div>
                <div className="p-3 rounded bg-aura-panelLight/40 border border-aura-border/50">
                  <span className="text-[10px] text-aura-textMuted font-mono block">TRANSACTIONS</span>
                  <span className="font-mono text-sm font-bold text-white">{data.txn_count} txs</span>
                </div>
                <div className="p-3 rounded bg-aura-panelLight/40 border border-aura-border/50">
                  <span className="text-[10px] text-aura-textMuted font-mono block">FAN IN / OUT</span>
                  <span className="font-mono text-sm font-bold text-white">{data.fan_in} / {data.fan_out}</span>
                </div>
              </div>

              {/* Explainability factors */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-aura-textMuted">Why flagged?</h4>
                <div className="space-y-3 bg-aura-panelLight/30 border border-aura-border/40 p-4 rounded-lg">
                  {data.explanation && data.explanation.map((item, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-white">{item.factor}</span>
                        <span className="font-mono text-aura-accent">+{item.contribution}%</span>
                      </div>
                      <p className="text-[11px] text-aura-textMuted leading-relaxed">{item.detail}</p>
                      <div className="h-1.5 w-full bg-aura-border rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-aura-indigo rounded-full transition-all duration-1000"
                          style={{ width: `${item.contribution}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top counterparties */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-aura-textMuted">Top Counterparties</h4>
                <div className="divide-y divide-aura-border bg-aura-panelLight/30 border border-aura-border/40 rounded-lg overflow-hidden">
                  {data.top_counterparties && data.top_counterparties.map((cp, idx) => (
                    <div key={idx} className="p-3 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-semibold text-white block">{cp.name}</span>
                        <span className="font-mono text-[10px] text-aura-textMuted">{cp.account_id}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-bold block text-white">
                          ₹{cp.amount.toLocaleString()}
                        </span>
                        <span className={`inline-flex items-center text-[10px] uppercase font-bold gap-0.5 ${cp.direction === 'in' ? 'text-aura-low' : 'text-aura-high'}`}>
                          {cp.direction === 'in' ? '← Received' : 'Sent →'}
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
