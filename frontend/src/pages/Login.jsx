import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

/* ─────────────────────────────────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────────────────────────────────── */
const STORAGE_KEY = 'aura_operators';
const SESSION_KEY = 'aura_auth';

/** Built-in demo account (always available, cannot be deleted) */
const DEMO_ACCOUNT = {
  id: 'demo.operator',
  password: 'demo@aura2024',
  clearance: 'ALPHA-III',
  name: 'Demo Operator',
  createdAt: '2024-01-01T00:00:00Z',
  isDemo: true,
};

/* ─────────────────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────────────────────── */
function loadOperators() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}
function saveOperators(ops) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ops));
}
function findOperator(id, password) {
  if (id === DEMO_ACCOUNT.id && password === DEMO_ACCOUNT.password) return DEMO_ACCOUNT;
  return loadOperators().find(o => o.id === id && o.password === password) || null;
}
function operatorExists(id) {
  if (id === DEMO_ACCOUNT.id) return true;
  return loadOperators().some(o => o.id === id);
}

/* ─────────────────────────────────────────────────────────────────────────
   ANIMATED CANVAS BACKGROUND
───────────────────────────────────────────────────────────────────────── */
function LoginCanvas() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId, t = 0;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);
    const particles = Array.from({ length: 55 }, () => ({
      x: Math.random() * window.innerWidth, y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 0.28, vy: (Math.random() - 0.5) * 0.28,
      r: Math.random() * 1.4 + 0.5, alpha: Math.random() * 0.35 + 0.08,
    }));
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // Dot grid
      ctx.fillStyle = 'rgba(0,229,255,0.04)';
      for (let x = 0; x < canvas.width; x += 28)
        for (let y = 0; y < canvas.height; y += 28) {
          ctx.beginPath(); ctx.arc(x, y, 0.7, 0, Math.PI * 2); ctx.fill();
        }
      // Particles
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = canvas.width; if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height; if (p.y > canvas.height) p.y = 0;
        ctx.globalAlpha = p.alpha * (0.5 + 0.5 * Math.sin(t + p.x * 0.01));
        ctx.fillStyle = '#00E5FF';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      });
      // Connection lines
      ctx.globalAlpha = 1;
      particles.forEach((p, i) => particles.slice(i + 1).forEach(q => {
        const d = Math.hypot(p.x - q.x, p.y - q.y);
        if (d < 110) {
          ctx.strokeStyle = `rgba(0,229,255,${0.055 * (1 - d / 110)})`;
          ctx.lineWidth = 0.5;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
        }
      }));
      // Sweep line
      const sy = (t * 38) % canvas.height;
      const sg = ctx.createLinearGradient(0, sy - 80, 0, sy + 80);
      sg.addColorStop(0, 'transparent'); sg.addColorStop(0.5, 'rgba(0,229,255,0.022)'); sg.addColorStop(1, 'transparent');
      ctx.fillStyle = sg; ctx.fillRect(0, sy - 80, canvas.width, 160);
      t += 0.01; animId = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
  }, []);
  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-0" />;
}

