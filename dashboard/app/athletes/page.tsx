'use client';

import React, { useState, useEffect } from 'react';
import { ref, onValue, get } from 'firebase/database';
import { db } from '../lib/firebase';
import { Sidebar } from '../components/Sidebar';
import type { UserProfile, DailyStatus, RecoveryEntry, PainMarker, AthleteRoster, Legion } from '../lib/types';
import { calculateReadiness } from '../lib/types';
import { format } from 'date-fns';

/* ═══════════════════════════════════════════════════════════
   SVG ICON SYSTEM — inline Lucide-style icons, no emoji
═══════════════════════════════════════════════════════════ */
const ICONS: Record<string, React.ReactNode> = {
  dashboard:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  tracks:       <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h4l3-9 4 18 3-9h4"/></svg>,
  recovery:     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a10 10 0 1 0 10 10"/><path d="M22 2 12 12"/></svg>,
  injuries:     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12h6"/><path d="M12 9v6"/><circle cx="12" cy="12" r="10"/></svg>,
  daily:        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>,
  legion:       <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  devices:      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/></svg>,
  readiness:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>,
  athletes:     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-1.5-3.1"/><path d="M16 3.13a4 4 0 0 1 0 7.74"/></svg>,
  profile:      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  settings:     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/></svg>,
  barChart:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" x2="12" y1="20" y2="10"/><line x1="18" x2="18" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="16"/></svg>,
  help:         <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>,
};

function Icon({ name, size = 16, color = "currentColor", style = {} }: { name: string; size?: number; color?: string; style?: React.CSSProperties }) {
  const base = ICONS[name];
  if (!base) return null;
  return React.cloneElement(base as React.ReactElement, {
    width: size, height: size,
    style: { color, flexShrink: 0, ...style },
    "aria-hidden": true,
  });
}

function StatusDot({ status, size = 7 }: { status: string; size?: number }) {
  const colors: Record<string, string> = { active: "#22C55E", connected: "#22C55E", error: "#EF4444", disconnected: "#EF4444", pending: "#F59E0B", syncing: "#F59E0B", offline: "#D4D4D4", default: "#D4D4D4" };
  const color = colors[status] || colors.default;
  const pulse = ["active","connected","syncing"].includes(status);
  return (
    <span style={{ display: "inline-block", width: size, height: size, borderRadius: "50%", background: color, flexShrink: 0, animation: pulse ? "pulse 2s infinite" : "none" }} />
  );
}

function getTier(score: number | null | undefined) {
  if (score == null) return { label: "—", cls: "tier-mod", color: "#D4D4D4" };
  if (score >= 85) return { label: "ELITE READY", cls: "tier-elite", color: "#22C55E" };
  if (score >= 65) return { label: "READY", cls: "tier-ready", color: "#FFD600" };
  if (score >= 45) return { label: "MODERATE", cls: "tier-mod", color: "#F59E0B" };
  if (score >= 25) return { label: "LOW", cls: "tier-low", color: "#F97316" };
  return { label: "CRITICAL", cls: "tier-critical", color: "#EF4444" };
}

function inits(name: string) {
  return (name || "?").split(" ").map(w => w[0]).join("").substring(0, 2).toUpperCase();
}

function Spin({ dark }: { dark?: boolean }) {
  return <div className={`spinner${dark ? " spinner-dark" : ""}`} />;
}

interface RingProps {
  score: number | null | undefined;
  size?: number;
  stroke?: number;
}

function Ring({ score, size = 120, stroke = 8 }: RingProps) {
  if (score == null) return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: "var(--bg3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 10, color: "var(--text3)" }}>—</span>
    </div>
  );
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const t = getTier(score);
  return (
    <div className="ring-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F0F0F0" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={t.color} strokeWidth={stroke}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" style={{ transition: "stroke-dasharray 1s ease" }} />
      </svg>
      <div className="ring-center">
        <div className="ring-score" style={{ fontSize: size > 100 ? 36 : size > 60 ? 18 : 13, color: t.color }}>{score}</div>
        <div className="ring-lbl" style={{ fontSize: size > 100 ? 8 : 7 }}>READY</div>
      </div>
    </div>
  );
}

interface RadarChartProps {
  data: Record<string, number>;
  size?: number;
}

