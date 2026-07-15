import { useTranslation } from '@/hooks/useTranslation';
import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, Alert, Modal, TextInput
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAppStore } from '@/store/useAppStore';
import { logout, subscribeToCoachNotes, CoachNote } from '@/services/firebase';
import { StatCard } from '@/components/common/StatCard';
import { ReadinessRing } from '@/components/common/ReadinessRing';
import { COLORS, FONTS, SPACING, RADIUS, globalStyles } from '@/utils/theme';
import { calculateStreak, calculateReadiness, runKineticAlertEngine, formatDate, calculateVulnerabilities } from '@/utils/calculations';
import { useTheme } from '@/hooks/useTheme';

function AthleteDashboard() {
  const { profile, workouts, recovery, injuries } = useAppStore();
  const { t } = useTranslation();
  const { colors } = useTheme();

  const [showAllVulns, setShowAllVulns] = useState(false);
  const [latestNote, setLatestNote] = useState<CoachNote | null>(null);

  React.useEffect(() => {
    if (profile?.uid) {
      const unsub = subscribeToCoachNotes(profile.uid, (notes) => {
        setLatestNote(notes[0] || null);
      });
      return unsub;
    }
  }, [profile?.uid]);

  const todayRecovery = recovery[0] ?? null;
  const readiness = todayRecovery
    ? calculateReadiness(todayRecovery.recoveryScore, todayRecovery.painScore)
    : 0;

  const totalCalories = workouts.slice(0, 7).reduce((a, w) => a + w.caloriesBurned, 0);
  const activeInjuries = injuries.filter((i) => !i.resolved).length;

  const vulnerabilities = calculateVulnerabilities(workouts, injuries, {
    sport: profile?.sport,
    painBodyParts: profile?.painBodyParts,
    injuryStatus: profile?.injuryStatus,
    trainingFrequency: profile?.trainingFrequency,
    ageRange: profile?.ageRange,
  });

  const alert = todayRecovery
    ? runKineticAlertEngine(
        readiness,
        todayRecovery.painScore,
        workouts[0]?.duration ?? 0,
        t
      )
    : null;

  return (
    <ScrollView style={[globalStyles.screen, { backgroundColor: colors.bg }]} contentContainerStyle={styles.content}>
      <View>
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.greeting, { color: colors.textMuted }]}>{t.welcomeBack}</Text>
            <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>{profile?.name?.toUpperCase() ?? 'ATHLETE'}</Text>
            <Text style={styles.sport}>{profile?.sport?.toUpperCase()}</Text>
          </View>
        </View>

        {/* Coach Note Alert */}
        {latestNote && profile?.role !== 'coach' && (
          <View style={[styles.alertCard, { backgroundColor: COLORS.cyan + '15', borderColor: COLORS.cyan + '40' }]}>
            <Ionicons name="chatbubble-ellipses" size={18} color={COLORS.cyan} />
            <View style={{ flex: 1, marginLeft: SPACING.sm }}>
              <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.cyan, marginBottom: 2, letterSpacing: 1 }}>
                MESSAGE FROM COACH
              </Text>
              <Text style={{ fontFamily: FONTS.body, fontSize: 14, color: colors.textPrimary, lineHeight: 20 }}>
                "{latestNote.message}"
              </Text>
            </View>
          </View>
        )}

        {/* Kinetic Alert */}
        {alert && (
          <View style={[styles.alertCard, alert.severity === 'danger' ? styles.alertDanger : styles.alertWarning]}>
            <Ionicons
              name={alert.severity === 'danger' ? 'warning' : 'alert-circle'}
              size={18}
              color={alert.severity === 'danger' ? COLORS.danger : COLORS.warning}
            />
            <View style={{ flex: 1, marginLeft: SPACING.sm }}>
              <Text style={[styles.alertText, { color: alert.severity === 'danger' ? COLORS.danger : COLORS.warning }]}>
                {alert.message}
              </Text>
              <Text style={[styles.alertAction, { color: colors.textSecondary }]}>{alert.action}</Text>
            </View>
          </View>
        )}

        {/* Readiness Ring */}
        <View style={[styles.ringCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{t.todaysReadiness}</Text>
          <View style={styles.ringRow}>
            <ReadinessRing score={readiness} size={160} />
            <View style={styles.ringMeta}>
              <View style={styles.metaItem}>
                <Text style={[styles.metaLabel, { color: colors.textMuted }]}>HRV</Text>
                <Text style={[styles.metaVal, { color: colors.textPrimary }]}>{todayRecovery?.hrv ?? '--'} <Text style={styles.metaUnit}>ms</Text></Text>
              </View>
              <View style={styles.metaItem}>
                <Text style={[styles.metaLabel, { color: colors.textMuted }]}>RHR</Text>
                <Text style={[styles.metaVal, { color: colors.textPrimary }]}>{todayRecovery?.rhr ?? '--'} <Text style={styles.metaUnit}>bpm</Text></Text>
              </View>
              <View style={styles.metaItem}>
                <Text style={[styles.metaLabel, { color: colors.textMuted }]}>SLEEP</Text>
                <Text style={[styles.metaVal, { color: colors.textPrimary }]}>{todayRecovery?.sleepHours ?? '--'} <Text style={styles.metaUnit}>hrs</Text></Text>
              </View>
            </View>
          </View>
        </View>

        {/* Stats Row */}
        <Text style={[styles.sectionLabel, { marginTop: SPACING.lg, color: colors.textMuted }]}>{t.sevenDaySnapshot}</Text>
        <View style={styles.statsRow}>
          <StatCard label={t.calories} value={totalCalories} unit="kcal" accent={COLORS.lime} />
          <StatCard label={t.sessions} value={workouts.slice(0, 7).length} unit="wk" accent={COLORS.accent} />
          <StatCard label={t.injuries} value={activeInjuries} unit={t.active} accent={activeInjuries > 0 ? COLORS.danger : COLORS.success} />
        </View>

        {/* Vulnerability Mapping (V1) */}
        <Text style={[styles.sectionLabel, { marginTop: SPACING.lg, color: colors.textMuted }]}>
          {t.vulnerabilityMapping}
        </Text>
        <View style={[styles.vulnerabilityCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={[styles.vulnSub, { color: colors.textMuted }]}>
            {t.vulnerabilityDesc}
          </Text>
          
          {vulnerabilities.filter(v => v.level !== 'healthy').length === 0 ? (
            <View style={styles.healthyContainer}>
              <Ionicons name="shield-checkmark" size={24} color={COLORS.success} />
              <Text style={[styles.healthyText, { color: colors.textPrimary }]}>
                ALL SYSTEMS NOMINAL
              </Text>
              <Text style={[styles.healthyDesc, { color: colors.textMuted }]}>
                No muscle fatigue or active pain markers detected. Keep up the smart training!
              </Text>
            </View>
          ) : (
            <View style={{ gap: SPACING.md, marginTop: SPACING.sm }}>
              {vulnerabilities
                .filter(v => v.level !== 'healthy')
                .sort((a, b) => b.score - a.score)
                .slice(0, 3)
                .map((v, idx) => {
                  const levelColor = v.level === 'critical' ? COLORS.danger :
                                     v.level === 'high' ? '#FF6B35' :
                                     v.level === 'medium' ? '#FFD600' : '#8E9AA6';
                  return (
                    <View key={idx} style={styles.vulnItem}>
                      <View style={styles.vulnItemHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Ionicons 
                            name={v.level === 'critical' || v.level === 'high' ? 'warning' : 'bar-chart'} 
                            size={14} 
                            color={levelColor} 
                          />
                          <Text style={[styles.vulnPartName, { color: colors.textPrimary }]}>
                            {v.bodyPart.toUpperCase()}
                          </Text>
                        </View>
                        <View style={[styles.vulnBadge, { backgroundColor: levelColor + '20', borderColor: levelColor }]}>
                          <Text style={[styles.vulnBadgeText, { color: levelColor }]}>
                            {v.level.toUpperCase()} ({v.score}%)
                          </Text>
                        </View>
                      </View>
                      
                      {/* Progress bar */}
                      <View style={[styles.progressBarBg, { backgroundColor: colors.surface }]}>
                        <View style={[styles.progressBarFill, { width: `${v.score}%`, backgroundColor: levelColor }]} />
                      </View>
                      
                      <Text style={[styles.vulnReason, { color: colors.textMuted }]} numberOfLines={1}>
                        {v.reason}
                      </Text>
                    </View>
                  );
                })}
                
              {vulnerabilities.filter(v => v.level !== 'healthy').length > 3 && (
                <Pressable 
                  style={[styles.btnViewAllVulns, { backgroundColor: colors.surface }]}
                  onPress={() => setShowAllVulns(true)}
                >
                  <Text style={[styles.btnViewAllText, { color: colors.textPrimary }]}>
                    VIEW ALL {vulnerabilities.filter(v => v.level !== 'healthy').length} VULNERABILITIES
                  </Text>
                  <Ionicons name="chevron-forward" size={14} color={colors.textPrimary} />
                </Pressable>
              )}
            </View>
          )}
        </View>

        {/* Recent Sessions */}
        <Text style={[styles.sectionLabel, { marginTop: SPACING.lg, color: colors.textMuted }]}>{t.recentSessions}</Text>
        {workouts.slice(0, 4).map((w, i) => (
          <View key={i} style={[styles.sessionRow, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <View style={styles.sessionIcon}>
              <Ionicons name="barbell" size={16} color={COLORS.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sessionDate, { color: colors.textPrimary }]}>{formatDate(w.date)}</Text>
              <Text style={[styles.sessionSets, { color: colors.textMuted }]}>{w.sets.length} {t.exercises}</Text>
            </View>
            <View style={styles.sessionRight}>
              <Text style={[styles.sessionCals, { color: COLORS.lime }]}>{w.caloriesBurned} kcal</Text>
              <Text style={[styles.sessionDur, { color: colors.textMuted }]}>{w.duration} min</Text>
            </View>
          </View>
        ))}
        {workouts.length === 0 && (
          <Text style={[styles.empty, { color: colors.textMuted }]}>{t.noSessionsLogged}</Text>
        )}
      </View>

      {/* All Vulnerabilities Modal */}
      <Modal visible={showAllVulns} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.85)' }]}>
          <View style={[styles.modalContainer, { backgroundColor: colors.bg, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                {t.vulnerabilityMapping}
              </Text>
              <Pressable style={styles.modalCloseBtn} onPress={() => setShowAllVulns(false)}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ padding: SPACING.md, paddingBottom: 60 }}>
              <Text style={[styles.modalSubtitle, { color: colors.textMuted, marginBottom: SPACING.md }]}>
                Full skeletal and muscular vulnerability index updated dynamically.
              </Text>
              
              {vulnerabilities.map((v, idx) => {
                const levelColor = v.level === 'critical' ? COLORS.danger :
                                   v.level === 'high' ? '#FF6B35' :
                                   v.level === 'medium' ? '#FFD600' : 
                                   v.level === 'low' ? '#8E9AA6' : COLORS.success;
                return (
                  <View key={idx} style={[styles.modalVulnRow, { borderBottomColor: colors.border }]}>
                    <View style={styles.modalVulnHeader}>
                      <Text style={[styles.modalVulnPart, { color: colors.textPrimary }]}>
                        {v.bodyPart}
                      </Text>
                      <View style={[styles.vulnBadge, { backgroundColor: levelColor + '15', borderColor: levelColor }]}>
                        <Text style={[styles.vulnBadgeText, { color: levelColor }]}>
                          {v.level.toUpperCase()}
                        </Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 }}>
                      <View style={[styles.progressBarBg, { flex: 1, backgroundColor: colors.surface }]}>
                        <View style={[styles.progressBarFill, { width: `${v.score}%`, backgroundColor: levelColor }]} />
                      </View>
                      <Text style={[styles.modalVulnScore, { color: colors.textSecondary }]}>
                        {v.score}%
                      </Text>
                    </View>
                    <Text style={[styles.modalVulnReason, { color: colors.textMuted }]}>
                      {v.reason}
                    </Text>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { fontFamily: FONTS.display, fontSize: 20, marginBottom: 12, marginTop: 24, paddingHorizontal: 20 },
  content: { padding: SPACING.md, paddingBottom: 120 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.lg,
    paddingTop: SPACING.md,
  },
  greeting: { fontFamily: FONTS.mono, fontSize: 10, color: COLORS.textMuted, letterSpacing: 2 },
  name: { fontFamily: FONTS.display, fontSize: 32, color: COLORS.textPrimary, letterSpacing: 2, lineHeight: 36 },
  sport: { fontFamily: FONTS.mono, fontSize: 11, color: COLORS.accent, letterSpacing: 1.5, marginTop: 2 },
  streakBadge: {
    alignItems: 'center',
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.lime + '40',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  logoutBtn: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.danger + '15',
    borderWidth: 1,
    borderColor: COLORS.danger + '30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakNum: { fontFamily: FONTS.display, fontSize: 28, color: COLORS.lime, lineHeight: 32 },
  streakLabel: { fontFamily: FONTS.mono, fontSize: 8, color: COLORS.textMuted, letterSpacing: 1.5 },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  alertDanger: { backgroundColor: COLORS.danger + '15', borderColor: COLORS.danger + '40' },
  alertWarning: { backgroundColor: COLORS.warning + '15', borderColor: COLORS.warning + '40' },
  alertText: { fontFamily: FONTS.mono, fontSize: 11, letterSpacing: 0.5 },
  alertAction: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.textSecondary, marginTop: 4 },
  sectionLabel: { fontFamily: FONTS.mono, fontSize: 10, color: COLORS.textMuted, letterSpacing: 2, marginBottom: SPACING.sm },
  ringCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
  },
  ringRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', marginTop: SPACING.md },
  ringMeta: { gap: SPACING.lg },
  metaItem: { alignItems: 'flex-end' },
  metaLabel: { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.textMuted, letterSpacing: 1.5 },
  metaVal: { fontFamily: FONTS.display, fontSize: 22, color: COLORS.textPrimary, lineHeight: 26 },
  metaUnit: { fontFamily: FONTS.mono, fontSize: 10, color: COLORS.accent },
  statsRow: { flexDirection: 'row', gap: SPACING.sm },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    gap: SPACING.md,
  },
  sessionIcon: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.accent + '18',
    borderWidth: 1,
    borderColor: COLORS.accent + '30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionDate: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.textPrimary },
  sessionSets: { fontFamily: FONTS.mono, fontSize: 10, color: COLORS.textMuted },
  sessionRight: { alignItems: 'flex-end' },
  sessionCals: { fontFamily: FONTS.display, fontSize: 18, lineHeight: 22 },
  sessionDur: { fontFamily: FONTS.mono, fontSize: 10, color: COLORS.textMuted },
  empty: { fontFamily: FONTS.mono, fontSize: 11, color: COLORS.textMuted, textAlign: 'center', paddingVertical: SPACING.xl },
  vulnerabilityCard: {
    padding: SPACING.md,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    marginBottom: SPACING.md,
  },
  vulnSub: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    letterSpacing: 0.5,
    marginBottom: SPACING.md,
    textTransform: 'uppercase',
  },
  healthyContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.lg,
    gap: SPACING.xs,
  },
  healthyText: {
    fontFamily: FONTS.display,
    fontSize: 14,
    letterSpacing: 1.5,
    marginTop: SPACING.xs,
  },
  healthyDesc: {
    fontFamily: FONTS.body,
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: SPACING.md,
  },
  vulnItem: {
    marginBottom: SPACING.xs,
  },
  vulnItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  vulnPartName: {
    fontFamily: FONTS.display,
    fontSize: 13,
    letterSpacing: 1,
  },
  vulnBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
    borderWidth: 0.5,
  },
  vulnBadgeText: {
    fontFamily: FONTS.mono,
    fontSize: 8,
    letterSpacing: 0.5,
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  vulnReason: {
    fontFamily: FONTS.mono,
    fontSize: 9,
  },
  btnViewAllVulns: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.lg,
    marginTop: SPACING.xs,
  },
  btnViewAllText: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    letterSpacing: 1,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContainer: {
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    borderWidth: 1,
    borderBottomWidth: 0,
    maxHeight: '80%',
    padding: SPACING.md,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    paddingBottom: SPACING.md,
  },
  modalTitle: {
    fontFamily: FONTS.display,
    fontSize: 18,
    letterSpacing: 1.5,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalSubtitle: {
    fontFamily: FONTS.body,
    fontSize: 12,
    lineHeight: 18,
    marginTop: SPACING.md,
  },
  modalVulnRow: {
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
  },
  modalVulnHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalVulnPart: {
    fontFamily: FONTS.display,
    fontSize: 15,
    letterSpacing: 1,
  },
  modalVulnScore: {
    fontFamily: FONTS.mono,
    fontSize: 11,
  },
  modalVulnReason: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    marginTop: 6,
  },
});


import { subscribeToLegion, fetchAthleteProfiles, UserProfile, Legion, saveCoachNote, subscribeToInjuries, PainMarker } from '@/services/firebase';
import HumanBodySvg from '@/components/HumanBodySvg';

function CoachDashboard() {
  const { profile, user } = useAppStore();
  const { t } = useTranslation();
  const { colors } = useTheme();
  
  const [activeLegion, setActiveLegion] = useState<Legion | null>(null);
  const [athletes, setAthletes] = useState<UserProfile[]>([]);
  const [selectedAthlete, setSelectedAthlete] = useState<UserProfile | null>(null);
  const [athleteInjuries, setAthleteInjuries] = useState<PainMarker[]>([]);
  const [noteInput, setNoteInput] = useState('');
  const [isSendingNote, setIsSendingNote] = useState(false);

  React.useEffect(() => {
    if (profile?.legionId) {
      const unsub = subscribeToLegion(profile.legionId, (legionData) => {
        setActiveLegion(legionData);
        if (legionData?.athleteUids) {
          const uids = Object.keys(legionData.athleteUids);
          fetchAthleteProfiles(uids).then(setAthletes).catch(console.error);
        }
      });
      return unsub;
    }
  }, [profile?.legionId]);

  React.useEffect(() => {
    if (selectedAthlete) {
      const unsubInj = subscribeToInjuries(selectedAthlete.uid, setAthleteInjuries);
      return unsubInj;
    } else {
      setAthleteInjuries([]);
    }
  }, [selectedAthlete]);

  const handleSendNote = async () => {
    if (!selectedAthlete || !noteInput.trim() || !user) return;
    setIsSendingNote(true);
    try {
      await saveCoachNote(selectedAthlete.uid, {
        athleteUid: selectedAthlete.uid,
        coachUid: user.uid,
        message: noteInput.trim(),
        timestamp: Date.now(),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Sent', `Note sent to ${selectedAthlete.name}`);
      setNoteInput('');
      setSelectedAthlete(null);
    } catch (e) {
      Alert.alert('Error', 'Failed to send note.');
    }
    setIsSendingNote(false);
  };
  
  const injuredCount = athletes.filter(a => (activeLegion as any)?.athlete_status?.[a.uid]?.[Object.keys((activeLegion as any)?.athlete_status[a.uid] || {})[0]]?.injuryStatus?.startsWith('Yes')).length;
  const aiMessage = injuredCount > 0 
    ? `AI INSIGHT: ${injuredCount} athletes are currently reporting active injuries. Consider adjusting the team's load management to prioritize recovery this week.`
    : `AI INSIGHT: Your roster is currently healthy. Optimal time to push for progressive overload.`;

  return (
    <ScrollView style={[globalStyles.screen, { backgroundColor: colors.bg }]} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.greeting, { color: colors.textMuted }]}>{t.welcomeBack}</Text>
          <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>{profile?.name?.toUpperCase() ?? 'COACH'}</Text>
          <Text style={styles.sport}>COACH DASHBOARD</Text>
        </View>
      </View>

      <View style={[styles.alertCard, { backgroundColor: COLORS.purple + '15', borderColor: COLORS.purple + '40', marginBottom: 24 }]}>
        <Ionicons name="sparkles" size={18} color={COLORS.purple} />
        <View style={{ flex: 1, marginLeft: SPACING.sm }}>
          <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.purple, marginBottom: 2, letterSpacing: 1 }}>
            RECOVO AI RECOMMENDATION
          </Text>
          <Text style={{ fontFamily: FONTS.body, fontSize: 14, color: colors.textPrimary, lineHeight: 20 }}>
            {aiMessage}
          </Text>
        </View>
      </View>

      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Your Roster ({athletes.length})</Text>

      {athletes.length === 0 ? (
        <View style={{ padding: 20, alignItems: 'center', backgroundColor: colors.surface, borderRadius: 16 }}>
          <Text style={{ color: colors.textMuted }}>No athletes in your legion yet.</Text>
        </View>
      ) : (
        athletes.map(athlete => {
          const hasInjuries = (activeLegion as any)?.athlete_status?.[athlete.uid]?.[Object.keys((activeLegion as any)?.athlete_status[athlete.uid] || {})[0]]?.injuryStatus?.startsWith('Yes');
          return (
            <Pressable 
              key={athlete.uid}
              style={{ padding: 16, backgroundColor: colors.surface, borderRadius: 16, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: colors.border }}
              onPress={() => setSelectedAthlete(athlete)}
            >
              <View>
                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.textPrimary }}>{athlete.name}</Text>
                <Text style={{ fontSize: 14, color: colors.textSecondary }}>{athlete.sport}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {hasInjuries && <Ionicons name="warning" size={16} color={COLORS.warning} />}
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </View>
            </Pressable>
          )
        })
      )}

      <Modal visible={!!selectedAthlete} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelectedAthlete(null)}>
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 20, paddingTop: 60, borderBottomWidth: 1, borderColor: colors.border }}>
            <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.textPrimary }}>{selectedAthlete?.name}</Text>
            <Pressable onPress={() => setSelectedAthlete(null)}>
              <Ionicons name="close-circle" size={28} color={colors.textMuted} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20 }}>
            <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 10, textAlign: 'center' }}>Reported Pain Markers</Text>
            <View style={{ alignItems: 'center', marginBottom: 30 }}>
              <HumanBodySvg 
                activeRegionIds={new Set(athleteInjuries.map(i => i.bodyPart))}
                getMarkerColor={() => COLORS.danger}
              />
              {athleteInjuries.length === 0 && (
                <Text style={{ color: colors.textMuted, marginTop: 10 }}>No active injuries reported.</Text>
              )}
            </View>

            <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 10 }}>Leave a Note</Text>
            <TextInput
              style={{ backgroundColor: colors.surface, color: colors.textPrimary, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.border, minHeight: 100, textAlignVertical: 'top' }}
              multiline
              placeholder="E.g., Take it easy on the knees today..."
              placeholderTextColor={colors.textMuted}
              value={noteInput}
              onChangeText={setNoteInput}
            />
            <Pressable 
              disabled={isSendingNote || !noteInput.trim()}
              style={{ backgroundColor: '#FF5A1F', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 16, opacity: noteInput.trim() ? 1 : 0.5 }}
              onPress={handleSendNote}
            >
              <Text style={{ color: '#000', fontWeight: 'bold', fontSize: 16 }}>{isSendingNote ? 'Sending...' : 'Send Note to Athlete'}</Text>
            </Pressable>
          </ScrollView>
        </View>
      </Modal>
    </ScrollView>
  );
}


export default function DashboardScreen() {
  const { profile } = useAppStore();
  if (profile?.role === 'coach') {
    return <CoachDashboard />;
  }
  return <AthleteDashboard />;
}
