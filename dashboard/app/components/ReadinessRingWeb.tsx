'use client';

import { useEffect, useRef, useState } from 'react';
import { getReadinessLevel, READINESS_COLORS } from '../lib/types';

interface Props {
  score: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export function ReadinessRingWeb({ score, size = 120, strokeWidth = 10, className = '' }: Props) {
  const [animatedScore, setAnimatedScore] = useState(0);
  const level = getReadinessLevel(score);
  const color = READINESS_COLORS[level];
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (animatedScore / 100) * circumference;

  useEffect(() => {
    let frame: number;
    let current = 0;
    const step = () => {
      current = Math.min(current + 2, score);
      setAnimatedScore(current);
      if (current < score) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [score]);

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="var(--border)" strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.05s linear', filter: `drop-shadow(0 0 6px ${color}60)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-2xl leading-none" style={{ color }}>{animatedScore}</span>
        <span className="font-mono text-[8px] tracking-widest mt-0.5" style={{ color }}>{level}</span>
      </div>
    </div>
  );
}
