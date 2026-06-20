import React from 'react';
import { NavLink } from 'react-router-dom';

export default function Header({ currentDataset, onResetDataset, isGenerating }) {
  const activeClass = "flex items-center gap-2 px-4 py-2 text-sm font-medium text-aura-accent border-b-2 border-aura-accent bg-aura-accent/5 transition-all";
  const inactiveClass = "flex items-center gap-2 px-4 py-2 text-sm font-medium text-aura-textMuted border-b-2 border-transparent hover:text-aura-textLight hover:border-aura-border transition-all";

  return (
    <header className="border-b border-aura-border bg-aura-panel/85 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-gradient-to-tr from-aura-indigo to-aura-accent flex items-center justify-center font-mono font-bold text-black text-lg shadow-[0_0_15px_rgba(0,240,255,0.4)]">
              A
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-sans font-bold text-white tracking-wide text-lg">AURA</span>
                <span className="text-[10px] bg-aura-accent/15 text-aura-accent border border-aura-accent/30 px-1.5 py-0.2 rounded font-mono uppercase tracking-wider">
                  Investigator Console
                </span>
              </div>
              <p className="text-[10px] text-aura-textMuted font-mono">Anti-Money-Laundering Analytics</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex h-16">
            <NavLink to="/" className={({ isActive }) => isActive ? activeClass : inactiveClass}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4zM14 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2v-4z" />
              </svg>
              Dashboard
            </NavLink>
            <NavLink to="/graph" className={({ isActive }) => isActive ? activeClass : inactiveClass}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L16 4m0 13V4m0 0L9 7" />
              </svg>
              Money Trail Graph
            </NavLink>
            <NavLink to="/alerts" className={({ isActive }) => isActive ? activeClass : inactiveClass}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Alert Feed
            </NavLink>
          </nav>

          {/* Right Section: System info */}
          <div className="flex items-center gap-4">
            <div className="hidden md:flex flex-col items-end">
              <span className="text-[10px] text-aura-textMuted font-mono">ACTIVE DATASET</span>
              <span className="text-xs font-mono font-bold text-aura-accent select-none">{currentDataset}</span>
            </div>
            
            <button
              onClick={onResetDataset}
              disabled={isGenerating}
              className={`px-3 py-1.5 rounded bg-aura-panelLight border border-aura-border text-xs font-medium text-white hover:bg-aura-border hover:border-aura-textMuted active:scale-95 transition-all flex items-center gap-2 ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isGenerating ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Initializing...
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.228 10H18.22" />
                  </svg>
                  Reset Demo
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
