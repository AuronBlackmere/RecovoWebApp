import { useTranslation } from '@/hooks/useTranslation';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, TextInput, Alert, Animated, Modal, Switch, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAppStore } from '@/store/useAppStore';
import { COLORS, FONTS, SPACING, RADIUS, globalStyles } from '@/utils/theme';
import {
  calculateCalories,
  formatDuration,
  formatDate,
  calculateVulnerabilities,
  generateInjuryPreventionRoutine,
  generateRecoveryPlan,
  Vulnerability,
  PreventionExercise,
  RecoveryStep,
} from '@/utils/calculations';
import { saveWorkoutSession } from '@/services/firebase';
import type { WorkoutSet } from '@/services/firebase';
import { useTheme } from '@/hooks/useTheme';
import Svg, { Circle, G } from 'react-native-svg';
import { subscribeToLegion, fetchAthleteProfiles, saveInboxMessage } from '@/services/firebase';
import type { UserProfile, Legion } from '@/services/firebase';


const SPORTS_LIST = ['Football', 'Basketball', 'Cricket', 'Wrestling', 'Boxing', 'Tennis', 'Running', 'Weightlifting', 'Mixed Martial Arts (MMA)'];

const DEFAULT_WEIGHTLIFTING = [
  { name: 'Bench Press', targetSets: 4, targetReps: 10, targetWeight: 60 },
  { name: 'Squats', targetSets: 4, targetReps: 10, targetWeight: 80 },
  { name: 'Shoulder Press', targetSets: 3, targetReps: 12, targetWeight: 40 },
];

const DEFAULT_CALISTHENICS = [
  { name: 'Pull-Ups', targetSets: 4, targetReps: 10, targetWeight: 0 },
  { name: 'Push-Ups', targetSets: 4, targetReps: 15, targetWeight: 0 },
  { name: 'Dips', targetSets: 3, targetReps: 12, targetWeight: 0 },
];

