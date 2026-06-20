import React, { useEffect, useState } from 'react';
import { getRiskProperties } from './RiskBadge';

export default function RiskGauge({ score = 0, size = 150 }) {
  const [offset, setOffset] = useState(251.2);
  const config = getRiskProperties(score);
  
  // R = 40, circum = 251.2
  const r = 40;
  const circumference = 2 * Math.PI * r;

  useEffect(() => {
    // Animate the dial progress on load
    const progressOffset = circumference - (score / 100) * circumference;
    const timer = setTimeout(() => {
      setOffset(progressOffset);
    }, 100);
    return () => clearTimeout(timer);
  }, [score, circumference]);

  return (
    <div className="flex flex-col items-center justify-center select-none" style={{ width: size, height: size }}>
      <div className="relative" style={{ width: size, height: size }}>
        {/* Glow backdrop ring */}
        <div 
          className="absolute inset-0 rounded-full opacity-10 blur-xl transition-all duration-1000"
          style={{ backgroundColor: config.hex }}
        />
        
        <svg 
          viewBox="0 0 100 100" 
          className="w-full h-full transform -rotate-90 select-none"
        >
          {/* Inner grey track */}
          <circle
            cx="50"
            cy="50"
            r={r}
            stroke="#21262D"
            strokeWidth="6"
            fill="transparent"
            className="transition-colors duration-500"
          />
          {/* Active colored progress ring */}
          <circle
            cx="50"
            cy="50"
            r={r}
            stroke={config.hex}
            strokeWidth="6"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            fill="transparent"
            className="transition-all duration-1000 ease-out"
            style={{ filter: `drop-shadow(0 0 2px ${config.hex}80)` }}
          />
        </svg>

        {/* Center Text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="font-mono text-3xl font-bold tracking-tight text-white leading-none">
            {score}
          </span>
          <span 
            className="text-[10px] tracking-wider uppercase font-semibold mt-1"
            style={{ color: config.hex }}
          >
            {config.text.split(' ')[0]}
          </span>
        </div>
      </div>
    </div>
  );
}
