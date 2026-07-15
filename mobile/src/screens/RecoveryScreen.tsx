import { useTheme } from '@/hooks/useTheme';
import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, Modal, TextInput, Alert, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Svg, { Circle, Path as SvgPath, Polyline, Line, G, Text as SvgText, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useAppStore } from '@/store/useAppStore';
import { ReadinessRing } from '@/components/common/ReadinessRing';
import { StatCard } from '@/components/common/StatCard';
import { COLORS, FONTS, SPACING, RADIUS, globalStyles } from '@/utils/theme';
import { calculateReadiness, calculateRecoveryScore, getReadinessLabel } from '@/utils/calculations';
import { saveRecoveryEntry, subscribeToLegion, fetchTeamInjuries, PainMarker , fetchAthleteProfiles, saveCoachNote, subscribeToRecovery } from '@/services/firebase';
import { fetchAIRecommendations, AIRecommendation } from '@/services/aiRecommendation';
import { useTranslation } from '@/hooks/useTranslation';
import { fetchNativeHealthData, HealthData } from '@/services/healthSync';


const AI_SUGGESTIONS: Record<string, string[]> = {
  ELITE: [
    'Your body is primed. Go for a peak intensity session today.',
    'HRV and sleep are optimal â€” push your limits.',
    'Great day for personal records. Hit it hard.',
  ],
  HIGH: [
    'Solid readiness. Normal training intensity recommended.',
    'Recovery is on track. Maintain your training plan.',
  ],
  MODERATE: [
    'Consider reducing training volume by 20â€“30% today.',
    'Prioritise technique work over heavy loading.',
    'Stay hydrated and include a proper warm-up.',
  ],
  LOW: [
    'Light recovery session only â€” walking, mobility, stretching.',
    'Your nervous system needs rest. Skip heavy weights today.',
    'Focus on sleep quality tonight â€” target 8+ hours.',
  ],
  CRITICAL: [
    'Mandatory rest day. Your body is telling you something.',
    'Do not train today. Active recovery only â€” yoga or a walk.',
    'Consult a physician if this pattern continues beyond 3 days.',
  ],
};

const getSuggestions = (score: number): string[] => {
  if (score >= 85) return AI_SUGGESTIONS.ELITE;
  if (score >= 70) return AI_SUGGESTIONS.HIGH;
  if (score >= 55) return AI_SUGGESTIONS.MODERATE;
  if (score >= 40) return AI_SUGGESTIONS.LOW;
  return AI_SUGGESTIONS.CRITICAL;
};


const RecoveryGraph = ({ recovery, t, colors }: any) => {
  const [width, setWidth] = React.useState(0);
  const height = 160;
  const padding = 20;

  const chartData = recovery.length ? recovery.slice(0, 7).reverse() : [];
  const displayData = [...Array(Math.max(0, 7 - chartData.length)).fill(null), ...chartData];
  const hasData = displayData.some(d => d !== null);

  return (
    <View 
      style={{ height, width: '100%', backgroundColor: colors.bgCard, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: colors.border, marginTop: SPACING.md, justifyContent: 'center' }}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      {!hasData ? (
        <View style={{ alignItems: 'center', padding: SPACING.lg }}>
          <Text style={{ color: colors.textMuted, fontFamily: FONTS.body, fontSize: 12, textAlign: 'center' }}>No data. Tap "SYNC DEVICE" to generate an entry.</Text>
        </View>
      ) : width > 0 ? (
        <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ position: 'absolute', top: 0, left: 0 }}>
          <Defs>
            <LinearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={COLORS.accent} stopOpacity="0.4" />
              <Stop offset="1" stopColor={COLORS.accent} stopOpacity="0.0" />
            </LinearGradient>
          </Defs>
          {(() => {
            const maxVal = 100;
            const minVal = 0;
            const points = displayData.map((entry, i) => {
              const score = entry ? calculateReadiness(entry.recoveryScore, entry.painScore) : 0;
              const x = padding + (i * ((width - padding * 2) / 6));
              const y = height - padding - ((score - minVal) / (maxVal - minVal) * (height - padding * 2));
              return { x, y, score, entry };
            });
            const validPoints = points.filter(p => p.entry !== null);

            return (
              <G>
                {[0, 25, 50, 75, 100].map(val => {
                  const y = height - padding - ((val - minVal) / (maxVal - minVal) * (height - padding * 2));
                  return <Line key={val} x1={padding} y1={y} x2={width - padding} y2={y} stroke={colors.border} strokeWidth="1" strokeDasharray="4 4" />;
                })}
                {validPoints.length > 1 && (
                  <SvgPath d={validPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')} fill="none" stroke={COLORS.accent} strokeWidth="3" />
                )}
                {points.map((p, i) => {
                  const { color: dotColor } = getReadinessLabel(p.score, t);
                  return (
                    <G key={i}>
                      {p.entry && <Circle cx={p.x} cy={p.y} r="5" fill={colors.bgCard} stroke={dotColor} strokeWidth="2" />}
                      {p.entry && p.score > 0 && <SvgText x={p.x} y={p.y - 12} fill={colors.textPrimary} fontSize="10" fontFamily={FONTS.mono} textAnchor="middle">{p.score}</SvgText>}
                      <SvgText x={p.x} y={height - 2} fill={colors.textMuted} fontSize="10" fontFamily={FONTS.mono} textAnchor="middle">
                        {p.entry ? new Date(p.entry.date).toLocaleDateString(undefined, { weekday: 'narrow' }) : '-'}
                      </SvgText>
                    </G>
                  );
                })}
              </G>
            );
          })()}
        </Svg>
      ) : null}
    </View>
  );
}

