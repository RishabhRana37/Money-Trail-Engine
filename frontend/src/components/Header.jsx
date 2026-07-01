import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import NavBar from './NavBar';

export default function Header({ currentDataset, onResetDataset, isGenerating }) {
  const [sysTime, setSysTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      const yr = d.getUTCFullYear();
      const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
      const dy = String(d.getUTCDate()).padStart(2, '0');
      const hr = String(d.getUTCHours()).padStart(2, '0');
      const mi = String(d.getUTCMinutes()).padStart(2, '0');
      const sc = String(d.getUTCSeconds()).padStart(2, '0');
      setSysTime(`${yr}-${mo}-${dy} ${hr}:${mi}:${sc} UTC`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="border-b border-aura-border bg-aura-panel/90 backdrop-blur-md sticky top-0 z-40 select-none">
      {/* Upper tiny status strip */}
      <div className="bg-black/40 border-b border-aura-border/40 px-4 py-1 flex items-center justify-between text-[8px] font-mono text-aura-textMuted tracking-widest">
        <div className="flex items-center gap-4">
          <span>[LOC: 28.6143° N, 77.2037° E]</span>
          <span className="text-emerald-500 flex items-center gap-1">
            <span className="w-1 h-1 bg-emerald-500 rounded-none animate-ping" />
            SECURE_LINK_STABLE
          </span>
        </div>
        <div>
          <span>[SYS_CLOCK: {sysTime}]</span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Logo & coordinates & Home Button */}
          <div className="flex items-center gap-3">
            <Link
              to="/landing"
              className="w-7 h-7 border border-aura-accent/40 text-aura-accent hover:bg-aura-accent/15 hover:text-white hover:shadow-[0_0_10px_rgba(0,240,255,0.35)] active:scale-95 duration-200 transition-all flex items-center justify-center rounded-none"
              title="Return to Landing"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
            </Link>

            <div className="w-7 h-7 rounded-none bg-aura-accent flex items-center justify-center font-mono font-bold text-black text-sm shadow-[0_0_10px_rgba(0,240,255,0.3)]">
              A
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-mono font-bold text-white tracking-widest text-base">AURA</span>
                <span className="text-[8px] border border-aura-border px-1 py-0.2 font-mono text-aura-textMuted">
                  DECISION_DECK
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Bar */}
          <NavBar />

          {/* Right Controls */}
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col items-end text-right">
              <span className="text-[8px] text-aura-textMuted font-mono">D_SET_REF</span>
              <span className="text-xs font-mono font-bold text-white">{currentDataset}</span>
            </div>
            
            <button
              onClick={onResetDataset}
              disabled={isGenerating}
              className={`px-3 py-1 bg-black hover:bg-aura-panelLight border border-aura-border text-[10px] font-mono font-bold text-white active:scale-95 transition-all flex items-center gap-1.5 ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isGenerating ? (
                <>
                  <svg className="animate-spin h-3 w-3 text-aura-accent" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  SEEDING...
                </>
              ) : (
                <>
                  <svg className="w-3 h-3 text-aura-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.228 10H18.22" />
                  </svg>
                  REBUILD_DB
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
