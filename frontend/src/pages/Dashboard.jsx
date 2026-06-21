import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import RiskBadge from '../components/RiskBadge';
import { fakeAccountsList } from '../fixtures';

/* ── SIMULATED LIVE SATELLITE RADAR ─────────────────────────────────────── */
const RADAR_TARGETS = [
  { id: 1, cx: 38, cy: 28, color: '#E24B4A', delay: '0s',   label: 'TGT-A01' },
  { id: 2, cx: 68, cy: 55, color: '#00E5FF', delay: '1.0s', label: 'TGT-B03' },
  { id: 3, cx: 28, cy: 65, color: '#3FB950', delay: '2.2s', label: 'TGT-C07' },
  { id: 4, cx: 72, cy: 30, color: '#F0883E', delay: '3.1s', label: 'TGT-D12' },
];

function RadarWidget() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 4000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="hud-panel bg-black/60 p-4 flex flex-col gap-3 h-full" style={{ minHeight: '240px' }}>
      <div className="flex items-center justify-between">
        <span className="log-label text-[10px] font-mono font-bold uppercase tracking-widest text-aura-textMuted">// ORBITAL_SCAN</span>
        <span className="text-[8px] font-mono text-aura-accent animate-pulse">● LIVE</span>
      </div>

      {/* Radar circle */}
      <div className="flex-1 flex items-center justify-center">
        <div className="relative w-44 h-44 radar-sweep-effect rounded-full border border-aura-accent/25 bg-black/70 overflow-hidden flex items-center justify-center">
          {/* SVG rings + cross-hairs */}
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100">
            <defs>
              <radialGradient id="radarBg" cx="50%" cy="50%" r="50%">
                <stop offset="0%"  stopColor="#00E5FF" stopOpacity="0.03" />
                <stop offset="100%" stopColor="#000"   stopOpacity="0" />
              </radialGradient>
            </defs>
            <circle cx="50" cy="50" r="49" fill="url(#radarBg)" />
            <circle cx="50" cy="50" r="36" fill="none" stroke="#00E5FF" strokeOpacity="0.12" strokeWidth="0.5" />
            <circle cx="50" cy="50" r="22" fill="none" stroke="#00E5FF" strokeOpacity="0.08" strokeWidth="0.5" />
            <circle cx="50" cy="50" r="9"  fill="none" stroke="#00E5FF" strokeOpacity="0.12" strokeWidth="0.5" />
            {/* Cross-hair lines */}
            <line x1="50" y1="1" x2="50" y2="99" stroke="#00E5FF" strokeOpacity="0.08" strokeWidth="0.4" />
            <line x1="1" y1="50" x2="99" y2="50" stroke="#00E5FF" strokeOpacity="0.08" strokeWidth="0.4" />
            {/* Target dots */}
            {RADAR_TARGETS.map(t => (
              <g key={t.id}>
                <rect
                  x={t.cx - 1.8} y={t.cy - 1.8}
                  width="3.6" height="3.6"
                  fill={t.color}
                  className="radar-dot"
                  style={{ '--dot-delay': t.delay, color: t.color }}
                />
                <text x={t.cx + 3} y={t.cy + 1} fontSize="4" fill={t.color} opacity="0.55" fontFamily="monospace">{t.label}</text>
              </g>
            ))}
            {/* Center pip */}
            <rect x="48.5" y="48.5" width="3" height="3" fill="#00E5FF" opacity="0.9" />
          </svg>
        </div>
      </div>

      {/* Status readout */}
      <div className="grid grid-cols-2 gap-x-4 text-[8px] font-mono text-aura-textMuted border-t border-aura-border/40 pt-2">
        <span>SWEEP: <span className="text-aura-accent">4.00s/REV</span></span>
        <span>TARGETS: <span className="text-[#E24B4A]">4 LOCKED</span></span>
        <span>MODE: <span className="text-white">ACTIVE_SAR</span></span>
        <span>RANGE: <span className="text-white">450NM</span></span>
      </div>
    </div>
  );
}

