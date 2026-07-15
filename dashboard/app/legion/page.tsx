'use client';

import React, { useState, useEffect } from 'react';
import { ref, onValue, get, push, set, update } from 'firebase/database';
import { db, auth } from '../lib/firebase';
import { Sidebar } from '../components/Sidebar';
import type { Legion, UserProfile, DailyStatus, RecoveryEntry, PainMarker, AthleteRoster } from '../lib/types';
import { calculateReadiness } from '../lib/types';

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
  users:        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
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

function Empty({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="empty-state">
      <div className="empty-icon"><Icon name={icon} size={40} color="var(--text3)" /></div>
      <div className="empty-title">{title}</div>
      <div className="empty-desc">{desc}</div>
    </div>
  );
}

const SPORTS = ["Soccer", "Basketball", "Football", "Running", "Swimming", "Cycling", "CrossFit", "Weightlifting", "Tennis", "Rowing", "Other"];

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

const MOCK_LEGION: Legion = {
  id: "legion_mock",
  name: "Elite Performance Legion",
  coachUid: "coach_mock",
  inviteCode: "RECOVO",
  sport: "Running",
  createdAt: Date.now(),
  athleteUids: { a1: true, a2: true, a3: true }
};

export default function LegionPage() {
  const [legion, setLegion] = useState<Legion | null>(null);
  const [athletes, setAthletes] = useState<AthleteRoster[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState({ name: "", sport: SPORTS[0] });
  const [creating, setCreating] = useState(false);

  // Load legion and roster
  useEffect(() => {
    const legionsRef = ref(db, 'legions');

    // Resilient timeout fallback
    const fallbackTimer = setTimeout(() => {
      if (loading) {
        console.warn("Firebase legion load timed out. Using mock fallback data.");
        setLegion(MOCK_LEGION);
        setAthletes(MOCK_ATHLETES);
        setLoading(false);
      }
    }, 2000);

    const unsub = onValue(legionsRef, async (snap) => {
      clearTimeout(fallbackTimer);
      if (!snap.exists()) {
        setLegion(MOCK_LEGION);
        setAthletes(MOCK_ATHLETES);
        setLoading(false);
        return;
      }
      try {
        const legionsData = snap.val() as Record<string, Legion>;
        const firstLegion = Object.values(legionsData)[0];
        setLegion(firstLegion);

        // Fetch roster profiles
        const athleteUids = Object.keys(firstLegion.athleteUids ?? {});
        if (athleteUids.length === 0) {
          setAthletes([]);
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
        setLoading(false);
      } catch (e) {
        console.error(e);
        setLegion(MOCK_LEGION);
        setAthletes(MOCK_ATHLETES);
        setLoading(false);
      }
    }, (err) => {
      console.warn("Firebase permission or network error:", err);
      clearTimeout(fallbackTimer);
      setLegion(MOCK_LEGION);
      setAthletes(MOCK_ATHLETES);
      setLoading(false);
    });

    return () => {
      clearTimeout(fallbackTimer);
      unsub();
    };
  }, []);

  const createLegion = async () => {
    if (!form.name.trim()) return;
    setCreating(true);
    const coachUid = auth.currentUser?.uid || "coach_dev";
    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    const newLegion = {
      id: "legion_" + Date.now(),
      name: form.name.trim(),
      coachUid,
      inviteCode,
      sport: form.sport,
      createdAt: Date.now(),
      athleteUids: {},
    };

    try {
      const newLegionRef = push(ref(db, 'legions'));
      newLegion.id = newLegionRef.key || newLegion.id;
      await set(newLegionRef, newLegion);

      if (auth.currentUser?.uid) {
        await update(ref(db, `users/${auth.currentUser.uid}`), {
          legionId: newLegion.id,
          legionCode: inviteCode,
        });
      }
      setLegion(newLegion);
    } catch (e) {
      console.warn("Firebase database write failed. Creating local Legion instead.");
      setLegion(newLegion);
    } finally {
      setCreating(false);
    }
  };

  const handleCopyCode = () => {
    if (!legion?.inviteCode) return;
    navigator.clipboard?.writeText(legion.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen" style={{ background: 'var(--bg2)' }}>
        <Sidebar />
        <main className="main-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Spin dark />
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg2)' }}>
      <Sidebar />
      <main className="main-content">
        <div className="max-w-6xl mx-auto">
          {!legion ? (
            /* Create Legion view */
            <div style={{ maxWidth: 480 }}>
              <div className="topbar">
                <div>
                  <h1 className="font-display text-4xl tracking-widest" style={{ color: 'var(--text1)' }}>CREATE LEGION</h1>
                </div>
              </div>
              <div className="card flat">
                <div style={{ textAlign: "center", marginBottom: 28 }}>
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      background: "var(--bg3)",
                      borderRadius: 16,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      margin: "0 auto 16px",
                      border: "1px solid var(--border)"
                    }}
                  >
                    <Icon name="legion" size={28} color="var(--text2)" />
                  </div>
                  <div style={{ fontFamily: "'Bebas Neue'", fontSize: 22, letterSpacing: 3 }}>BUILD YOUR TEAM</div>
                  <div style={{ fontSize: 13, color: "var(--text2)", marginTop: 6 }}>
                    Create a Legion to start monitoring your athletes in real time
                  </div>
                </div>
                <div className="input-wrap">
                  <label className="input-lbl">Legion Name</label>
                  <input
                    className="input-field"
                    placeholder="Thunder Athletics"
                    value={form.name}
                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  />
                </div>
                <div className="input-wrap">
                  <label className="input-lbl">Primary Sport</label>
                  <select
                    className="input-field"
                    value={form.sport}
                    onChange={e => setForm(p => ({ ...p, sport: e.target.value }))}
                  >
                    {SPORTS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <button
                  className="btn btn-primary btn-full btn-lg"
                  onClick={createLegion}
                  disabled={creating || !form.name.trim()}
                >
                  {creating ? <><Spin /> Creating…</> : "Create Legion →"}
                </button>
              </div>
            </div>
          ) : (
            /* Active Legion View */
            <div>
              <div className="topbar">
                <div>
                  <h1 className="font-display text-4xl tracking-widest mb-1" style={{ color: 'var(--text1)' }}>LEGION</h1>
                  <div className="topbar-meta">{legion.name} · ROSTER MANAGEMENT</div>
                </div>
              </div>

              <div className="g23" style={{ marginBottom: 18 }}>
                {/* Invite Code Display */}
                <div style={{ background: "var(--surface)", border: "2px solid var(--accent)", borderRadius: 20, textAlign: "center", padding: 32 }}>
                  <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 11, color: "var(--text2)", textTransform: "uppercase", letterSpacing: 2, marginBottom: 6 }}>
                    Athlete Invite Code
                  </div>
                  <div style={{ fontFamily: "'Bebas Neue'", fontSize: 52, letterSpacing: 10, color: "var(--text1)", padding: 16 }}>
                    {legion.inviteCode}
                  </div>
                  <button className="btn btn-primary" style={{ margin: "0 auto", display: "flex" }} onClick={handleCopyCode}>
                    {copied ? "Copied" : "Copy Code"}
                  </button>
                  <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 11, color: "var(--text3)", marginTop: 12 }}>
                    Share with athletes to join {legion.name}
                  </div>
                </div>

                {/* Legion Overview */}
                <div className="card flat">
                  <div className="sec-title" style={{ marginBottom: 16 }}>LEGION OVERVIEW</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    {[
                      ["Name", legion.name],
                      ["Sport", legion.sport],
                      ["Athletes", athletes.length.toString()],
                      ["Invite Code", legion.inviteCode],
                    ].map(([k, v]) => (
                      <div key={k} style={{ background: "var(--bg2)", borderRadius: 10, padding: 14, border: "1px solid var(--border)" }}>
                        <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 9, color: "var(--text3)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
                          {k}
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{v}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Roster Table */}
              <div className="card flat">
                <div className="sec-title" style={{ marginBottom: 16 }}>ROSTER</div>
                {athletes.length > 0 ? (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          {["Athlete", "Sport", "Readiness", "HRV", "RHR", "Sleep", "Status"].map(h => <th key={h}>{h}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {athletes.map(a => {
                          const t = getTier(a.readiness);
                          return (
                            <tr key={a.profile.uid}>
                              <td style={{ fontWeight: 600 }}>{a.profile.name}</td>
                              <td style={{ fontFamily: "'IBM Plex Mono'", fontSize: 11, color: "var(--text2)" }}>
                                {a.profile.sport}
                              </td>
                              <td><span className={t.cls}>{a.readiness || "—"}</span></td>
                              <td style={{ fontFamily: "'IBM Plex Mono'", fontSize: 12 }}>{a.latestRecovery?.hrv || "—"}</td>
                              <td style={{ fontFamily: "'IBM Plex Mono'", fontSize: 12 }}>{a.latestRecovery?.rhr || "—"}</td>
                              <td style={{ fontFamily: "'IBM Plex Mono'", fontSize: 12 }}>
                                {a.latestRecovery?.sleepHours ? `${a.latestRecovery.sleepHours}h` : "—"}
                              </td>
                              <td>
                                {a.latestStatus ? (
                                  <span className="chip chip-green">Submitted</span>
                                ) : (
                                  <span className="chip chip-gray">Pending</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <Empty icon="users" title="NO ATHLETES YET" desc="Athletes who join using your invite code will appear here automatically." />
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
