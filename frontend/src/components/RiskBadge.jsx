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
      bg: 'bg-[#3FB950]/10',
      border: 'border-[#3FB950]/40',
      textColor: 'text-[#3FB950]',
      bullet: 'bg-[#3FB950]',
      hex: '#3FB950'
    },
    medium: {
      text: 'MEDIUM',
      bg: 'bg-[#D29922]/10',
      border: 'border-[#D29922]/40',
      textColor: 'text-[#D29922]',
      bullet: 'bg-[#D29922]',
      hex: '#D29922'
    },
    high: {
      text: 'HIGH',
      bg: 'bg-[#F0883E]/10',
      border: 'border-[#F0883E]/40',
      textColor: 'text-[#F0883E]',
      bullet: 'bg-[#F0883E]',
      hex: '#F0883E'
    },
    critical: {
      text: 'CRITICAL',
      bg: 'bg-[#E24B4A]/10',
      border: 'border-[#E24B4A]/40',
      textColor: 'text-[#E24B4A]',
      bullet: 'bg-[#E24B4A] animate-pulse',
      hex: '#E24B4A'
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