/* ── LOG DECRYPTION MATRIX TERMINAL ─────────────────────────────────────── */
const HEX_CHARS = '0123456789ABCDEF';
function rndHex(n) {
  let s = '';
  for (let i = 0; i < n; i++) s += HEX_CHARS[Math.floor(Math.random() * 16)];
  return s;
}
const LOG_TEMPLATES = [
  () => `0x${rndHex(4)}${rndHex(4)}... DECRYPT_OK`,
  () => `DECRYPTING NODE VECTOR_${rndHex(2)}...`,
  () => `HASH_VERIFY: ${rndHex(8)} [PASS]`,
  () => `PKT_INTERCEPT → ${rndHex(3)}.${rndHex(3)}.${rndHex(3)}.${rndHex(3)}`,
  () => `AUTH_TOKEN 0x${rndHex(6)} ACCEPTED`,
  () => `ROUTE_TRACE [${rndHex(4)}] SUCCESS`,
  () => `KEY_EXCHANGE: ${rndHex(4)}-${rndHex(4)} OK`,
  () => `ANOMALY FLAG: acct_${rndHex(4)} SCORE=${Math.floor(Math.random()*55+45)}`,
  () => `LAYER_STRIP: txn_${rndHex(6)} → CLEAR`,
  () => `CIPHER_BLOCK ${rndHex(8)} RESOLVED`,
];

