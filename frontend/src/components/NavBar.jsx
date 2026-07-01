import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { getStats } from '../api';

export default function NavBar() {
  const [isLive, setIsLive] = useState(false);

  const checkStatus = async () => {
    try {
      await getStats();
      setIsLive(true);
    } catch (err) {
      setIsLive(false);
    }
  };

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  const activeClass = "flex items-center gap-2 px-4 py-2 text-xs font-mono font-bold text-aura-accent border-b-2 border-aura-accent bg-aura-accent/5 transition-all";
  const inactiveClass = "flex items-center gap-2 px-4 py-2 text-xs font-mono font-bold text-aura-textMuted border-b-2 border-transparent hover:text-aura-textLight hover:border-aura-border transition-all";

  return (
    <div className="flex items-center flex-1 justify-between">
      {/* Links */}
      <nav className="flex h-14">
        <NavLink to="/" className={({ isActive }) => isActive ? activeClass : inactiveClass}>
          Dashboard
        </NavLink>
        <NavLink to="/alerts" className={({ isActive }) => isActive ? activeClass : inactiveClass}>
          Alerts
        </NavLink>
      </nav>

      {/* Connection Indicator */}
      <div className="flex items-center gap-1.5 px-3 py-1 bg-black/40 border border-aura-border/40 font-mono text-[10px]">
        <span className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-emerald-500 animate-pulse' : 'bg-red-500 animate-pulse'}`} />
        <span className={isLive ? 'text-emerald-500' : 'text-red-500'}>
          {isLive ? 'Live' : 'Offline'}
        </span>
      </div>
    </div>
  );
}
