import { useTranslation } from '@/hooks/useTranslation';
import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, Modal, TextInput, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAppStore } from '@/store/useAppStore';
import { COLORS, FONTS, SPACING, RADIUS, globalStyles } from '@/utils/theme';
import { saveDailyStatus } from '@/services/firebase';
import { useTheme } from '@/hooks/useTheme';
import { subscribeToLegion, fetchAthleteProfiles, subscribeToDailyStatus, subscribeToInjuries } from '@/services/firebase';
import { AnatomicalModel3D } from '@/components/common/AnatomicalModel3D';
import { BouncyButton } from '@/components/common/BouncyButton';
import Svg, { Circle, Path as SvgPath, G } from 'react-native-svg';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, withSequence, withRepeat } from 'react-native-reanimated';




const MOOD_LABELS: Record<string, string[]> = {
  en: ['Terrible', 'Low', 'Neutral', 'Good', 'Elite'],
  fr: ['Terrible', 'Faible', 'Neutre', 'Bon', 'Élite'],
  es: ['Terrible', 'Bajo', 'Neutral', 'Bueno', 'Élite'],
  de: ['Schrecklich', 'Niedrig', 'Neutral', 'Gut', 'Elite'],
  hi: ['बहुत बुरा', 'बुरा', 'सामान्य', 'अच्छा', 'बहुत अच्छा'],
};

const AnimatedSvg = Animated.createAnimatedComponent(Svg);

function AnimatedFace({ rating, active }: { rating: number; active: boolean }) {
  const scale = useSharedValue(1);
  
  useEffect(() => {
    if (active) {
      scale.value = withRepeat(withSequence(withTiming(1.1, {duration: 300}), withTiming(1, {duration: 300})), -1, true);
    } else {
      scale.value = withTiming(1);
    }
  }, [active]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }]
  }));

  const getMouth = () => {
    switch(rating) {
      case 1: return "M 8 18 Q 12 14 16 18"; // sad
      case 2: return "M 9 17 Q 12 15 15 17"; // slightly sad
      case 3: return "M 9 16 L 15 16"; // neutral
      case 4: return "M 9 15 Q 12 17 15 15"; // smile
      case 5: return "M 8 14 Q 12 20 16 14"; // big smile
      default: return "M 9 16 L 15 16";
    }
  };

  const getEyes = () => {
    if (rating === 1) return <G><SvgPath d="M 7 9 L 10 12 M 10 9 L 7 12" stroke="#fff" strokeWidth="1.5" /><SvgPath d="M 14 9 L 17 12 M 17 9 L 14 12" stroke="#fff" strokeWidth="1.5" /></G>;
    if (rating === 5) return <G><SvgPath d="M 8.5 9 L 8.5 11 M 7.5 10 L 9.5 10" stroke="#fff" strokeWidth="1.5" /><SvgPath d="M 15.5 9 L 15.5 11 M 14.5 10 L 16.5 10" stroke="#fff" strokeWidth="1.5" /></G>;
    return <G><Circle cx="8.5" cy="10" r="1.5" fill="#fff" /><Circle cx="15.5" cy="10" r="1.5" fill="#fff" /></G>;
  };

  const colorsByRating = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e'];
  const color = colorsByRating[rating - 1];

  return (
    <Animated.View style={animatedStyle}>
      <Svg width="24" height="24" viewBox="0 0 24 24">
        <Circle cx="12" cy="12" r="11" fill={color} />
        {getEyes()}
        <SvgPath d={getMouth()} stroke="#fff" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      </Svg>
    </Animated.View>
  );
}


interface ScalePickerProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  color?: string;
}

