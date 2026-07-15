import { useTranslation } from '@/hooks/useTranslation';
import { getTranslationForBodyPart } from '@/utils/translations';
import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, TextInput, Alert, Modal, ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAppStore } from '@/store/useAppStore';
import { COLORS, FONTS, SPACING, RADIUS, globalStyles } from '@/utils/theme';
import { joinLegion, forgeLegion, savePainMarker, subscribeToLegion, fetchAthleteProfiles, Legion, UserProfile, subscribeToInjuries, PainMarker, saveCoachNote, subscribeToCoachNotes, CoachNote, subscribeToDailyStatus, DailyStatus, subscribeToRecovery, RecoveryEntry } from '@/services/firebase';
import { useTheme } from '@/hooks/useTheme';
import { BouncyButton } from '@/components/common/BouncyButton';
import {
  AnatomicalModel3D,
  BODY_REGIONS_3D,
  PAIN_TYPES,
  PAIN_TYPE_COLORS,
} from '@/components/common/AnatomicalModel3D';

const SPORTS = [
  'Football', 'Basketball', 'Cricket', 'Wrestling', 'Boxing',
  'Cycling', 'Swimming', 'Running', 'Volleyball', 'Tennis',
  'Badminton', 'Athletics', 'Gymnastics', 'MMA', 'Other',
];

type ViewState = 'main' | 'join' | 'forge';