function AthleteRecoveryView() {
  const { user, profile, recovery, setRecovery, injuries, workouts, dailyStatuses } = useAppStore();
  const { t } = useTranslation();
  const [syncing, setSyncing] = useState(false);
  const [fetchingAI, setFetchingAI] = useState(false);
  const [aiRec, setAiRec] = useState<AIRecommendation | null>(null);
  const [lastSync, setLastSync] = useState<HealthData | null>(null);
  const [teamInjuries, setTeamInjuries] = useState<PainMarker[]>([]);

  React.useEffect(() => {
    if (profile?.role === 'coach' && profile?.legionId) {
      const unsub = subscribeToLegion(profile.legionId, async (legionData) => {
        if (legionData?.athleteUids) {
          const uids = Object.keys(legionData.athleteUids);
          const tInj = await fetchTeamInjuries(uids);
          setTeamInjuries(tInj);
        }
      });
      return unsub;
    }
  }, [profile?.role, profile?.legionId]);

  const latest = recovery[0] ?? null;
  const recoveryScore = latest?.recoveryScore ?? 0;
  const painScore = latest?.painScore ?? 0;
  const readiness = calculateReadiness(recoveryScore, painScore);
  const { label, color } = getReadinessLabel(readiness, t);
  const suggestions = getSuggestions(readiness);

  const handleGenerateAI = async () => {
    setFetchingAI(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Call our new OpenAI backend
    const result = await fetchAIRecommendations(
      profile, 
      dailyStatuses || [], 
      workouts || [], 
      profile?.role === 'coach' ? teamInjuries : (injuries || [])
    );
    
    if (result) {
      setAiRec(result);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Alert.alert('AI Error', 'Could not generate recommendations at this time.');
    }
    setFetchingAI(false);
  };

  const handleSync = async () => {
    setSyncing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const data = await fetchNativeHealthData();
      if (!data) throw new Error('No data returned');

      const sleepQuality = 85; // Default estimate as native APIs rarely provide a simple 1-100 quality score

      const recovScore = calculateRecoveryScore(data.hrv || 50, data.rhr || 60, data.sleepHours || 8);

      setLastSync(data);
      setSyncing(false);

      if (!user) return;
      
      await saveRecoveryEntry(user.uid, {
        uid: user.uid,
        date: Date.now(),
        hrv: data.hrv || 50,
        rhr: data.rhr || 60,
        sleepHours: data.sleepHours || 8,
        sleepQuality,
        recoveryScore: recovScore,
        readinessScore: calculateReadiness(recovScore, painScore),
        painScore,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      setSyncing(false);
      Alert.alert('Sync Error', `Could not sync health data: ${error.message}`);
    }
  };

  return (
    <ScrollView style={globalStyles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>RECOVERY</Text>
        <Text style={styles.subtitle}>READINESS ENGINE</Text>
      </View>

      {/* Readiness Ring */}
      <View style={styles.ringCard}>
        <View style={styles.ringCenter}>
          <ReadinessRing score={readiness} size={200} strokeWidth={14} />
        </View>
        <View style={styles.ringFooter}>
          <Text style={styles.formulaLabel}>READINESS = (RECOVERY x 0.7) - (PAIN x 0.3)</Text>
          <View style={styles.formulaValues}>
            <View style={styles.formulaChip}>
              <Text style={styles.formulaChipLabel}>RECOVERY</Text>
              <Text style={[styles.formulaChipVal, { color: COLORS.cyan }]}>{recoveryScore}</Text>
            </View>
            <Text style={styles.formulaOp}>x0.7 -</Text>
            <View style={styles.formulaChip}>
              <Text style={styles.formulaChipLabel}>PAIN</Text>
              <Text style={[styles.formulaChipVal, { color: COLORS.danger }]}>{painScore}</Text>
            </View>
            <Text style={styles.formulaOp}>x0.3</Text>
          </View>
        </View>
      </View>

      {/* Metric Cards */}
      <Text style={styles.sectionLabel}>BIOMETRICS</Text>
      <View style={styles.metricsGrid}>
        <StatCard label="HRV" value={latest?.hrv ?? '--'} unit="ms" accent={COLORS.cyan} />
        <StatCard label="RHR" value={latest?.rhr ?? '--'} unit="bpm" accent={COLORS.purple} />
        <StatCard label="Sleep" value={latest?.sleepHours ?? '--'} unit="hrs" accent={COLORS.lime} />
        <StatCard label="Quality" value={latest?.sleepQuality ?? '--'} unit="%" accent={COLORS.warning} />
      </View>

      {/* Device Sync */}
      {Platform.OS !== 'web' && (
        <>
          <Text style={[styles.sectionLabel, { marginTop: SPACING.lg }]}>DEVICE SYNC</Text>
          <View style={styles.syncCard}>
        {lastSync && (
          <View style={styles.syncDeviceRow}>
            <Ionicons name="watch-outline" size={16} color={COLORS.cyan} />
            <Text style={styles.syncDeviceName}>{lastSync.device}</Text>
            <View style={styles.syncConnectedDot} />
            <Text style={styles.syncConnectedText}>CONNECTED</Text>
          </View>
        )}
        <View style={styles.syncGrid}>
          {[
            { label: 'HRV', val: lastSync?.hrv, unit: 'ms', color: COLORS.cyan },
            { label: 'RHR', val: lastSync?.rhr, unit: 'bpm', color: COLORS.purple },
            { label: 'SLEEP', val: lastSync?.sleepHours, unit: 'hrs', color: COLORS.lime },
          ].map(({ label, val, unit, color: c }) => (
            <View key={label} style={styles.syncMetric}>
              <Text style={[styles.syncMetricLabel, { color: c }]}>{label}</Text>
              <Text style={styles.syncMetricVal}>
                {syncing ? '...' : (val ?? '—')}
              </Text>
              <Text style={styles.syncMetricUnit}>{unit}</Text>
            </View>
          ))}
        </View>
        <Pressable
          style={[styles.syncBtn, syncing && { opacity: 0.6 }]}
          onPress={handleSync}
          disabled={syncing}
        >
          <Ionicons name={syncing ? 'sync' : 'sync-outline'} size={16} color={COLORS.textInverse} />
          <Text style={styles.syncBtnText}>{syncing ? 'SYNCING...' : 'SYNC DEVICE'}</Text>
        </Pressable>
        <Text style={styles.syncNote}>
          Supports: Apple Watch • Garmin • Whoop • Polar • Google Fit
        </Text>
      </View>

      {/* AI Recovery Suggestions */}
      <Text style={[styles.sectionLabel, { marginTop: SPACING.lg }]}>AI RECOVERY SUGGESTIONS</Text>
      
      {!aiRec ? (
        <View style={[styles.suggestionsCard, { borderColor: color + '40', alignItems: 'center', paddingVertical: SPACING.xl }]}>
           <Ionicons name="sparkles" size={24} color={COLORS.cyan} style={{ marginBottom: SPACING.sm }} />
           <Text style={[styles.suggestionsTitle, { textAlign: 'center', marginBottom: SPACING.md }]}>
             Generate an elite AI recovery plan based on your recent performances, sleep, and injuries.
           </Text>
           <Pressable
            style={[styles.syncBtn, { width: '80%' }, fetchingAI && { opacity: 0.6 }]}
            onPress={handleGenerateAI}
            disabled={fetchingAI}
          >
            <Text style={styles.syncBtnText}>{fetchingAI ? 'ANALYZING...' : 'GENERATE AI PLAN'}</Text>
          </Pressable>
        </View>
      ) : (
        <View style={[styles.suggestionsCard, { borderColor: aiRec.shouldRest ? COLORS.danger : COLORS.cyan }]}>
          <View style={styles.suggestionsHeader}>
            <Ionicons name="sparkles" size={16} color={aiRec.shouldRest ? COLORS.danger : COLORS.cyan} />
            <Text style={[styles.suggestionsTitle, { color: aiRec.shouldRest ? COLORS.danger : COLORS.cyan }]}>
              {aiRec.shouldRest ? 'REST HIGHLY RECOMMENDED' : 'RECOVERY PLAN ACTIVE'}
            </Text>
          </View>
          
          {aiRec.restReason ? (
            <View style={styles.suggestionItem}>
              <View style={[styles.suggestionDot, { backgroundColor: COLORS.danger }]} />
              <Text style={styles.suggestionText}><Text style={{fontWeight:'bold'}}>Why Rest:</Text> {aiRec.restReason}</Text>
            </View>
          ) : null}
          
          <View style={styles.suggestionItem}>
            <View style={[styles.suggestionDot, { backgroundColor: COLORS.cyan }]} />
            <Text style={styles.suggestionText}><Text style={{fontWeight:'bold'}}>Plan:</Text> {aiRec.recoveryPlan}</Text>
          </View>
          
          {aiRec.medicalAdvice ? (
            <View style={styles.suggestionItem}>
              <View style={[styles.suggestionDot, { backgroundColor: COLORS.warning }]} />
              <Text style={styles.suggestionText}><Text style={{fontWeight:'bold'}}>Medical:</Text> {aiRec.medicalAdvice}</Text>
            </View>
          ) : null}
          
          <Pressable style={{ marginTop: SPACING.md }} onPress={() => setAiRec(null)}>
            <Text style={{ color: COLORS.textMuted, fontSize: 10, textAlign: 'right' }}>CLEAR PLAN</Text>
          </Pressable>
        </View>
      )}

      {/* 7-Day History */}
      <Text style={[styles.sectionLabel, { marginTop: SPACING.lg }]}>7-DAY READINESS HISTORY</Text>
      <View style={styles.historyChart}>
        {(recovery.length ? recovery.slice(0, 7).reverse() : Array(7).fill(null)).map((entry, i) => {
          const score = entry ? calculateReadiness(entry.recoveryScore, entry.painScore) : 0;
          const { color: barColor } = getReadinessLabel(score, t);
          return (
            <View key={i} style={styles.barContainer}>
              <Text style={styles.barVal}>{entry ? score : ''}</Text>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { height: `${score}%`, backgroundColor: barColor }]} />
              </View>
              <Text style={styles.barDay}>
                {entry ? new Date(entry.date).toLocaleDateString('en', { weekday: 'narrow' }) : 'D' + (i + 1)}
              </Text>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  greeting: { fontFamily: FONTS.mono, fontSize: 13, letterSpacing: 2, textTransform: 'uppercase' },
  name: { fontFamily: FONTS.display, fontSize: 32, marginTop: 4 },
  sectionTitle: { fontFamily: FONTS.display, fontSize: 20, marginBottom: 12, marginTop: 24, paddingHorizontal: 20 },
  alertCard: { flexDirection: 'row', alignItems: 'flex-start', padding: 16, borderRadius: RADIUS.lg, borderWidth: 1, marginTop: 24 },

  content: { padding: SPACING.md, paddingBottom: 120 },
  header: { paddingTop: SPACING.md, marginBottom: SPACING.lg },
  title: { fontFamily: FONTS.display, fontSize: 36, color: COLORS.textPrimary, letterSpacing: 3 },
  subtitle: { fontFamily: FONTS.mono, fontSize: 10, color: COLORS.textMuted, letterSpacing: 2 },
  sectionLabel: { fontFamily: FONTS.mono, fontSize: 10, color: COLORS.textMuted, letterSpacing: 2, marginBottom: SPACING.sm },
  ringCard: {
    backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg, borderWidth: 1,
    borderColor: COLORS.border, padding: SPACING.lg, marginBottom: SPACING.lg,
  },
  ringCenter: { alignItems: 'center', marginBottom: SPACING.lg },
  ringFooter: { alignItems: 'center', gap: SPACING.sm },
  formulaLabel: { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.textMuted, letterSpacing: 1, textAlign: 'center' },
  formulaValues: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  formulaChip: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.sm, padding: SPACING.sm, alignItems: 'center',
  },
  formulaChipLabel: { fontFamily: FONTS.mono, fontSize: 8, color: COLORS.textMuted, letterSpacing: 1 },
  formulaChipVal: { fontFamily: FONTS.display, fontSize: 20 },
  formulaOp: { fontFamily: FONTS.mono, fontSize: 11, color: COLORS.textMuted },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  syncCard: {
    backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg, borderWidth: 1,
    borderColor: COLORS.border, padding: SPACING.lg,
  },
  syncDeviceRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.md },
  syncDeviceName: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.textPrimary, flex: 1 },
  syncConnectedDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.success },
  syncConnectedText: { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.success, letterSpacing: 1.5 },
  syncGrid: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: SPACING.lg },
  syncMetric: { alignItems: 'center', gap: 4 },
  syncMetricLabel: { fontFamily: FONTS.mono, fontSize: 9, letterSpacing: 1.5 },
  syncMetricVal: { fontFamily: FONTS.display, fontSize: 28, color: COLORS.textPrimary, lineHeight: 32 },
  syncMetricUnit: { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.textMuted },
  syncBtn: {
    flexDirection: 'row', gap: SPACING.sm, backgroundColor: COLORS.cyan,
    borderRadius: RADIUS.md, padding: SPACING.md, alignItems: 'center', justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  syncBtnText: { fontFamily: FONTS.mono, fontSize: 12, color: COLORS.textInverse, letterSpacing: 1.5 },
  syncNote: { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.textMuted, textAlign: 'center', letterSpacing: 0.5 },
  suggestionsCard: {
    backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg, borderWidth: 1, padding: SPACING.lg,
  },
  suggestionsHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.md },
  suggestionsTitle: { fontFamily: FONTS.mono, fontSize: 11, letterSpacing: 1 },
  suggestionItem: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm, marginBottom: SPACING.sm },
  suggestionDot: { width: 6, height: 6, borderRadius: 3, marginTop: 5 },
  suggestionText: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.textSecondary, flex: 1, lineHeight: 20 },
  historyChart: {
    flexDirection: 'row', gap: SPACING.sm, backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border,
    padding: SPACING.md, height: 140, alignItems: 'flex-end',
  },
  barContainer: { flex: 1, alignItems: 'center', gap: 4 },
  barVal: { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.textMuted },
  barTrack: {
    flex: 1, width: '100%', backgroundColor: COLORS.surface,
    borderRadius: RADIUS.sm, overflow: 'hidden', justifyContent: 'flex-end',
  },
  barFill: { width: '100%', borderRadius: RADIUS.sm },
  barDay: { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.textMuted },
});

