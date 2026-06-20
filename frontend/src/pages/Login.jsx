import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

/* ── Animated canvas background ─────────────────────────────────────────── */
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

    const particles = Array.from({ length: 60 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      r: Math.random() * 1.5 + 0.5,
      alpha: Math.random() * 0.4 + 0.1,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Dot matrix
      ctx.fillStyle = 'rgba(0, 229, 255, 0.04)';
      for (let x = 0; x < canvas.width; x += 28) {
        for (let y = 0; y < canvas.height; y += 28) {
          ctx.beginPath();
          ctx.arc(x, y, 0.7, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Particles
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;
        ctx.globalAlpha = p.alpha * (0.5 + 0.5 * Math.sin(t + p.x));
        ctx.fillStyle = '#00E5FF';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      });

      // Connection lines
      ctx.globalAlpha = 1;
      particles.forEach((p, i) => {
        particles.slice(i + 1).forEach(q => {
          const d = Math.hypot(p.x - q.x, p.y - q.y);
          if (d < 120) {
            ctx.strokeStyle = `rgba(0,229,255,${0.06 * (1 - d / 120)})`;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.stroke();
          }
        });
      });

      // Horizontal sweep line
      const sweepY = ((t * 40) % canvas.height);
      const sweepGrad = ctx.createLinearGradient(0, sweepY - 80, 0, sweepY + 80);
      sweepGrad.addColorStop(0, 'transparent');
      sweepGrad.addColorStop(0.5, 'rgba(0, 229, 255, 0.025)');
      sweepGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = sweepGrad;
      ctx.fillRect(0, sweepY - 80, canvas.width, 160);

      t += 0.01;
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
  }, []);
  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-0" />;
}

/* ── Typing animation for log lines ─────────────────────────────────────── */
function BootLog({ lines }) {
  return (
    <div className="font-mono text-[10px] space-y-0.5">
      {lines.map((line, i) => (
        <div key={i} className="flex gap-2 items-center text-green-400/60" style={{ animation: `terminal-flicker 3s ${i * 0.3}s infinite` }}>
          <span className="text-cyan-400/30">[{String(i + 1).padStart(2, '0')}]</span>
          <span>{line}</span>
          {i === lines.length - 1 && <span className="text-cyan-400 animate-pulse">▌</span>}
        </div>
      ))}
    </div>
  );
}

