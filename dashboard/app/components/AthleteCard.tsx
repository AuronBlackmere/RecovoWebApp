'use client';

import { ReadinessRingWeb } from './ReadinessRingWeb';
import { getReadinessLevel, READINESS_COLORS, type AthleteRoster } from '../lib/types';

const PAIN_COLORS: Record<string, string> = {
  sharp: '#F87171',
  dull: '#FCD34D',
  burning: '#F97316',
  aching: '#A78BFA',
};

interface Props {
  athlete: AthleteRoster;
  selected?: boolean;
  onClick: () => void;
}

export function AthleteCard({ athlete, selected, onClick }: Props) {
  const level = getReadinessLevel(athlete.readiness);
  const color = READINESS_COLORS[level];
  const status = athlete.latestStatus;
  const activeInjuries = athlete.activeInjuries.filter((i) => !i.resolved);

  return (
    <button
      onClick={onClick}
      className="card w-full text-left"
      style={{
        borderColor: selected ? 'var(--accent)' : 'var(--border)',
        background: selected ? 'rgba(249,115,22,0.06)' : 'var(--surface)',
        boxShadow: selected ? '0 0 0 1px var(--accent), 0 4px 16px rgba(249,115,22,0.1)' : undefined,
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-body font-semibold text-sm leading-tight" style={{ color: 'var(--text1)' }}>
            {athlete.profile.name}
          </p>
          <p className="font-mono text-[9px] tracking-wider mt-0.5" style={{ color: 'var(--text2)' }}>
            {athlete.profile.sport?.toUpperCase()}
          </p>
        </div>
        <ReadinessRingWeb score={athlete.readiness} size={64} strokeWidth={6} />
      </div>

      {/* Status badges */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {status && (
          <>
            <StatusBadge label="MOOD" value={status.mood} max={5} />
            <StatusBadge label="ENERGY" value={status.energy} max={5} color="var(--green)" />
            <StatusBadge label="STRESS" value={status.stress} max={5} color="var(--red)" invertGood />
          </>
        )}
      </div>

      {/* Active injuries */}
      {activeInjuries.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {activeInjuries.slice(0, 3).map((inj, i) => (
            <span
              key={i}
              className="chip"
              style={{
                backgroundColor: (PAIN_COLORS[inj.painType] || '#888') + '18',
                color: PAIN_COLORS[inj.painType] || '#888',
                borderColor: (PAIN_COLORS[inj.painType] || '#888') + '40',
                fontSize: '8px',
                padding: '2px 7px',
              }}
            >
              {inj.bodyPart}
            </span>
          ))}
          {activeInjuries.length > 3 && (
            <span className="font-mono text-[8px]" style={{ color: 'var(--text3)' }}>
              +{activeInjuries.length - 3} more
            </span>
          )}
        </div>
      )}

      {/* HRV / RHR mini */}
      {athlete.latestRecovery && (
        <div className="flex gap-3 mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
          {[
            { label: 'HRV', val: athlete.latestRecovery.hrv, unit: 'ms' },
            { label: 'RHR', val: athlete.latestRecovery.rhr, unit: 'bpm' },
            { label: 'SLEEP', val: athlete.latestRecovery.sleepHours, unit: 'h' },
          ].map(({ label, val, unit }) => (
            <div key={label} className="flex-1 text-center">
              <p className="stat-label">{label}</p>
              <p className="font-display text-base leading-tight" style={{ color: 'var(--text1)' }}>
                {val}<span className="font-mono text-[9px] ml-0.5" style={{ color: 'var(--text2)' }}>{unit}</span>
              </p>
            </div>
          ))}
        </div>
      )}

      {!status && !athlete.latestRecovery && (
        <p className="font-mono text-[10px] text-center py-1" style={{ color: 'var(--text3)' }}>
          No data logged today
        </p>
      )}
    </button>
  );
}

function StatusBadge({ label, value, max, color = 'var(--accent)', invertGood = false }: {
  label: string; value: number; max: number; color?: string; invertGood?: boolean;
}) {
  const pct = (value / max) * 100;
  const good = invertGood ? pct < 60 : pct >= 60;
  const finalColor = good ? color : 'var(--text3)';
  return (
    <span
      className="chip"
      style={{
        backgroundColor: `color-mix(in srgb, ${finalColor} 12%, transparent)`,
        color: finalColor,
        borderColor: `color-mix(in srgb, ${finalColor} 25%, transparent)`,
        fontSize: '8px',
        padding: '2px 7px',
      }}
    >
      {label} {value}/{max}
    </span>
  );
}
