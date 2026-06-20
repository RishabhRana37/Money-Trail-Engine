import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

/* ── Animated dot-matrix canvas background ─────────────────────────────── */
function TacticalCanvas() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;
    let t = 0;
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Dot grid
      ctx.fillStyle = 'rgba(0, 229, 255, 0.06)';
      const spacing = 30;
      for (let x = 0; x < canvas.width; x += spacing) {
        for (let y = 0; y < canvas.height; y += spacing) {
          const pulse = Math.sin(t * 0.8 + x * 0.02 + y * 0.02) * 0.5 + 0.5;
          ctx.globalAlpha = 0.03 + pulse * 0.06;
          ctx.beginPath();
          ctx.arc(x, y, 0.8, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;

      // Horizontal scan line
      const scanY = ((t * 60) % canvas.height);
      const grad = ctx.createLinearGradient(0, scanY - 60, 0, scanY + 60);
      grad.addColorStop(0, 'transparent');
      grad.addColorStop(0.5, 'rgba(0, 229, 255, 0.03)');
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.fillRect(0, scanY - 60, canvas.width, 120);

      t += 0.016;
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
  }, []);
  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-0" />;
}

/* ── Animated Radar ─────────────────────────────────────────────────────── */
function RadarDisplay() {
  return (
    <div className="relative w-48 h-48 mx-auto">
      {/* Radar rings */}
      {[1, 2, 3, 4].map(i => (
        <div
          key={i}
          className="absolute inset-0 m-auto rounded-full border border-cyan-400/20"
          style={{
            width: `${i * 25}%`,
            height: `${i * 25}%`,
            top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)'
          }}
        />
      ))}
      {/* Crosshairs */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-full h-px bg-cyan-400/20" />
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="h-full w-px bg-cyan-400/20" />
      </div>
      {/* Sweep arm */}
      <div className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-full" style={{ animation: 'radar-sweep 4s linear infinite' }}>
        <div style={{
          position: 'absolute',
          top: 0, left: '50%',
          width: '50%', height: '50%',
          background: 'conic-gradient(from 0deg at 0% 100%, rgba(0,229,255,0.5) 0deg, transparent 90deg)',
          transformOrigin: '0% 100%',
        }} />
      </div>
      {/* Blinking dots */}
      {[
        { x: '35%', y: '28%', delay: '0s' },
        { x: '62%', y: '55%', delay: '0.8s' },
        { x: '25%', y: '65%', delay: '1.6s' },
      ].map((dot, i) => (
        <div
          key={i}
          className="absolute w-1.5 h-1.5 rounded-full bg-cyan-400"
          style={{
            left: dot.x, top: dot.y,
            animation: `target-pulse 2s ${dot.delay} ease-in-out infinite`,
            boxShadow: '0 0 6px #00e5ff'
          }}
        />
      ))}
      {/* Center dot */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-2 h-2 rounded-full bg-cyan-400" style={{ boxShadow: '0 0 10px #00e5ff' }} />
      </div>
    </div>
  );
}

/* ── Typewriter headline ────────────────────────────────────────────────── */
function TypewriterText({ text, className, speed = 40 }) {
  const [displayed, setDisplayed] = useState('');
  useEffect(() => {
    let i = 0;
    const id = setInterval(() => {
      setDisplayed(text.slice(0, i + 1));
      i++;
      if (i >= text.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [text, speed]);
  return <span className={className}>{displayed}<span className="animate-pulse">▌</span></span>;
}

/* ── Stat counter card ──────────────────────────────────────────────────── */
function StatCard({ value, label, delay }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const timeout = setTimeout(() => {
      let start = 0;
      const end = parseInt(value.replace(/\D/g, ''));
      const duration = 1500;
      const step = duration / end;
      const timer = setInterval(() => {
        start += Math.ceil(end / 60);
        if (start >= end) { setCount(end); clearInterval(timer); }
        else setCount(start);
      }, step > 0 ? step : 16);
    }, delay);
    return () => clearTimeout(timeout);
  }, [value, delay]);

  const formatted = value.includes('M') ? `${count.toLocaleString()}M+` :
    value.includes('B') ? `${count}B+` : `${count.toLocaleString()}+`;

  return (
    <div className="hud-panel p-5 flex flex-col gap-1 min-w-[140px] text-center">
      <span className="font-mono text-2xl font-bold text-cyan-400" style={{ textShadow: '0 0 20px rgba(0,229,255,0.5)' }}>
        {formatted}
      </span>
      <span className="text-xs font-mono text-slate-400 uppercase tracking-widest">{label}</span>
    </div>
  );
}

/* ── Feature row ────────────────────────────────────────────────────────── */
function FeatureRow({ icon, title, desc, delay }) {
  const [visible, setVisible] = useState(false);
  const ref = useRef();
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold: 0.2 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className="hud-panel p-6 flex gap-5 items-start transition-all duration-700"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateX(0)' : 'translateX(-30px)',
        transitionDelay: `${delay}ms`
      }}
    >
      <div className="text-3xl">{icon}</div>
      <div>
        <h3 className="text-sm font-mono font-bold text-cyan-400 uppercase tracking-wider mb-1">{title}</h3>
        <p className="text-sm text-slate-400 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

/* ── Main Landing Page ──────────────────────────────────────────────────── */
export default function Landing() {
  const navigate = useNavigate();
  const [bootText, setBootText] = useState([]);
  const [bootDone, setBootDone] = useState(false);

  const bootLines = [
    'AURA CONSOLE v4.7.2 — INITIALIZING...',
    'LOADING THREAT INTELLIGENCE MODULES...',
    'SECURE CHANNEL ESTABLISHED [AES-256-GCM]',
    'NEURAL PATTERN RECOGNITION: ONLINE',
    'FINANCIAL CRIME ENGINE: ARMED',
    'ALL SYSTEMS NOMINAL. AWAITING OPERATOR.',
  ];

  useEffect(() => {
    let i = 0;
    const id = setInterval(() => {
      setBootText(prev => [...prev, bootLines[i]]);
      i++;
      if (i >= bootLines.length) { clearInterval(id); setTimeout(() => setBootDone(true), 600); }
    }, 320);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative min-h-screen bg-aura-bg text-slate-300 overflow-x-hidden">
      <TacticalCanvas />

      {/* ── NAV ─────────────────────────────────────────────────────────── */}
      <nav className="relative z-10 flex items-center justify-between px-8 py-4 border-b border-cyan-400/10 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          {/* Logo mark */}
          <svg width="28" height="28" viewBox="0 0 401 494" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M371.9 357.3L400.4 410.4L200.4 493.2L0.4 410.4L28.9 357.3L200.4 429.3L371.9 357.3Z M200.4 0.7C306.3 0.7 392.3 84.2 392.3 187.2C392.3 290.2 306.4 373.7 200.4 373.7C94.4 373.7 8.5 290.2 8.5 187.2C8.5 84.2 94.4 0.7 200.4 0.7ZM200.4 58.4C127.1 58.4 67.8 116.1 67.8 187.3C67.8 258.5 127.2 316.3 200.4 316.3C273.7 316.3 333.1 258.6 333.1 187.4C333.1 116.2 273.7 58.4 200.4 58.4Z" fill="#00E5FF"/>
          </svg>
          <span className="font-mono text-sm font-bold tracking-[0.3em] text-white uppercase">AURA</span>
          <span className="font-mono text-xs text-cyan-400/50 hidden sm:inline">// FINANCIAL CRIME ENGINE</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          <span className="hidden md:block font-mono text-xs text-slate-500">
            UTC {new Date().toISOString().substr(11, 8)} Z
          </span>
          <button
            onClick={() => navigate('/login')}
            className="font-mono text-xs uppercase tracking-widest px-4 py-2 border border-cyan-400/40 text-cyan-400 hover:bg-cyan-400/10 hover:border-cyan-400 transition-all duration-200"
          >
            OPERATOR LOGIN
          </button>
          <button
            onClick={() => navigate('/login')}
            className="font-mono text-xs uppercase tracking-widest px-4 py-2 bg-cyan-400 text-aura-bg hover:bg-cyan-300 transition-all duration-200 font-bold"
          >
            LAUNCH CONSOLE →
          </button>
        </div>
      </nav>

      {/* ── HERO ────────────────────────────────────────────────────────── */}
      <section className="relative z-10 flex flex-col lg:flex-row items-center justify-center gap-12 px-8 pt-16 pb-20 max-w-7xl mx-auto">
        {/* Left side */}
        <div className="flex-1 max-w-2xl">
          {/* Boot terminal */}
          <div className="mb-8 font-mono text-xs text-green-400/70 space-y-0.5">
            {bootText.map((line, i) => (
              <div key={i} style={{ animation: 'terminal-flicker 4s infinite', animationDelay: `${i * 0.1}s` }}>
                <span className="text-cyan-400/40 mr-2">[{String(i + 1).padStart(2, '0')}]</span>
                {line}
              </div>
            ))}
          </div>

          <div className="mb-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-gradient-to-r from-cyan-400/60 to-transparent" />
            <span className="font-mono text-xs text-cyan-400/60 uppercase tracking-[0.3em]">CLASSIFIED SYSTEM</span>
            <div className="h-px flex-1 bg-gradient-to-l from-cyan-400/60 to-transparent" />
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight text-white mb-6" style={{ letterSpacing: '-0.01em' }}>
            The Operating<br />
            <span style={{ color: '#00E5FF', textShadow: '0 0 40px rgba(0,229,255,0.4)' }}>System for</span><br />
            Financial Crime
          </h1>

          <p className="text-slate-400 text-base leading-relaxed mb-8 max-w-xl font-light">
            AURA surfaces hidden transaction networks, traces money trails through millions of entities, and delivers
            actionable intelligence to financial investigators — at machine speed.
          </p>

          <div className="flex flex-wrap gap-4">
            <button
              id="landing-launch-btn"
              onClick={() => navigate('/login')}
              className="group relative font-mono text-sm uppercase tracking-widest px-8 py-4 bg-cyan-400 text-aura-bg font-bold hover:bg-cyan-300 transition-all duration-200 flex items-center gap-3 overflow-hidden"
            >
              <span className="relative z-10">LAUNCH CONSOLE</span>
              <span className="relative z-10 group-hover:translate-x-1 transition-transform duration-200">→</span>
              <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-5 transition-opacity" />
            </button>
            <button
              id="landing-demo-btn"
              onClick={() => navigate('/login')}
              className="font-mono text-sm uppercase tracking-widest px-8 py-4 border border-cyan-400/30 text-slate-400 hover:text-cyan-400 hover:border-cyan-400/60 transition-all duration-200"
            >
              REQUEST ACCESS
            </button>
          </div>

          {/* Certifications row */}
          <div className="mt-10 flex flex-wrap gap-3">
            {['FedRAMP', 'SOC 2 TYPE II', 'ISO 27001', 'AML-GRADE', 'ZERO-TRUST'].map(cert => (
              <span key={cert} className="font-mono text-[10px] uppercase tracking-widest px-2.5 py-1 border border-slate-700 text-slate-500">
                / {cert}
              </span>
            ))}
          </div>
        </div>

        {/* Right side - Radar + telemetry */}
        <div className="flex-shrink-0 flex flex-col items-center gap-6">
          <div className="hud-panel p-8 radar-sweep-effect">
            <div className="font-mono text-[10px] text-cyan-400/50 mb-3 uppercase tracking-widest text-center">
              THREAT TRACKING SYSTEM
            </div>
            <RadarDisplay />
            <div className="font-mono text-[10px] text-slate-500 mt-4 space-y-1 text-center">
              <div>LOC: 28.61° N / 77.20° E</div>
              <div className="text-green-400">STATUS: TRACKING 3 ACTIVE RINGS</div>
            </div>
          </div>

          {/* Live feed strip */}
          <div className="hud-panel p-4 w-full font-mono text-[10px] space-y-1.5">
            <div className="text-cyan-400/50 uppercase tracking-widest mb-2">// LIVE ALERT FEED</div>
            {[
              { lvl: 'CRITICAL', msg: 'Ring detected: ACC_0042 → shell chain' },
              { lvl: 'HIGH', msg: 'Velocity spike: ACC_0017 +$8.3M/4h' },
              { lvl: 'MEDIUM', msg: 'Cross-border loop: 7 entities, 3 jxns' },
            ].map((a, i) => (
              <div key={i} className="flex gap-2 items-center">
                <span className={`px-1 ${a.lvl === 'CRITICAL' ? 'text-red-400' : a.lvl === 'HIGH' ? 'text-orange-400' : 'text-yellow-400'}`}>
                  [{a.lvl}]
                </span>
                <span className="text-slate-500 truncate">{a.msg}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── STATS BAR ───────────────────────────────────────────────────── */}
      <section className="relative z-10 border-y border-cyan-400/10 bg-black/20 backdrop-blur-sm py-10">
        <div className="max-w-5xl mx-auto px-8 flex flex-wrap justify-center gap-4">
          <StatCard value="200" label="Accounts Tracked" delay={0} />
          <StatCard value="2500" label="Transactions/Cycle" delay={200} />
          <StatCard value="47" label="Alert Patterns" delay={400} />
          <StatCard value="99" label="Detection Rate %" delay={600} />
        </div>
      </section>

      {/* ── FEATURES ────────────────────────────────────────────────────── */}
      <section className="relative z-10 max-w-6xl mx-auto px-8 py-20">
        <div className="text-center mb-12">
          <div className="font-mono text-xs text-cyan-400/50 uppercase tracking-[0.3em] mb-3">// SYSTEM CAPABILITIES</div>
          <h2 className="text-3xl font-bold text-white">Thousands of Transactions. A Single Pane of Glass.</h2>
          <p className="text-slate-500 mt-3 max-w-2xl mx-auto text-sm leading-relaxed">
            AURA joins and enriches massive volumes of near-real-time financial data and surfaces them in a single
            view, enabling investigators to make faster, more confident decisions together.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FeatureRow delay={0} icon="🕸️" title="Money Trail Graph" desc="Visualize complex transaction networks as force-directed graphs. Trace multi-hop money flows, identify shell chains, and pinpoint primary threat nodes at a glance." />
          <FeatureRow delay={100} icon="🔴" title="Ring Detection AI" desc="Machine learning models detect cyclical transaction rings, layering, and smurfing patterns — and continuously refine themselves from operator feedback." />
          <FeatureRow delay={200} icon="⚡" title="Real-Time Alerts" desc="Velocity spikes, cross-border anomalies, and behavioral outliers surface as prioritized alerts before they cascade into untraceable flows." />
          <FeatureRow delay={300} icon="🔒" title="Multi-Layer Security" desc="FedRAMP Moderate / AML-grade data governance. Granular audit trails on every operator action. Zero-trust architecture throughout." />
          <FeatureRow delay={400} icon="📡" title="Edge AI Deployment" desc="AURA's feedback loops train and refine models that augment human analysis during live operations. Operator actions improve models over time." />
          <FeatureRow delay={500} icon="🌐" title="Open & Interoperable" desc="Export all data products with provenance in any format. Seamlessly connect with existing AML / KYC / SWIFT infrastructure." />
        </div>
      </section>

      {/* ── QUOTE ───────────────────────────────────────────────────────── */}
      <section className="relative z-10 border-y border-cyan-400/10 bg-black/30 py-16 px-8">
        <div className="max-w-3xl mx-auto text-center">
          <div className="text-cyan-400/20 text-6xl font-serif mb-4">"</div>
          <blockquote className="text-xl text-white leading-relaxed font-light italic mb-6">
            You are giving us advantages right now that we need — ground-breaking technologies that help us make
            better decisions in high-stakes environments.
          </blockquote>
          <cite className="font-mono text-xs text-slate-500 uppercase tracking-widest">
            — Financial Crimes Enforcement Network, Reference Brief
          </cite>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────────── */}
      <section className="relative z-10 max-w-4xl mx-auto px-8 py-20 text-center">
        <div className="hud-panel p-12">
          <div className="font-mono text-xs text-cyan-400/50 uppercase tracking-[0.3em] mb-4">// READY TO OPERATE</div>
          <h2 className="text-3xl font-bold text-white mb-4">Initiate System Access</h2>
          <p className="text-slate-500 text-sm mb-8">Reach out to learn more or authenticate with your credentials to access the AURA console.</p>
          <div className="flex flex-wrap gap-4 justify-center">
            <button
              id="landing-cta-btn"
              onClick={() => navigate('/login')}
              className="font-mono text-sm uppercase tracking-widest px-10 py-4 bg-cyan-400 text-aura-bg font-bold hover:bg-cyan-300 transition-all duration-200"
            >
              AUTHENTICATE NOW →
            </button>
          </div>
          <div className="mt-6 font-mono text-[10px] text-slate-600 uppercase tracking-widest">
            AURA CONSOLE v4.7.2 · SECURITY LEVEL: ALPHA-III · NODE: IN-DEL-01
          </div>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────────────── */}
      <footer className="relative z-10 border-t border-cyan-400/10 px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <svg width="16" height="16" viewBox="0 0 401 494" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M371.9 357.3L400.4 410.4L200.4 493.2L0.4 410.4L28.9 357.3L200.4 429.3L371.9 357.3Z M200.4 0.7C306.3 0.7 392.3 84.2 392.3 187.2C392.3 290.2 306.4 373.7 200.4 373.7C94.4 373.7 8.5 290.2 8.5 187.2C8.5 84.2 94.4 0.7 200.4 0.7ZM200.4 58.4C127.1 58.4 67.8 116.1 67.8 187.3C67.8 258.5 127.2 316.3 200.4 316.3C273.7 316.3 333.1 258.6 333.1 187.4C333.1 116.2 273.7 58.4 200.4 58.4Z" fill="#00E5FF" fillOpacity="0.4"/>
          </svg>
          <span className="font-mono text-xs text-slate-600">AURA FINANCIAL CRIME ENGINE</span>
        </div>
        <span className="font-mono text-xs text-slate-700">© 2024 · SECURITY CLEARANCE REQUIRED · ALL RIGHTS RESERVED</span>
      </footer>
    </div>
  );
}
