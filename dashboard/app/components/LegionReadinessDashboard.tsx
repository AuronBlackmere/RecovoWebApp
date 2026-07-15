'use client';

import { AthleteCard } from './AthleteCard';
import { ReadinessRingWeb } from './ReadinessRingWeb';
import { getReadinessLevel, READINESS_COLORS, calculateReadiness, type AthleteRoster } from '../lib/types';
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';

interface Props {
  athletes: AthleteRoster[];
  selectedAthlete: AthleteRoster | null;
  onSelectAthlete: (a: AthleteRoster | null) => void;
}

export function LegionReadinessDashboard({ athletes, selectedAthlete, onSelectAthlete }: Props) {
  // Sort: critical first
  const sorted = [...athletes].sort((a, b) => a.readiness - b.readiness);

  const readinessDistribution = [
    { label: 'ELITE', count: athletes.filter((a) => a.readiness >= 85).length, color: '#4ADE80' },
    { label: 'HIGH', count: athletes.filter((a) => a.readiness >= 70 && a.readiness < 85).length, color: '#3B82F6' },
    { label: 'MOD', count: athletes.filter((a) => a.readiness >= 55 && a.readiness < 70).length, color: '#FCD34D' },
    { label: 'LOW', count: athletes.filter((a) => a.readiness >= 40 && a.readiness < 55).length, color: '#F97316' },
    { label: 'CRIT', count: athletes.filter((a) => a.readiness < 40).length, color: '#F87171' },
  ];

  const athlete = selectedAthlete;
  const radarData = athlete?.latestStatus
    ? [
        { metric: 'MOOD', value: (athlete.latestStatus.mood / 5) * 100 },
        { metric: 'ENERGY', value: (athlete.latestStatus.energy / 5) * 100 },
        { metric: 'SLEEP', value: (athlete.latestStatus.sleepQuality / 5) * 100 },
        { metric: 'RECOVERY', value: athlete.latestRecovery?.recoveryScore ?? 0 },
        { metric: 'READINESS', value: athlete.readiness },
      ]
    : [];

  const tooltipStyle = {
    backgroundColor: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    fontFamily: 'var(--font-ibm-mono)',
    fontSize: 11,
    color: 'var(--text1)',
  };

  return (
    <div className="grid grid-cols-12 gap-6">
      {/* Roster grid - left */}
      <div className="col-span-12 lg:col-span-7 space-y-4">
        {/* Readiness distribution bar */}
        <div className="card">
          <p className="card-lbl">TEAM READINESS DISTRIBUTION</p>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={readinessDistribution} barSize={32}>
                <XAxis
                  dataKey="label"
                  tick={{ fontFamily: 'var(--font-ibm-mono)', fontSize: 9, fill: 'var(--text3)', letterSpacing: 1 }}
                  axisLine={false} tickLine={false}
                />
                <YAxis hide />
                <Tooltip
                  contentStyle={tooltipStyle}
                  cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {readinessDistribution.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Athlete cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {sorted.length === 0 ? (
            <div className="col-span-2 card text-center" style={{ padding: '40px 24px' }}>
              <p className="font-display text-2xl tracking-widest" style={{ color: 'var(--text3)' }}>
                NO ATHLETES YET
              </p>
              <p className="font-mono text-xs mt-2" style={{ color: 'var(--text3)' }}>
                Share your invite code to start building your roster.
              </p>
            </div>
          ) : (
            sorted.map((a) => (
              <AthleteCard
                key={a.profile.uid}
                athlete={a}
                selected={selectedAthlete?.profile.uid === a.profile.uid}
                onClick={() => onSelectAthlete(
                  selectedAthlete?.profile.uid === a.profile.uid ? null : a
                )}
              />
            ))
          )}
        </div>
      </div>

      {/* Detail panel - right */}
      <div className="col-span-12 lg:col-span-5 space-y-4">
        {athlete ? (
          <>
            {/* Athlete detail header */}
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="card-lbl">ATHLETE DETAIL</p>
                  <h2 className="font-display text-3xl tracking-widest mt-1" style={{ color: 'var(--text1)' }}>
                    {athlete.profile.name.toUpperCase()}
                  </h2>
                  <p className="font-mono text-xs tracking-widest" style={{ color: 'var(--accent)' }}>
                    {athlete.profile.sport}
                  </p>
                </div>
                <ReadinessRingWeb score={athlete.readiness} size={96} strokeWidth={8} />
              </div>

              {/* Radar chart */}
              {radarData.length > 0 && (
                <div className="h-48 mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="var(--border)" />
                      <PolarAngleAxis
                        dataKey="metric"
                        tick={{ fontFamily: 'var(--font-ibm-mono)', fontSize: 8, fill: 'var(--text3)', letterSpacing: 1 }}
                      />
                      <Radar
                        dataKey="value"
                        stroke="var(--accent)"
                        fill="var(--accent)"
                        fillOpacity={0.15}
                        strokeWidth={1.5}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Daily status detail */}
            {athlete.latestStatus && (
              <div className="card">
                <p className="card-lbl">TODAY'S SELF-REPORT</p>
                <div className="space-y-3">
                  {[
                    { label: 'MOOD', val: athlete.latestStatus.mood, max: 5, color: 'var(--accent)' },
                    { label: 'ENERGY', val: athlete.latestStatus.energy, max: 5, color: 'var(--green)' },
                    { label: 'STRESS', val: athlete.latestStatus.stress, max: 5, color: 'var(--red)' },
                    { label: 'SLEEP QUALITY', val: athlete.latestStatus.sleepQuality, max: 5, color: 'var(--blue)' },
                  ].map(({ label, val, max, color }) => (
                    <div key={label}>
                      <div className="flex justify-between mb-1">
                        <span className="stat-label">{label}</span>
                        <span className="font-mono text-[10px]" style={{ color }}>{val}/{max}</span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg3)' }}>
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${(val / max) * 100}%`, backgroundColor: color }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                {athlete.latestStatus.notes && (
                  <div className="mt-4 p-3 rounded-lg" style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}>
                    <p className="stat-label mb-1">ATHLETE NOTE</p>
                    <p className="font-body text-xs leading-relaxed" style={{ color: 'var(--text2)' }}>
                      {athlete.latestStatus.notes}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Active injuries */}
            {athlete.activeInjuries.filter((i) => !i.resolved).length > 0 && (
              <div className="card">
                <p className="card-lbl">ACTIVE PAIN FLAGS</p>
                <div className="space-y-2">
                  {athlete.activeInjuries.filter((i) => !i.resolved).map((inj, i) => {
                    const c = { sharp: '#F87171', dull: '#FCD34D', burning: '#F97316', aching: '#A78BFA' }[inj.painType];
                    return (
                      <div key={i} className="flex items-center gap-3 p-2 rounded-lg" style={{ background: 'var(--bg3)' }}>
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: c }} />
                        <div className="flex-1">
                          <p className="font-body text-xs" style={{ color: 'var(--text1)' }}>{inj.bodyPart}</p>
                          <p className="font-mono text-[9px] tracking-wider" style={{ color: c }}>
                            {inj.painType.toUpperCase()}
                          </p>
                        </div>
                        <span className="font-display text-xl" style={{ color: c }}>{inj.intensity}</span>
                        <span className="font-mono text-[9px]" style={{ color: 'var(--text3)' }}>/10</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="card flex flex-col items-center justify-center text-center gap-4 h-80">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
              style={{ border: '1px solid var(--border)', color: 'var(--text3)' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                <path d="M22 21v-2a4 4 0 0 0-1.5-3.1"/><path d="M16 3.13a4 4 0 0 1 0 7.74"/>
              </svg>
            </div>
            <p className="font-display text-xl tracking-widest" style={{ color: 'var(--text3)' }}>
              SELECT AN ATHLETE
            </p>
            <p className="font-mono text-xs" style={{ color: 'var(--text3)' }}>
              Click any card to view full status details
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
