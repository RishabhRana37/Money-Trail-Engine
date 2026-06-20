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
        <svg className="animate-spin h-8 w-8 text-aura-accent" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <span className="text-sm font-mono text-aura-textMuted mt-3">Accessing secure vault...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex-1 p-6 max-w-3xl mx-auto w-full">
        <div className="p-4 rounded border border-aura-critical/30 bg-aura-critical/10 text-aura-critical text-sm font-mono text-center">
          {error || 'No dossier selected. Return to Dashboard.'}
        </div>
      </div>
    );
  }

  // Format chart timeline data
  const chartData = data.timeline.map((tx, idx) => ({
    name: new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    inflow: tx.direction === 'in' ? tx.amount : 0,
    outflow: tx.direction === 'out' ? tx.amount : 0,
    amount: tx.amount,
    timestamp: new Date(tx.timestamp).toLocaleString(),
    counterparty: tx.counterparty_id
  }));

  return (
    <div className="flex-1 p-6 space-y-6 max-w-7xl mx-auto w-full text-aura-textLight">
      {/* Header breadcrumb & view-in-graph action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-aura-border pb-5">
        <div className="space-y-1">
          <span className="text-[10px] text-aura-accent font-mono tracking-widest block uppercase">CRIMINAL_INTELLIGENCE_DOSSIER</span>
          <h1 className="text-3xl font-bold text-white tracking-tight">{data.name}</h1>
          <p className="font-mono text-sm text-aura-textMuted">ID: <span className="select-all text-aura-textLight">{data.account_id}</span></p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/graph?accountId=${data.account_id}`)}
            className="px-4 py-2 bg-aura-accent/15 border border-aura-accent/30 text-sm font-semibold rounded text-aura-accent hover:bg-aura-accent/25 active:scale-95 transition-all flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            Trace on Money Graph
          </button>
        </div>
      </div>

      {/* Main Grid: Overview & Explanation */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Col: Dossier Core Card & Stats */}
        <div className="space-y-6 lg:col-span-1">
          {/* Card */}
          <div className="p-6 rounded-lg bg-aura-panel border border-aura-border flex flex-col items-center text-center space-y-4 shadow-xl">
            <RiskGauge score={data.risk_score} size={130} />
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-white">{data.name}</h2>
              <div className="flex items-center justify-center gap-2">
                <span className="text-[10px] px-2 py-0.5 rounded bg-aura-border font-mono text-aura-textLight uppercase select-none">
                  {data.account_type}
                </span>
                <RiskBadge score={data.risk_score} showScore={false} />
              </div>
            </div>
            {/* Flags badges */}
            {data.flags && data.flags.length > 0 && (
              <div className="flex flex-wrap justify-center gap-1.5 pt-2">
                {data.flags.map(f => (
                  <span key={f} className="text-[9px] font-mono px-2 py-0.5 rounded bg-aura-high/10 border border-aura-high/20 text-aura-high uppercase">
                    {f.replace('_', ' ')}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Stats details */}
          <div className="p-5 rounded-lg bg-aura-panel border border-aura-border space-y-4 shadow-xl">
            <h3 className="text-xs font-bold uppercase tracking-wider text-aura-textMuted">Operational Metrics</h3>
            <div className="grid grid-cols-2 gap-4 text-xs font-mono">
              <div className="p-3 bg-aura-panelLight rounded border border-aura-border/40">
                <span className="text-[10px] text-aura-textMuted block">TOTAL DEPOSITED</span>
                <span className="text-sm font-bold text-aura-low mt-0.5 block">₹{data.total_in.toLocaleString()}</span>
              </div>
              <div className="p-3 bg-aura-panelLight rounded border border-aura-border/40">
                <span className="text-[10px] text-aura-textMuted block">TOTAL TRANSFERRED</span>
                <span className="text-sm font-bold text-aura-high mt-0.5 block">₹{data.total_out.toLocaleString()}</span>
              </div>
              <div className="p-3 bg-aura-panelLight rounded border border-aura-border/40">
                <span className="text-[10px] text-aura-textMuted block">FAN-IN (DEPOSITORS)</span>
                <span className="text-sm font-bold text-white mt-0.5 block">{data.fan_in} nodes</span>
              </div>
              <div className="p-3 bg-aura-panelLight rounded border border-aura-border/40">
                <span className="text-[10px] text-aura-textMuted block">FAN-OUT (RECIPIENTS)</span>
                <span className="text-sm font-bold text-white mt-0.5 block">{data.fan_out} nodes</span>
              </div>
            </div>
            <div className="p-3 bg-aura-panelLight rounded border border-aura-border/40 text-center">
              <span className="text-[10px] text-aura-textMuted font-mono block">TOTAL TRANSACTION COUNT</span>
              <span className="text-base font-bold text-white font-mono mt-0.5 block">{data.txn_count} completed transfers</span>
            </div>
          </div>
        </div>

        {/* Right Col: Explainability & Timelines */}
        <div className="lg:col-span-2 space-y-6">
          {/* Explanation panel */}
          <div className="p-6 rounded-lg bg-aura-panel border border-aura-border space-y-4 shadow-xl">
            <h3 className="text-xs font-bold uppercase tracking-wider text-aura-textMuted">Threat Vector Attribution (Why flagged?)</h3>
            <div className="space-y-4">
              {data.explanation.map((item, idx) => (
                <div key={idx} className="space-y-1.5 border-b border-aura-border/50 pb-3 last:border-b-0 last:pb-0">
                  <div className="flex justify-between text-sm">
                    <span className="font-bold text-white">{item.factor}</span>
                    <span className="font-mono text-aura-accent font-semibold">+{item.contribution}% contribution</span>
                  </div>
                  <p className="text-xs text-aura-textMuted leading-relaxed">{item.detail}</p>
                  <div className="h-2 w-full bg-aura-border rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-aura-indigo to-aura-accent rounded-full transition-all duration-1000"
                      style={{ width: `${item.contribution}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Timeline chart */}
          <div className="p-6 rounded-lg bg-aura-panel border border-aura-border space-y-4 shadow-xl">
            <h3 className="text-xs font-bold uppercase tracking-wider text-aura-textMuted">Transaction Timeline (In vs Out over Time)</h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorInflow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3FB950" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#3FB950" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorOutflow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F85149" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#F85149" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#21262D" />
                  <XAxis dataKey="name" stroke="#8B949E" tick={{ fontSize: 10, fontFamily: 'monospace' }} />
                  <YAxis stroke="#8B949E" tick={{ fontSize: 10, fontFamily: 'monospace' }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#161B22', borderColor: '#30363D', color: '#C9D1D9' }}
                    labelStyle={{ fontFamily: 'monospace', fontWeight: 'bold' }}
                    itemStyle={{ fontSize: 12 }}
                  />
                  <Area type="monotone" dataKey="inflow" name="Inflow" stroke="#3FB950" fillOpacity={1} fill="url(#colorInflow)" />
                  <Area type="monotone" dataKey="outflow" name="Outflow" stroke="#F85149" fillOpacity={1} fill="url(#colorOutflow)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Counterparties list */}
          <div className="p-6 rounded-lg bg-aura-panel border border-aura-border space-y-4 shadow-xl">
            <h3 className="text-xs font-bold uppercase tracking-wider text-aura-textMuted">Key Transaction Counterparties</h3>
            <div className="divide-y divide-aura-border">
              {data.top_counterparties.map((cp, idx) => (
                <div key={idx} className="py-3 flex items-center justify-between first:pt-0 last:pb-0">
                  <div className="space-y-1">
                    <span className="font-bold text-white text-sm">{cp.name}</span>
                    <span 
                      onClick={() => navigate(`/account/${cp.account_id}`)}
                      className="font-mono text-xs text-aura-accent hover:underline cursor-pointer"
                    >
                      {cp.account_id}
                    </span>
                  </div>
                  <div className="text-right space-y-1">
                    <span className="font-mono text-sm font-bold text-white block">₹{cp.amount.toLocaleString()}</span>
                    <span className={`inline-flex items-center text-[10px] uppercase font-bold gap-0.5 rounded px-2 py-0.5 ${
                      cp.direction === 'in' ? 'bg-aura-low/10 text-aura-low border border-aura-low/20' : 'bg-aura-high/10 text-aura-high border border-aura-high/20'
                    }`}>
                      {cp.direction === 'in' ? '← Received Funds' : 'Sent Funds →'}
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