function LogTerminal() {
  const [lines, setLines] = useState(() =>
    Array.from({ length: 28 }, () => LOG_TEMPLATES[Math.floor(Math.random() * LOG_TEMPLATES.length)]())
  );
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (hovered) return;  // pause generation on hover
    const id = setInterval(() => {
      const newLine = LOG_TEMPLATES[Math.floor(Math.random() * LOG_TEMPLATES.length)]();
      setLines(prev => [newLine, ...prev.slice(0, 55)]);
    }, 150);
    return () => clearInterval(id);
  }, [hovered]);

  // duplicate list for seamless scroll loop
  const displayLines = [...lines, ...lines];

  return (
    <div
      className="log-terminal hud-panel bg-black/70 p-4 flex flex-col gap-2 overflow-hidden h-full"
      style={{ minHeight: '240px', borderColor: 'rgba(0,229,255,0.22)' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <span className="log-label text-[10px] font-mono font-bold uppercase tracking-widest text-aura-textMuted transition-all duration-200">// DECRYPT_MATRIX</span>
        <div className="flex items-center gap-2">
          {hovered && <span className="text-[8px] font-mono text-emerald-400 animate-pulse">● PAUSED</span>}
          {!hovered && <span className="text-[8px] font-mono text-aura-accent animate-pulse">● LIVE_STREAM</span>}
        </div>
      </div>

      {/* Scrolling log window */}
      <div className="flex-1 overflow-hidden relative" style={{ maskImage: 'linear-gradient(to bottom, transparent 0%, black 8%, black 90%, transparent 100%)' }}>
        <div className={`log-scroll-inner${hovered ? ' paused' : ''} font-mono text-[9px] leading-5 space-y-0.5`}>
          {displayLines.map((line, i) => {
            const isSuccess = line.includes('OK') || line.includes('PASS') || line.includes('ACCEPTED') || line.includes('SUCCESS') || line.includes('CLEAR') || line.includes('RESOLVED');
            const isWarn    = line.includes('ANOMALY') || line.includes('INTERCEPT');
            const color     = isWarn ? 'text-[#F0883E]' : isSuccess ? 'text-emerald-400' : 'text-aura-accent/75';
            return (
              <div key={i} className={`flex gap-2 ${color}`}>
                <span className="text-aura-textMuted flex-shrink-0 opacity-40">{String(i % lines.length).padStart(3,'0')}</span>
                <span className="truncate">{line}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard({ datasetId, onDatasetGenerated }) {

  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [analyzingState, setAnalyzingState] = useState(''); // 'generating', 'analyzing', ''
  const [toastMessage, setToastMessage] = useState('');

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        setToastMessage('');
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);
  
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
      
      const alertCount = anaRes.alerts_generated || 11;
      const txnCount = genRes.num_transactions || 2500;
      setToastMessage(`Analysis complete — ${alertCount} alerts found across ${txnCount.toLocaleString()} transactions.`);
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

/* ── Severity Pill Component ────────────────────────────────────────────── */
function SeverityPill({ score }) {
  let style = "bg-slate-800 text-slate-300 border-slate-700/50";
  if (score >= 90) style = "bg-[#FCEBEB] text-[#A32D2D] border-[#E24B4A]/20";
  else if (score >= 70) style = "bg-[#FAEEDA] text-[#854F0B] border-[#F0883E]/20";
  else if (score >= 40) style = "bg-[#FAEEDA] text-[#634000] border-[#D29922]/20";
  else style = "bg-[#EAF3DE] text-[#3B6D11] border-[#3FB950]/20";
  
  return (
    <span className={`inline-flex items-center justify-center font-mono text-[10px] font-bold px-2.5 py-0.5 border rounded-full ${style}`}>
      {score}
    </span>
  );
}

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

function AnimatedCounter({ value, duration = 800, formatter = (val) => val }) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    let start = 0;
    const end = value;
    if (start === end) return;

    let startTimestamp = null;
    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      setCurrent(Math.floor(progress * (end - start) + start));
      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };
    window.requestAnimationFrame(step);
  }, [value, duration]);

  return <>{formatter(current)}</>;
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
          Load demo dataset
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono">
            
             <div className="p-4 hud-panel bg-aura-panel/80 shadow-lg">
              <span className="hud-corner-tl">[KPI_01]</span>
              <span className="text-[11px] text-aura-textMuted block">Total accounts</span>
              <span className="text-2xl font-medium text-white block mt-1.5">
                <AnimatedCounter value={stats.total_accounts} formatter={val => val} />
              </span>
            </div>
            
            <div className="p-4 hud-panel bg-aura-panel/80 shadow-lg">
              <span className="hud-corner-tl">[KPI_02]</span>
              <span className="text-[11px] text-aura-textMuted block">Transactions</span>
              <span className="text-2xl font-medium text-white block mt-1.5">
                <AnimatedCounter value={stats.total_transactions} formatter={val => val.toLocaleString('en-IN')} />
              </span>
            </div>

            <div className="p-4 hud-panel border-[#E24B4A]/30 bg-[#E24B4A]/5 shadow-lg">
              <span className="hud-corner-tl" style={{ color: '#E24B4A' }}>[KPI_03]</span>
              <span className="text-[11px] text-aura-textMuted block">Amount flagged</span>
              <span className="text-2xl font-medium text-[#E24B4A] block mt-1.5">
                <AnimatedCounter value={stats.amount_flagged} formatter={formatIndianCurrency} />
              </span>
            </div>

            <div className="p-4 hud-panel border-[#E24B4A]/30 bg-[#E24B4A]/5 shadow-lg">
              <span className="hud-corner-tl" style={{ color: '#E24B4A' }}>[KPI_04]</span>
              <span className="text-[11px] text-aura-textMuted block font-medium">High-risk accounts</span>
              <span className="text-2xl font-medium text-[#E24B4A] block mt-1.5">
                <AnimatedCounter value={stats.high_risk_accounts || 18} formatter={val => val} />
              </span>
            </div>
          </div>

          {/* Patterns telemetry counters */}
          <div className="space-y-2">
            <h3 className="text-[11px] font-mono font-medium uppercase tracking-wider text-aura-textMuted">Triage Threat Profiles</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { key: 'circular', label: 'Circular' },
                { key: 'layering', label: 'Layering' },
                { key: 'smurfing', label: 'Smurfing' },
                { key: 'rapid_movement', label: 'Rapid movement' },
                { key: 'fan_in', label: 'Fan-in' },
                { key: 'fan_out', label: 'Fan-out' }
              ].map(({ key, label }) => {
                const value = stats.alerts_by_type[key] || 0;
                return (
                  <div 
                    key={key} 
                    onClick={() => navigate(`/alerts?type=${key}`)}
                    className={`p-3 border text-center cursor-pointer transition-all duration-200 relative ${
                      value > 0 
                        ? 'bg-aura-panelLight/40 border-[#E24B4A]/40 hover:border-[#E24B4A] text-[#E24B4A]' 
                        : 'bg-black/20 border-aura-border/40 text-slate-500 opacity-50 hover:opacity-100'
                    }`}
                  >
                    <span className="text-[11px] font-medium block uppercase tracking-wider">
                      {label}
                    </span>
                    <span className={`font-mono text-xl font-medium block mt-1.5 ${value > 0 ? 'text-[#E24B4A]' : 'text-slate-500'}`}>
                      {value}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Threat List Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Top Risk Targets */}
            <div className="lg:col-span-6 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-mono font-bold uppercase tracking-wider text-aura-textMuted">Top risk accounts</h3>
                <span className="text-[8px] text-aura-textMuted font-mono">D_RANK: HIGHEST_SCORE</span>
              </div>
              
              <div className="divide-y divide-aura-border bg-black/40 border border-aura-border rounded-none overflow-hidden">
                {stats.top_risk_accounts && stats.top_risk_accounts.map((acc) => {
                  const matchedAcct = fakeAccountsList.find(a => a.account_id === acc.account_id) || {};
                  const accountType = matchedAcct.account_type || 'individual';
                  const flags = matchedAcct.flags || [];
                  const riskColorClass = acc.risk_score >= 90 ? 'bg-[#E24B4A]' : acc.risk_score >= 70 ? 'bg-[#F0883E]' : acc.risk_score >= 40 ? 'bg-[#D29922]' : 'bg-[#3FB950]';
                  const textColorClass = acc.risk_score >= 90 ? 'text-[#E24B4A]' : acc.risk_score >= 70 ? 'text-[#F0883E]' : acc.risk_score >= 40 ? 'text-[#D29922]' : 'text-[#3FB950]';

                  return (
                    <div 
                      key={acc.account_id}
                      onClick={() => navigate(`/graph?accountId=${acc.account_id}`)}
                      className="p-3 flex items-center justify-between hover:bg-aura-panelLight/50 cursor-pointer transition-colors border-b border-aura-border last:border-b-0 gap-4"
                    >
                      {/* Name + Mono ID */}
                      <div className="flex-1 min-w-0">
                        <span className="font-sans text-[13px] font-medium text-white block truncate">{acc.name}</span>
                        <span className="font-mono text-[11px] text-aura-textMuted block">{acc.account_id}</span>
                      </div>
                      
                      {/* Account Type */}
                      <div className="flex-shrink-0">
                        <span className="text-[11px] px-1.5 py-0.5 rounded bg-black/40 border border-aura-border text-aura-textMuted">
                          {accountType}
                        </span>
                      </div>

                      {/* Pattern Badges */}
                      <div className="hidden sm:flex flex-wrap gap-1 max-w-[120px]">
                        {flags.map(f => (
                          <span key={f} className="text-[9px] px-1.5 py-0.5 border border-aura-border bg-black/40 text-aura-textMuted uppercase font-medium">
                            {f.replace('_', ' ')}
                          </span>
                        ))}
                      </div>

                      {/* Risk Bar + Score */}
                      <div className="flex items-center gap-3">
                        <div className="w-[60px] bg-black/40 border border-aura-border rounded-full h-1 overflow-hidden flex-shrink-0">
                          <div className={`h-full rounded-full ${riskColorClass}`} style={{ width: `${acc.risk_score}%` }} />
                        </div>
                        <span className={`score-text text-xs font-mono font-medium ${textColorClass} min-w-[20px] text-right`}>
                          {acc.risk_score}
                        </span>
                      </div>

                      {/* Level Badge */}
                      <div className="flex-shrink-0">
                        <RiskBadge score={acc.risk_score} showScore={false} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Active alert logs */}
            <div className="lg:col-span-6 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-mono font-bold uppercase tracking-wider text-aura-textMuted">Tactical Threat Feed</h3>
                <span className="text-[8px] text-aura-accent hover:underline cursor-pointer font-mono" onClick={() => navigate('/alerts')}>
                  OPEN_THREAT_DIRECTORY
                </span>
              </div>

              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
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
                        <SeverityPill score={alert.severity} />
                      </div>
                      <p className="text-[11px] text-aura-textLight font-mono leading-relaxed">{alert.summary}</p>
                      <div className="flex items-center justify-between gap-4 mt-3 text-[9px] font-mono text-aura-textMuted">
                        <span>CAP_EXPOSURE: {formatIndianCurrency(alert.amount_involved)}</span>
                        <span>DATE_CAPTURED: {new Date(alert.detected_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* ── BOTTOM ROW: Radar + Log Terminal ── */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Satellite Radar */}
            <div className="lg:col-span-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[10px] font-mono font-bold uppercase tracking-wider text-aura-textMuted">Orbital Scan Matrix</h3>
                <span className="text-[8px] text-aura-textMuted font-mono">SYS: SAR_ACTIVE</span>
              </div>
              <RadarWidget />
            </div>

            {/* Decryption Log Terminal */}
            <div className="lg:col-span-8">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[10px] font-mono font-bold uppercase tracking-wider text-aura-textMuted">Decrypt Matrix Terminal</h3>
                <span className="text-[8px] text-aura-textMuted font-mono">HOVER TO PAUSE</span>
              </div>
              <LogTerminal />
            </div>
          </div>
        </>

      ) : null}

      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#10141D] border border-aura-accent/50 text-white font-mono text-[11px] p-4 shadow-2xl rounded-none flex items-center gap-3 animate-toast">
          <div className="w-2 h-2 bg-aura-accent rounded-full animate-pulse" />
          <div>{toastMessage}</div>
          <button onClick={() => setToastMessage('')} className="text-aura-textMuted hover:text-white ml-2">×</button>
        </div>
      )}
    </div>
  );
}