function AthleteTracksView() {
  const { user, profile, workouts, injuries, activeSession, startSession, stopSession, addSet, tickSession } = useAppStore();
  const { t } = useTranslation();
  const { colors } = useTheme();

  // Basic Planner States
  const [sessionType, setSessionType] = useState<'weightlifting' | 'calisthenics' | 'running'>('weightlifting');
  const [saving, setSaving] = useState(false);
  
  // Custom Exercises list for Weightlifting/Calisthenics
  const [customExercises, setCustomExercises] = useState(DEFAULT_WEIGHTLIFTING);
  
  // Custom Running parameters
  const [targetDistance, setTargetDistance] = useState('5.0');
  const [targetDuration, setTargetDuration] = useState('30');
  const [actualDistance, setActualDistance] = useState('5.0');
  
  // Add Exercise Form Modal States
  const [showAddModal, setShowAddModal] = useState(false);
  const [newExName, setNewExName] = useState('');
  const [newExSets, setNewExSets] = useState('4');
  const [newExReps, setNewExReps] = useState('10');
  const [newExWeight, setNewExWeight] = useState('60');

  // Injury Prevention Activation check-offs
  const [checkedPrevention, setCheckedPrevention] = useState<Record<string, boolean>>({});
  const [showActivationList, setShowActivationList] = useState(true);
  const [selectedSport, setSelectedSport] = useState<string | null>(null);
  const [showSportModal, setShowSportModal] = useState(false);
  const currentSport = selectedSport || profile?.sport || 'Football';

  // Active Workout Parameters
  const [activeExerciseIdx, setActiveExerciseIdx] = useState(0);
  const [completedSetsTracker, setCompletedSetsTracker] = useState<Record<string, boolean>>({}); // key = "exIndex-setIndex" -> checked
  const [restTime, setRestTime] = useState(0);

  // Post-Workout Recovery Planner Modal
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [recoveryPlan, setRecoveryPlan] = useState<{ intensity: 'low' | 'medium' | 'high'; steps: RecoveryStep[] } | null>(null);
  const [completedRecoverySteps, setCompletedRecoverySteps] = useState<Record<string, boolean>>({});
  const [breathingActive, setBreathingActive] = useState(false);
  const [breathingPhase, setBreathingPhase] = useState<'inhale' | 'hold' | 'exhale' | 'idle'>('idle');
  const [breathingSeconds, setBreathingSeconds] = useState(4);
  const [breathingCycleCount, setBreathingCycleCount] = useState(0);

  // Timer Ref
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const breathingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Animations
  const popupAnim = useRef(new Animated.Value(0)).current;
  const [showPopup, setShowPopup] = useState(false);
  const [popupText, setPopupText] = useState('');
  const recordingPulse = useRef(new Animated.Value(1)).current;

  // Sync session type defaults
  useEffect(() => {
    if (sessionType === 'weightlifting') {
      setCustomExercises(DEFAULT_WEIGHTLIFTING);
    } else if (sessionType === 'calisthenics') {
      setCustomExercises(DEFAULT_CALISTHENICS);
    } else {
      setCustomExercises([]);
    }
    setCompletedSetsTracker({});
    setActiveExerciseIdx(0);
  }, [sessionType]);

  // Session timer
  useEffect(() => {
    if (activeSession.running) {
      timerRef.current = setInterval(() => tickSession(), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [activeSession.running]);

  // Live blink indicator
  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    if (activeSession.running) {
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(recordingPulse, { toValue: 0.3, duration: 800, useNativeDriver: true }),
          Animated.timing(recordingPulse, { toValue: 1.0, duration: 800, useNativeDriver: true }),
        ])
      );
      loop.start();
    } else {
      recordingPulse.setValue(1);
    }
    return () => { if (loop) loop.stop(); };
  }, [activeSession.running]);

  // Rest Timer Countdown
  useEffect(() => {
    let countdown: any = null;
    if (restTime > 0) {
      countdown = setInterval(() => {
        setRestTime((prev) => {
          if (prev <= 1) {
            clearInterval(countdown);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => { if (countdown) clearInterval(countdown); };
  }, [restTime]);

  // Breathing cycles (4-7-8 method or box breathing depending on intensity)
  useEffect(() => {
    if (breathingActive) {
      const isHighIntensity = recoveryPlan?.intensity === 'high';
      // High: 4s inhale, 7s hold, 8s exhale (4-7-8)
      // Med/Low: 4s inhale, 4s hold, 4s exhale, 4s hold (Box breathing)
      breathingTimerRef.current = setInterval(() => {
        setBreathingSeconds((prev) => {
          if (prev <= 1) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            if (isHighIntensity) {
              // 4-7-8 Transitions
              if (breathingPhase === 'inhale') {
                setBreathingPhase('hold');
                return 7;
              } else if (breathingPhase === 'hold') {
                setBreathingPhase('exhale');
                return 8;
              } else {
                setBreathingPhase('inhale');
                setBreathingCycleCount((c) => c + 1);
                return 4;
              }
            } else {
              // Box Transitions: 4-4-4-4
              if (breathingPhase === 'inhale') {
                setBreathingPhase('hold');
                return 4;
              } else if (breathingPhase === 'hold') {
                setBreathingPhase('exhale');
                return 4;
              } else {
                setBreathingPhase('inhale');
                setBreathingCycleCount((c) => c + 1);
                return 4;
              }
            }
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (breathingTimerRef.current) clearInterval(breathingTimerRef.current);
      setBreathingPhase('idle');
      setBreathingSeconds(4);
    }
    return () => { if (breathingTimerRef.current) clearInterval(breathingTimerRef.current); };
  }, [breathingActive, breathingPhase, recoveryPlan]);

  // Compute active vulnerabilities and dynamic routines
  // Profile context is passed to personalize AI output based on the user's sport,
  // injury history, training frequency, and age from the onboarding questionnaire.
  const profileContext = useMemo(() => ({
    sport: currentSport,
    painBodyParts: profile?.painBodyParts,
    injuryStatus: profile?.injuryStatus,
    trainingFrequency: profile?.trainingFrequency,
    ageRange: profile?.ageRange,
  }), [currentSport, profile?.painBodyParts, profile?.injuryStatus, profile?.trainingFrequency, profile?.ageRange]);

  const vulnerabilities = useMemo(() => {
    return calculateVulnerabilities(workouts, injuries, profileContext);
  }, [workouts, injuries, profileContext]);

  const activePreventionDrills = useMemo(() => {
    const names = customExercises.map((e) => e.name);
    return generateInjuryPreventionRoutine(sessionType, names, vulnerabilities, currentSport, profile?.role === 'coach');
  }, [sessionType, customExercises, vulnerabilities, currentSport, profile?.role]);

  // Check if current setup targets a vulnerable body part
  const targetedVulnerabilities = useMemo(() => {
    const activeVulns = vulnerabilities.filter((v) => v.level === 'high' || v.level === 'critical');
    if (sessionType === 'running') {
      return activeVulns.filter((v) => ['Knee', 'Ankle', 'Foot', 'Calf', 'Lower Leg'].includes(v.bodyPart));
    }
    // Check resistance exercises
    const names = customExercises.map((e) => e.name.toLowerCase());
    return activeVulns.filter((v) => {
      if (v.bodyPart === 'Knee' || v.bodyPart === 'Quad') {
        return names.some((n) => n.includes('squat') || n.includes('leg') || n.includes('lunge'));
      }
      if (v.bodyPart === 'Lower Back' || v.bodyPart === 'Hamstring' || v.bodyPart === 'Hip') {
        return names.some((n) => n.includes('deadlift') || n.includes('back extension') || n.includes('swing'));
      }
      if (v.bodyPart === 'Shoulder' || v.bodyPart === 'Chest' || v.bodyPart === 'Elbow') {
        return names.some((n) => n.includes('bench') || n.includes('press') || n.includes('push') || n.includes('dip'));
      }
      if (v.bodyPart === 'Upper Back') {
        return names.some((n) => n.includes('pull') || n.includes('row') || n.includes('chin'));
      }
      return false;
    });
  }, [sessionType, customExercises, vulnerabilities]);

  const handleStartWorkout = () => {
    if (sessionType !== 'running' && customExercises.length === 0) {
      if (Platform.OS === 'web') {
        window.alert('Please add at least one exercise to your routine.');
      } else {
        Alert.alert('No Exercises', 'Please add at least one exercise to your routine.');
      }
      return;
    }
    // Check if dynamic routine is active and warned
    const unchecked = activePreventionDrills.some((d, idx) => !checkedPrevention[idx]);
    if (unchecked && activePreventionDrills.length > 0) {
      if (Platform.OS === 'web') {
        const confirmStart = window.confirm(
          'We strongly advise completing the AI Injury Prevention Activation exercises before logging heavy load. Do you want to proceed and skip the warm-up?'
        );
        if (confirmStart) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          startSession();
        }
      } else {
        Alert.alert(
          'Warm-Up Recommended',
          'We strongly advise completing the AI Injury Prevention Activation exercises before logging heavy load. Do you want to proceed?',
          [
            { text: 'Start Warm-Up First', style: 'cancel' },
            {
              text: 'Skip & Start Workout',
              style: 'destructive',
              onPress: () => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                startSession();
              },
            },
          ]
        );
      }
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      startSession();
    }
  };

  const handleAddExercise = () => {
    if (!newExName.trim()) {
      if (Platform.OS === 'web') {
        window.alert('Please enter an exercise name.');
      } else {
        Alert.alert('Required', 'Please enter an exercise name.');
      }
      return;
    }
    const setsVal = parseInt(newExSets) || 4;
    const repsVal = parseInt(newExReps) || 10;
    const weightVal = parseFloat(newExWeight) || 0;
    
    setCustomExercises((prev) => [
      ...prev,
      { name: newExName.trim(), targetSets: setsVal, targetReps: repsVal, targetWeight: weightVal },
    ]);
    
    setNewExName('');
    setShowAddModal(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleRemoveExercise = (idx: number) => {
    setCustomExercises((prev) => prev.filter((_, i) => i !== idx));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleToggleSetCheck = (exIdx: number, setIdx: number) => {
    const key = `${exIdx}-${setIdx}`;
    const wasChecked = !!completedSetsTracker[key];
    
    // Toggle state
    setCompletedSetsTracker((prev) => ({
      ...prev,
      [key]: !wasChecked,
    }));
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (!wasChecked) {
      // Log set to store activeSession
      const targetEx = customExercises[exIdx];
      const newSet: WorkoutSet = {
        exercise: targetEx.name,
        sets: 1,
        reps: targetEx.targetReps,
        weight: targetEx.targetWeight,
        duration: 0.5, // 30s estimate
        met: sessionType === 'calisthenics' ? 6.0 : 5.0,
      };
      
      addSet(newSet);

      // Trigger pop-up toast
      setPopupText(`Logged: Set ${setIdx + 1} of ${targetEx.name}`);
      setShowPopup(true);
      popupAnim.setValue(0);
      Animated.sequence([
        Animated.spring(popupAnim, { toValue: 1, friction: 5, useNativeDriver: true }),
        Animated.delay(1200),
        Animated.timing(popupAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start(() => setShowPopup(false));

      // Start 90s rest countdown
      setRestTime(90);
    }
  };

  const handleFinishWorkout = async () => {
    if (!user) return;
    
    // If running, log a mock run set
    if (sessionType === 'running') {
      const durationMins = parseFloat(targetDuration) || 30;
      const distance = parseFloat(actualDistance) || 5.0;
      
      const runSet: WorkoutSet = {
        exercise: 'Running',
        sets: 1,
        reps: 1,
        weight: 0,
        duration: durationMins,
        met: 9.8,
      };
      
      addSet(runSet);
    }

    if (activeSession.sets.length === 0) {
      if (Platform.OS === 'web') {
        window.alert('Log at least one completed set or run before finishing.');
      } else {
        Alert.alert('No Progress Logged', 'Log at least one completed set or run before finishing.');
      }
      return;
    }

    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    try {
      const weightKg = profile?.weight ?? 75;
      
      // Calculate MET calories
      const durationMins = Math.max(1, Math.round(activeSession.elapsedSeconds / 60));
      const totalCals = activeSession.sets.reduce(
        (acc, s) => acc + calculateCalories(s.exercise, weightKg, s.duration),
        0
      );

      // Save to Firebase
      await saveWorkoutSession(user.uid, {
        uid: user.uid,
        date: Date.now(),
        duration: durationMins,
        caloriesBurned: totalCals,
        sets: activeSession.sets,
      });

      // Generate post-workout recovery plan
      const setsCount = activeSession.sets.length;
      const dist = sessionType === 'running' ? parseFloat(actualDistance) : undefined;
      const plan = generateRecoveryPlan(sessionType, durationMins, setsCount, dist, currentSport);
      setRecoveryPlan(plan);

      // Reset logger states
      stopSession();
      setRestTime(0);
      setCompletedSetsTracker({});
      setCheckedPrevention({});
      
      // Show Recovery Planner modal
      setShowRecoveryModal(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      if (Platform.OS === 'web') {
        window.alert(`Failed to save workout session to the server. Error: ${e.message || e}`);
      } else {
        Alert.alert('Save Error', `Failed to save workout session to the server. Error: ${e.message || e}`);
      }
    }
    setSaving(false);
  };

  // Cooldown timer styles
  const isHighInt = recoveryPlan?.intensity === 'high';
  const totalPhaseSecs = breathingPhase === 'hold' ? (isHighInt ? 7 : 4) : 
                          breathingPhase === 'exhale' ? (isHighInt ? 8 : 4) : 4;
  const progressRatio = breathingPhase !== 'idle' ? (breathingSeconds / totalPhaseSecs) : 1;

  return (
    <ScrollView style={[globalStyles.screen, { backgroundColor: colors.bg }]} contentContainerStyle={styles.content}>
      
      {/* â”€â”€â”€ SETUP SCREEN (Not Running) â”€â”€â”€ */}
      {!activeSession.running ? (
        <View>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>{t.workoutPlanner}</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>{t.customSetLog}</Text>
          </View>

          {/* Session Type horizontal chips */}
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{t.sessionType}</Text>
          <View style={styles.chipRow}>
            {(['weightlifting', 'calisthenics', 'running'] as const).map((type) => (
              <Pressable
                key={type}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSessionType(type);
                }}
                style={[
                  styles.typeChip,
                  { borderColor: colors.border },
                  sessionType === type && { backgroundColor: COLORS.accent, borderColor: COLORS.accent }
                ]}
              >
                <Text style={[styles.typeChipText, { color: colors.textSecondary }, sessionType === type && { color: COLORS.textInverse }]}>
                  {t[type]?.toUpperCase() || type.toUpperCase()}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Vulnerability Warnings Alert */}
          {targetedVulnerabilities.length > 0 && (
            <View style={styles.vulnAlertBox}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="warning" size={16} color={COLORS.danger} />
                <Text style={styles.vulnAlertTitle}>{t.vulnerableAlert}</Text>
              </View>
              <Text style={styles.vulnAlertDesc}>
                {t.vulnerableAlertDesc}
                <Text style={{ fontFamily: FONTS.mono, fontWeight: '700' }}>
                  {targetedVulnerabilities.map((v) => v.bodyPart).join(', ')}
                </Text>
              </Text>
            </View>
          )}

          {/* AI Injury Prevention Activation Card */}
          {activePreventionDrills.length > 0 && (
            <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: COLORS.accent + '40' }]}>
              <View style={styles.activationHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{t.preWorkoutActivation}</Text>
                  
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 8 }}>
                    <View style={styles.sportBadge}>
                      <Text style={styles.sportBadgeText}>{currentSport.toUpperCase()}</Text>
                    </View>
                    <Pressable onPress={() => setShowSportModal(true)} style={styles.btnChangeSport}>
                      <Ionicons name="add-circle" size={16} color={COLORS.cyan} />
                      <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.cyan }}>CHANGE SPORT</Text>
                    </Pressable>
                  </View>
                </View>
                <Pressable onPress={() => setShowActivationList(!showActivationList)} style={styles.activationToggle}>
                  <Ionicons name={showActivationList ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textSecondary} />
                </Pressable>
              </View>

              {showActivationList && (
                <View style={{ marginTop: SPACING.md, gap: SPACING.sm }}>
                  {activePreventionDrills.map((drill, idx) => (
                    <Pressable
                      key={idx}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setCheckedPrevention((prev) => ({ ...prev, [idx]: !prev[idx] }));
                      }}
                      style={[
                        styles.activationItem,
                        { backgroundColor: colors.surface, borderColor: colors.border },
                        checkedPrevention[idx] && { borderColor: COLORS.lime + '60' }
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.drillName, { color: colors.textPrimary }, checkedPrevention[idx] && { textDecorationLine: 'line-through', opacity: 0.6 }]}>
                          {drill.name} ({drill.reps})
                        </Text>
                        <Text style={[styles.drillDesc, { color: colors.textMuted }]}>{drill.desc}</Text>
                        {drill.warning && (
                          <View style={styles.warningBadge}>
                            <Text style={styles.warningBadgeText}>{drill.warning}</Text>
                          </View>
                        )}
                      </View>
                      <Ionicons
                        name={checkedPrevention[idx] ? 'checkmark-circle' : 'ellipse-outline'}
                        size={22}
                        color={checkedPrevention[idx] ? COLORS.lime : colors.textMuted}
                      />
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Exercise Builder Card */}
          <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            {sessionType !== 'running' ? (
              <View>
                <View style={styles.builderHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>ROUTINE CONSTRUCTOR</Text>
                  <Pressable style={styles.btnAddEx} onPress={() => setShowAddModal(true)}>
                    <Ionicons name="add" size={14} color={COLORS.textInverse} />
                    <Text style={styles.btnAddExText}>{t.addExercise}</Text>
                  </Pressable>
                </View>

                {customExercises.length === 0 ? (
                  <Text style={[styles.emptyText, { color: colors.textMuted }]}>No exercises added. Add one above.</Text>
                ) : (
                  <View style={{ gap: SPACING.xs, marginTop: SPACING.sm }}>
                    {customExercises.map((ex, idx) => (
                      <View key={idx} style={[styles.builderItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.builderExName, { color: colors.textPrimary }]}>{ex.name}</Text>
                          <Text style={[styles.builderExMeta, { color: colors.textMuted }]}>
                            {ex.targetSets} sets x {ex.targetReps} reps {ex.targetWeight > 0 ? `| ${ex.targetWeight} kg` : ''}
                          </Text>
                        </View>
                        <Pressable onPress={() => handleRemoveExercise(idx)} style={styles.btnRemoveEx}>
                          <Ionicons name="trash-outline" size={16} color={COLORS.danger} />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ) : (
              // Running inputs
              <View>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginBottom: SPACING.md }]}>RUN PARAMETERS</Text>
                <View style={styles.inputRow}>
                  <View style={styles.inputGroup}>
                    <Text style={[styles.inputLabel, { color: colors.textMuted }]}>{t.targetDistance}</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
                      value={targetDistance}
                      onChangeText={setTargetDistance}
                      keyboardType="numeric"
                      placeholder="5.0"
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={[styles.inputLabel, { color: colors.textMuted }]}>{t.targetDuration}</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
                      value={targetDuration}
                      onChangeText={setTargetDuration}
                      keyboardType="numeric"
                      placeholder="30"
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>
                </View>
              </View>
            )}

            {/* Launch Button */}
            <Pressable style={styles.btnStart} onPress={handleStartWorkout}>
              <Ionicons name="play" size={20} color={COLORS.textInverse} />
              <Text style={styles.btnStartText}>{t.startRecordingTime}</Text>
            </Pressable>
          </View>

          {/* Workout History */}
          <Text style={[styles.sectionLabel, { marginTop: SPACING.xl, color: colors.textMuted }]}>{t.workoutHistory}</Text>
          {workouts.length === 0 && (
            <Text style={[styles.empty, { color: colors.textMuted }]}>{t.noLoggedSessions}</Text>
          )}
          {workouts.slice(0, 5).map((w, i) => (
            <View key={i} style={[styles.historyCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <View style={styles.historyHeader}>
                <Text style={[styles.historyDate, { color: colors.textPrimary }]}>{formatDate(w.date)}</Text>
                <Text style={[styles.historyCals, { color: COLORS.lime }]}>{w.caloriesBurned} kcal</Text>
              </View>
              <View style={styles.historyRow}>
                <View style={[styles.historyBadge, { backgroundColor: colors.surface }]}>
                  <Ionicons name="timer-outline" size={12} color={COLORS.accent} />
                  <Text style={[styles.historyBadgeText, { color: colors.textSecondary }]}>{w.duration} {t.min}</Text>
                </View>
                <View style={[styles.historyBadge, { backgroundColor: colors.surface }]}>
                  <Ionicons name="barbell-outline" size={12} color={COLORS.accent} />
                  <Text style={[styles.historyBadgeText, { color: colors.textSecondary }]}>{w.sets?.length || 0} {t.sets}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      ) : (
        
        // â”€â”€â”€ ACTIVE WORKOUT STATE (Logging) â”€â”€â”€
        <View>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>{t.activeWorkout}</Text>
            <Text style={[styles.subtitle, { color: COLORS.lime }]}>
              {sessionType.toUpperCase()} {sessionType !== 'running' ? `(${customExercises.length} EXERCISES)` : ''}
            </Text>
          </View>

          {/* Floating Toast Popup */}
          {showPopup && (
            <Animated.View style={[styles.popupToast, { transform: [{ scale: popupAnim }], opacity: popupAnim }]}>
              <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
              <Text style={styles.popupText}>{popupText}</Text>
            </Animated.View>
          )}

          {/* Live Timer & Stats Card */}
          <View style={[styles.timerCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <View style={styles.timeHeader}>
              <Text style={[styles.timerLabel, { color: colors.textMuted }]}>{t.elapsedTime}</Text>
              <View style={styles.liveBadge}>
                <Animated.View style={[styles.liveDot, { opacity: recordingPulse }]} />
                <Text style={styles.liveText}>{t.recording}</Text>
              </View>
            </View>
            <Text style={[styles.timerValue, { color: colors.textPrimary }]}>
              {formatDuration(activeSession.elapsedSeconds)}
            </Text>
          </View>

          {/* Rest Period Active Panel */}
          {restTime > 0 && (
            <View style={[styles.restCard, { backgroundColor: colors.bgCard, borderColor: COLORS.accent + '40' }]}>
              <Text style={[styles.restLabel, { color: colors.textMuted }]}>{t.restPeriodActive}</Text>
              <View style={styles.restCircleRow}>
                <Svg width={120} height={120} style={styles.restSvg}>
                  <Circle cx={60} cy={60} r={50} stroke={colors.border} strokeWidth={6} fill="none" />
                  <Circle
                    cx={60} cy={60} r={50}
                    stroke={COLORS.accent} strokeWidth={6} fill="none"
                    strokeDasharray={2 * Math.PI * 50}
                    strokeDashoffset={2 * Math.PI * 50 * (1 - restTime / 90)}
                    strokeLinecap="round"
                    transform="rotate(-90 60 60)"
                  />
                </Svg>
                <View style={styles.restTextContainer}>
                  <Text style={styles.restSeconds}>{restTime}</Text>
                  <Text style={[styles.restSecLabel, { color: colors.textMuted }]}>SEC</Text>
                </View>
              </View>
              <Pressable style={[styles.btnSkipRest, { backgroundColor: colors.surface }]} onPress={() => setRestTime(0)}>
                <Ionicons name="play-skip-forward" size={14} color={colors.textPrimary} />
                <Text style={[styles.btnSkipText, { color: colors.textPrimary }]}>SKIP REST</Text>
              </Pressable>
            </View>
          )}

          {/* Active Logging Panels */}
          {sessionType !== 'running' ? (
            <View style={{ gap: SPACING.md }}>
              <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginBottom: SPACING.md }]}>ACTIVE SETS LOGGER</Text>
                
                {/* Exercise Selector tab */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: SPACING.md }}>
                  {customExercises.map((ex, idx) => {
                    const isSelected = activeExerciseIdx === idx;
                    const loggedSets = Array.from({ length: ex.targetSets }).filter((_, sIdx) => completedSetsTracker[`${idx}-${sIdx}`]).length;
                    return (
                      <Pressable
                        key={idx}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setActiveExerciseIdx(idx);
                        }}
                        style={[
                          styles.exTab,
                          { borderColor: colors.border },
                          isSelected && { backgroundColor: COLORS.accent, borderColor: COLORS.accent }
                        ]}
                      >
                        <Text style={[styles.exTabText, { color: colors.textPrimary }, isSelected && { color: COLORS.textInverse }]}>
                          {ex.name} ({loggedSets}/{ex.targetSets})
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                {/* Selected Exercise detail & checklists */}
                {customExercises[activeExerciseIdx] && (
                  <View>
                    <View style={styles.activeExInfo}>
                      <Text style={[styles.activeExName, { color: colors.textPrimary }]}>
                        {customExercises[activeExerciseIdx].name}
                      </Text>
                      <Text style={[styles.activeExTarget, { color: COLORS.lime }]}>
                        Goal: {customExercises[activeExerciseIdx].targetSets} sets x {customExercises[activeExerciseIdx].targetReps} reps {customExercises[activeExerciseIdx].targetWeight > 0 ? `@ ${customExercises[activeExerciseIdx].targetWeight} kg` : ''}
                      </Text>
                    </View>

                    {/* Sets Circle Checkbox Row */}
                    <View style={styles.setsList}>
                      {Array.from({ length: customExercises[activeExerciseIdx].targetSets }).map((_, setIdx) => {
                        const isLogged = !!completedSetsTracker[`${activeExerciseIdx}-${setIdx}`];
                        return (
                          <Pressable
                            key={setIdx}
                            onPress={() => handleToggleSetCheck(activeExerciseIdx, setIdx)}
                            style={[
                              styles.setCheckRow,
                              { backgroundColor: colors.surface, borderColor: colors.border },
                              isLogged && { borderColor: COLORS.lime }
                            ]}
                          >
                            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                              <View style={[styles.setNumCircle, { backgroundColor: isLogged ? COLORS.lime : colors.border }]}>
                                <Text style={[styles.setNumText, { color: isLogged ? '#000' : colors.textPrimary }]}>{setIdx + 1}</Text>
                              </View>
                              <Text style={[styles.setLogValText, { color: colors.textPrimary }]}>
                                {customExercises[activeExerciseIdx].targetReps} reps
                              </Text>
                            </View>
                            <Text style={[styles.setLogValWeight, { color: isLogged ? COLORS.lime : colors.textMuted }]}>
                              {customExercises[activeExerciseIdx].targetWeight > 0 ? `${customExercises[activeExerciseIdx].targetWeight} kg` : 'Bodyweight'}
                            </Text>
                            <Ionicons
                              name={isLogged ? 'checkbox' : 'square-outline'}
                              size={20}
                              color={isLogged ? COLORS.lime : colors.textMuted}
                              style={{ marginLeft: SPACING.md }}
                            />
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                )}
              </View>

              {/* Workout List of Logged sets */}
              {activeSession.sets.length > 0 && (
                <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                  <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginBottom: SPACING.sm }]}>LOGGED PROGRESS</Text>
                  {activeSession.sets.map((s, idx) => (
                    <View key={idx} style={[styles.loggedSetItem, { borderBottomColor: colors.border }]}>
                      <Text style={[styles.loggedExName, { color: colors.textPrimary }]}>{s.exercise}</Text>
                      <Text style={[styles.loggedExReps, { color: COLORS.lime }]}>
                        {s.reps} reps {s.weight > 0 ? `@ ${s.weight} kg` : ''}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ) : (
            // Running active log controls
            <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginBottom: SPACING.md }]}>LOG ACTE RUN SUMMARY</Text>
              
              <View style={styles.runningProgressGrid}>
                <View style={styles.runMetric}>
                  <Text style={[styles.runMetricLabel, { color: colors.textMuted }]}>TARGET DISTANCE</Text>
                  <Text style={[styles.runMetricVal, { color: colors.textPrimary }]}>{targetDistance} km</Text>
                </View>
                <View style={styles.runMetric}>
                  <Text style={[styles.runMetricLabel, { color: colors.textMuted }]}>TARGET TIME</Text>
                  <Text style={[styles.runMetricVal, { color: colors.textPrimary }]}>{targetDuration} mins</Text>
                </View>
              </View>

              <Text style={[styles.inputLabel, { color: colors.textMuted, marginTop: SPACING.md }]}>ACTUAL COMPLETED DISTANCE (KM)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary, marginBottom: SPACING.lg }]}
                value={actualDistance}
                onChangeText={setActualDistance}
                keyboardType="numeric"
                placeholder="5.0"
                placeholderTextColor={colors.textMuted}
              />
            </View>
          )}

          {/* Save & Finish Buttons */}
          <View style={{ gap: SPACING.sm, marginVertical: SPACING.md }}>
            <Pressable
              style={[styles.btnFinishWorkout, saving && { opacity: 0.5 }]}
              onPress={handleFinishWorkout}
              disabled={saving}
            >
              <Ionicons name="checkmark-done" size={20} color={COLORS.textInverse} />
              <Text style={styles.btnFinishWorkoutText}>{saving ? 'SAVING...' : 'FINISH WORKOUT'}</Text>
            </Pressable>
            
            <Pressable style={[styles.btnCancelWorkout, { backgroundColor: colors.surface, borderColor: COLORS.danger + '50' }]} onPress={() => {
              if (Platform.OS === 'web') {
                const confirmCancel = window.confirm('Are you sure you want to discard this workout? No data will be logged.');
                if (confirmCancel) {
                  stopSession();
                  setRestTime(0);
                  setCompletedSetsTracker({});
                }
              } else {
                Alert.alert('Cancel Session', 'Are you sure you want to discard this workout? No data will be logged.', [
                  { text: 'Keep Logging', style: 'cancel' },
                  { text: 'Discard Session', style: 'destructive', onPress: () => {
                      stopSession();
                      setRestTime(0);
                      setCompletedSetsTracker({});
                  } }
                ]);
              }
            }}>
              <Text style={{ fontFamily: FONTS.mono, fontSize: 11, color: COLORS.danger, letterSpacing: 1 }}>DISCARD SESSION</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* â”€â”€â”€ MODAL: ADD EXERCISE CREATOR â”€â”€â”€ */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.bg, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>{t.addExercise}</Text>
              <Pressable style={styles.closeBtn} onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </Pressable>
            </View>

            <Text style={[styles.inputLabel, { color: colors.textMuted }]}>{t.exerciseName}</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary, marginBottom: SPACING.md }]}
              value={newExName}
              onChangeText={setNewExName}
              placeholder="e.g. Incline Bench Press"
              placeholderTextColor={colors.textMuted}
            />

            <View style={styles.inputRow}>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.textMuted }]}>{t.targetSets}</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
                  value={newExSets}
                  onChangeText={setNewExSets}
                  keyboardType="numeric"
                  placeholder="4"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.textMuted }]}>{t.targetReps}</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
                  value={newExReps}
                  onChangeText={setNewExReps}
                  keyboardType="numeric"
                  placeholder="10"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            </View>

            <Text style={[styles.inputLabel, { color: colors.textMuted }]}>{t.targetWeight}</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary, marginBottom: SPACING.lg }]}
              value={newExWeight}
              onChangeText={setNewExWeight}
              keyboardType="numeric"
              placeholder="0 (Bodyweight)"
              placeholderTextColor={colors.textMuted}
            />

            <Pressable style={styles.btnSaveAdd} onPress={handleAddExercise}>
              <Text style={styles.btnSaveAddText}>CONFIRM EXERCISE</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* â”€â”€â”€ MODAL: POST-WORKOUT AI RECOVERY PLANNER â”€â”€â”€ */}
      <Modal visible={showRecoveryModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.bg, borderColor: colors.border, maxHeight: '85%' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>{t.recoveryPlanner}</Text>
              <Pressable style={styles.closeBtn} onPress={() => {
                setBreathingActive(false);
                setShowRecoveryModal(false);
              }}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
              <Text style={[styles.modalDescText, { color: colors.textMuted }]}>{t.recoveryPlannerDesc}</Text>

              {/* Intensity Banner */}
              {recoveryPlan && (
                <View style={[
                  styles.intensityBanner,
                  recoveryPlan.intensity === 'high' && { backgroundColor: COLORS.danger + '18', borderColor: COLORS.danger },
                  recoveryPlan.intensity === 'medium' && { backgroundColor: COLORS.warning + '18', borderColor: COLORS.warning },
                  recoveryPlan.intensity === 'low' && { backgroundColor: COLORS.success + '18', borderColor: COLORS.success },
                ]}>
                  <Text style={[
                    styles.intensityText,
                    recoveryPlan.intensity === 'high' && { color: COLORS.danger },
                    recoveryPlan.intensity === 'medium' && { color: COLORS.warning },
                    recoveryPlan.intensity === 'low' && { color: COLORS.success }
                  ]}>
                    SESSION INTENSITY: {recoveryPlan.intensity.toUpperCase()}
                  </Text>
                </View>
              )}

              {/* Dynamic Recovery mobility drills list */}
              <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginTop: SPACING.md, marginBottom: SPACING.sm }]}>RECOMMENDED MOBILITY</Text>
              {recoveryPlan?.steps.filter(s => s.name.indexOf('Breathing') === -1 && s.name.indexOf('Hydration') === -1).map((step, idx) => (
                <View key={idx} style={[styles.stepItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.stepName, { color: colors.textPrimary }]}>{step.name} ({step.duration})</Text>
                    <Text style={[styles.stepDesc, { color: colors.textMuted }]}>{step.desc}</Text>
                  </View>
                  <Pressable onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setCompletedRecoverySteps(prev => ({ ...prev, [idx]: !prev[idx] }));
                  }}>
                    <Ionicons
                      name={completedRecoverySteps[idx] ? 'checkmark-circle' : 'ellipse-outline'}
                      size={22}
                      color={completedRecoverySteps[idx] ? COLORS.lime : colors.textMuted}
                    />
                  </Pressable>
                </View>
              ))}

              {/* Interactive Down-Regulation Breathing Section */}
              <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginTop: SPACING.lg, marginBottom: SPACING.sm }]}>DOWN-REGULATION BREATHING COOLDOWN</Text>
              <View style={[styles.breathingCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.breathingHeading, { color: colors.textPrimary }]}>
                  {isHighInt ? '4-7-8 Parasympathetic Down-Reg' : 'Rhythmic Box Cooldown'}
                </Text>
                <Text style={[styles.breathingSub, { color: colors.textMuted }]}>
                  {isHighInt ? 'Inhale 4s, Hold 7s, Exhale 8s. Switches central nervous system out of exertion mode.' : 'Inhale 4s, Hold 4s, Exhale 4s, Hold 4s. Lowers heart rate.'}
                </Text>

                {/* Live Circle Indicator */}
                <View style={styles.breathingContainer}>
                  <Svg width={140} height={140}>
                    <Circle cx={70} cy={70} r={60} stroke={colors.border} strokeWidth={6} fill="none" />
                    <Circle
                      cx={70} cy={70} r={60}
                      stroke={COLORS.accent} strokeWidth={6} fill="none"
                      strokeDasharray={2 * Math.PI * 60}
                      strokeDashoffset={2 * Math.PI * 60 * progressRatio}
                      strokeLinecap="round"
                      transform="rotate(-90 70 70)"
                    />
                  </Svg>
                  <View style={styles.breathingStatusContainer}>
                    <Text style={[styles.breathingSecText, { color: colors.textPrimary }]}>{breathingSeconds}s</Text>
                    <Text style={[styles.breathingPhaseText, { color: COLORS.accent }]}>
                      {breathingPhase === 'idle' ? 'READY' : breathingPhase.toUpperCase()}
                    </Text>
                  </View>
                </View>

                {/* Control Toggles */}
                <View style={{ flexDirection: 'row', gap: SPACING.md, width: '100%', marginTop: SPACING.md }}>
                  <Pressable
                    style={[styles.btnBreathingAction, { backgroundColor: breathingActive ? COLORS.danger : COLORS.accent }]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      if (breathingActive) {
                        setBreathingActive(false);
                      } else {
                        setBreathingCycleCount(0);
                        setBreathingPhase('inhale');
                        setBreathingSeconds(4);
                        setBreathingActive(true);
                      }
                    }}
                  >
                    <Text style={styles.btnBreathingText}>
                      {breathingActive ? 'STOP' : 'START TIMER'}
                    </Text>
                  </Pressable>
                </View>
                
                {breathingCycleCount > 0 && (
                  <Text style={[styles.cycleCountText, { color: colors.textMuted }]}>
                    Cycles completed: {breathingCycleCount}
                  </Text>
                )}
              </View>

              {/* Dismiss Recovery Plan */}
              <Pressable
                style={[styles.btnDismissRecovery, { backgroundColor: COLORS.lime }]}
                onPress={() => {
                  setBreathingActive(false);
                  setShowRecoveryModal(false);
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                }}
              >
                <Text style={styles.btnDismissRecoveryText}>COMPLETE RECOVERY</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Sport Selector Modal */}
      <Modal visible={showSportModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>SELECT SPORT</Text>
              <Pressable onPress={() => setShowSportModal(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </Pressable>
            </View>
            <ScrollView style={{ maxHeight: 400 }}>
              {SPORTS_LIST.map((sportItem) => (
                <Pressable
                  key={sportItem}
                  style={[
                    styles.sportOption,
                    { borderBottomColor: colors.border },
                    currentSport === sportItem && { borderBottomColor: COLORS.cyan, backgroundColor: COLORS.cyan + '1A' }
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectedSport(sportItem);
                    setShowSportModal(false);
                  }}
                >
                  <Text style={[
                    styles.sportOptionText,
                    { color: currentSport === sportItem ? COLORS.cyan : colors.textPrimary }
                  ]}>{sportItem}</Text>
                  {currentSport === sportItem && (
                    <Ionicons name="checkmark-circle" size={20} color={COLORS.cyan} />
                  )}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  greeting: { fontFamily: FONTS.mono, fontSize: 13, letterSpacing: 2, textTransform: 'uppercase' },
  name: { fontFamily: FONTS.display, fontSize: 32, marginTop: 4 },
  sectionTitle: { fontFamily: FONTS.display, fontSize: 20, marginBottom: 12, marginTop: 24, paddingHorizontal: 20 },
  alertCard: { flexDirection: 'row', alignItems: 'flex-start', padding: 16, borderRadius: RADIUS.lg, borderWidth: 1, marginTop: 24 },

  content: { padding: SPACING.md, paddingBottom: 160 },
  header: { paddingTop: SPACING.md, marginBottom: SPACING.md },
  title: { fontFamily: FONTS.display, fontSize: 34, letterSpacing: 2, lineHeight: 38 },
  subtitle: { fontFamily: FONTS.mono, fontSize: 10, letterSpacing: 1.5 },
  sectionLabel: { fontFamily: FONTS.mono, fontSize: 10, letterSpacing: 2, marginBottom: SPACING.xs },
  
  // Chips
  chipRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
  typeChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm - 2,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  typeChipText: { fontFamily: FONTS.mono, fontSize: 10 },
  
  // Vuln warning box
  vulnAlertBox: {
    backgroundColor: COLORS.danger + '12',
    borderWidth: 1,
    borderColor: COLORS.danger + '40',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  vulnAlertTitle: { fontFamily: FONTS.mono, fontSize: 10, color: COLORS.danger, fontWeight: '700', letterSpacing: 1 },
  vulnAlertDesc: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.danger, marginTop: 4, lineHeight: 16 },

  // Cards
  card: {
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  cardTitle: { fontFamily: FONTS.display, fontSize: 16, letterSpacing: 1.5 },
  cardSub: { fontFamily: FONTS.body, fontSize: 11, lineHeight: 16, marginTop: 2 },
  
  // Sport Selection
  sportBadge: {
    backgroundColor: COLORS.cyan + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.cyan + '40',
  },
  sportBadgeText: { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.cyan, fontWeight: '700', letterSpacing: 1 },
  btnChangeSport: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 4 },
  sportOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: 1,
  },
  sportOptionText: { fontFamily: FONTS.body, fontSize: 14, letterSpacing: 0.5 },
  // Activation / warm-up list
  activationHeader: { flexDirection: 'row', alignItems: 'center' },
  activationToggle: { padding: 4 },
  activationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    gap: SPACING.md,
  },
  drillName: { fontFamily: FONTS.display, fontSize: 13, letterSpacing: 0.5 },
  drillDesc: { fontFamily: FONTS.body, fontSize: 11, lineHeight: 15, marginTop: 2 },
  warningBadge: {
    backgroundColor: COLORS.danger + '15',
    alignSelf: 'flex-start',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 4,
  },
  warningBadgeText: { fontFamily: FONTS.mono, fontSize: 8, color: COLORS.danger, fontWeight: '700' },

  // Routine Constructor styles
  builderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
  btnAddEx: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
  },
  btnAddExText: { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.textInverse, letterSpacing: 1 },
  emptyText: { fontFamily: FONTS.mono, fontSize: 11, textAlign: 'center', paddingVertical: SPACING.lg },
  builderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
  },
  builderExName: { fontFamily: FONTS.display, fontSize: 14, letterSpacing: 0.5 },
  builderExMeta: { fontFamily: FONTS.mono, fontSize: 10, marginTop: 2 },
  btnRemoveEx: { padding: 4 },

  // Inputs
  inputRow: { flexDirection: 'row', gap: SPACING.md, marginVertical: SPACING.xs },
  inputGroup: { flex: 1 },
  inputLabel: { fontFamily: FONTS.mono, fontSize: 9, letterSpacing: 1.5, marginBottom: SPACING.xs },
  input: {
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    padding: SPACING.sm,
    fontFamily: FONTS.mono,
    fontSize: 13,
  },

  // Log active exercises tabs
  exTab: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm - 2,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    marginRight: SPACING.sm,
  },
  exTabText: { fontFamily: FONTS.mono, fontSize: 10 },
  activeExInfo: { marginBottom: SPACING.md },
  activeExName: { fontFamily: FONTS.display, fontSize: 18, letterSpacing: 1 },
  activeExTarget: { fontFamily: FONTS.mono, fontSize: 10, marginTop: 2 },
  setsList: { gap: SPACING.xs },
  setCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
  },
  setNumCircle: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  setNumText: { fontFamily: FONTS.mono, fontSize: 10, fontWeight: '700', textAlign: 'center' },
  setLogValText: { fontFamily: FONTS.body, fontSize: 13 },
  setLogValWeight: { fontFamily: FONTS.mono, fontSize: 12, fontWeight: '700' },
  
  // Logged sets row
  loggedSetItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
  },
  loggedExName: { fontFamily: FONTS.display, fontSize: 13, letterSpacing: 0.5 },
  loggedExReps: { fontFamily: FONTS.mono, fontSize: 11, fontWeight: '700' },

  // Running Summary
  runningProgressGrid: { flexDirection: 'row', gap: SPACING.lg, paddingBottom: SPACING.md, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.05)' },
  runMetric: { flex: 1 },
  runMetricLabel: { fontFamily: FONTS.mono, fontSize: 8, letterSpacing: 1 },
  runMetricVal: { fontFamily: FONTS.display, fontSize: 20, marginTop: 2 },

  // Action Buttons
  btnStart: {
    flexDirection: 'row',
    gap: SPACING.sm,
    backgroundColor: COLORS.lime,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.md,
  },
  btnStartText: { fontFamily: FONTS.mono, fontSize: 12, color: COLORS.textInverse, letterSpacing: 1.5, fontWeight: '700' },
  btnFinishWorkout: {
    flexDirection: 'row',
    gap: SPACING.sm,
    backgroundColor: COLORS.lime,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnFinishWorkoutText: { fontFamily: FONTS.mono, fontSize: 12, color: COLORS.textInverse, letterSpacing: 1.5, fontWeight: '700' },
  btnCancelWorkout: {
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Active workout timer
  timerCard: {
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    alignItems: 'center',
  },
  timeHeader: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', alignItems: 'center', marginBottom: SPACING.sm },
  timerLabel: { fontFamily: FONTS.mono, fontSize: 10, letterSpacing: 1.5 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.danger },
  liveText: { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.danger, letterSpacing: 1.5 },
  timerValue: { fontFamily: FONTS.display, fontSize: 56, letterSpacing: 4, lineHeight: 60, marginVertical: SPACING.sm },

  // Rest periods
  restCard: {
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    alignItems: 'center',
  },
  restLabel: { fontFamily: FONTS.mono, fontSize: 9, letterSpacing: 2, marginBottom: SPACING.sm },
  restCircleRow: { width: 120, height: 120, alignItems: 'center', justifyContent: 'center', marginVertical: SPACING.xs },
  restSvg: { position: 'absolute' },
  restTextContainer: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  restSeconds: { fontFamily: FONTS.display, fontSize: 32, color: COLORS.accent, lineHeight: 36 },
  restSecLabel: { fontFamily: FONTS.mono, fontSize: 9, letterSpacing: 1 },
  btnSkipRest: {
    flexDirection: 'row',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    marginTop: SPACING.md,
  },
  btnSkipText: { fontFamily: FONTS.mono, fontSize: 10, letterSpacing: 1, fontWeight: '700' },

  // Modal Structure
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.7)' },
  modalContent: {
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    borderWidth: 1,
    borderBottomWidth: 0,
    padding: SPACING.md,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    paddingBottom: SPACING.md,
    marginBottom: SPACING.md,
  },
  modalTitle: { fontFamily: FONTS.display, fontSize: 18, letterSpacing: 1.5 },
  modalDescText: { fontFamily: FONTS.body, fontSize: 12, lineHeight: 18, marginBottom: SPACING.md },
  closeBtn: { padding: 4 },
  btnSaveAdd: {
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
  },
  btnSaveAddText: { fontFamily: FONTS.mono, fontSize: 11, color: COLORS.textInverse, letterSpacing: 1, fontWeight: '700' },

  // Cooldown / recovery steps
  intensityBanner: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    padding: SPACING.sm,
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  intensityText: { fontFamily: FONTS.mono, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACING.xs,
    gap: SPACING.md,
  },
  stepName: { fontFamily: FONTS.display, fontSize: 13, letterSpacing: 0.5 },
  stepDesc: { fontFamily: FONTS.body, fontSize: 11, lineHeight: 15, marginTop: 2 },

  // Cooldown breathing timer
  breathingCard: {
    padding: SPACING.md,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  breathingHeading: { fontFamily: FONTS.display, fontSize: 14, letterSpacing: 1 },
  breathingSub: { fontFamily: FONTS.body, fontSize: 11, textAlign: 'center', lineHeight: 16, marginTop: 2, paddingHorizontal: SPACING.md },
  breathingContainer: { width: 140, height: 140, alignItems: 'center', justifyContent: 'center', marginTop: SPACING.md },
  breathingStatusContainer: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  breathingSecText: { fontFamily: FONTS.display, fontSize: 36, lineHeight: 40 },
  breathingPhaseText: { fontFamily: FONTS.mono, fontSize: 10, letterSpacing: 1.5, marginTop: 2 },
  btnBreathingAction: { flex: 1, padding: SPACING.sm + 2, borderRadius: RADIUS.md, alignItems: 'center' },
  btnBreathingText: { fontFamily: FONTS.mono, fontSize: 11, color: COLORS.textInverse, letterSpacing: 1, fontWeight: '700' },
  cycleCountText: { fontFamily: FONTS.mono, fontSize: 10, marginTop: SPACING.md },

  btnDismissRecovery: {
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  btnDismissRecoveryText: { fontFamily: FONTS.mono, fontSize: 12, color: COLORS.textInverse, letterSpacing: 1.5, fontWeight: '700' },

  // History Card
  historyCard: {
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.xs },
  historyDate: { fontFamily: FONTS.body, fontSize: 13 },
  historyCals: { fontFamily: FONTS.display, fontSize: 18 },
  historyRow: { flexDirection: 'row', gap: SPACING.sm },
  historyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
  historyBadgeText: { fontFamily: FONTS.mono, fontSize: 10 },
  empty: { fontFamily: FONTS.mono, fontSize: 11, textAlign: 'center', paddingVertical: SPACING.xl },

  // Toast
  popupToast: {
    position: 'absolute',
    top: 20,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: SPACING.xs,
    backgroundColor: '#10B981',
    borderRadius: RADIUS.full,
    paddingVertical: SPACING.sm - 2,
    paddingHorizontal: SPACING.md,
    zIndex: 999,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 6,
    elevation: 8,
  },
  popupText: { fontFamily: FONTS.mono, fontSize: 11, color: '#FFFFFF', fontWeight: '700', letterSpacing: 1 },
});



function CoachTracksView() {
  const { profile, user } = useAppStore();
  const { t } = useTranslation();
  const { colors } = useTheme();

  const [activeLegion, setActiveLegion] = useState<Legion | null>(null);
  const [athletes, setAthletes] = useState<UserProfile[]>([]);
  const [selectedAthlete, setSelectedAthlete] = useState<UserProfile | null>(null);
  
  const [exerciseName, setExerciseName] = useState('');
  const [sets, setSets] = useState('4');
  const [reps, setReps] = useState('10');
  const [notes, setNotes] = useState('');
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

  const handleImplement = async () => {
    if (!selectedAthlete || !exerciseName.trim() || !user) return;
    setIsSending(true);
    try {
      await saveInboxMessage(selectedAthlete.uid, {
        athleteUid: selectedAthlete.uid,
        coachUid: user.uid,
        title: 'New Workout Assigned',
        message: `Your coach assigned: ${exerciseName} (${sets} sets x ${reps} reps). \nNotes: ${notes}`,
        type: 'workout_assignment',
        data: {
          exerciseName,
          sets: parseInt(sets, 10) || 4,
          reps: parseInt(reps, 10) || 10,
          notes,
        },
        timestamp: Date.now(),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Assigned', `Workout assigned to ${selectedAthlete.name}`);
      setExerciseName('');
      setSets('4');
      setReps('10');
      setNotes('');
      setSelectedAthlete(null);
    } catch (e) {
      Alert.alert('Error', 'Failed to assign workout.');
    }
    setIsSending(false);
  };

  return (
    <ScrollView style={[globalStyles.screen, { backgroundColor: colors.bg }]} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.greeting, { color: colors.textMuted }]}>Coach Assignments</Text>
          <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>WORKOUT PLANNER</Text>
        </View>
      </View>

      <Text style={[styles.sectionTitle, { color: colors.textPrimary, paddingHorizontal: 20 }]}>Select Athlete</Text>
      <View style={{ paddingHorizontal: 20 }}>
        {athletes.length === 0 ? (
          <View style={{ padding: 20, alignItems: 'center', backgroundColor: colors.surface, borderRadius: 16 }}>
            <Text style={{ color: colors.textMuted }}>No athletes in your legion.</Text>
          </View>
        ) : (
          athletes.map(athlete => (
            <Pressable 
              key={athlete.uid}
              style={{ padding: 16, backgroundColor: colors.surface, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
              onPress={() => setSelectedAthlete(athlete)}
            >
              <View>
                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.textPrimary }}>{athlete.name}</Text>
                <Text style={{ fontSize: 14, color: colors.textSecondary }}>{athlete.sport}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </Pressable>
          ))
        )}
      </View>

      <Modal visible={!!selectedAthlete} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelectedAthlete(null)}>
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 20, paddingTop: 60, borderBottomWidth: 1, borderColor: colors.border }}>
            <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.textPrimary }}>Assign to {selectedAthlete?.name}</Text>
            <Pressable onPress={() => setSelectedAthlete(null)}>
              <Ionicons name="close-circle" size={28} color={colors.textMuted} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
            
            <View>
              <Text style={{ color: colors.textSecondary, marginBottom: 8, fontSize: 14, fontWeight: '600' }}>Exercise Name / Routine</Text>
              <TextInput
                style={{ backgroundColor: colors.surface, color: colors.textPrimary, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.border }}
                placeholder="e.g. 5km Run, or Heavy Squats..."
                placeholderTextColor={colors.textMuted}
                value={exerciseName}
                onChangeText={setExerciseName}
              />
            </View>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.textSecondary, marginBottom: 8, fontSize: 14, fontWeight: '600' }}>Sets</Text>
                <TextInput
                  style={{ backgroundColor: colors.surface, color: colors.textPrimary, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.border }}
                  keyboardType="numeric"
                  value={sets}
                  onChangeText={setSets}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.textSecondary, marginBottom: 8, fontSize: 14, fontWeight: '600' }}>Reps / Duration</Text>
                <TextInput
                  style={{ backgroundColor: colors.surface, color: colors.textPrimary, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.border }}
                  value={reps}
                  onChangeText={setReps}
                />
              </View>
            </View>

            <View>
              <Text style={{ color: colors.textSecondary, marginBottom: 8, fontSize: 14, fontWeight: '600' }}>Coach Notes (Optional)</Text>
              <TextInput
                style={{ backgroundColor: colors.surface, color: colors.textPrimary, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.border, minHeight: 100, textAlignVertical: 'top' }}
                multiline
                placeholder="Focus on form..."
                placeholderTextColor={colors.textMuted}
                value={notes}
                onChangeText={setNotes}
              />
            </View>

            <Pressable 
              disabled={isSending || !exerciseName.trim()}
              style={{ backgroundColor: '#FF5A1F', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 16, opacity: exerciseName.trim() ? 1 : 0.5 }}
              onPress={handleImplement}
            >
              <Text style={{ color: '#000', fontWeight: 'bold', fontSize: 16 }}>{isSending ? 'Sending...' : 'Implement'}</Text>
            </Pressable>
          </ScrollView>
        </View>
      </Modal>

    </ScrollView>
  );
}

export default function TracksScreen() {
  const { profile } = useAppStore();
  if (profile?.role === 'coach') return <CoachTracksView />;
  return <AthleteTracksView />;
}