const ScalePicker: React.FC<ScalePickerProps> = ({
  label, value, onChange, color = COLORS.accent,
}) => {
  const { colors } = useTheme();
  return (
    <View style={sp.container}>
      <View style={sp.header}>
        <Text style={[sp.label, { color: colors.textMuted }]}>{label}</Text>
        <Text style={[sp.value, { color }]}>{value}/5</Text>
      </View>
      <View style={sp.row}>
        {[1, 2, 3, 4, 5].map((n) => (
          <BouncyButton
            key={n}
            onPress={() => onChange(n)}
            style={[
              sp.dot,
              { backgroundColor: colors.surface, borderColor: colors.border },
              n <= value && { backgroundColor: color, borderColor: color },
            ]}
          >
            <View style={{width: '100%', height: '100%'}} />
          </BouncyButton>
        ))}
      </View>
    </View>
  );
};

const sp = StyleSheet.create({
  container: { marginBottom: SPACING.md },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.xs },
  label: { fontFamily: FONTS.mono, fontSize: 10, letterSpacing: 1.5 },
  value: { fontFamily: FONTS.display, fontSize: 18, lineHeight: 22 },
  row: { flexDirection: 'row', gap: SPACING.sm },
  dot: {
    flex: 1, height: 36, borderRadius: RADIUS.sm,
    borderWidth: 1,
  },
});

