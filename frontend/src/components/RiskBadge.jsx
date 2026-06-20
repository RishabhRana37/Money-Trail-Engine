import React from 'react';

export function getRiskProperties(levelOrScore) {
  let level = 'low';
  let score = null;

  if (typeof levelOrScore === 'number') {
    score = levelOrScore;
    if (score >= 90) level = 'critical';
    else if (score >= 70) level = 'high';
    else if (score >= 40) level = 'medium';
    else level = 'low';
  } else {
    level = levelOrScore?.toLowerCase() || 'low';
  }

  const configs = {
    low: {
      text: 'LOW',
      bg: 'bg-emerald-950/20',
      border: 'border-emerald-500/40',
      textColor: 'text-emerald-400',
      bullet: 'bg-emerald-400',
      hex: '#0F9960'
    },
    medium: {
      text: 'MEDIUM',
      bg: 'bg-amber-950/20',
      border: 'border-amber-500/40',
      textColor: 'text-amber-400',
      bullet: 'bg-amber-400',
      hex: '#FFAE00'
    },
    high: {
      text: 'HIGH',
      bg: 'bg-orange-950/20',
      border: 'border-orange-500/40',
      textColor: 'text-orange-400',
      bullet: 'bg-orange-400',
      hex: '#FF7300'
    },
    critical: {
      text: 'CRITICAL',
      bg: 'bg-red-950/20',
      border: 'border-red-500/40',
      textColor: 'text-red-400',
      bullet: 'bg-red-400 animate-pulse',
      hex: '#FF3B30'
    }
  };

  return configs[level] || configs.low;
}

export default function RiskBadge({ level, score, showScore = true }) {
  const value = score !== undefined ? score : level;
  const config = getRiskProperties(value);
  const displayScore = score !== undefined ? `:${score}` : '';

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 border rounded-none font-mono text-[10px] tracking-wider uppercase select-none ${config.bg} ${config.border} ${config.textColor}`}>
      <span className={`w-1.5 h-1.5 rounded-none ${config.bullet}`}></span>
      <span>[LVL_{config.text}{displayScore}]</span>
    </span>
  );
}
