import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { api } from '../api';
import RiskBadge from '../components/RiskBadge';
import RiskGauge from '../components/RiskGauge';

export default function AccountDetail() {
  const { accountId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!accountId) return;

    const loadDossier = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await api.getAccountDetail(accountId);
        setData(res);
      } catch (err) {
        console.error(err);
        setError('Failed to download account dossier.');
      } finally {
        setLoading(false);
      }
    };

    loadDossier();
  }, [accountId]);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[70vh]">
        <svg className="animate-spin h-5 w-5 text-aura-accent" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <span className="text-xs font-mono text-aura-textMuted mt-3">DOWNLOADING DOSSIER DATA...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex-1 p-6 max-w-3xl mx-auto w-full">
        <div className="p-3 border border-aura-critical/30 bg-aura-critical/10 text-aura-critical text-xs font-mono text-center">
          &gt; EXCEPTION: {error || 'Dossier reference is invalid.'}
        </div>
      </div>
    );
  }

  const chartData = data.timeline.map((tx, idx) => ({
    name: new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    inflow: tx.direction === 'in' ? tx.amount : 0,
    outflow: tx.direction === 'out' ? tx.amount : 0,
    amount: tx.amount,
    timestamp: new Date(tx.timestamp).toLocaleString(),
    counterparty: tx.counterparty_id
  }));

  return (
    <div className="flex-1 p-6 space-y-6 max-w-7xl mx-auto w-full text-aura-textLight font-mono select-none">
      
      {/* HUD Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-aura-border pb-4">
        <div className="space-y-1">
          <span className="text-[9px] text-aura-accent tracking-widest block font-bold uppercase">[CLASSIFIED_INTEL_DOSSIER]</span>
          <h1 className="text-xl font-bold text-white tracking-widest uppercase">{data.name}</h1>
          <p className="text-xs text-aura-textMuted">TARGET_REF: <span className="select-all text-white font-bold">{data.account_id}</span></p>
        </div>
        <div>
          <button
            onClick={() => navigate(`/graph?accountId=${data.account_id}`)}
            className="px-4 py-2 bg-aura-accent/10 border border-aura-accent/40 text-xs font-bold text-aura-accent hover:bg-aura-accent/20 active:scale-95 transition-all flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            TRACE_MONEY_trail
          </button>
        </div>
      </div>

      {/* Main grids */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Col: Target Core details */}
        <div className="space-y-6 lg:col-span-1">
          {/* Main Card */}
          <div className="p-6 hud-panel flex flex-col items-center text-center space-y-4 shadow-xl">
            <span className="hud-corner-tl">[TARGET_PROFILE]</span>
            <RiskGauge score={data.risk_score} size={120} />
            <div className="space-y-2 mt-2">
              <h2 className="text-base font-bold text-white uppercase">{data.name}</h2>
              <div className="flex items-center justify-center gap-1.5">
                <span className="text-[8px] border border-aura-border px-1.5 py-0.2 text-aura-textLight uppercase select-none">
                  {data.account_type}
                </span>
                <RiskBadge score={data.risk_score} showScore={false} />
              </div>
            </div>
            {/* Flags badges */}
            {data.flags && data.flags.length > 0 && (
              <div className="flex flex-wrap justify-center gap-1.5 pt-1">
                {data.flags.map(f => (
                  <span key={f} className="text-[8px] px-1.5 py-0.2 border border-aura-high/40 bg-aura-high/5 text-aura-high uppercase font-bold">
                    {f.replace('_', ' ')}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Stats details */}
          <div className="p-5 hud-panel space-y-4 shadow-xl">
            <span className="hud-corner-tl">[TELEMETRY_LOGS]</span>
            <h3 className="text-[9px] font-bold uppercase tracking-wider text-aura-textMuted mt-1">Operational Metrics</h3>
            <div className="grid grid-cols-2 gap-3 text-[10px]">
              <div className="p-3 bg-black/10 border border-aura-border/40">
                <span className="text-[8px] text-aura-textMuted block">DEPOSITED</span>
                <span className="text-xs font-bold text-emerald-400 mt-0.5 block">₹{data.total_in.toLocaleString()}</span>
              </div>
              <div className="p-3 bg-black/10 border border-aura-border/40">
                <span className="text-[8px] text-aura-textMuted block">TRANSFERRED</span>
                <span className="text-xs font-bold text-orange-400 mt-0.5 block">₹{data.total_out.toLocaleString()}</span>
              </div>
              <div className="p-3 bg-black/10 border border-aura-border/40">
                <span className="text-[8px] text-aura-textMuted block">FAN-IN (DEPS)</span>
                <span className="text-xs font-bold text-white mt-0.5 block">{data.fan_in} nodes</span>
              </div>
              <div className="p-3 bg-black/10 border border-aura-border/40">
                <span className="text-[8px] text-aura-textMuted block">FAN-OUT (RECS)</span>
                <span className="text-xs font-bold text-white mt-0.5 block">{data.fan_out} nodes</span>
              </div>
            </div>
            <div className="p-3 bg-black/10 border border-aura-border/40 text-center text-[10px]">
              <span className="text-[8px] text-aura-textMuted block">TOTAL TRANSACTION COUNT</span>
              <span className="text-sm font-bold text-white mt-0.5 block">{data.txn_count} completed transfers</span>
            </div>
          </div>
        </div>

        {/* Right Col: Explainability & Timelines */}
        <div className="lg:col-span-2 space-y-6">
          {/* Explanation panel */}
          <div className="p-6 hud-panel space-y-4 shadow-xl">
            <span className="hud-corner-tl">[THREAT_ATTRIBUTION]</span>
            <h3 className="text-[9px] font-bold uppercase tracking-wider text-aura-textMuted mt-1">Attribution Factors</h3>
            <div className="space-y-4">
              {data.explanation.map((item, idx) => (
                <div key={idx} className="space-y-1.5 border-b border-aura-border/40 pb-3 last:border-b-0 last:pb-0">
                  <div className="flex justify-between text-[11px]">
                    <span className="font-bold text-white">{item.factor}</span>
                    <span className="text-aura-accent font-bold">+{item.contribution}%</span>
                  </div>
                  <p className="text-[10px] text-aura-textMuted leading-relaxed">{item.detail}</p>
                  <div className="h-1.5 w-full bg-aura-border rounded-none overflow-hidden">
                    <div 
                      className="h-full bg-aura-accent rounded-none transition-all duration-1000"
                      style={{ width: `${item.contribution}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Timeline chart */}
          <div className="p-6 hud-panel space-y-4 shadow-xl">
            <span className="hud-corner-tl">[LEDGER_TEMPORAL_FLOW]</span>
            <h3 className="text-[9px] font-bold uppercase tracking-wider text-aura-textMuted mt-1">Transaction Timeline (In vs Out over Time)</h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorInflow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0F9960" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#0F9960" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorOutflow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#FF3B30" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#FF3B30" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="2 4" stroke="#1F2836" />
                  <XAxis dataKey="name" stroke="#6B7B91" tick={{ fontSize: 9, fontFamily: 'monospace' }} />
                  <YAxis stroke="#6B7B91" tick={{ fontSize: 9, fontFamily: 'monospace' }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#10141D', borderColor: '#1F2836', color: '#B9C6D6', fontFamily: 'monospace' }}
                    labelStyle={{ fontWeight: 'bold' }}
                    itemStyle={{ fontSize: 10 }}
                  />
                  <Area type="monotone" dataKey="inflow" name="Inflow" stroke="#0F9960" strokeWidth={1.5} fillOpacity={1} fill="url(#colorInflow)" />
                  <Area type="monotone" dataKey="outflow" name="Outflow" stroke="#FF3B30" strokeWidth={1.5} fillOpacity={1} fill="url(#colorOutflow)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Counterparties list */}
          <div className="p-6 hud-panel space-y-4 shadow-xl">
            <span className="hud-corner-tl">[COUNTERPARTY_DIRECTORY]</span>
            <h3 className="text-[9px] font-bold uppercase tracking-wider text-aura-textMuted mt-1">Known Counterparties</h3>
            <div className="divide-y divide-aura-border/60">
              {data.top_counterparties.map((cp, idx) => (
                <div key={idx} className="py-3 flex items-center justify-between first:pt-0 last:pb-0">
                  <div className="space-y-1">
                    <span className="font-bold text-white text-xs block uppercase">{cp.name}</span>
                    <span 
                      onClick={() => navigate(`/account/${cp.account_id}`)}
                      className="text-[10px] text-aura-accent hover:underline cursor-pointer"
                    >
                      {cp.account_id}
                    </span>
                  </div>
                  <div className="text-right space-y-1">
                    <span className="text-xs font-bold text-white block">₹{cp.amount.toLocaleString()}</span>
                    <span className={`text-[8px] font-bold px-1.5 py-0.2 border ${
                      cp.direction === 'in' ? 'bg-emerald-950/20 border-emerald-500/20 text-emerald-400' : 'bg-orange-950/20 border-orange-500/20 text-orange-400'
                    }`}>
                      {cp.direction === 'in' ? 'INBOUND' : 'OUTBOUND'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
