import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

/* ── MOCK DATA FOR TACTICAL TARGETS ─────────────────────────────────────── */
const TARGETS_DATA = [
  { id: 'TGT-A01', name: 'OP RADIANT FALCON', type: 'Vessel', lat: 0.26, lon: 1.00, status: 'FIX', risk: 'P1', hash: 'MTS/HCS/SI/TK/OC/NF' },
  { id: 'acc_0042', name: 'Quikfix Traders', type: 'Shell Comp.', lat: 0.50, lon: 1.35, status: 'ENGAGE', risk: 'P1', hash: 'MTS/HCS/SI/TK/OC/NF' },
  { id: 'acc_0118', name: 'Neel Sharma', type: 'Mule Node', lat: 0.48, lon: 1.36, status: 'TRACK', risk: 'P2', hash: 'MTS/HCS/SI/TK/OC/NF' },
  { id: 'TGT-I05', name: '#0a196b / SA-5', type: 'IADS', lat: 0.55, lon: 0.80, status: 'ENGAGE', risk: 'P1', hash: 'MTS/HCS/SI/TK/OC/NF' },
  { id: 'TGT-V12', name: 'CONTAINER VESSEL ALPHA', type: 'Vessel', lat: -0.10, lon: 1.20, status: 'TRACK', risk: 'P2', hash: 'MTS/HCS/SI/TK/OC/NF' },
  { id: 'acc_0091', name: 'Maya Holdings', type: 'Business Mule', lat: 0.70, lon: -1.30, status: 'TRACK', risk: 'P2', hash: 'MTS/HCS/SI/TK/OC/NF' },
];