export default function LegionScreen() {
  const { user, profile } = useAppStore();
  const { t, lang } = useTranslation();
  const { colors } = useTheme();
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [view, setView] = useState<ViewState>('main');
  const [inviteCode, setInviteCode] = useState('');
  const [legionName, setLegionName] = useState('');
  const [sport, setSport] = useState('Football');
  const [loading, setLoading] = useState(false);
  const [forgedCode, setForgedCode] = useState('');

  // Coach Athlete Management state
  const [activeLegion, setActiveLegion] = useState<Legion | null>(null);
  const [athletes, setAthletes] = useState<UserProfile[]>([]);
  const [selectedAthlete, setSelectedAthlete] = useState<UserProfile | null>(null);
  const [athleteInjuries, setAthleteInjuries] = useState<PainMarker[]>([]);
  const [athleteRecovery, setAthleteRecovery] = useState<RecoveryEntry[]>([]);
  const [coachNoteInput, setCoachNoteInput] = useState('');
  const [isSendingNote, setIsSendingNote] = useState(false);

  useEffect(() => {
    if (profile?.legionId) {
      const unsub = subscribeToLegion(profile.legionId, (legionData) => {
        setActiveLegion(legionData);
        if (legionData?.athleteUids && profile.role === 'coach') {
          const uids = Object.keys(legionData.athleteUids);
          fetchAthleteProfiles(uids).then(setAthletes).catch(console.error);
        }
      });
      return unsub;
    }
  }, [profile?.legionId, profile?.role]);

  // When an athlete is selected by the coach, subscribe to their injuries and recovery
  useEffect(() => {
    if (selectedAthlete) {
      const unsubInj = subscribeToInjuries(selectedAthlete.uid, setAthleteInjuries);
      const unsubRec = subscribeToRecovery(selectedAthlete.uid, setAthleteRecovery);
      return () => {
        unsubInj();
        unsubRec();
      };
    }
  }, [selectedAthlete]);

  const handleSendCoachNote = async () => {
    if (!selectedAthlete || !coachNoteInput.trim() || !user) return;
    setIsSendingNote(true);
    try {
      await saveCoachNote(selectedAthlete.uid, {
        athleteUid: selectedAthlete.uid,
        coachUid: user.uid,
        message: coachNoteInput.trim(),
        timestamp: Date.now(),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Sent', 'Note sent to athlete.');
      setCoachNoteInput('');
    } catch (e) {
      Alert.alert('Error', 'Failed to send note.');
    }
    setIsSendingNote(false);
  };

  const [selectedRegion, setSelectedRegion] = useState<typeof BODY_REGIONS_3D[0] | null>(null);

  // Pain logging states
  const [showLogModal, setShowLogModal] = useState(false);
  const [painType, setPainType] = useState<typeof PAIN_TYPES[number]>('dull');
  const [intensity, setIntensity] = useState(5);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const isCoach = profile?.role === 'coach';
  const athleteCount = activeLegion?.athleteUids ? Object.keys(activeLegion.athleteUids).length : 0;
  const hasLegion = !!profile?.legionId;

  const handleRegionTap = (region: typeof BODY_REGIONS_3D[0]) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedRegion(region);
    setPainType('dull');
    setIntensity(5);
    setNotes('');
    setShowLogModal(true);
  };

  const handleSavePain = async () => {
    if (!user || !selectedRegion) return;
    setSaving(true);
    try {
      await savePainMarker(user.uid, {
        uid: user.uid,
        bodyPart: selectedRegion.key,
        side: selectedRegion.id.startsWith('left') ? 'left'
          : selectedRegion.id.startsWith('right') ? 'right' : 'center',
        x: selectedRegion.x + 100,
        y: selectedRegion.y + 160,
        painType,
        intensity,
        notes,
        timestamp: Date.now(),
        resolved: false,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowLogModal(false);
      setSelectedRegion(null);
    } catch {
      Alert.alert('Error', 'Failed to save pain marker.');
    }
    setSaving(false);
  };

  const handleJoin = async () => {
    if (!user || !inviteCode.trim()) return;
    setLoading(true);
    try {
      const success = await joinLegion(user.uid, inviteCode.trim());
      if (success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Joined!', 'You are now part of the Legion.');
      } else {
        Alert.alert('Invalid Code', 'No Legion found with that code.');
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to join Legion. Permission denied or server error.');
    } finally {
      setLoading(false);
    }
  };

  const handleForge = async () => {
    if (!user || !legionName.trim()) return;
    setLoading(true);
    try {
      const code = await forgeLegion(user.uid, legionName.trim(), sport);
      setForgedCode(code);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert('Error', 'Could not create Legion.');
    }
    setLoading(false);
  };

  /* ─── Forged success view ─── */
  if (forgedCode) {
    return (
      <View style={[globalStyles.screen, styles.centeredContainer, { backgroundColor: colors.bg }]}>
        <View style={{ alignItems: 'center' }}>
          <View style={styles.successIconWrap}>
            <Ionicons name="shield-checkmark" size={32} color={COLORS.accent} />
          </View>
          <Text style={[styles.centeredTitle, { color: colors.textPrimary }]}>{t.legionForged}</Text>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{t.yourInviteCode}</Text>
          <View style={[styles.codeCard, { backgroundColor: colors.bgCard }]}>
            <Text style={styles.codeText}>{forgedCode}</Text>
          </View>
          <Text style={[styles.centeredSub, { color: colors.textMuted }]}>
            {t.shareInviteCodeDesc}
          </Text>
        </View>
      </View>
    );
  }

  /* ─── Join view ─── */
  if (view === 'join') {
    return (
      <ScrollView style={[globalStyles.screen, { backgroundColor: colors.bg }]} contentContainerStyle={styles.content}>
        <Pressable onPress={() => setView('main')} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={18} color={COLORS.accent} />
          <Text style={styles.backText}>{t.back}</Text>
        </Pressable>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{t.joinLegion}</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>{t.enterInviteCode}</Text>
        <View style={[styles.card, { marginTop: SPACING.lg, backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{t.inviteCodeLabel}</Text>
          <TextInput
            style={[styles.codeInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
            value={inviteCode}
            onChangeText={setInviteCode}
            placeholder="e.g. AB12CD"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="characters"
            maxLength={6}
          />
          <Pressable
            style={[styles.actionBtn, loading && { opacity: 0.5 }]}
            onPress={handleJoin}
            disabled={loading}
          >
            <Ionicons name="enter-outline" size={18} color={COLORS.textInverse} />
            <Text style={styles.actionBtnText}>{loading ? t.joining : t.joinLegionBtn}</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  /* ─── Forge view ─── */
  if (view === 'forge') {
    return (
      <ScrollView style={[globalStyles.screen, { backgroundColor: colors.bg }]} contentContainerStyle={styles.content}>
        <Pressable onPress={() => setView('main')} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={18} color={COLORS.accent} />
          <Text style={styles.backText}>{t.back}</Text>
        </Pressable>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{t.forgeLegionTitle}</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>{t.createCoachingRoster}</Text>
        <View style={[styles.card, { marginTop: SPACING.lg, gap: SPACING.md, backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <View>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{t.legionName}</Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
              value={legionName}
              onChangeText={setLegionName}
              placeholder="e.g. Thunder Squad"
              placeholderTextColor={colors.textMuted}
            />
          </View>
          <View>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{t.sportLabel}</Text>
            <View style={styles.sportsGrid}>
              {SPORTS.map((s) => (
                <Pressable
                  key={s}
                  onPress={() => setSport(s)}
                  style={[styles.sportChip, { backgroundColor: colors.bgCard, borderColor: colors.border }, sport === s && styles.sportChipActive]}
                >
                  <Text style={[styles.sportChipText, { color: colors.textSecondary }, sport === s && styles.sportChipTextActive]}>
                    {s}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
          <Pressable
            style={[styles.forgeBtn, loading && { opacity: 0.5 }]}
            onPress={handleForge}
            disabled={loading}
          >
            <Ionicons name="hammer" size={18} color={COLORS.textInverse} />
            <Text style={styles.actionBtnText}>{loading ? t.forging : t.forgeLegionBtn}</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  /* ─── Main view ─── */
  return (
    <ScrollView scrollEnabled={scrollEnabled} style={[globalStyles.screen, { backgroundColor: colors.bg }]} contentContainerStyle={styles.content}>
      <View>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>{t.legion}</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>{t.teamManagement}</Text>
        </View>

        {hasLegion ? (
          <View style={{ gap: SPACING.md }}>
            <View style={[styles.activeCard, { backgroundColor: colors.bgCard }]}>
              <View style={styles.activeIconWrap}>
                <Ionicons name="shield-checkmark" size={28} color={COLORS.accent} />
              </View>
              <Text style={[styles.activeName, { color: colors.textPrimary }]}>{t.activeLegion}</Text>
              <View style={styles.activeCodeBadge}>
                <Text style={styles.activeCodeText}>{t.inviteCodeLabel}: {profile?.legionCode}</Text>
              </View>
              <Text style={[styles.activeSub, { color: colors.textMuted }]}>
                {isCoach ? t.coachActiveDesc : t.athleteActiveDesc}
              </Text>
            </View>

            {/* Unlock 3D pain model for athletes */}
            {!isCoach && (
              <View style={[styles.painSection, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{t.reportActivePain}</Text>
                <Text style={[styles.sectionDesc, { color: colors.textMuted }]}>{t.reportActivePainDesc}</Text>

                <View style={styles.modelContainer}>
                  <AnatomicalModel3D
                    activeRegionIds={new Set<string>()}
                    activeInjuries={[]}
                    selectedRegion={selectedRegion}
                    onRegionSelect={(reg) => {
                      if (reg) {
                        handleRegionTap(reg);
                      } else {
                        setSelectedRegion(null);
                      }
                    }}
                    scale={1.15}
                  />
                </View>
              </View>
            )}

            {isCoach && (
              <View style={[styles.rosterSection, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>ATHLETE ROSTER</Text>
                {athletes.length === 0 ? (
                  <Text style={[styles.sectionDesc, { color: colors.textMuted }]}>No athletes have joined your Legion yet.</Text>
                ) : (
                  athletes.map(athlete => {
                    // Find latest readiness score
                    const rec = athleteRecovery[0];
                    const readiness = rec ? rec.readinessScore : null;
                    return (
                      <Pressable
                        key={athlete.uid}
                        style={[styles.athleteCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                        onPress={() => setSelectedAthlete(athlete)}
                      >
                        <View style={styles.athleteInfo}>
                          <Text style={[styles.athleteName, { color: colors.textPrimary }]}>{athlete.name}</Text>
                          <Text style={[styles.athleteEmail, { color: colors.textMuted }]}>{athlete.email}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                      </Pressable>
                    );
                  })
                )}
              </View>
            )}
          </View>
        ) : (
          <View style={styles.optionsContainer}>
            {!isCoach && (
              <BouncyButton
                style={[styles.optionCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
                onPress={() => setView('join')}
              >
                <View style={styles.optionIconWrap}>
                  <Ionicons name="enter-outline" size={24} color={COLORS.accent} />
                </View>
                <Text style={[styles.optionTitle, { color: colors.textPrimary }]}>{t.joinLegionCardTitle}</Text>
                <Text style={[styles.optionDesc, { color: colors.textSecondary }]}>
                  {t.joinLegionCardDesc}
                </Text>
                <View style={styles.optionCtaRow}>
                  <Text style={styles.optionCta}>{t.enterCode}</Text>
                  <Ionicons name="arrow-forward" size={14} color={COLORS.accent} />
                </View>
              </BouncyButton>
            )}
            {isCoach && (
              <BouncyButton
                style={[styles.optionCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
                onPress={() => setView('forge')}
              >
                <View style={[styles.optionIconWrap, { backgroundColor: 'rgba(74,222,128,0.12)', borderColor: 'rgba(74,222,128,0.25)' }]}>
                  <Ionicons name="hammer-outline" size={24} color={COLORS.success} />
                </View>
                <Text style={[styles.optionTitle, { color: colors.textPrimary }]}>{t.forgeLegionCardTitle}</Text>
                <Text style={[styles.optionDesc, { color: colors.textSecondary }]}>
                  {t.forgeLegionCardDesc}
                </Text>
                <View style={styles.optionCtaRow}>
                  <Text style={[styles.optionCta, { color: COLORS.success }]}>{t.createRoster}</Text>
                  <Ionicons name="arrow-forward" size={14} color={COLORS.success} />
                </View>
              </BouncyButton>
            )}
          </View>
        )}

        {/* Log Pain Modal */}
        <Modal visible={showLogModal} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>{t.logPain}</Text>
              <Text style={styles.modalRegion}>{getTranslationForBodyPart(selectedRegion?.key || '', t).toUpperCase()}</Text>

              <Text style={[styles.inputLabel, { color: colors.textMuted }]}>{t.painType}</Text>
              <View style={styles.painTypeRow}>
                {PAIN_TYPES.map((type) => (
                  <Pressable
                    key={type}
                    onPress={() => setPainType(type)}
                    style={[
                      styles.painTypeBtn,
                      { borderColor: PAIN_TYPE_COLORS[type] + '60' },
                      painType === type && { backgroundColor: PAIN_TYPE_COLORS[type] + '30', borderColor: PAIN_TYPE_COLORS[type] },
                    ]}
                  >
                    <Text style={[styles.painTypeTxt, { color: painType === type ? PAIN_TYPE_COLORS[type] : colors.textMuted }]}>
                      {t[type] ? t[type].toUpperCase() : type.toUpperCase()}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={[styles.inputLabel, { color: colors.textMuted }]}>{t.intensity}: {intensity}/10</Text>
              <View style={styles.intensityRow}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                  <Pressable
                    key={n}
                    onPress={() => setIntensity(n)}
                    style={[
                      styles.intensityDot,
                      { backgroundColor: colors.surface, borderColor: colors.border },
                      n <= intensity && {
                        backgroundColor: n <= 3 ? COLORS.success : n <= 6 ? COLORS.warning : COLORS.danger,
                        borderColor: n <= 3 ? COLORS.success : n <= 6 ? COLORS.warning : COLORS.danger,
                      },
                    ]}
                  />
                ))}
              </View>

              <Text style={[styles.inputLabel, { color: colors.textMuted }]}>{t.notesOptional}</Text>
              <TextInput
                style={[styles.notesInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
                value={notes}
                onChangeText={setNotes}
                placeholder={t.describePainPlaceholder}
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={3}
              />

              <View style={styles.modalActions}>
                <Pressable style={[styles.btnCancel, { backgroundColor: colors.surface }]} onPress={() => setShowLogModal(false)}>
                  <Text style={[styles.btnCancelText, { color: colors.textMuted }]}>{t.cancel}</Text>
                </Pressable>
                <Pressable style={[styles.btnSave, saving && { opacity: 0.5 }]} onPress={handleSavePain} disabled={saving}>
                  <Text style={[styles.btnSaveText, { color: COLORS.textInverse }]}>{t.logPainBtn}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        {/* Coach Athlete Detail Modal */}
        <Modal visible={!!selectedAthlete} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <ScrollView contentContainerStyle={[styles.modalCard, { backgroundColor: colors.bgCard, borderColor: colors.border, width: '90%', maxHeight: '90%' }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={[styles.modalTitle, { color: colors.textPrimary, marginBottom: 0 }]}>{selectedAthlete?.name}</Text>
                <Pressable onPress={() => setSelectedAthlete(null)}>
                  <Ionicons name="close" size={24} color={colors.textMuted} />
                </Pressable>
              </View>
              <Text style={[styles.sectionDesc, { color: colors.textMuted, marginBottom: SPACING.md }]}>{selectedAthlete?.email}</Text>
              
              <Text style={[styles.sectionLabel, { color: colors.textMuted, marginTop: SPACING.md }]}>3D PAIN MAP (VIEW ONLY)</Text>
              <View style={[styles.modelContainer, { height: 250 }]}>
                <AnatomicalModel3D
                  activeRegionIds={new Set(athleteInjuries.filter(i => !i.resolved).map(i => i.bodyPart))}
                  activeInjuries={athleteInjuries.filter(i => !i.resolved)}
                  selectedRegion={null}
                  onRegionSelect={() => {}}
                  scale={0.9}
                  onDragStart={() => {}}
                  onDragEnd={() => {}}
                />
              </View>

              <Text style={[styles.sectionLabel, { color: colors.textMuted, marginTop: SPACING.xl }]}>SEND COACH NOTE</Text>
              <TextInput
                style={[styles.notesInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary, marginBottom: SPACING.sm }]}
                value={coachNoteInput}
                onChangeText={setCoachNoteInput}
                placeholder="Suggest rest, modify training..."
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={3}
              />
              <Pressable style={[styles.actionBtn, isSendingNote && { opacity: 0.5 }]} onPress={handleSendCoachNote} disabled={isSendingNote}>
                <Text style={styles.actionBtnText}>{isSendingNote ? 'SENDING...' : 'SEND NOTE'}</Text>
              </Pressable>
            </ScrollView>
          </View>
        </Modal>

      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: SPACING.md,
    paddingBottom: 140,
  },
  header: {
    paddingTop: SPACING.md,
    marginBottom: SPACING.lg,
  },
  title: {
    fontFamily: FONTS.display,
    fontSize: 28,
    color: COLORS.textPrimary,
    letterSpacing: 2,
  },
  subtitle: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: COLORS.textMuted,
    letterSpacing: 2,
    marginTop: 3,
  },
  sectionLabel: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: COLORS.textMuted,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: SPACING.sm,
  },
  card: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  backText: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: COLORS.accent,
    letterSpacing: 1.5,
  },

  /* ── Inputs ── */
  codeInput: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    fontFamily: FONTS.display,
    fontSize: 28,
    color: COLORS.textPrimary,
    letterSpacing: 8,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  textInput: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textPrimary,
  },

  /* ── Action buttons ── */
  actionBtn: {
    flexDirection: 'row',
    gap: SPACING.sm,
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  forgeBtn: {
    flexDirection: 'row',
    gap: SPACING.sm,
    backgroundColor: COLORS.success,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnText: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    color: COLORS.textInverse,
    letterSpacing: 1.5,
    fontWeight: '700',
  },

  /* ── Sport chips ── */
  sportsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  sportChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bgCard,
  },
  sportChipActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  sportChipText: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  sportChipTextActive: {
    color: COLORS.textInverse,
    fontWeight: '700',
  },

  /* ── Active legion card ── */
  activeCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.25)',
    padding: SPACING.xl,
    alignItems: 'center',
    gap: SPACING.md,
  },
  activeIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(249,115,22,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeName: {
    fontFamily: FONTS.display,
    fontSize: 24,
    color: COLORS.textPrimary,
    letterSpacing: 2,
  },
  activeCodeBadge: {
    backgroundColor: 'rgba(249,115,22,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.25)',
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: 4,
  },
  activeCodeText: {
    fontFamily: FONTS.mono,
    fontSize: 13,
    color: COLORS.accent,
    letterSpacing: 3,
    fontWeight: '700',
  },
  activeSub: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },

  /* ── Option cards ── */
  optionsContainer: {
    gap: SPACING.md,
  },
  optionCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.xl,
    gap: SPACING.sm,
  },
  optionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(249,115,22,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  optionTitle: {
    fontFamily: FONTS.display,
    fontSize: 22,
    color: COLORS.textPrimary,
    letterSpacing: 1,
  },
  optionDesc: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  optionCtaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: SPACING.sm,
  },
  optionCta: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: COLORS.accent,
    letterSpacing: 1.5,
    fontWeight: '700',
  },

  /* ── Forged success ── */
  successIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: 'rgba(249,115,22,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  centeredContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
    gap: SPACING.md,
  },
  centeredTitle: {
    fontFamily: FONTS.display,
    fontSize: 28,
    color: COLORS.textPrimary,
    letterSpacing: 2,
    textAlign: 'center',
  },
  centeredSub: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  codeCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.xl,
    borderWidth: 2,
    borderColor: COLORS.accent,
    paddingHorizontal: SPACING.xxl,
    paddingVertical: SPACING.lg,
    alignItems: 'center',
  },
  codeText: {
    fontFamily: FONTS.display,
    fontSize: 52,
    color: COLORS.accent,
    letterSpacing: 10,
  },

  /* ── 3D pain logging section ── */
  painSection: {
    marginTop: SPACING.md,
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  sectionTitle: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: COLORS.textMuted,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  sectionDesc: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.textMuted,
    lineHeight: 18,
    marginBottom: SPACING.sm,
  },
  modelContainer: {
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  canvasCard: {
    alignItems: 'center',
  },
  canvasLabel: {
    fontFamily: FONTS.mono,
    fontSize: 8,
    color: COLORS.textMuted,
    letterSpacing: 1,
    marginBottom: 8,
    width: 170,
    textAlign: 'center',
  },
  controlsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  controlBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  controlBtnActive: {
    backgroundColor: COLORS.cyan,
    borderColor: COLORS.cyan,
  },
  controlBtnText: {
    fontFamily: FONTS.mono,
    fontSize: 8,
    color: COLORS.textMuted,
    letterSpacing: 0.5,
  },

  // Modal styling (custom layout)
  modalOverlay: {
    flex: 1,
    backgroundColor: '#000000D0',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: COLORS.bgCard,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    borderTopWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    paddingBottom: 40,
  },
  modalTitle: {
    fontFamily: FONTS.display,
    fontSize: 24,
    color: COLORS.textPrimary,
    letterSpacing: 2,
  },
  modalRegion: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: COLORS.cyan,
    letterSpacing: 2,
    marginBottom: SPACING.lg,
  },
  inputLabel: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    color: COLORS.textMuted,
    letterSpacing: 1.5,
    marginBottom: SPACING.xs,
  },
  painTypeRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
    flexWrap: 'wrap',
  },
  painTypeBtn: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  painTypeTxt: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    letterSpacing: 1,
  },
  intensityRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
    flexWrap: 'wrap',
  },
  intensityDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  notesInput: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.sm,
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textPrimary,
    marginBottom: SPACING.lg,
    minHeight: 72,
  },
  modalActions: {
    marginTop: SPACING.lg,
    paddingTop: SPACING.lg,
  },
  btnCancel: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: 'center',
  },
  btnCancelText: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  btnSave: {
    flex: 1,
    backgroundColor: COLORS.cyan,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: 'center',
  },
  btnSaveText: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  rosterSection: {
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    marginTop: SPACING.md,
  },
  athleteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.sm,
  },
  athleteInfo: {
    flex: 1,
  },
  athleteName: {
    fontFamily: FONTS.body,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  athleteEmail: {
    fontFamily: FONTS.mono,
    fontSize: 11,
  },
});
