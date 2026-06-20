import React, { useEffect, useState } from 'react';
import { getRiskProperties } from './RiskBadge';

export default function RiskGauge({ score = 0, size = 150 }) {
  const [offset, setOffset] = useState(251.2);
  const config = getRiskProperties(score);
  
  // R = 40, circum = 251.2
  const r = 40;
  const circumference = 2 * Math.PI * r;

  useEffect(() => {
    const progressOffset = circumference - (score / 100) * circumference;
    const timer = setTimeout(() => {
      setOffset(progressOffset);
    }, 100);
    return () => clearTimeout(timer);
  }, [score, circumference]);

  return (
    <div className="flex flex-col items-center justify-center select-none" style={{ width: size, height: size }}>
      <div className="relative" style={{ width: size, height: size }}>
        {/* Sonar sweep backdrop effect */}
        <div 
          className="absolute inset-2 rounded-full opacity-[0.03] border border-dashed animate-spin"
          style={{ borderColor: varColor(config.hex), animationDuration: '20s' }}
        />
        
        <svg 
          viewBox="0 0 100 100" 
          className="w-full h-full transform -rotate-90 select-none"
        >
          {/* Compass grid lines */}
          <line x1="50" y1="6" x2="50" y2="12" stroke="#1F2836" strokeWidth="0.5" />
          <line x1="50" y1="88" x2="50" y2="94" stroke="#1F2836" strokeWidth="0.5" />
          <line x1="6" y1="50" x2="12" y2="50" stroke="#1F2836" strokeWidth="0.5" />
          <line x1="88" y1="50" x2="94" y2="50" stroke="#1F2836" strokeWidth="0.5" />

          {/* Inner tick indicator ring */}
          <circle
            cx="50"
            cy="50"
            r={r}
            stroke="#1F2836"
            strokeWidth="4"
            fill="transparent"
            strokeDasharray="2 4"
          />

          {/* Active colored progress ring */}
          <circle
            cx="50"
            cy="50"
            r={r}
            stroke={config.hex}
            strokeWidth="3"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="square"
            fill="transparent"
            className="transition-all duration-1000 ease-out"
            style={{ filter: `drop-shadow(0 0 1.5px ${config.hex}60)` }}
          />
        </svg>

        {/* Center Text displaying status */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="font-mono text-2xl font-bold tracking-tighter text-white leading-none">
            {score.toString().padStart(3, '0')}
          </span>
          <span 
            className="text-[8px] tracking-widest font-mono uppercase mt-1 font-bold"
            style={{ color: config.hex }}
          >
            {config.text}
          </span>
        </div>

        {/* Tactical orientation markers */}
        <span className="absolute top-1 left-1/2 transform -translate-x-1/2 text-[6px] font-mono text-aura-textMuted">000</span>
        <span className="absolute bottom-1 left-1/2 transform -translate-x-1/2 text-[6px] font-mono text-aura-textMuted">180</span>
        <span className="absolute left-1 top-1/2 transform -translate-y-1/2 text-[6px] font-mono text-aura-textMuted">270</span>
        <span className="absolute right-1 top-1/2 transform -translate-y-1/2 text-[6px] font-mono text-aura-textMuted">090</span>
      </div>
    </div>
  );
}

// helper to handle hex colors in standard CSS styles
function varColor(hex) {
  return hex;
}