function CoachRecoveryView() {
  const { profile, user } = useAppStore();
  const { t } = useTranslation();
  const { colors } = useTheme();

  const [activeLegion, setActiveLegion] = useState<any>(null);
  const [athletes, setAthletes] = useState<any[]>([]);
  const [selectedAthlete, setSelectedAthlete] = useState<any | null>(null);
  
  const [athleteRecovery, setAthleteRecovery] = useState<any[]>([]);
  const [noteInput, setNoteInput] = useState('');
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (profile?.legionId && profile?.role === 'coach') {
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

  useEffect(() => {
    if (selectedAthlete) {
      const unsubRec = subscribeToRecovery(selectedAthlete.uid, setAthleteRecovery);
      return unsubRec;
    } else {
      setAthleteRecovery([]);
    }
  }, [selectedAthlete]);

  const handleSendNote = async () => {
    if (!selectedAthlete || !noteInput.trim() || !user) return;
    setIsSending(true);
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
    setIsSending(false);
  };

  const avgRecoveryScore = athleteRecovery.length > 0 
    ? Math.round(athleteRecovery.reduce((acc, curr) => acc + curr.recoveryScore, 0) / athleteRecovery.length)
    : 0;

  const aiSuggestion = avgRecoveryScore > 0 && avgRecoveryScore < 50
    ? `AI INSIGHT: ${selectedAthlete?.name} has a chronically low recovery score (${avgRecoveryScore}%). Recommend decreasing training volume by 20% and prioritizing sleep.`
    : avgRecoveryScore >= 80 
      ? `AI INSIGHT: ${selectedAthlete?.name} is recovering exceptionally well (${avgRecoveryScore}%). Ready for peak performance block.`
      : `AI INSIGHT: ${selectedAthlete?.name} is maintaining a balanced recovery (${avgRecoveryScore}%). Standard programming is appropriate.`;

  return (
    <ScrollView style={[globalStyles.screen, { backgroundColor: colors.bg }]} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.greeting, { color: colors.textMuted }]}>Coach Assignments</Text>
          <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>RECOVERY MANAGER</Text>
        </View>
      </View>

      <Text style={[styles.sectionTitle, { color: colors.textPrimary, paddingHorizontal: 20 }]}>Athlete Recovery Status</Text>
      <View style={{ paddingHorizontal: 20 }}>
        {athletes.length === 0 ? (
          <View style={{ padding: 20, alignItems: 'center', backgroundColor: colors.surface, borderRadius: 16 }}>
            <Text style={{ color: colors.textMuted }}>No athletes in your legion.</Text>
          </View>
        ) : (
          athletes.map(athlete => {
            const hasInjuries = activeLegion?.athlete_status?.[athlete.uid]?.[Object.keys(activeLegion?.athlete_status[athlete.uid] || {})[0]]?.injuryStatus?.startsWith('Yes');
            return (
              <Pressable 
                key={athlete.uid}
                style={{ padding: 16, backgroundColor: colors.surface, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
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
      </View>

      <Modal visible={!!selectedAthlete} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelectedAthlete(null)}>
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 20, paddingTop: 60, borderBottomWidth: 1, borderColor: colors.border }}>
            <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.textPrimary }}>{selectedAthlete?.name}'s Recovery</Text>
            <Pressable onPress={() => setSelectedAthlete(null)}>
              <Ionicons name="close-circle" size={28} color={colors.textMuted} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
            
            <View style={[styles.alertCard, { backgroundColor: COLORS.purple + '15', borderColor: COLORS.purple + '40' }]}>
              <Ionicons name="sparkles" size={18} color={COLORS.purple} />
              <View style={{ flex: 1, marginLeft: SPACING.sm }}>
                <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.purple, marginBottom: 2, letterSpacing: 1 }}>
                  RECOVO AI RECOMMENDATION
                </Text>
                <Text style={{ fontFamily: FONTS.body, fontSize: 14, color: colors.textPrimary, lineHeight: 20 }}>
                  {aiSuggestion}
                </Text>
              </View>
            </View>

            <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: 'bold', marginTop: 10 }}>Recent Recovery Logs</Text>
            {athleteRecovery.length === 0 ? (
              <Text style={{ color: colors.textMuted }}>No recovery data logged recently.</Text>
            ) : (
              athleteRecovery.slice(0, 5).map(rec => (
                <View key={rec.id} style={{ padding: 16, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}>
                  <Text style={{ color: colors.textPrimary, fontWeight: 'bold' }}>Score: {rec.recoveryScore}%</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Pain: {rec.painScore}/10 | Fatigue: {rec.fatigueScore}/10</Text>
                </View>
              ))
            )}

            <View style={{ marginTop: 20 }}>
              <Text style={{ color: colors.textSecondary, marginBottom: 8, fontSize: 14, fontWeight: '600' }}>Leave a Note</Text>
              <TextInput
                style={{ backgroundColor: colors.surface, color: colors.textPrimary, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.border, minHeight: 100, textAlignVertical: 'top' }}
                multiline
                placeholder="E.g., Great job on your recovery..."
                placeholderTextColor={colors.textMuted}
                value={noteInput}
                onChangeText={setNoteInput}
              />
            </View>

            <Pressable 
              disabled={isSending || !noteInput.trim()}
              style={{ backgroundColor: '#FF5A1F', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 16, opacity: noteInput.trim() ? 1 : 0.5 }}
              onPress={handleSendNote}
            >
              <Text style={{ color: '#000', fontWeight: 'bold', fontSize: 16 }}>{isSending ? 'Sending...' : 'Send Note'}</Text>
            </Pressable>
          </ScrollView>
        </View>
      </Modal>
    </ScrollView>
  );
}

export default function RecoveryScreen() {
  const { profile } = useAppStore();
  if (profile?.role === 'coach') return <CoachRecoveryView />;
  return <AthleteRecoveryView />;
}