/* ── Main Login Page ─────────────────────────────────────────────────────── */
export default function Login({ onLogin }) {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('idle'); // idle | checking | success | error
  const [errorMsg, setErrorMsg] = useState('');
  const [authLog, setAuthLog] = useState([]);
  const [showPass, setShowPass] = useState(false);
  const [clearanceLevel, setClearanceLevel] = useState('');

  const bootLines = [
    'SECURE BOOT SEQUENCE — INITIATED',
    'HARDWARE ATTESTATION: PASS',
    'ENCRYPTION LAYER: AES-256-GCM · ACTIVE',
    'BIOMETRIC MODULE: STANDING BY',
    'AWAITING OPERATOR CREDENTIALS...',
  ];

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setErrorMsg('CREDENTIAL_ERROR: All fields required');
      setStatus('error');
      return;
    }

    setStatus('checking');
    setErrorMsg('');
    setAuthLog([]);

    const logs = [
      `AUTH_REQUEST: ${username.toUpperCase()} · ${new Date().toISOString()}`,
      'HANDSHAKE_INIT: Establishing secure channel...',
      'CERT_VERIFY: Validating operator certificate...',
      'RBAC_CHECK: Loading permission matrix...',
      'SESSION_GRANT: Token issued · TTL 8h',
    ];

    for (let i = 0; i < logs.length; i++) {
      await new Promise(r => setTimeout(r, 350));
      setAuthLog(prev => [...prev, logs[i]]);
    }

    await new Promise(r => setTimeout(r, 300));

    // Demo: any non-empty credentials work (demo mode)
    setStatus('success');
    setClearanceLevel('ALPHA-III');
    await new Promise(r => setTimeout(r, 1000));

    if (onLogin) onLogin();
    navigate('/');
  };

  const isChecking = status === 'checking';

  return (
    <div className="relative min-h-screen bg-aura-bg flex items-center justify-center overflow-hidden">
      <LoginCanvas />

      {/* Full-page success overlay */}
      {status === 'success' && (
        <div className="fixed inset-0 z-50 bg-black flex items-center justify-center" style={{ animation: 'none' }}>
          <div className="text-center font-mono">
            <div className="text-cyan-400 text-4xl mb-4" style={{ textShadow: '0 0 40px rgba(0,229,255,0.8)' }}>
              ◉ ACCESS GRANTED
            </div>
            <div className="text-green-400 text-sm animate-pulse">LOADING AURA CONSOLE...</div>
            <div className="text-slate-600 text-xs mt-2">CLEARANCE: {clearanceLevel}</div>
          </div>
        </div>
      )}

      {/* Layout: Left panel + Right form */}
      <div className="relative z-10 w-full max-w-5xl mx-auto px-6 flex flex-col lg:flex-row gap-8 items-center">

        {/* ── LEFT PANEL ─────────────────────────────────────────────────── */}
        <div className="flex-1 hidden lg:flex flex-col gap-6 max-w-md">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-4">
            <svg width="32" height="32" viewBox="0 0 401 494" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M371.9 357.3L400.4 410.4L200.4 493.2L0.4 410.4L28.9 357.3L200.4 429.3L371.9 357.3Z M200.4 0.7C306.3 0.7 392.3 84.2 392.3 187.2C392.3 290.2 306.4 373.7 200.4 373.7C94.4 373.7 8.5 290.2 8.5 187.2C8.5 84.2 94.4 0.7 200.4 0.7ZM200.4 58.4C127.1 58.4 67.8 116.1 67.8 187.3C67.8 258.5 127.2 316.3 200.4 316.3C273.7 316.3 333.1 258.6 333.1 187.4C333.1 116.2 273.7 58.4 200.4 58.4Z" fill="#00E5FF"/>
            </svg>
            <div>
              <div className="font-mono font-bold text-white tracking-[0.3em] text-sm">AURA</div>
              <div className="font-mono text-[10px] text-cyan-400/50 tracking-widest uppercase">Financial Crime Engine</div>
            </div>
          </div>

          <div>
            <h1 className="text-3xl font-bold text-white leading-tight mb-3">
              The Operating System<br />for Financial Crime
            </h1>
            <p className="text-slate-500 text-sm leading-relaxed">
              Surface hidden money trails, track transaction rings, and deliver intelligence-grade financial analysis
              at machine speed.
            </p>
          </div>

          {/* Boot terminal */}
          <div className="hud-panel p-4">
            <div className="font-mono text-[10px] text-cyan-400/40 uppercase tracking-widest mb-3">// SYSTEM STATUS</div>
            <BootLog lines={bootLines} />
          </div>

          {/* System metrics */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'TRANSACTIONS', value: '2,500+', color: 'text-cyan-400' },
              { label: 'ACCOUNTS', value: '200+', color: 'text-cyan-400' },
              { label: 'ALERT RINGS', value: '47', color: 'text-orange-400' },
              { label: 'DETECTION', value: '99.2%', color: 'text-green-400' },
            ].map(m => (
              <div key={m.label} className="hud-panel p-3 text-center">
                <div className={`font-mono font-bold text-lg ${m.color}`} style={{ textShadow: m.color.includes('cyan') ? '0 0 16px rgba(0,229,255,0.4)' : undefined }}>{m.value}</div>
                <div className="font-mono text-[9px] text-slate-600 uppercase tracking-widest mt-0.5">{m.label}</div>
              </div>
            ))}
          </div>

          {/* Compliance badges */}
          <div className="flex flex-wrap gap-2">
            {['FedRAMP', 'SOC 2', 'ISO 27001', 'AML-GRADE', 'ZERO-TRUST'].map(b => (
              <span key={b} className="font-mono text-[9px] border border-slate-700 text-slate-600 px-2 py-0.5 uppercase tracking-widest">
                / {b}
              </span>
            ))}
          </div>
        </div>

        {/* ── RIGHT FORM ─────────────────────────────────────────────────── */}
        <div className="w-full max-w-md">
          <div className="hud-panel p-8 relative">
            {/* Extra corner brackets */}
            <div className="absolute top-2 right-3 font-mono text-[9px] text-cyan-400/30 uppercase tracking-wider">
              SEC-NODE:IN-DEL-01
            </div>

            {/* Form header */}
            <div className="mb-8 text-center lg:text-left">
              <div className="font-mono text-[10px] text-cyan-400/50 uppercase tracking-[0.3em] mb-2">
                // OPERATOR AUTHENTICATION
              </div>
              <h2 className="text-xl font-bold text-white font-mono">SECURE ACCESS PORTAL</h2>
              <p className="text-slate-600 text-xs font-mono mt-1">Authorization required · All sessions are monitored</p>
            </div>

            {/* Auth log strip */}
            {authLog.length > 0 && (
              <div className="mb-6 bg-black/40 border border-green-400/20 p-3 font-mono text-[10px] space-y-0.5">
                {authLog.map((line, i) => (
                  <div key={i} className="flex gap-2 text-green-400/70">
                    <span className="text-cyan-400/30 shrink-0">{'>'}</span>
                    <span>{line}</span>
                  </div>
                ))}
                {isChecking && (
                  <div className="flex gap-2 text-cyan-400/50 animate-pulse">
                    <span>{'>'}</span><span>PROCESSING...</span>
                  </div>
                )}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-5">
              {/* Operator ID */}
              <div>
                <label className="font-mono text-[10px] uppercase tracking-widest text-slate-500 block mb-2" htmlFor="login-username">
                  OPERATOR ID
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs text-cyan-400/40">{'>'}</div>
                  <input
                    id="login-username"
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    disabled={isChecking}
                    className="w-full bg-black/30 border border-slate-700 focus:border-cyan-400/60 outline-none pl-8 pr-4 py-3 font-mono text-sm text-white placeholder-slate-700 transition-colors duration-200 disabled:opacity-50"
                    placeholder="operator.id"
                    autoComplete="username"
                  />
                </div>
              </div>

              {/* Passphrase */}
              <div>
                <label className="font-mono text-[10px] uppercase tracking-widest text-slate-500 block mb-2" htmlFor="login-password">
                  PASSPHRASE
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs text-cyan-400/40">{'>'}</div>
                  <input
                    id="login-password"
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    disabled={isChecking}
                    className="w-full bg-black/30 border border-slate-700 focus:border-cyan-400/60 outline-none pl-8 pr-12 py-3 font-mono text-sm text-white placeholder-slate-700 transition-colors duration-200 disabled:opacity-50"
                    placeholder="••••••••••••"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[9px] text-slate-600 hover:text-cyan-400 transition-colors uppercase"
                    tabIndex={-1}
                  >
                    {showPass ? 'HIDE' : 'SHOW'}
                  </button>
                </div>
              </div>

              {/* Security tier */}
              <div>
                <label className="font-mono text-[10px] uppercase tracking-widest text-slate-500 block mb-2">
                  CLEARANCE TIER
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['ALPHA-I', 'ALPHA-II', 'ALPHA-III'].map(tier => (
                    <button
                      key={tier}
                      type="button"
                      onClick={() => setClearanceLevel(tier)}
                      disabled={isChecking}
                      className={`font-mono text-[10px] uppercase tracking-wider py-2 border transition-all duration-150 ${
                        clearanceLevel === tier
                          ? 'border-cyan-400 bg-cyan-400/10 text-cyan-400'
                          : 'border-slate-700 text-slate-600 hover:border-slate-500 hover:text-slate-400'
                      }`}
                    >
                      {tier}
                    </button>
                  ))}
                </div>
              </div>

              {/* Error message */}
              {status === 'error' && errorMsg && (
                <div className="hud-panel border-red-500/30 bg-red-500/5 p-3 font-mono text-xs text-red-400">
                  ⚠ {errorMsg}
                </div>
              )}

              {/* Submit */}
              <button
                id="login-submit-btn"
                type="submit"
                disabled={isChecking}
                className="w-full font-mono text-sm uppercase tracking-widest py-4 font-bold transition-all duration-200 flex items-center justify-center gap-3 relative overflow-hidden"
                style={{
                  background: isChecking ? 'rgba(0, 229, 255, 0.2)' : '#00E5FF',
                  color: isChecking ? '#00E5FF' : '#0B0E14',
                }}
              >
                {isChecking ? (
                  <>
                    <span className="inline-block w-3 h-3 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                    AUTHENTICATING...
                  </>
                ) : (
                  <>AUTHENTICATE & ENTER →</>
                )}
              </button>
            </form>

            {/* Demo note */}
            <div className="mt-6 border-t border-slate-800 pt-4">
              <p className="font-mono text-[10px] text-slate-700 text-center leading-relaxed">
                DEMO MODE · Any credentials accepted · All activity is logged and monitored per security policy §4.2
              </p>
            </div>

            {/* Back to landing */}
            <div className="mt-3 text-center">
              <button
                onClick={() => navigate('/landing')}
                className="font-mono text-[10px] text-slate-600 hover:text-cyan-400 transition-colors uppercase tracking-widest"
              >
                ← RETURN TO MISSION BRIEFING
              </button>
            </div>
          </div>

          {/* Bottom telemetry strip */}
          <div className="mt-3 flex justify-between font-mono text-[9px] text-slate-700 px-1">
            <span>NODE: IN-DEL-01 · 28.61°N 77.20°E</span>
            <span>{new Date().toUTCString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