function RadarChart({ data, size = 200 }: RadarChartProps) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 22;
  const keys = Object.keys(data);
  const n = keys.length;
  const ang = (2 * Math.PI) / n;
  const pt = (i: number, val: number) => {
    const a = ang * i - Math.PI / 2;
    const rv = r * (val / 100);
    return [cx + rv * Math.cos(a), cy + rv * Math.sin(a)];
  };
  const gp = (i: number, p: number) => {
    const a = ang * i - Math.PI / 2;
    return [cx + r * p * Math.cos(a), cy + r * p * Math.sin(a)];
  };
  const grids = [0.25, 0.5, 0.75, 1].map(p => keys.map((_, i) => gp(i, p)).map(([x, y]) => `${x},${y}`).join(" "));
  const dpts = keys.map((_, i) => pt(i, data[keys[i]] || 0));
  return (
    <svg width={size} height={size}>
      {grids.map((pts, gi) => <polygon key={gi} points={pts} fill="none" stroke="#EBEBEB" strokeWidth="1" />)}
      {keys.map((_, i) => {
        const [x2, y2] = gp(i, 1);
        return <line key={i} x1={cx} y1={cy} x2={x2} y2={y2} stroke="#EBEBEB" strokeWidth={1} />;
      })}
      <polygon points={dpts.map(([x, y]) => `${x},${y}`).join(" ")} fill="rgba(255,214,0,0.15)" stroke="#FFD600" strokeWidth={2} />
      {dpts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={4} fill="#111" />)}
      {keys.map((k, i) => {
        const [x, y] = gp(i, 1.25);
        return <text key={i} x={x} y={y} textAnchor="middle" dominantBaseline="middle" style={{ fill: "#999", fontSize: 9, fontFamily: "'IBM Plex Mono'" }}>{k}</text>;
      })}
    </svg>
  );
}

