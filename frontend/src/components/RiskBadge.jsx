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
      text: 'Low Risk',
      bg: 'bg-aura-low/10',
      border: 'border-aura-low/30',
      textColor: 'text-aura-low',
      bullet: 'bg-aura-low',
      hex: '#3FB950'
    },
    medium: {
      text: 'Medium Risk',
      bg: 'bg-aura-medium/10',
      border: 'border-aura-medium/30',
      textColor: 'text-aura-medium',
      bullet: 'bg-aura-medium',
      hex: '#D29922'
    },
    high: {
      text: 'High Risk',
      bg: 'bg-aura-high/10',
      border: 'border-aura-high/30',
      textColor: 'text-aura-high',
      bullet: 'bg-aura-high',
      hex: '#F0883E'
    },
    critical: {
      text: 'Critical Risk',
      bg: 'bg-aura-critical/10',
      border: 'border-aura-critical/30',
      textColor: 'text-aura-critical',
      bullet: 'bg-aura-critical animate-pulse',
      hex: '#F85149'
    }
  };

  return configs[level] || configs.low;
}

export default function RiskBadge({ level, score, showScore = true }) {
  const value = score !== undefined ? score : level;
  const config = getRiskProperties(value);
  const displayScore = score !== undefined ? `(${score})` : '';

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.bg} ${config.border} ${config.textColor}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.bullet}`}></span>
      <span>{config.text} {showScore && displayScore}</span>
    </span>
  );
}