/* ─────────────────────────────────────────────────────────────────────────
   BOOT LOG
───────────────────────────────────────────────────────────────────────── */
function BootLog({ lines }) {
  return (
    <div className="font-mono text-[10px] space-y-0.5">
      {lines.map((line, i) => (
        <div key={i} className="flex gap-2 items-center text-green-400/60"
          style={{ animation: `terminal-flicker 3s ${i * 0.3}s infinite` }}>
          <span className="text-cyan-400/30">[{String(i + 1).padStart(2, '0')}]</span>
          <span>{line}</span>
          {i === lines.length - 1 && <span className="text-cyan-400 animate-pulse">▌</span>}
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   AUTH LOG STREAM
───────────────────────────────────────────────────────────────────────── */
function AuthLogStream({ lines, isProcessing }) {
  if (!lines.length && !isProcessing) return null;
  return (
    <div className="mb-5 bg-black/50 border border-green-400/20 p-3 font-mono text-[10px] space-y-0.5 max-h-28 overflow-y-auto">
      {lines.map((line, i) => (
        <div key={i} className="flex gap-2 text-green-400/70">
          <span className="text-cyan-400/30 shrink-0">{'>'}</span>
          <span>{line}</span>
        </div>
      ))}
      {isProcessing && (
        <div className="flex gap-2 text-cyan-400/50 animate-pulse">
          <span>{'>'}</span><span>PROCESSING...</span>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   DEMO CREDENTIALS CARD
───────────────────────────────────────────────────────────────────────── */
function DemoCard({ onUseDemo }) {
  const [copied, setCopied] = useState(null);
  const copy = (text, field) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(field);
    setTimeout(() => setCopied(null), 1800);
  };
  return (
    <div className="border border-cyan-400/20 bg-cyan-400/5 p-4 relative">
      {/* top label */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" style={{ boxShadow: '0 0 6px #00e5ff' }} />
        <span className="font-mono text-[10px] text-cyan-400 uppercase tracking-widest">DEMO ACCESS CREDENTIALS</span>
      </div>
      <div className="space-y-2">
        {[
          { label: 'OPERATOR ID', val: DEMO_ACCOUNT.id, field: 'id' },
          { label: 'PASSPHRASE', val: DEMO_ACCOUNT.password, field: 'pw' },
          { label: 'CLEARANCE', val: DEMO_ACCOUNT.clearance, field: 'cl' },
        ].map(row => (
          <div key={row.field} className="flex items-center justify-between gap-3">
            <span className="font-mono text-[9px] text-slate-600 uppercase w-20 shrink-0">{row.label}</span>
            <span className="font-mono text-[10px] text-slate-300 flex-1">{row.val}</span>
            <button
              onClick={() => copy(row.val, row.field)}
              className="font-mono text-[9px] text-slate-600 hover:text-cyan-400 transition-colors uppercase px-1.5 py-0.5 border border-slate-800 hover:border-cyan-400/40"
            >
              {copied === row.field ? '✓ COPIED' : 'COPY'}
            </button>
          </div>
        ))}
      </div>
      <button
        id="demo-autofill-btn"
        onClick={onUseDemo}
        className="mt-4 w-full font-mono text-[10px] uppercase tracking-widest py-2.5 border border-cyan-400/40 text-cyan-400 hover:bg-cyan-400/10 transition-all duration-200 flex items-center justify-center gap-2"
      >
        <span>⚡</span> AUTO-FILL & LOGIN AS DEMO OPERATOR
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   FIELD COMPONENT
───────────────────────────────────────────────────────────────────────── */
function Field({ id, label, type = 'text', value, onChange, placeholder, disabled, autoComplete, children }) {
  return (
    <div>
      <label className="font-mono text-[10px] uppercase tracking-widest text-slate-500 block mb-2" htmlFor={id}>
        {label}
      </label>
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs text-cyan-400/40">{'>'}</div>
        <input
          id={id}
          type={type}
          value={value}
          onChange={onChange}
          disabled={disabled}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="w-full bg-black/30 border border-slate-700 focus:border-cyan-400/60 outline-none pl-8 pr-4 py-3 font-mono text-sm text-white placeholder-slate-700 transition-colors duration-200 disabled:opacity-50"
        />
        {children}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   SUCCESS OVERLAY
───────────────────────────────────────────────────────────────────────── */
function SuccessOverlay({ clearance, name }) {
  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center gap-4">
      <div className="font-mono text-center">
        <div className="text-cyan-400 text-4xl mb-3" style={{ textShadow: '0 0 40px rgba(0,229,255,0.8)' }}>
          ◉ ACCESS GRANTED
        </div>
        <div className="text-white text-sm mb-1">WELCOME, {name?.toUpperCase()}</div>
        <div className="text-green-400 text-xs animate-pulse mb-2">LOADING AURA CONSOLE...</div>
        <div className="text-slate-600 text-[10px] uppercase tracking-widest">CLEARANCE: {clearance}</div>
      </div>
      {/* animated bars */}
      <div className="flex gap-1 mt-2">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="w-1 bg-cyan-400/60 rounded-full"
            style={{ height: `${12 + Math.random() * 20}px`, animation: `target-pulse 0.6s ${i * 0.05}s ease-in-out infinite` }} />
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   MAIN LOGIN PAGE
───────────────────────────────────────────────────────────────────────── */
export default function Login({ onLogin }) {
  const navigate = useNavigate();

  /* mode: 'signin' | 'register' */
  const [mode, setMode] = useState('signin');

  /* shared fields */
  const [operatorId, setOperatorId] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [clearance, setClearance] = useState('ALPHA-II');

  /* register-only fields */
  const [displayName, setDisplayName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  /* async state */
  const [status, setStatus] = useState('idle'); // idle|checking|success|error
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [authLog, setAuthLog] = useState([]);
  const [grantedOperator, setGrantedOperator] = useState(null);

  const isChecking = status === 'checking';

  const bootLines = [
    'SECURE BOOT SEQUENCE — INITIATED',
    'HARDWARE ATTESTATION: PASS',
    'ENCRYPTION LAYER: AES-256-GCM · ACTIVE',
    'IDENTITY SERVICE: ONLINE',
    'AWAITING OPERATOR CREDENTIALS...',
  ];

  /* reset state when switching modes */
  const switchMode = (m) => {
    setMode(m);
    setStatus('idle');
    setErrorMsg('');
    setSuccessMsg('');
    setAuthLog([]);
    setPassword('');
    setConfirmPassword('');
  };

  /* auto-fill demo credentials */
  const fillDemo = () => {
    setOperatorId(DEMO_ACCOUNT.id);
    setPassword(DEMO_ACCOUNT.password);
    setClearance(DEMO_ACCOUNT.clearance);
    setMode('signin');
    setErrorMsg('');
    setAuthLog([]);
  };

  /* stream auth log lines */
  const streamLogs = async (lines) => {
    for (const line of lines) {
      await new Promise(r => setTimeout(r, 340));
      setAuthLog(prev => [...prev, line]);
    }
  };

  /* ── SIGN IN ── */
  const handleSignIn = async (e) => {
    e.preventDefault();
    if (!operatorId.trim() || !password) {
      setErrorMsg('CREDENTIAL_ERROR: All fields are required'); setStatus('error'); return;
    }
    setStatus('checking'); setErrorMsg(''); setAuthLog([]);

    await streamLogs([
      `AUTH_REQUEST: ${operatorId.toUpperCase()} · ${new Date().toISOString()}`,
      'HANDSHAKE_INIT: Establishing secure channel...',
      'CERT_VERIFY: Validating operator certificate...',
    ]);

    const op = findOperator(operatorId.trim(), password);

    if (!op) {
      await new Promise(r => setTimeout(r, 300));
      setAuthLog(prev => [...prev, 'AUTH_FAIL: Invalid credentials — access denied']);
      setErrorMsg('CREDENTIAL_ERROR: Invalid operator ID or passphrase');
      setStatus('error'); return;
    }

    await streamLogs([
      'RBAC_CHECK: Loading permission matrix...',
      `SESSION_GRANT: ${op.name.toUpperCase()} · Clearance ${op.clearance} · TTL 8h`,
    ]);

    await new Promise(r => setTimeout(r, 400));
    setGrantedOperator(op);
    setStatus('success');
    await new Promise(r => setTimeout(r, 1400));
    if (onLogin) onLogin({ name: op.name, clearance: op.clearance, id: op.id });
    navigate('/');
  };

  /* ── REGISTER ── */
  const handleRegister = async (e) => {
    e.preventDefault();
    setErrorMsg(''); setSuccessMsg('');

    const idClean = operatorId.trim().toLowerCase().replace(/\s+/g, '.');
    if (!idClean || !displayName.trim() || !password || !confirmPassword) {
      setErrorMsg('REGISTRATION_ERROR: All fields are required'); setStatus('error'); return;
    }
    if (password.length < 8) {
      setErrorMsg('SECURITY_POLICY: Passphrase must be ≥ 8 characters'); setStatus('error'); return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('CREDENTIAL_ERROR: Passphrases do not match'); setStatus('error'); return;
    }
    if (operatorExists(idClean)) {
      setErrorMsg(`CONFLICT_ERROR: Operator ID "${idClean}" is already registered`); setStatus('error'); return;
    }

    setStatus('checking'); setAuthLog([]);

    await streamLogs([
      `ENROLL_REQUEST: ${idClean.toUpperCase()} · ${new Date().toISOString()}`,
      'VALIDATING: Checking ID namespace...',
      `ID_CLEAR: "${idClean}" is available`,
      `CLEARANCE_ASSIGN: ${clearance}`,
      'ENCRYPTING: Hashing credentials...',
      'PROFILE_WRITE: Writing operator record...',
    ]);

    const newOp = {
      id: idClean,
      password,
      clearance,
      name: displayName.trim(),
      createdAt: new Date().toISOString(),
    };
    const ops = loadOperators();
    ops.push(newOp);
    saveOperators(ops);

    await new Promise(r => setTimeout(r, 300));
    setAuthLog(prev => [...prev, `ENROLL_SUCCESS: Profile created for ${displayName.trim().toUpperCase()}`]);
    await new Promise(r => setTimeout(r, 600));
    setStatus('idle');
    setSuccessMsg(`PROFILE CREATED · Operator "${idClean}" enrolled at ${clearance}`);
    setPassword(''); setConfirmPassword('');
    // Auto-switch to sign in after short delay
    setTimeout(() => { switchMode('signin'); setOperatorId(idClean); }, 1800);
  };

  /* ─────────────────────────────────────────────────────────────────────── */
  return (
    <div className="relative min-h-screen bg-aura-bg flex items-center justify-center overflow-hidden py-8">
      <LoginCanvas />

      {/* Success overlay */}
      {status === 'success' && grantedOperator && (
        <SuccessOverlay clearance={grantedOperator.clearance} name={grantedOperator.name} />
      )}

      <div className="relative z-10 w-full max-w-5xl mx-auto px-6 flex flex-col lg:flex-row gap-8 items-start lg:items-center">

        {/* ── LEFT INFO PANEL ──────────────────────────────────────────── */}
        <div className="flex-1 hidden lg:flex flex-col gap-5 max-w-md">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <svg width="30" height="30" viewBox="0 0 401 494" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M371.9 357.3L400.4 410.4L200.4 493.2L0.4 410.4L28.9 357.3L200.4 429.3L371.9 357.3Z M200.4 0.7C306.3 0.7 392.3 84.2 392.3 187.2C392.3 290.2 306.4 373.7 200.4 373.7C94.4 373.7 8.5 290.2 8.5 187.2C8.5 84.2 94.4 0.7 200.4 0.7ZM200.4 58.4C127.1 58.4 67.8 116.1 67.8 187.3C67.8 258.5 127.2 316.3 200.4 316.3C273.7 316.3 333.1 258.6 333.1 187.4C333.1 116.2 273.7 58.4 200.4 58.4Z" fill="#00E5FF" />
            </svg>
            <div>
              <div className="font-mono font-bold text-white tracking-[0.3em] text-sm">AURA</div>
              <div className="font-mono text-[10px] text-cyan-400/50 tracking-widest">FINANCIAL CRIME ENGINE</div>
            </div>
          </div>

          <div>
            <h1 className="text-3xl font-bold text-white leading-tight mb-2">
              The Operating System<br />for Financial Crime
            </h1>
            <p className="text-slate-500 text-sm leading-relaxed">
              Surface hidden money trails, trace transaction rings, and deliver intelligence-grade financial analysis at machine speed.
            </p>
          </div>

          {/* Boot log */}
          <div className="hud-panel p-4">
            <div className="font-mono text-[10px] text-cyan-400/40 uppercase tracking-widest mb-3">// SYSTEM STATUS</div>
            <BootLog lines={bootLines} />
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'TRANSACTIONS', value: '2,500+', color: 'text-cyan-400' },
              { label: 'ACCOUNTS', value: '200+', color: 'text-cyan-400' },
              { label: 'ALERT RINGS', value: '47', color: 'text-orange-400' },
              { label: 'DETECTION', value: '99.2%', color: 'text-green-400' },
            ].map(m => (
              <div key={m.label} className="hud-panel p-3 text-center">
                <div className={`font-mono font-bold text-lg ${m.color}`}
                  style={{ textShadow: m.color.includes('cyan') ? '0 0 14px rgba(0,229,255,0.4)' : undefined }}>
                  {m.value}
                </div>
                <div className="font-mono text-[9px] text-slate-600 uppercase tracking-widest mt-0.5">{m.label}</div>
              </div>
            ))}
          </div>

          {/* Registered operators count */}
          <div className="font-mono text-[10px] text-slate-700 flex items-center gap-2">
            <span className="text-cyan-400/30">{'>'}</span>
            <span>{loadOperators().length} registered operator{loadOperators().length !== 1 ? 's' : ''} on this node · 1 demo account always active</span>
          </div>
        </div>

        {/* ── RIGHT FORM PANEL ─────────────────────────────────────────── */}
        <div className="w-full max-w-md">
          <div className="hud-panel p-7 relative">

            <div className="absolute top-2 right-3 font-mono text-[9px] text-cyan-400/25 uppercase">SEC-NODE:IN-DEL-01</div>

            {/* ── TAB SWITCHER ── */}
            <div className="flex gap-0 mb-7 border border-slate-800">
              {[
                { id: 'signin', label: '⟶ SIGN IN' },
                { id: 'register', label: '✚ CREATE PROFILE' },
              ].map(tab => (
                <button
                  key={tab.id}
                  id={`tab-${tab.id}`}
                  onClick={() => switchMode(tab.id)}
                  disabled={isChecking}
                  className={`flex-1 font-mono text-[10px] uppercase tracking-widest py-3 transition-all duration-200 ${
                    mode === tab.id
                      ? 'bg-cyan-400 text-aura-bg font-bold'
                      : 'text-slate-500 hover:text-slate-300 bg-black/20'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* ── FORM HEADER ── */}
            <div className="mb-5">
              <div className="font-mono text-[10px] text-cyan-400/50 uppercase tracking-[0.25em] mb-1">
                {mode === 'signin' ? '// OPERATOR AUTHENTICATION' : '// ENROLL NEW OPERATOR'}
              </div>
              <h2 className="text-lg font-bold text-white font-mono">
                {mode === 'signin' ? 'SECURE ACCESS PORTAL' : 'OPERATOR REGISTRATION'}
              </h2>
              <p className="text-slate-600 text-[10px] font-mono mt-0.5">
                {mode === 'signin'
                  ? 'Authorization required · All sessions are logged'
                  : 'Create your profile to access AURA console'}
              </p>
            </div>

            {/* ── AUTH LOG ── */}
            <AuthLogStream lines={authLog} isProcessing={isChecking} />

            {/* ── SUCCESS MSG (register) ── */}
            {successMsg && (
              <div className="mb-4 border border-green-500/30 bg-green-500/5 p-3 font-mono text-[10px] text-green-400 flex gap-2 items-center">
                <span>✓</span><span>{successMsg}</span>
              </div>
            )}

            {/* ── ERROR MSG ── */}
            {status === 'error' && errorMsg && (
              <div className="mb-4 border border-red-500/30 bg-red-500/5 p-3 font-mono text-[10px] text-red-400 flex gap-2 items-center">
                <span>⚠</span><span>{errorMsg}</span>
              </div>
            )}

            {/* ══════════════════════════ SIGN IN FORM ══════════════════════ */}
            {mode === 'signin' && (
              <form onSubmit={handleSignIn} className="space-y-4">
                <Field id="signin-username" label="OPERATOR ID" value={operatorId}
                  onChange={e => setOperatorId(e.target.value)} placeholder="operator.id"
                  disabled={isChecking} autoComplete="username" />

                <div>
                  <label className="font-mono text-[10px] uppercase tracking-widest text-slate-500 block mb-2" htmlFor="signin-password">
                    PASSPHRASE
                  </label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs text-cyan-400/40">{'>'}</div>
                    <input id="signin-password" type={showPass ? 'text' : 'password'} value={password}
                      onChange={e => setPassword(e.target.value)} disabled={isChecking}
                      placeholder="••••••••••••" autoComplete="current-password"
                      className="w-full bg-black/30 border border-slate-700 focus:border-cyan-400/60 outline-none pl-8 pr-16 py-3 font-mono text-sm text-white placeholder-slate-700 transition-colors duration-200 disabled:opacity-50"
                    />
                    <button type="button" tabIndex={-1} onClick={() => setShowPass(!showPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[9px] text-slate-600 hover:text-cyan-400 transition-colors uppercase">
                      {showPass ? 'HIDE' : 'SHOW'}
                    </button>
                  </div>
                </div>

                <button id="login-submit-btn" type="submit" disabled={isChecking}
                  className="w-full font-mono text-sm uppercase tracking-widest py-3.5 font-bold transition-all duration-200 flex items-center justify-center gap-3 mt-2"
                  style={{ background: isChecking ? 'rgba(0,229,255,0.15)' : '#00E5FF', color: isChecking ? '#00E5FF' : '#0B0E14' }}>
                  {isChecking
                    ? <><span className="inline-block w-3 h-3 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />AUTHENTICATING...</>
                    : <>AUTHENTICATE & ENTER →</>}
                </button>

                {/* ── DEMO CARD ── */}
                <div className="pt-1">
                  <DemoCard onUseDemo={fillDemo} />
                </div>
              </form>
            )}

            {/* ══════════════════════════ REGISTER FORM ══════════════════════ */}
            {mode === 'register' && (
              <form onSubmit={handleRegister} className="space-y-4">

                <Field id="reg-name" label="DISPLAY NAME" value={displayName}
                  onChange={e => setDisplayName(e.target.value)} placeholder="Agent Name"
                  disabled={isChecking} autoComplete="name" />

                <div>
                  <label className="font-mono text-[10px] uppercase tracking-widest text-slate-500 block mb-2" htmlFor="reg-id">
                    OPERATOR ID <span className="text-slate-700">(used to login)</span>
                  </label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs text-cyan-400/40">{'>'}</div>
                    <input id="reg-id" type="text" value={operatorId}
                      onChange={e => setOperatorId(e.target.value.toLowerCase().replace(/\s/g, '.'))}
                      disabled={isChecking} placeholder="agent.name" autoComplete="username"
                      className="w-full bg-black/30 border border-slate-700 focus:border-cyan-400/60 outline-none pl-8 pr-4 py-3 font-mono text-sm text-white placeholder-slate-700 transition-colors duration-200 disabled:opacity-50"
                    />
                  </div>
                  <p className="font-mono text-[9px] text-slate-700 mt-1 pl-1">Spaces auto-converted to dots. e.g. john.doe</p>
                </div>

                <div>
                  <label className="font-mono text-[10px] uppercase tracking-widest text-slate-500 block mb-2">CLEARANCE TIER</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['ALPHA-I', 'ALPHA-II', 'ALPHA-III'].map(tier => (
                      <button key={tier} type="button" disabled={isChecking}
                        onClick={() => setClearance(tier)}
                        className={`font-mono text-[10px] uppercase tracking-wider py-2 border transition-all duration-150 ${
                          clearance === tier
                            ? 'border-cyan-400 bg-cyan-400/10 text-cyan-400'
                            : 'border-slate-700 text-slate-600 hover:border-slate-500 hover:text-slate-400'
                        }`}>
                        {tier}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="font-mono text-[10px] uppercase tracking-widest text-slate-500 block mb-2" htmlFor="reg-pw">PASSPHRASE</label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs text-cyan-400/40">{'>'}</div>
                    <input id="reg-pw" type={showPass ? 'text' : 'password'} value={password}
                      onChange={e => setPassword(e.target.value)} disabled={isChecking}
                      placeholder="Min 8 characters" autoComplete="new-password"
                      className="w-full bg-black/30 border border-slate-700 focus:border-cyan-400/60 outline-none pl-8 pr-16 py-3 font-mono text-sm text-white placeholder-slate-700 transition-colors duration-200 disabled:opacity-50"
                    />
                    <button type="button" tabIndex={-1} onClick={() => setShowPass(!showPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[9px] text-slate-600 hover:text-cyan-400 transition-colors uppercase">
                      {showPass ? 'HIDE' : 'SHOW'}
                    </button>
                  </div>
                  {/* Password strength bar */}
                  {password.length > 0 && (
                    <div className="mt-1.5 flex gap-1">
                      {[4, 8, 12, 16].map(thresh => (
                        <div key={thresh} className="flex-1 h-0.5 rounded-full transition-colors duration-300"
                          style={{
                            background: password.length >= thresh
                              ? password.length >= 12 ? '#0F9960' : password.length >= 8 ? '#FFAE00' : '#FF3B30'
                              : '#1F2836'
                          }} />
                      ))}
                      <span className="font-mono text-[9px] ml-1"
                        style={{ color: password.length >= 12 ? '#0F9960' : password.length >= 8 ? '#FFAE00' : '#FF3B30' }}>
                        {password.length >= 12 ? 'STRONG' : password.length >= 8 ? 'FAIR' : 'WEAK'}
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="font-mono text-[10px] uppercase tracking-widest text-slate-500 block mb-2" htmlFor="reg-confirm">CONFIRM PASSPHRASE</label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs text-cyan-400/40">{'>'}</div>
                    <input id="reg-confirm" type={showConfirm ? 'text' : 'password'} value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)} disabled={isChecking}
                      placeholder="Re-enter passphrase" autoComplete="new-password"
                      className={`w-full bg-black/30 border focus:border-cyan-400/60 outline-none pl-8 pr-16 py-3 font-mono text-sm text-white placeholder-slate-700 transition-colors duration-200 disabled:opacity-50 ${
                        confirmPassword && password !== confirmPassword ? 'border-red-500/50' : 'border-slate-700'
                      }`}
                    />
                    <button type="button" tabIndex={-1} onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[9px] text-slate-600 hover:text-cyan-400 transition-colors uppercase">
                      {showConfirm ? 'HIDE' : 'SHOW'}
                    </button>
                  </div>
                  {confirmPassword && password !== confirmPassword && (
                    <p className="font-mono text-[9px] text-red-400 mt-1 pl-1">⚠ Passphrases do not match</p>
                  )}
                </div>

                <button id="register-submit-btn" type="submit" disabled={isChecking}
                  className="w-full font-mono text-sm uppercase tracking-widest py-3.5 font-bold transition-all duration-200 flex items-center justify-center gap-3 mt-2"
                  style={{ background: isChecking ? 'rgba(0,229,255,0.15)' : '#00E5FF', color: isChecking ? '#00E5FF' : '#0B0E14' }}>
                  {isChecking
                    ? <><span className="inline-block w-3 h-3 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />ENROLLING OPERATOR...</>
                    : <>CREATE OPERATOR PROFILE ✚</>}
                </button>

                <p className="font-mono text-[9px] text-slate-700 text-center leading-relaxed pt-1">
                  Profiles stored locally in this browser · No server required
                </p>
              </form>
            )}

            {/* ── FOOTER LINKS ── */}
            <div className="mt-5 pt-4 border-t border-slate-800 flex flex-col gap-2 items-center">
              <button onClick={() => navigate('/landing')}
                className="font-mono text-[10px] text-slate-600 hover:text-cyan-400 transition-colors uppercase tracking-widest">
                ← RETURN TO MISSION BRIEFING
              </button>
            </div>
          </div>

          {/* Telemetry strip */}
          <div className="mt-2 flex justify-between font-mono text-[9px] text-slate-700 px-1">
            <span>NODE: IN-DEL-01 · 28.61°N 77.20°E</span>
            <span>{new Date().toUTCString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