function Empty({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="empty-state">
      <div className="empty-icon"><Icon name={icon} size={40} color="var(--text3)" /></div>
      <div className="empty-title">{title}</div>
      <div className="empty-desc">{desc}</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   RESILIENT MOCK DATA FALLBACKS (For Offline/Dev Testing)
═══════════════════════════════════════════════════════════ */
const MOCK_ATHLETES: AthleteRoster[] = [
  {
    profile: { uid: "a1", name: "Sarah Jenkins", email: "sarah@recovo.com", role: "athlete", sport: "Running", createdAt: Date.now() },
    latestRecovery: { uid: "a1", date: Date.now(), hrv: 82, rhr: 58, sleepHours: 8.2, sleepQuality: 85, recoveryScore: 90, readinessScore: 88, painScore: 10 },
    latestStatus: { uid: "a1", date: Date.now(), mood: 5, energy: 4, stress: 2, sleepQuality: 5 },
    activeInjuries: [],
    readiness: 88
  },
  {
    profile: { uid: "a2", name: "Marcus Thompson", email: "marcus@recovo.com", role: "athlete", sport: "Basketball", createdAt: Date.now() },
    latestRecovery: { uid: "a2", date: Date.now(), hrv: 68, rhr: 64, sleepHours: 7.0, sleepQuality: 70, recoveryScore: 75, readinessScore: 70, painScore: 25 },
    latestStatus: { uid: "a2", date: Date.now(), mood: 4, energy: 3, stress: 3, sleepQuality: 4 },
    activeInjuries: [{ uid: "a2", bodyPart: "l_ankle", painType: "dull", intensity: 30, resolved: false, timestamp: Date.now() }],
    readiness: 70
  },
  {
    profile: { uid: "a3", name: "Elena Rostova", email: "elena@recovo.com", role: "athlete", sport: "Swimming", createdAt: Date.now() },
    latestRecovery: { uid: "a3", date: Date.now(), hrv: 95, rhr: 52, sleepHours: 9.0, sleepQuality: 90, recoveryScore: 95, readinessScore: 92, painScore: 5 },
    latestStatus: { uid: "a3", date: Date.now(), mood: 5, energy: 5, stress: 1, sleepQuality: 5 },
    activeInjuries: [],
    readiness: 92
  }
];

const MOCK_HISTORY: RecoveryEntry[] = [
  { uid: "a1", date: Date.now() - 5 * 86400000, hrv: 75, rhr: 62, sleepHours: 7.8, sleepQuality: 80, recoveryScore: 82, readinessScore: 78, painScore: 20 },
  { uid: "a1", date: Date.now() - 4 * 86400000, hrv: 78, rhr: 60, sleepHours: 8.0, sleepQuality: 80, recoveryScore: 85, readinessScore: 82, painScore: 15 },
  { uid: "a1", date: Date.now() - 3 * 86400000, hrv: 80, rhr: 59, sleepHours: 8.1, sleepQuality: 82, recoveryScore: 87, readinessScore: 84, painScore: 12 },
  { uid: "a1", date: Date.now() - 2 * 86400000, hrv: 79, rhr: 59, sleepHours: 8.0, sleepQuality: 80, recoveryScore: 86, readinessScore: 83, painScore: 14 },
  { uid: "a1", date: Date.now() - 1 * 86400000, hrv: 82, rhr: 58, sleepHours: 8.2, sleepQuality: 85, recoveryScore: 90, readinessScore: 88, painScore: 10 },
];

export default function AthletesPage() {
  const [athletes, setAthletes] = useState<AthleteRoster[]>([]);
  const [sel, setSel] = useState<AthleteRoster | null>(null);
  const [athleteHistory, setAthleteHistory] = useState<RecoveryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Load roster
  useEffect(() => {
    const legionsRef = ref(db, 'legions');

    // Resilient timeout fallback
    const fallbackTimer = setTimeout(() => {
      if (loading) {
        console.warn("Firebase roster load timed out. Using mock fallback data.");
        setAthletes(MOCK_ATHLETES);
        setSel(MOCK_ATHLETES[0]);
        setLoading(false);
      }
    }, 2000);

    const unsub = onValue(legionsRef, async (snap) => {
      clearTimeout(fallbackTimer);
      if (!snap.exists()) {
        setAthletes(MOCK_ATHLETES);
        setSel(MOCK_ATHLETES[0]);
        setLoading(false);
        return;
      }
      try {
        const legionsData = snap.val() as Record<string, Legion>;
        const firstLegion = Object.values(legionsData)[0];
        const athleteUids = Object.keys(firstLegion.athleteUids ?? {});

        if (athleteUids.length === 0) {
          setAthletes(MOCK_ATHLETES);
          setSel(MOCK_ATHLETES[0]);
          setLoading(false);
          return;
        }

        const rosters: AthleteRoster[] = await Promise.all(
          athleteUids.map(async (uid) => {
            const [profileSnap, statusSnap, recoverySnap, injuriesSnap] = await Promise.all([
              get(ref(db, `users/${uid}`)),
              get(ref(db, `daily_status/${uid}`)),
              get(ref(db, `recovery/${uid}`)),
              get(ref(db, `injuries/${uid}`)),
            ]);
            const profile: UserProfile = profileSnap.val() || { uid, name: "Unknown Athlete", email: "", role: "athlete", sport: "Other", createdAt: Date.now() };
            const statuses = statusSnap.exists() ? Object.values(statusSnap.val()) as DailyStatus[] : [];
            const recoveries = recoverySnap.exists() ? Object.values(recoverySnap.val()) as RecoveryEntry[] : [];
            const injuries = injuriesSnap.exists() ? Object.values(injuriesSnap.val()) as PainMarker[] : [];
            const latestStatus = statuses.sort((a, b) => b.date - a.date)[0];
            const latestRecovery = recoveries.sort((a, b) => b.date - a.date)[0];
            const activeInjuries = injuries.filter((i) => !i.resolved);
            const readiness = latestRecovery
              ? calculateReadiness(latestRecovery.recoveryScore, latestRecovery.painScore)
              : 65;
            return { profile, latestStatus, latestRecovery, activeInjuries, readiness };
          })
        );
        setAthletes(rosters);
        if (rosters.length > 0) setSel(rosters[0]);
        setLoading(false);
      } catch (e) {
        console.error(e);
        setAthletes(MOCK_ATHLETES);
        setSel(MOCK_ATHLETES[0]);
        setLoading(false);
      }
    }, (err) => {
      console.warn("Firebase permission or network error:", err);
      clearTimeout(fallbackTimer);
      setAthletes(MOCK_ATHLETES);
      setSel(MOCK_ATHLETES[0]);
      setLoading(false);
    });

    return () => {
      clearTimeout(fallbackTimer);
      unsub();
    };
  }, []);

  // Load history for selected athlete
  useEffect(() => {
    if (!sel) return;
    if (sel.profile.uid.startsWith("a")) {
      setAthleteHistory(MOCK_HISTORY);
      return;
    }

    const recovRef = ref(db, `recovery/${sel.profile.uid}`);

    const fallbackTimer = setTimeout(() => {
      setAthleteHistory(MOCK_HISTORY);
    }, 1500);

    const unsub = onValue(recovRef, (snap) => {
      clearTimeout(fallbackTimer);
      if (!snap.exists()) { setAthleteHistory(MOCK_HISTORY); return; }
      const entries = Object.values(snap.val()) as RecoveryEntry[];
      setAthleteHistory(entries.sort((a, b) => a.date - b.date).slice(-14));
    }, () => {
      clearTimeout(fallbackTimer);
      setAthleteHistory(MOCK_HISTORY);
    });

    return () => {
      clearTimeout(fallbackTimer);
      unsub();
    };
  }, [sel?.profile.uid]);

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg2)' }}>
      <Sidebar />
      <main className="main-content">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="topbar">
            <div>
              <p className="stat-label mb-1">ATHLETES</p>
              <h1 className="font-display text-4xl tracking-widest" style={{ color: 'var(--text1)' }}>DEEP DIVE ANALYTICS</h1>
            </div>
          </div>

          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
              <Spin dark />
            </div>
          ) : athletes.length === 0 ? (
            <div className="card flat">
              <Empty icon="barChart" title="NO ATHLETES YET" desc="Athletes will appear here once they join your Legion and submit data." />
            </div>
          ) : (
            <>
              {/* Athlete selector tab chips */}
              <div style={{ display: "flex", gap: 10, marginBottom: 22, flexWrap: "wrap" }}>
                {athletes.map(a => (
                  <div
                    key={a.profile.uid}
                    onClick={() => setSel(a)}
                    style={{
                      cursor: "pointer",
                      padding: "8px 14px",
                      borderRadius: 10,
                      border: `1px solid ${sel?.profile.uid === a.profile.uid ? "var(--text1)" : "var(--border)"}`,
                      background: sel?.profile.uid === a.profile.uid ? "#111" : "var(--surface)",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      transition: "all 0.15s"
                    }}
                  >
                    <div
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: "50%",
                        background: sel?.profile.uid === a.profile.uid ? "var(--accent)" : "var(--bg3)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 10,
                        fontWeight: 700,
                        color: sel?.profile.uid === a.profile.uid ? "#111" : "var(--text2)"
                      }}
                    >
                      {inits(a.profile.name)}
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 500, color: sel?.profile.uid === a.profile.uid ? "#fff" : "var(--text1)" }}>
                      {a.profile.name}
                    </span>
                  </div>
                ))}
              </div>

              {sel && (
                <>
                  {/* Detailed Profile Card */}
                  <div className="card flat" style={{ marginBottom: 14, background: "var(--bg2)", border: "1px solid var(--border)" }}>
                    <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
                      <div
                        style={{
                          width: 72,
                          height: 72,
                          borderRadius: 18,
                          background: "var(--text1)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontFamily: "'Bebas Neue'",
                          fontSize: 26,
                          color: "var(--accent)",
                          flexShrink: 0
                        }}
                      >
                        {inits(sel.profile.name)}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 26, letterSpacing: 2 }}>{sel.profile.name}</div>
                        <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 12, color: "var(--text2)", marginTop: 3 }}>
                          {sel.profile.sport}
                        </div>
                        <div style={{ marginTop: 10 }}>
                          <span className={getTier(sel.readiness).cls}>{getTier(sel.readiness).label}</span>
                        </div>
                      </div>
                      <Ring score={sel.readiness} size={90} />
                    </div>
                  </div>

                  {/* Grid: Sparkline and Radar Chart */}
                  <div className="g2">
                    <div className="card flat">
                      <div className="sec-title" style={{ marginBottom: 12 }}>READINESS HISTORY</div>
                      {athleteHistory.length > 0 ? (
                        <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: 80 }}>
                          {athleteHistory.map((entry, i) => {
                            const score = entry.readinessScore || calculateReadiness(entry.recoveryScore, entry.painScore);
                            const t = getTier(score);
                            return (
                              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                                <div
                                  style={{
                                    width: "100%",
                                    background: t.color,
                                    borderRadius: "3px 3px 0 0",
                                    height: `${score * 0.78}%`,
                                    maxHeight: 66,
                                    minHeight: 4
                                  }}
                                />
                                <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 8, color: "var(--text3)" }}>
                                  {format(new Date(entry.date), 'dd')}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <Empty icon="barChart" title="NO HISTORY" desc="Readiness history will appear here." />
                      )}
                    </div>

                    <div className="card flat">
                      <div className="sec-title" style={{ marginBottom: 12 }}>PERFORMANCE RADAR</div>
                      <div style={{ display: "flex", justifyContent: "center" }}>
                        <RadarChart
                          data={{
                            HRV: sel.latestRecovery?.hrv || 0,
                            Sleep: (sel.latestRecovery?.sleepHours || 0) * 10,
                            Mood: sel.latestStatus ? (sel.latestStatus.mood / 5) * 100 : 0,
                            Energy: sel.latestStatus ? (sel.latestStatus.energy / 5) * 100 : 0,
                            Recovery: sel.readiness || 0
                          }}
                          size={200}
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