/* ── 3D CANVAS GLOBE COMPONENT ─────────────────────────────────────────── */
function TacticalGlobe({ scrollProgress, selectedTarget, onTargetSelected }) {
  const canvasRef = useRef(null);
  const anglesRef = useRef({ rx: 0.3, ry: 0 });
  const timeRef = useRef(0);

  // Generate sphere points once (continents vs ocean)
  const spherePointsRef = useRef([]);
  useEffect(() => {
    const points = [];
    const continents = [
      { lat: 0.3, lon: 0.5, radius: 0.9 },   // Asia/Europe
      { lat: -0.1, lon: 0.3, radius: 0.7 },  // Africa
      { lat: 0.6, lon: -1.4, radius: 0.8 },  // North America
      { lat: -0.2, lon: -1.0, radius: 0.7 }, // South America
      { lat: -0.4, lon: 2.3, radius: 0.5 }   // Australia/Oceania
    ];

    for (let latIdx = -22; latIdx <= 22; latIdx++) {
      const lat = (latIdx / 24) * Math.PI * 0.48;
      const rCosLat = Math.cos(lat);
      for (let lonIdx = 0; lonIdx < 70; lonIdx++) {
        const lon = (lonIdx / 70) * Math.PI * 2 - Math.PI;

        // Check if this point lies inside any continent boundary
        let isLand = false;
        for (const cont of continents) {
          const dLat = lat - cont.lat;
          const dLon = lon - cont.lon;
          // Haversine-like distance proxy
          const dist = Math.sqrt(dLat * dLat + dLon * dLon);
          if (dist < cont.radius) {
            isLand = true;
            break;
          }
        }

        // Denser dots on land, sparse on water for tactical styling
        if (isLand || Math.random() < 0.12) {
          points.push({ lat, lon, isLand });
        }
      }
    }
    spherePointsRef.current = points;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const width = canvas.width;
      const height = canvas.height;
      const centerX = width * 0.62; // Center right
      // Pan globe upwards on scroll
      const centerY = height * (0.52 - scrollProgress * 0.22);

      // Base globe configuration
      const radius = Math.min(width, height) * 0.28;
      // Zoom in on scroll
      const cameraZ = 1200 - scrollProgress * 650;
      const fov = 850;

      timeRef.current += 0.012;

      // Update rotation angles
      let targetRx = 0.35 + scrollProgress * 0.45;
      let targetRy = timeRef.current * 0.08 + scrollProgress * Math.PI * 1.5;

      if (selectedTarget) {
        // Smoothly center on selected target
        targetRy = -selectedTarget.lon;
        targetRx = -selectedTarget.lat;
      }

      // Linear interpolation (lerp) for camera rotation angles
      anglesRef.current.rx = anglesRef.current.rx * 0.94 + targetRx * 0.06;
      anglesRef.current.ry = anglesRef.current.ry * 0.94 + targetRy * 0.06;

      const rx = anglesRef.current.rx;
      const ry = anglesRef.current.ry;

      /* 1. DRAW ATMOSPHERE GLOW */
      const atmosGrad = ctx.createRadialGradient(
        centerX, centerY, radius * 0.9,
        centerX, centerY, radius * 1.3
      );
      atmosGrad.addColorStop(0, 'rgba(0, 229, 255, 0.08)');
      atmosGrad.addColorStop(0.3, 'rgba(0, 229, 255, 0.04)');
      atmosGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = atmosGrad;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * 1.3, 0, Math.PI * 2);
      ctx.fill();

      // Earth outer rim circle
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.15)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.stroke();

      // Sonar sweep background arc
      const radarAngle = (timeRef.current * 0.5) % (Math.PI * 2);
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * 1.08, radarAngle, radarAngle + 0.8);
      ctx.stroke();

      /* 2. PROJECT AND DRAW GLOBE SURFACE POINTS */
      const projectedPoints = [];
      spherePointsRef.current.forEach(pt => {
        // Spherical to 3D Cartesian
        const x = radius * Math.cos(pt.lat) * Math.sin(pt.lon);
        const y = radius * Math.sin(pt.lat);
        const z = radius * Math.cos(pt.lat) * Math.cos(pt.lon);

        // Y-axis rotation (spin)
        let x1 = x * Math.cos(ry) - z * Math.sin(ry);
        let z1 = x * Math.sin(ry) + z * Math.cos(ry);
        let y1 = y;

        // X-axis rotation (tilt)
        let x2 = x1;
        let y2 = y1 * Math.cos(rx) - z1 * Math.sin(rx);
        let z2 = y1 * Math.sin(rx) + z1 * Math.cos(rx);

        // We show front hemisphere fully, back hemisphere very faded
        const isFront = z2 <= 0;
        const scale = fov / (fov + z2 + cameraZ);
        const sx = centerX + x2 * scale;
        const sy = centerY + y2 * scale;

        // Clip out points outside boundary circle (sphere shape)
        const dx = sx - centerX;
        const dy = sy - centerY;
        const distToCenter = Math.sqrt(dx*dx + dy*dy);

        if (distToCenter <= radius * 1.01) {
          ctx.beginPath();
          ctx.arc(sx, sy, pt.isLand ? 0.9 : 0.6, 0, Math.PI * 2);
          if (isFront) {
            ctx.fillStyle = pt.isLand ? 'rgba(0, 229, 255, 0.4)' : 'rgba(0, 229, 255, 0.15)';
          } else {
            ctx.fillStyle = 'rgba(0, 229, 255, 0.05)';
          }
          ctx.fill();
        }
      });

      /* 3. DRAW ORBITAL BELTS */
      const drawOrbit = (orbitRadius, tiltZ, tiltX, speedScale, color) => {
        const satAngle = timeRef.current * speedScale;
        ctx.beginPath();
        const segments = 90;
        for (let i = 0; i <= segments; i++) {
          const angle = (i / segments) * Math.PI * 2;
          const ox = orbitRadius * Math.cos(angle);
          const oy = 0;
          const oz = orbitRadius * Math.sin(angle);

          // Tilt Z
          const tx = ox * Math.cos(tiltZ) - oy * Math.sin(tiltZ);
          const ty = ox * Math.sin(tiltZ) + oy * Math.cos(tiltZ);
          const tz = oz;

          // Tilt X
          const tx2 = tx;
          const ty2 = ty * Math.cos(tiltX) - tz * Math.sin(tiltX);
          const tz2 = ty * Math.sin(tiltX) + tz * Math.cos(tiltX);

          // Spin & Tilt globe rotations
          const rx_f = tx2 * Math.cos(ry) - tz2 * Math.sin(ry);
          const rz_f = tx2 * Math.sin(ry) + tz2 * Math.cos(ry);
          const ry_f = ty2 * Math.cos(rx) - rz_f * Math.sin(rx);
          const rz2_f = ty2 * Math.sin(rx) + rz_f * Math.cos(rx);

          const scale = fov / (fov + rz2_f + cameraZ);
          const sx = centerX + rx_f * scale;
          const sy = centerY + ry_f * scale;

          if (rz2_f <= 10) { // Faint path on front
            if (i === 0) ctx.moveTo(sx, sy);
            else ctx.lineTo(sx, sy);
          }
        }
        ctx.strokeStyle = color;
        ctx.lineWidth = 0.6;
        ctx.stroke();

        // Active satellite point
        const sx_sat = orbitRadius * Math.cos(satAngle);
        const sy_sat = 0;
        const sz_sat = orbitRadius * Math.sin(satAngle);

        const tx_s = sx_sat * Math.cos(tiltZ) - sy_sat * Math.sin(tiltZ);
        const ty_s = sx_sat * Math.sin(tiltZ) + sy_sat * Math.cos(tiltZ);
        const tz_s = sz_sat;

        const tx2_s = tx_s;
        const ty2_s = ty_s * Math.cos(tiltX) - tz_s * Math.sin(tiltX);
        const tz2_s = ty_s * Math.sin(tiltX) + tz_s * Math.cos(tiltX);

        const rx_fs = tx2_s * Math.cos(ry) - tz2_s * Math.sin(ry);
        const rz_fs = tx2_s * Math.sin(ry) + tz2_s * Math.cos(ry);
        const ry_fs = ty2_s * Math.cos(rx) - rz_fs * Math.sin(rx);
        const rz2_fs = ty2_s * Math.sin(rx) + rz_fs * Math.cos(rx);

        if (rz2_fs <= 0) {
          const scale = fov / (fov + rz2_fs + cameraZ);
          const sx = centerX + rx_fs * scale;
          const sy = centerY + ry_fs * scale;
          ctx.beginPath();
          ctx.arc(sx, sy, 3, 0, Math.PI * 2);
          ctx.fillStyle = '#00E5FF';
          ctx.shadowBlur = 8;
          ctx.shadowColor = '#00E5FF';
          ctx.fill();
          ctx.shadowBlur = 0;

          ctx.font = '7px monospace';
          ctx.fillStyle = 'rgba(0, 229, 255, 0.45)';
          ctx.fillText(`ORB-SAT-${Math.floor(orbitRadius)}`, sx + 8, sy - 2);
        }
      };

      drawOrbit(radius * 1.15, 0.4, 0.2, 0.15, 'rgba(0, 229, 255, 0.15)');
      drawOrbit(radius * 1.30, -0.3, 0.4, -0.10, 'rgba(255, 174, 0, 0.12)');

      /* 4. RENDER TARGETS ON GLOBE */
      const projectedTargets = [];
      TARGETS_DATA.forEach(tgt => {
        const x = radius * Math.cos(tgt.lat) * Math.sin(tgt.lon);
        const y = radius * Math.sin(tgt.lat);
        const z = radius * Math.cos(tgt.lat) * Math.cos(tgt.lon);

        let x1 = x * Math.cos(ry) - z * Math.sin(ry);
        let z1 = x * Math.sin(ry) + z * Math.cos(ry);
        let y1 = y;

        let x2 = x1;
        let y2 = y1 * Math.cos(rx) - z1 * Math.sin(rx);
        let z2 = y1 * Math.sin(rx) + z1 * Math.cos(rx);

        const isFront = z2 <= 20;
        const scale = fov / (fov + z2 + cameraZ);
        const sx = centerX + x2 * scale;
        const sy = centerY + y2 * scale;

        projectedTargets.push({ ...tgt, sx, sy, z2, isFront });
      });

      // Draw connection links between certain targets
      ctx.beginPath();
      for (let i = 0; i < projectedTargets.length - 1; i++) {
        const p1 = projectedTargets[i];
        const p2 = projectedTargets[i + 1];
        if (p1.isFront && p2.isFront) {
          ctx.beginPath();
          ctx.moveTo(p1.sx, p1.sy);
          const midX = (p1.sx + p2.sx) / 2;
          const midY = (p1.sy + p2.sy) / 2;
          const dx = p1.sx - p2.sx;
          const dy = p1.sy - p2.sy;
          const dist = Math.sqrt(dx*dx + dy*dy);
          // Pull arc outward slightly
          const nx = -dy / dist;
          const ny = dx / dist;
          const cpX = midX + nx * (dist * 0.15);
          const cpY = midY + ny * (dist * 0.15);

          ctx.quadraticCurveTo(cpX, cpY, p2.sx, p2.sy);
          ctx.strokeStyle = 'rgba(0, 229, 255, 0.15)';
          ctx.lineWidth = 0.8;
          ctx.stroke();

          // Animated pulse diode
          const pulseT = (timeRef.current * 0.2 + i * 0.3) % 1.0;
          const bx = (1 - pulseT) * (1 - pulseT) * p1.sx + 2 * (1 - pulseT) * pulseT * cpX + pulseT * pulseT * p2.sx;
          const by = (1 - pulseT) * (1 - pulseT) * p1.sy + 2 * (1 - pulseT) * pulseT * cpY + pulseT * pulseT * p2.sy;

          ctx.beginPath();
          ctx.arc(bx, by, 2.2, 0, Math.PI * 2);
          ctx.fillStyle = '#00E5FF';
          ctx.shadowBlur = 6;
          ctx.shadowColor = '#00E5FF';
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }

      // Draw targets
      projectedTargets.forEach(tgt => {
        if (!tgt.isFront) return;

        const isSelected = selectedTarget && selectedTarget.id === tgt.id;
        const color = tgt.status === 'ENGAGE' ? '#FF3B30' : tgt.status === 'FIX' ? '#FFAE00' : '#00E5FF';

        // Glowing point
        ctx.beginPath();
        ctx.arc(tgt.sx, tgt.sy, isSelected ? 4.5 : 3, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.shadowBlur = isSelected ? 12 : 5;
        ctx.shadowColor = color;
        ctx.fill();
        ctx.shadowBlur = 0;

        // Subdued target text tag
        ctx.font = '8px monospace';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
        ctx.fillText(tgt.name.slice(0, 16), tgt.sx + 8, tgt.sy + 3);

        // Blinking crosshair for lock-on or selection
        if (isSelected) {
          const pulse = Math.sin(timeRef.current * 8) * 4 + 14;
          ctx.strokeStyle = color;
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.arc(tgt.sx, tgt.sy, pulse, 0, Math.PI * 2);
          ctx.stroke();

          // Reticle hair marks
          ctx.beginPath();
          ctx.moveTo(tgt.sx - pulse - 3, tgt.sy);
          ctx.lineTo(tgt.sx + pulse + 3, tgt.sy);
          ctx.moveTo(tgt.sx, tgt.sy - pulse - 3);
          ctx.lineTo(tgt.sx, tgt.sy + pulse + 3);
          ctx.stroke();

          // Reticle values
          ctx.fillStyle = color;
          ctx.fillText(`LOCKED // DEC: ${(tgt.lat * 57.3).toFixed(2)}° N`, tgt.sx + pulse + 6, tgt.sy - 6);
          ctx.fillText(`RNG: ${tgt.risk}`, tgt.sx + pulse + 6, tgt.sy + 4);
        }
      });

      animId = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, [scrollProgress, selectedTarget]);

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-0 bg-[#07090D]" />;
}

/* ── MAIN LANDING PAGE ──────────────────────────────────────────────────── */
export default function Landing() {
  const navigate = useNavigate();
  const [scrollProgress, setScrollProgress] = useState(0);
  const [selectedTarget, setSelectedTarget] = useState(TARGETS_DATA[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [bootText, setBootText] = useState([]);
  const [bootDone, setBootDone] = useState(false);

  const bootLines = [
    'AURA CONSOLE v4.7.2 — INITIALIZING GLOBAL THREAT MATRIX...',
    'CONNECTING SATELLITE CHANNELS [NODE: IN-DEL-01]...',
    'SCANNING BATTLESPACE TRANSACTIONS: ACC_0042...',
    'NEURAL LAYER RECOGNITION ARMED [clearance=ALPHA-III]...',
    'READY FOR OPERATOR LOG.'
  ];

  // Live clock
  const [timeStr, setTimeStr] = useState('');
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toISOString().substring(11, 19));
    };
    updateTime();
    const t = setInterval(updateTime, 1000);
    return () => clearInterval(t);
  }, []);

  // Sync scroll
  useEffect(() => {
    const handleScroll = () => {
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      const progress = maxScroll > 0 ? window.scrollY / maxScroll : 0;
      setScrollProgress(progress);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Boot terminal sequence
  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      setBootText(prev => [...prev, bootLines[i]]);
      i++;
      if (i >= bootLines.length) {
        clearInterval(interval);
        setBootDone(true);
      }
    }, 280);
    return () => clearInterval(interval);
  }, []);

  // Filter targets list
  const filteredTargets = TARGETS_DATA.filter(t =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Transition opacities based on scroll progress
  // Fades out the initial HUD console view when scrolling down
  const initialHUDOpacity = Math.max(0, 1 - scrollProgress * 5); // Fades out completely at 20% scroll
  // Fades in the detailed information modules as user scrolls down
  const scrollContentOpacity = Math.min(1, Math.max(0, (scrollProgress - 0.1) * 3));

  return (
    <div className="relative min-h-[300vh] text-slate-300 font-sans select-none overflow-x-hidden">
      {/* 3D Global Tactical Canvas */}
      <TacticalGlobe
        scrollProgress={scrollProgress}
        selectedTarget={selectedTarget}
        onTargetSelected={setSelectedTarget}
      />

      {/* ── SCREEN 1: GOTHAM CONSOLE HUD OVERLAY (Fixed while scrollProgress is low) ── */}
      <div
        className="fixed inset-0 z-10 flex flex-col justify-between pointer-events-none transition-all duration-300"
        style={{ opacity: initialHUDOpacity, visibility: initialHUDOpacity === 0 ? 'hidden' : 'visible' }}
      >
        {/* Navigation / Top Telemetry bar */}
        <header className="w-full flex items-center justify-between px-6 py-3 border-b border-cyan-500/10 bg-black/40 backdrop-blur-sm pointer-events-auto">
          <div className="flex items-center gap-3">
            <svg width="24" height="24" viewBox="0 0 401 494" fill="none" className="animate-pulse">
              <path d="M371.9 357.3L400.4 410.4L200.4 493.2L0.4 410.4L28.9 357.3L200.4 429.3L371.9 357.3Z M200.4 0.7C306.3 0.7 392.3 84.2 392.3 187.2C392.3 290.2 306.4 373.7 200.4 373.7C94.4 373.7 8.5 290.2 8.5 187.2C8.5 84.2 94.4 0.7 200.4 0.7ZM200.4 58.4C127.1 58.4 67.8 116.1 67.8 187.3C67.8 258.5 127.2 316.3 200.4 316.3C273.7 316.3 333.1 258.6 333.1 187.4C333.1 116.2 273.7 58.4 200.4 58.4Z" fill="#00E5FF"/>
            </svg>
            <span className="font-mono text-sm font-bold tracking-[0.2em] text-white">AURA</span>
            <div className="h-4 w-px bg-slate-700 mx-1 hidden sm:block" />
            <div className="hidden sm:flex gap-1.5 items-center font-mono text-[10px] text-slate-400">
              <button className="px-2 py-0.5 border border-slate-700 hover:border-cyan-400/50 bg-slate-900/60 rounded">BOARD: OP RADIANT FALCON</button>
              <button className="px-1.5 py-0.5 border border-slate-800 text-slate-500 hover:text-slate-400">+</button>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <span className="font-mono text-xs text-cyan-400/60 tracking-wider hidden md:block">
              // UTC {timeStr} Z [DEL: 28.61° N, 77.20° E]
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/login')}
                className="font-mono text-[11px] uppercase tracking-widest px-4 py-1.5 border border-cyan-400/35 text-cyan-400 hover:bg-cyan-400/10 transition-all rounded"
              >
                Get Started
              </button>
              <button
                onClick={() => navigate('/login')}
                className="p-1.5 text-slate-400 hover:text-white transition-colors"
                title="Search Console"
              >
                🔍
              </button>
              <button
                onClick={() => navigate('/login')}
                className="p-1.5 text-slate-400 hover:text-white transition-colors"
                title="System Menu"
              >
                ☰
              </button>
            </div>
          </div>
        </header>

        {/* HUD Middle Area: Left Targets Sidebar + Globe center grid */}
        <div className="flex-1 flex overflow-hidden relative">
          
          {/* LEFT SIDEBAR: TARGET BOARD */}
          <aside className="w-80 border-r border-cyan-500/10 bg-black/45 backdrop-blur-md flex flex-col p-4 pointer-events-auto">
            <div className="flex justify-between items-center mb-3">
              <span className="font-mono text-[11px] text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" /> TARGET BOARD
              </span>
              <span className="font-mono text-[9px] text-slate-500 uppercase">1 active</span>
            </div>

            <div className="hud-panel p-2 mb-3 bg-cyan-950/20 border-cyan-500/20 text-cyan-400 font-mono text-[10px] flex justify-between items-center">
              <span>◉ OP RADIANT FALCON</span>
              <span className="text-slate-500 cursor-pointer">✕</span>
            </div>

            {/* Target search bar */}
            <div className="relative mb-4">
              <input
                type="text"
                placeholder="Search targets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900/80 border border-slate-800 focus:border-cyan-400/50 outline-none text-xs font-mono py-1.5 pl-3 pr-8 text-white rounded"
              />
              <span className="absolute right-2 top-2 text-[10px] opacity-40">⚙️</span>
            </div>

            {/* Filters toolbar */}
            <div className="grid grid-cols-3 gap-1 mb-4 font-mono text-[8px] text-center text-slate-400">
              <button className="py-1 border border-slate-800 hover:bg-slate-900 rounded">◉ STAGE</button>
              <button className="py-1 border border-slate-800 hover:bg-slate-900 rounded">◉ STATUS</button>
              <button className="py-1 border border-slate-800 hover:bg-slate-900 rounded">◉ TARGETS</button>
            </div>

            {/* Recommendation line */}
            <button
              onClick={() => navigate('/login')}
              className="w-full py-2 bg-slate-900/90 border border-cyan-500/20 text-cyan-400 hover:bg-cyan-950/30 text-left pl-3 font-mono text-[10px] flex items-center justify-between mb-4 transition-colors rounded"
            >
              <span>Recommend Taskings</span>
              <span className="pr-2">➔</span>
            </button>

            {/* Target List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {filteredTargets.map(tgt => {
                const isSelected = selectedTarget && selectedTarget.id === tgt.id;
                const statusColor = tgt.status === 'ENGAGE' ? 'text-red-400 border-red-500/30' : tgt.status === 'FIX' ? 'text-amber-400 border-amber-500/30' : 'text-cyan-400 border-cyan-500/30';
                
                return (
                  <div
                    key={tgt.id}
                    onClick={() => setSelectedTarget(tgt)}
                    className={`hud-panel p-3 cursor-pointer transition-all duration-200 ${isSelected ? 'border-cyan-400 bg-cyan-950/20 shadow-[0_0_10px_rgba(0,229,255,0.1)]' : 'border-slate-800 hover:border-slate-700 bg-slate-900/40'}`}
                  >
                    <div className="flex justify-between items-start mb-1.5">
                      <span className="font-mono text-[11px] font-bold text-white block truncate max-w-[150px]">
                        {tgt.name}
                      </span>
                      <span className="font-mono text-[9px] text-cyan-400/50 uppercase">
                        {tgt.risk}
                      </span>
                    </div>

                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-[9px] text-slate-400">{tgt.type}</span>
                      <span className="font-mono text-[8px] text-slate-500 truncate max-w-[100px]">{tgt.id}</span>
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-800/40 pt-2 font-mono text-[8px]">
                      <span className={`px-2 py-0.5 border rounded uppercase ${statusColor}`}>
                        {tgt.status}
                      </span>
                      <span className="text-slate-500 tracking-tighter">
                        {tgt.hash}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>

          {/* Center Coordinates Legend HUD marker */}
          <div className="absolute right-6 top-6 flex flex-col font-mono text-[9px] text-slate-500 text-right pointer-events-none">
            <span>AZIMUTH: {(anglesRef.current.ry * 57.3).toFixed(1)}°</span>
            <span>ELEVATION: {(anglesRef.current.rx * 57.3).toFixed(1)}°</span>
            <span>BATTLESPACE: ACTIVE DETECTED</span>
          </div>
        </div>

        {/* FOOTER: Giant "AURA" Title Overlay & Telemetry Columns */}
        <div className="w-full relative flex flex-col justify-end px-8 pb-4">
          
          {/* Telemetry info row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-7xl mx-auto w-full border-t border-slate-800/60 pt-4 mb-2 font-mono text-[9px] text-slate-400 pointer-events-auto">
            <div>
              <div className="text-slate-500 uppercase tracking-widest mb-0.5">YOU ARE NOW</div>
              <div className="text-cyan-400 font-bold">ENTERING CENTRAL SYSTEM</div>
            </div>
            <div>
              <div className="text-slate-500 uppercase tracking-widest mb-0.5">TIME REMAINING</div>
              <div className="text-white">SCROLL DOWN TO EXPLORE INTERACTIVE CONSOLE</div>
            </div>
            <div>
              <div className="text-slate-500 uppercase tracking-widest mb-0.5">OPERATING MATRIX</div>
              <div className="text-white">GLOBAL FINANCIAL CRIME INTEL DECISION PLATFORM</div>
            </div>
            <div>
              <div className="text-slate-500 uppercase tracking-widest mb-0.5">INTEL provenance</div>
              <div className="text-slate-500 uppercase">COPYRIGHT © 2026 AURA TECHNOLOGIES INC.</div>
            </div>
          </div>

          {/* Giant Title Overlay */}
          <div className="text-center overflow-hidden">
            <h1 className="text-[13vw] font-bold text-white/5 tracking-tighter uppercase leading-[0.8] select-none font-sans">
              AURA
            </h1>
          </div>
        </div>
      </div>

      {/* ── SCREEN 2: SCROLLABLE LANDING INFORMATION VIEW ── */}
      <div
        className="relative z-20 w-full pt-[100vh] pb-24 transition-opacity duration-300"
        style={{ opacity: scrollContentOpacity, pointerEvents: scrollProgress > 0.08 ? 'auto' : 'none' }}
      >
        <div className="max-w-7xl mx-auto px-6 space-y-24">

          {/* 1. HERO CONTENT BLOCK */}
          <div className="flex flex-col lg:flex-row items-center justify-between gap-12 pt-12">
            
            {/* Left Column: Boot terminal & titles */}
            <div className="flex-1 max-w-2xl bg-black/60 p-8 border border-slate-800/60 rounded-lg backdrop-blur-md">
              
              {/* Boot console strip */}
              <div className="mb-6 font-mono text-[10px] text-green-400/80 space-y-0.5">
                {bootText.map((line, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="text-cyan-400/30">[{String(i + 1).padStart(2, '0')}]</span>
                    <span>{line}</span>
                  </div>
                ))}
                {!bootDone && <span className="animate-pulse">▌</span>}
              </div>

              <div className="mb-4 flex items-center gap-3">
                <div className="h-px flex-1 bg-gradient-to-r from-cyan-400/60 to-transparent" />
                <span className="font-mono text-[9px] text-cyan-400/80 uppercase tracking-[0.25em]">CLASSIFIED INTEL GATEWAY</span>
                <div className="h-px flex-1 bg-gradient-to-l from-cyan-400/60 to-transparent" />
              </div>

              <h2 className="text-4xl sm:text-5xl font-bold leading-none text-white mb-6 tracking-tight">
                The Operating System for <br />
                <span className="text-cyan-400" style={{ textShadow: '0 0 35px rgba(0,229,255,0.3)' }}>
                  Financial Crime Tracking
                </span>
              </h2>

              <p className="text-slate-400 text-sm leading-relaxed mb-8 max-w-xl font-light">
                AURA unifies transaction networks, tracks multi-hop laundering trails through complex entities, 
                and delivers actionable mapping alerts for compliance teams and financial crime intelligence.
              </p>

              <div className="flex flex-wrap gap-4">
                <button
                  onClick={() => navigate('/login')}
                  className="group relative font-mono text-[11px] uppercase tracking-widest px-8 py-3.5 bg-cyan-400 text-slate-900 font-bold hover:bg-cyan-300 transition-all flex items-center gap-3 overflow-hidden rounded"
                >
                  <span>LAUNCH OPERATIONAL CONSOLE</span>
                  <span>➔</span>
                </button>
                <button
                  onClick={() => navigate('/login')}
                  className="font-mono text-[11px] uppercase tracking-widest px-8 py-3.5 border border-cyan-400/30 text-slate-400 hover:text-cyan-400 hover:border-cyan-400 transition-all rounded"
                >
                  REQUEST ACCESS clearance
                </button>
              </div>

              {/* Badges list */}
              <div className="mt-8 flex flex-wrap gap-2.5">
                {['FedRAMP', 'SOC 2 CERTIFIED', 'AML-GRADE', 'ZERO TRUST', 'ISO 27001'].map(tag => (
                  <span key={tag} className="font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 border border-slate-800 text-slate-500 rounded">
                    // {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Right Column: Mini threat board overview */}
            <div className="w-full lg:w-96 flex flex-col gap-4">
              <div className="hud-panel p-6 bg-black/60 backdrop-blur-md">
                <span className="font-mono text-[10px] text-cyan-400/50 uppercase tracking-widest block mb-4">
                  // REAL-TIME SECURITY ALERTS
                </span>

                <div className="space-y-3 font-mono text-[10px]">
                  <div className="flex items-start gap-2 border-b border-slate-900 pb-2">
                    <span className="text-red-400">[CRITICAL]</span>
                    <span className="text-slate-400">Loop flow: ACC_0042 &rarr; shell chain</span>
                  </div>
                  <div className="flex items-start gap-2 border-b border-slate-900 pb-2">
                    <span className="text-amber-400">[HIGH_VEL]</span>
                    <span className="text-slate-400">Deposit spike: ACC_0118 +$4.9M/2h</span>
                  </div>
                  <div className="flex items-start gap-2 pb-1">
                    <span className="text-cyan-400">[ANOMALY]</span>
                    <span className="text-slate-400">Cross-border flow: 8 nested transfers</span>
                  </div>
                </div>
              </div>

              <div className="hud-panel p-4 bg-black/60 backdrop-blur-md font-mono text-[9px] text-slate-500 space-y-1">
                <div>TELEMETRY STATION: CLOUD IN-DEL-01</div>
                <div className="text-green-400">STATE: NETWORK STABLE</div>
              </div>
            </div>
          </div>

          {/* 2. STATS INFO ROW */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-12">
            {[
              { val: '200+', label: 'Accounts Tracked' },
              { val: '2.5K+', label: 'Transactions Analyzed' },
              { val: '18M+', label: 'Flagged Vol ($)' },
              { val: '99%', label: 'True Anomaly Detection' }
            ].map((stat, i) => (
              <div key={i} className="hud-panel p-5 bg-black/60 text-center backdrop-blur-md rounded">
                <div className="font-mono text-2xl font-bold text-cyan-400 mb-1">{stat.val}</div>
                <div className="font-mono text-[10px] text-slate-500 uppercase tracking-widest">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* 3. CAPABILITIES GRID */}
          <div className="space-y-8 pt-12">
            <div className="text-center max-w-2xl mx-auto">
              <span className="font-mono text-[10px] text-cyan-400/50 uppercase tracking-[0.2em] block mb-2">
                // PLATFORM CORE ABILITIES
              </span>
              <h3 className="text-2xl font-bold text-white tracking-tight">
                Forensic intelligence at machine speed
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { title: 'Interactive Graph Paths', icon: '🕸️', desc: 'Trace multi-hop transactions visualised as node relationships. Identify layers and cycle rings immediately.' },
                { title: 'Neural Anomaly Engine', icon: '🧠', desc: 'Continuous machine learning models detect structural anomalies matching classic fraud profiles.' },
                { title: 'Operational Dossier', icon: '📁', desc: 'Instantly construct individual profiles, tracking net cash velocity, counterparts, and timelines.' }
              ].map((feat, i) => (
                <div key={i} className="hud-panel p-6 bg-black/60 backdrop-blur-md rounded">
                  <div className="text-3xl mb-4">{feat.icon}</div>
                  <h4 className="font-mono text-xs font-bold text-cyan-400 uppercase tracking-wider mb-2">{feat.title}</h4>
                  <p className="text-xs text-slate-400 leading-relaxed font-light">{feat.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 4. REFERENCE QUOTE */}
          <div className="hud-panel p-8 bg-black/70 max-w-4xl mx-auto text-center rounded backdrop-blur-md">
            <span className="text-3xl text-cyan-400/20 block mb-2">“</span>
            <p className="text-base text-slate-300 font-light italic leading-relaxed mb-4">
              AURA allows our investigations desk to overlay transactional telemetry instantly, 
              compressing tracking cycles from days to clicks.
            </p>
            <span className="font-mono text-[10px] text-slate-500 uppercase tracking-wider">
              — FINCEN Intelligence Briefing Note
            </span>
          </div>

          {/* 5. CALL TO ACTION BLOCK */}
          <div className="hud-panel p-10 bg-black/70 text-center max-w-3xl mx-auto rounded backdrop-blur-md">
            <span className="font-mono text-[10px] text-cyan-400/50 uppercase tracking-[0.2em] block mb-2">
              // OPERATE SYSTEM
            </span>
            <h4 className="text-2xl font-bold text-white mb-3">Initialize System Authentication</h4>
            <p className="text-xs text-slate-400 mb-6 font-light">
              Enter your credentials to launch the live analytics console.
            </p>
            <button
              onClick={() => navigate('/login')}
              className="font-mono text-xs font-bold uppercase tracking-widest px-10 py-3.5 bg-cyan-400 text-slate-900 hover:bg-cyan-300 transition-all rounded"
            >
              AUTHENTICATE CREDENTIALS
            </button>
          </div>

          {/* 6. STATIC SUBTLE FOOTER */}
          <footer className="w-full flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-800/40 pt-8 font-mono text-[10px] text-slate-600">
            <span>© 2026 AURA INTEL ENGINE · SYSTEM CLEARANCE REQUIRED</span>
            <span>SECURE AES-256 CONTEXT</span>
          </footer>

        </div>
      </div>
    </div>
  );
}