function AthleteDailyStatusView() {
  const { user, profile } = useAppStore();
  const { t, lang } = useTranslation();
  const moodLabels = MOOD_LABELS[lang] || MOOD_LABELS.en;
  const { colors } = useTheme();
  const [mood, setMood] = useState(3);
  const [energy, setEnergy] = useState(3);
  const [stress, setStress] = useState(2);
  const [sleepQuality, setSleepQuality] = useState(3);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const isLocked = !profile?.legionId;

  const handleSubmit = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await saveDailyStatus(user.uid, {
        uid: user.uid,
        date: Date.now(),
        mood,
        energy,
        stress,
        sleepQuality,
        notes,
        legionId: profile?.legionId,
      });
      setSaved(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert('Error', 'Could not save status.');
    }
    setSaving(false);
  };

  if (isLocked) {
    return (
      <View style={[globalStyles.screen, styles.lockedContainer, { backgroundColor: colors.bg }]}>
        <Ionicons name="lock-closed" size={48} color={colors.border} />
        <Text style={[styles.lockedTitle, { color: colors.textPrimary }]}>{t.joinLegion}</Text>
        <Text style={[styles.lockedSub, { color: colors.textMuted }]}>
          {t.dailyStatusLockDesc}
        </Text>
      </View>
    );
  }

  if (saved) {
    return (
      <View style={[globalStyles.screen, styles.savedContainer, { backgroundColor: colors.bg }]}>
        <Ionicons name="checkmark-circle" size={64} color={COLORS.success} />
        <Text style={styles.savedTitle}>{t.statusLogged}</Text>
        <Text style={[styles.savedSub, { color: colors.textMuted }]}>{t.coachNotified}</Text>
        <Pressable style={[styles.savedBtn, { borderColor: colors.border }]} onPress={() => setSaved(false)}>
          <Text style={[styles.savedBtnText, { color: colors.textMuted }]}>{t.logAgain}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={[globalStyles.screen, { backgroundColor: colors.bg }]} contentContainerStyle={styles.content}>
      <View>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>{t.dailyStatusTitle}</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>{t.howFeelingToday}</Text>
        </View>

        {/* Mood Selector */}
        <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{t.mood}</Text>
          <View style={styles.moodRow}>
            {[1, 2, 3, 4, 5].map((rating, i) => (
              <BouncyButton
                key={i}
                onPress={() => setMood(rating)}
                style={[
                  styles.moodBtn,
                  mood === rating && [styles.moodBtnActive, { borderColor: colors.borderAccent, backgroundColor: colors.bgCardHover }],
                ]}
              >
                <AnimatedFace rating={rating} active={mood === rating} />
                <Text style={[
                  styles.moodLabel,
                  { color: mood === rating ? COLORS.accent : colors.textMuted },
                ]}>
                  {moodLabels[i]}
                </Text>
              </BouncyButton>
            ))}
          </View>
        </View>

        {/* Scale pickers */}
        <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <ScalePicker
            label={t.energyLevel}
            value={energy}
            onChange={setEnergy}
            color={COLORS.lime}
          />
          <ScalePicker
            label={t.stressLevel}
            value={stress}
            onChange={setStress}
            color={COLORS.danger}
          />
          <ScalePicker
            label={t.sleepQualityStatus}
            value={sleepQuality}
            onChange={setSleepQuality}
            color={COLORS.accent}
          />
        </View>

        {/* Notes */}
        <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{t.notesForCoach}</Text>
          <TextInput
            style={[styles.notesInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
            value={notes}
            onChangeText={setNotes}
            placeholder={t.notesPlaceholder}
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Submit */}
        <Pressable
          style={[styles.submitBtn, saving && { opacity: 0.5 }]}
          onPress={handleSubmit}
          disabled={saving}
        >
          <Ionicons name="send" size={18} color={COLORS.textInverse} />
          <Text style={styles.submitBtnText}>
            {saving ? t.submitting : t.submitToCoach}
          </Text>
        </Pressable>
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
  sectionLabel: {
    fontFamily: FONTS.mono, fontSize: 10, color: COLORS.textMuted,
    letterSpacing: 2, marginBottom: SPACING.sm,
  },
  card: {
    backgroundColor: COLORS.bgCard, borderRadius: RADIUS.xl, borderWidth: 1,
    borderColor: COLORS.border, padding: SPACING.lg, marginBottom: SPACING.md,
  },
  moodRow: { flexDirection: 'row', justifyContent: 'space-between' },
  moodBtn: {
    alignItems: 'center', gap: 4, padding: SPACING.sm, flex: 1,
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: 'transparent',
  },
  moodBtnActive: {
    borderColor: COLORS.accent + '60',
    backgroundColor: COLORS.accent + '10',
  },
  moodIcon: { fontSize: 24 },
  moodLabel: {
    fontFamily: FONTS.mono, fontSize: 8, color: COLORS.textMuted,
    letterSpacing: 1, textAlign: 'center',
  },
  notesInput: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.sm, borderWidth: 1,
    borderColor: COLORS.border, padding: SPACING.sm, fontFamily: FONTS.body,
    fontSize: 13, color: COLORS.textPrimary, minHeight: 96,
  },
  submitBtn: {
    flexDirection: 'row', gap: SPACING.sm, backgroundColor: COLORS.accent,
    borderRadius: RADIUS.md, padding: SPACING.md + 2,
    alignItems: 'center', justifyContent: 'center',
  },
  submitBtnText: {
    fontFamily: FONTS.mono, fontSize: 13, color: COLORS.textInverse, letterSpacing: 2,
  },
  lockedContainer: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: SPACING.xl, gap: SPACING.md,
  },
  lockedTitle: {
    fontFamily: FONTS.display, fontSize: 28, color: COLORS.textPrimary,
    letterSpacing: 3, textAlign: 'center',
  },
  lockedSub: {
    fontFamily: FONTS.body, fontSize: 13, color: COLORS.textMuted,
    textAlign: 'center', lineHeight: 20,
  },
  savedContainer: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: SPACING.xl, gap: SPACING.md,
  },
  savedTitle: {
    fontFamily: FONTS.display, fontSize: 32, color: COLORS.success, letterSpacing: 3,
  },
  savedSub: {
    fontFamily: FONTS.body, fontSize: 13, color: COLORS.textMuted,
  },
  savedBtn: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, marginTop: SPACING.sm,
  },
  savedBtnText: {
    fontFamily: FONTS.mono, fontSize: 11, color: COLORS.textMuted, letterSpacing: 1.5,
  },
});



function CoachDailyStatusView() {
  const { profile } = useAppStore();
  const { t } = useTranslation();
  const { colors } = useTheme();

  const [activeLegion, setActiveLegion] = useState<any>(null);
  const [athletes, setAthletes] = useState<any[]>([]);
  const [selectedAthlete, setSelectedAthlete] = useState<any | null>(null);
  const [athleteInjuries, setAthleteInjuries] = useState<any[]>([]);
  const [athleteStatus, setAthleteStatus] = useState<any[]>([]);

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
      const unsubInj = subscribeToInjuries(selectedAthlete.uid, setAthleteInjuries);
      const unsubStatus = subscribeToDailyStatus(selectedAthlete.uid, setAthleteStatus);
      return () => {
        unsubInj();
        unsubStatus();
      };
    } else {
      setAthleteInjuries([]);
      setAthleteStatus([]);
    }
  }, [selectedAthlete]);

  const activeInjuriesList = athleteInjuries.filter(i => !i.resolved);
  
  return (
    <ScrollView style={[globalStyles.screen, { backgroundColor: colors.bg }]} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.greeting, { color: colors.textMuted }]}>Team Overview</Text>
          <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>ATHLETE STATUS</Text>
        </View>
      </View>

      <Text style={[styles.sectionTitle, { color: colors.textPrimary, paddingHorizontal: 20 }]}>Roster Status</Text>
      <View style={{ paddingHorizontal: 20 }}>
        {athletes.length === 0 ? (
          <View style={{ padding: 20, alignItems: 'center', backgroundColor: colors.surface, borderRadius: 16 }}>
            <Text style={{ color: colors.textMuted }}>No athletes in your legion.</Text>
          </View>
        ) : (
          athletes.map(athlete => {
            const todayStatus = activeLegion?.athlete_status?.[athlete.uid]?.[Object.keys(activeLegion?.athlete_status[athlete.uid] || {})[0]];
            const readiness = todayStatus?.readiness || 'Unknown';
            const mood = todayStatus?.mood || 'Neutral';
            const hasInjuries = todayStatus?.injuryStatus?.startsWith('Yes');
            
            return (
              <Pressable 
                key={athlete.uid}
                style={{ padding: 16, backgroundColor: colors.surface, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                onPress={() => setSelectedAthlete(athlete)}
              >
                <View>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: colors.textPrimary }}>{athlete.name}</Text>
                  <Text style={{ fontSize: 12, color: colors.textSecondary }}>Mood: {mood} | Readiness: {readiness}</Text>
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
            <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.textPrimary }}>{selectedAthlete?.name}'s Profile</Text>
            <Pressable onPress={() => setSelectedAthlete(null)}>
              <Ionicons name="close-circle" size={28} color={colors.textMuted} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
            
            <View style={{ backgroundColor: colors.surface, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ color: colors.textPrimary, fontWeight: 'bold', fontSize: 16, marginBottom: 8 }}>Overall Summary</Text>
              <Text style={{ color: colors.textSecondary, marginBottom: 4 }}>Sport: {selectedAthlete?.sport}</Text>
              <Text style={{ color: colors.textSecondary, marginBottom: 4 }}>Active Injuries: {activeInjuriesList.length}</Text>
              <Text style={{ color: colors.textSecondary, marginBottom: 4 }}>Risk Level: {selectedAthlete?.sport === 'Football' || selectedAthlete?.sport === 'Basketball' ? 'High' : 'Moderate'} (Based on Sport Workload)</Text>
            </View>

            <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.textPrimary, marginTop: 10, textAlign: 'center' }}>Pain Logging (3D Model)</Text>
            <View style={{ alignItems: 'center', marginBottom: 30, height: 400 }}>
              {/* As requested: Wireframe 3D model for this Coach view */}
              <AnatomicalModel3D activeRegionIds={new Set(activeInjuriesList.map(i => i.bodyPart))} activeInjuries={activeInjuriesList} selectedRegion={null} onRegionSelect={() => {}} />
              {activeInjuriesList.length === 0 && (
                <Text style={{ color: colors.textMuted, marginTop: -40 }}>No active injuries reported.</Text>
              )}
            </View>

          </ScrollView>
        </View>
      </Modal>
    </ScrollView>
  );
}

export default function DailyStatusScreen() {
  const { profile } = useAppStore();
  if (profile?.role === 'coach') return <CoachDailyStatusView />;
  return <AthleteDailyStatusView />;
}