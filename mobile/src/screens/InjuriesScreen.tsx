import { useTranslation } from '@/hooks/useTranslation';
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, Modal, TextInput, Alert, Linking, Animated, Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAppStore } from '@/store/useAppStore';
import { COLORS, FONTS, SPACING, RADIUS, globalStyles } from '@/utils/theme';
import { savePainMarker, resolvePainMarker , subscribeToLegion, fetchAthleteProfiles } from '@/services/firebase';
import type { PainMarker } from '@/services/firebase';
import { formatDate } from '@/utils/calculations';
import { useTheme } from '@/hooks/useTheme';
import {
  AnatomicalModel3D,
  BODY_REGIONS_3D,
  PAIN_TYPES,
  PAIN_TYPE_COLORS,
} from '@/components/common/AnatomicalModel3D';


// â”€â”€â”€ Education Injury Database â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface InjuryDetail {
  id: string;
  name: string;
  part: string;
  category: 'common' | 'rare' | 'serious';
  description: string;
  symptoms: string[];
  riskLevel: 'LOW RISK' | 'MEDIUM RISK' | 'HIGH RISK' | 'CRITICAL';
  risksIfIgnored: string;
  treatment: string;
}

const INJURY_DATABASE: InjuryDetail[] = [
  {
    id: 'plantar-fasciitis',
    name: 'Plantar Fasciitis',
    part: 'Foot',
    category: 'common',
    description: 'Heel and arch pain common in runners, jumpers, and those on their feet all day.',
    symptoms: ['Heel pain (worst in morning)', 'Arch pain', 'Stiffness after rest', 'Pain with prolonged standing'],
    riskLevel: 'LOW RISK',
    risksIfIgnored: 'Chronic cases can lead to bone spurs and require PRP injection or surgery.',
    treatment: 'Calf and plantar fascia stretching. Supportive footwear and orthotics. Night splints. Ice massage.',
  },
  {
    id: 'ankle-sprain',
    name: 'Ankle Sprain',
    part: 'Ankle',
    category: 'common',
    description: 'Stretching or tearing of ligaments that support the ankle, usually from twisting.',
    symptoms: ['Swelling and bruising', 'Tenderness to touch', 'Pain when putting weight', 'Limited range of motion'],
    riskLevel: 'LOW RISK',
    risksIfIgnored: 'Chronic ankle instability, repeat sprains, and early onset arthritis.',
    treatment: 'RICE protocol (Rest, Ice, Compression, Elevation), bracing, and progressive balance training.',
  },
  {
    id: 'shin-splints',
    name: 'Shin Splints',
    part: 'Lower Leg',
    category: 'common',
    description: 'Pain along the shin bone (tibia) caused by repetitive stress on connective tissue.',
    symptoms: ['Pain along front/side of lower leg', 'Tenderness along tibia', 'Mild swelling'],
    riskLevel: 'LOW RISK',
    risksIfIgnored: 'Can progress to a tibial stress fracture requiring weeks on crutches or boot.',
    treatment: 'Complete rest, ice, switching to low-impact workouts, calf stretching, and arch support.',
  },
  {
    id: 'muscle-cramp',
    name: 'Muscle Cramp',
    part: 'Quad',
    category: 'common',
    description: 'Sudden, involuntary contraction of one or more muscles, often due to dehydration or overuse.',
    symptoms: ['Intense sudden pain', 'Hard muscle bulge under skin', 'Temporary loss of function'],
    riskLevel: 'LOW RISK',
    risksIfIgnored: 'Muscle strains or tears if forced to stretch violently during a spasm.',
    treatment: 'Hydration with electrolytes, gentle passive stretching, warm baths, and light massage.',
  },
  {
    id: 'tennis-elbow',
    name: 'Tennis Elbow',
    part: 'Elbow',
    category: 'common',
    description: 'Inflammation or micro-tearing of the tendons joining forearm muscles to the outside of the elbow.',
    symptoms: ['Pain on outer elbow', 'Pain with gripping/twisting', 'Weak grip strength'],
    riskLevel: 'LOW RISK',
    risksIfIgnored: 'Chronic tendinopathy, persistent weakness, and permanent tendon degeneration.',
    treatment: 'Eccentric forearm exercises, elbow strap/brace, rest from repetitive tasks, and cold therapy.',
  },
  {
    id: 'rotator-cuff-strain',
    name: 'Rotator Cuff Strain',
    part: 'Shoulder',
    category: 'common',
    description: 'Tear or stretch in the shoulder tendons/muscles, common in throwing or overhead sports.',
    symptoms: ['Dull ache deep in shoulder', 'Difficulty reaching overhead', 'Weakness when rotating arm'],
    riskLevel: 'MEDIUM RISK',
    risksIfIgnored: 'Complete tendon tear requiring surgical repair, chronic instability, or frozen shoulder.',
    treatment: 'Physical therapy focusing on shoulder stability, avoiding overhead movements, and ice.',
  },
  {
    id: 'lower-back-strain',
    name: 'Lower Back Strain',
    part: 'Lower Back',
    category: 'common',
    description: 'Injury to muscles or ligaments of the lower back, often from heavy lifting or twisting.',
    symptoms: ['Dull ache in lumbar area', 'Spasms', 'Stiffness', 'Limited range of motion'],
    riskLevel: 'LOW RISK',
    risksIfIgnored: 'Chronic lower back pain, disc herniation, and compensatory injuries in hips.',
    treatment: 'Core strengthening, active movement (light walking), heat therapy, and correct posture.',
  },
  {
    id: 'acl-tear',
    name: 'ACL Tear',
    part: 'Knee',
    category: 'rare',
    description: 'Tearing of the anterior cruciate ligament, crucial for knee stability, often from sudden pivots.',
    symptoms: ['Pop sound on injury', 'Severe pain', 'Rapid swelling', 'Knee giving out'],
    riskLevel: 'HIGH RISK',
    risksIfIgnored: 'Chronic knee instability, meniscus damage, and rapid development of osteoarthritis.',
    treatment: 'Reconstructive surgery (often required for athletes) followed by 6-9 months of physical therapy.',
  },
  {
    id: 'achilles-rupture',
    name: 'Achilles Tendon Rupture',
    part: 'Ankle',
    category: 'rare',
    description: 'Complete tear of the tendon connecting calf muscles to the heel bone.',
    symptoms: ['Sudden snap/pop', 'Feeling of being kicked in the calf', 'Inability to push off/point toes'],
    riskLevel: 'HIGH RISK',
    risksIfIgnored: 'Permanent limp, calf muscle atrophy, and severe loss of ankle mobility.',
    treatment: 'Surgical repair or non-surgical casting/booting, requiring extensive rehabilitation.',
  },
  {
    id: 'stress-fracture',
    name: 'Stress Fracture',
    part: 'Foot',
    category: 'rare',
    description: 'Small cracks in bone caused by repetitive application of force (overuse).',
    symptoms: ['Localized bone pain (worsens with activity)', 'Pinpoint tenderness', 'Swelling'],
    riskLevel: 'MEDIUM RISK',
    risksIfIgnored: 'Full bone fracture, non-union of the bone, and chronic disability.',
    treatment: 'Complete rest, protective boot, and avoiding high-impact activities for 6-8 weeks.',
  },
  {
    id: 'herniated-disc',
    name: 'Herniated Disc',
    part: 'Lower Back',
    category: 'rare',
    description: 'Fragment of the disc nucleus pushed out into the spinal canal through a tear.',
    symptoms: ['Shooting pain down leg (sciatica)', 'Numbness/tingling in toes', 'Lower back pain'],
    riskLevel: 'HIGH RISK',
    risksIfIgnored: 'Permanent nerve damage, foot drop, and loss of bowel/bladder control.',
    treatment: 'Core stability training, anti-inflammatories, epidural injections, or microdiscectomy surgery.',
  },
  {
    id: 'concussion',
    name: 'Concussion',
    part: 'Head',
    category: 'serious',
    description: 'Traumatic brain injury caused by a blow to the head or body that shakes the brain.',
    symptoms: ['Headache and dizziness', 'Nausea/vomiting', 'Sensitivity to light/sound', 'Confusion'],
    riskLevel: 'CRITICAL',
    risksIfIgnored: 'Second-impact syndrome (fatal), permanent cognitive impairment, and chronic depression.',
    treatment: 'Strict cognitive and physical rest, gradual return-to-play protocol, and medical clearance.',
  },
  {
    id: 'heat-stroke',
    name: 'Heat Stroke',
    part: 'Head',
    category: 'serious',
    description: 'Life-threatening condition where the body temperature rises above 40Â°C due to heat exposure.',
    symptoms: ['High body temperature', 'Altered mental state (confusion)', 'Hot dry skin', 'Rapid breathing'],
    riskLevel: 'CRITICAL',
    risksIfIgnored: 'Multi-organ failure, permanent brain damage, coma, and death if not treated immediately.',
    treatment: 'EMERGENCY medical attention, immediate rapid cooling (ice bath, wet sheets), and hydration.',
  },
  {
    id: 'rhabdo',
    name: 'Rhabdomyolysis',
    part: 'Quad',
    category: 'serious',
    description: 'Breakdown of damaged muscle tissue, releasing dangerous proteins into the blood.',
    symptoms: ['Severe muscle pain and swelling', 'Profound weakness', 'Dark tea-colored urine'],
    riskLevel: 'CRITICAL',
    risksIfIgnored: 'Acute kidney failure, cardiac arrest from high potassium, and death.',
    treatment: 'Immediate hospitalization, aggressive IV hydration, and monitoring of kidney function.',
  },
  {
    id: 'c-spine-injury',
    name: 'Cervical Spine Injury',
    part: 'Neck',
    category: 'serious',
    description: 'Damage to the spinal cord or vertebrae in the neck, usually from high-impact collisions.',
    symptoms: ['Severe neck pain', 'Numbness/tingling in limbs', 'Paralysis below the neck'],
    riskLevel: 'CRITICAL',
    risksIfIgnored: 'Permanent quadriplegia, respiratory arrest, and death.',
    treatment: 'Immediate immobilization, neck collar, emergency surgical stabilization.',
  },
];

function AthleteInjuriesView() {
  const { user, injuries, setInjuries } = useAppStore();
  const { colors } = useTheme();
  const [scrollEnabled, setScrollEnabled] = useState(true);
  
  const entranceAnim = useRef(new Animated.Value(0)).current;
  const catalogAnim = useRef(new Animated.Value(0)).current;
  const emergencyPulse = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    Animated.timing(entranceAnim, {
      toValue: 1,
      duration: 650,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    // Loop emergency alert pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(emergencyPulse, {
          toValue: 1.0,
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(emergencyPulse, {
          toValue: 0.9,
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        })
      ])
    ).start();
  }, []);

  // Interactive states
  const [selectedRegion, setSelectedRegion] = useState<typeof BODY_REGIONS_3D[0] | null>(null);
  const [categoryTab, setCategoryTab] = useState<'common' | 'rare' | 'serious'>('common');

  useEffect(() => {
    catalogAnim.setValue(0);
    Animated.timing(catalogAnim, {
      toValue: 1,
      duration: 350,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [selectedRegion, categoryTab]);
  const [activeDetailInjury, setActiveDetailInjury] = useState<InjuryDetail | null>(null);

  // Pain Logger state
  const [showLogModal, setShowLogModal] = useState(false);
  const [painType, setPainType] = useState<typeof PAIN_TYPES[number]>('dull');
  const [intensity, setIntensity] = useState(5);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const activeInjuries = injuries.filter((i) => !i.resolved);

  const activeRegionIds = new Set(
    activeInjuries.map((i) => {
      const found = BODY_REGIONS_3D.find((r) => r.key === i.bodyPart);
      return found?.id;
    }).filter((id): id is string => !!id)
  );

  const handleSavePain = async () => {
    if (!user || !selectedRegion) return;
    setSaving(true);
    try {
      await savePainMarker(user.uid, {
        uid: user.uid,
        bodyPart: selectedRegion.key,
        side: selectedRegion.id.startsWith('left') ? 'left'
          : selectedRegion.id.startsWith('right') ? 'right' : 'center',
        x: selectedRegion.x + 100, // store absolute coordinates back
        y: selectedRegion.y + 160,
        painType,
        intensity,
        notes,
        timestamp: Date.now(),
        resolved: false,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowLogModal(false);
    } catch {
      Alert.alert('Error', 'Failed to save pain marker.');
    }
    setSaving(false);
  };

  const handleResolve = async (marker: PainMarker) => {
    if (!user || !marker.id) return;
    try {
      await resolvePainMarker(user.uid, marker.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert('Error', 'Could not resolve marker.');
    }
  };

  const handleCallEmergency = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Linking.openURL('tel:112');
  };

  const handleTextEmergency = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Linking.openURL('sms:112');
  };

  // Filter injuries list based on current tab and selected region filter
  const filteredInjuries = INJURY_DATABASE.filter((inj) => {
    const matchesTab = inj.category === categoryTab;
    const matchesRegion = selectedRegion ? inj.part === selectedRegion.key : true;
    return matchesTab && matchesRegion;
  });

  const translateY = entranceAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [25, 0],
  });

  return (
    <ScrollView scrollEnabled={scrollEnabled} style={[globalStyles.screen, { backgroundColor: colors.bg }]} contentContainerStyle={styles.content}>
      <Animated.View style={{ opacity: entranceAnim, transform: [{ translateY }] }}>
        {/* Title */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>INJURIES</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>Prevention, Education & Emergency Response</Text>
        </View>

        {/* Emergency Card */}
        <Animated.View style={[styles.emergencyCard, { backgroundColor: colors.bgCard, opacity: emergencyPulse }]}>
          <View style={styles.emergencyLeft}>
            <Ionicons name="warning" size={24} color={COLORS.danger} />
            <View style={{ marginLeft: SPACING.sm }}>
              <Text style={styles.emergencyTitle}>ðŸš¨ EMERGENCY SERVICES</Text>
              <Text style={[styles.emergencyDesc, { color: colors.textMuted }]}>Life-threatening situations only</Text>
            </View>
          </View>
          <View style={styles.emergencyRow}>
            <Pressable style={styles.emergencyBtn} onPress={handleCallEmergency}>
              <Ionicons name="call" size={16} color={COLORS.textInverse} />
              <Text style={styles.emergencyBtnText}>CALL 112</Text>
            </Pressable>
            <Pressable style={[styles.emergencyBtn, { backgroundColor: colors.bgCard, borderColor: COLORS.danger, borderWidth: 1 }]} onPress={handleTextEmergency}>
              <Ionicons name="chatbubble-ellipses" size={16} color={COLORS.danger} />
              <Text style={[styles.emergencyBtnText, { color: COLORS.danger }]}>TEXT HELP</Text>
            </Pressable>
          </View>
        </Animated.View>

        {/* Control Area Tabs */}
        <View style={[styles.catalogTabs, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          {(['common', 'rare', 'serious'] as const).map((tab) => (
            <Pressable
              key={tab}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setCategoryTab(tab);
              }}
              style={[styles.catalogTab, categoryTab === tab && [styles.catalogTabActive, { backgroundColor: colors.border }]]}
            >
              <View style={[styles.tabDot, {
                backgroundColor: tab === 'common' ? COLORS.lime : tab === 'rare' ? COLORS.accent : COLORS.danger
              }]} />
              <Text style={[styles.catalogTabText, { color: categoryTab === tab ? colors.textPrimary : colors.textMuted }]}>
                {tab.toUpperCase()}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Interactive model row */}
        <View style={styles.modelContainer}>
          <AnatomicalModel3D
            activeRegionIds={activeRegionIds}
            activeInjuries={activeInjuries}
            selectedRegion={selectedRegion}
            onRegionSelect={setSelectedRegion}
            onDragStart={() => setScrollEnabled(false)}
            onDragEnd={() => setScrollEnabled(true)}
          />

          {/* Selected Part Actions */}
          <View style={styles.actionCol}>
            <Text style={[styles.panelTitle, { color: colors.textMuted }]}>CLICK REGION TO SELECT</Text>
            {selectedRegion ? (
              <View style={[styles.selectedCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                <View style={styles.selectedIconWrap}>
                  <Ionicons name="locate" size={24} color={COLORS.cyan} />
                </View>
                <Text style={[styles.selectedName, { color: colors.textPrimary }]}>{selectedRegion.label.toUpperCase()}</Text>
                
                <Pressable style={styles.logBtn} onPress={() => setShowLogModal(true)}>
                  <Ionicons name="add" size={16} color={COLORS.textInverse} />
                  <Text style={styles.logBtnText}>LOG PAIN</Text>
                </Pressable>

                <Pressable
                  style={styles.clearBtn}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectedRegion(null);
                  }}
                >
                  <Text style={[styles.clearBtnText, { color: colors.textMuted }]}>CLEAR FILTER</Text>
                </Pressable>
              </View>
            ) : (
              <View style={[styles.instructionsCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                <Ionicons name="cube-outline" size={24} color={colors.textMuted} style={{ marginBottom: 8 }} />
                <Text style={[styles.instructionText, { color: colors.textMuted }]}>
                  Rotate the 3D model to expose back parts (like Upper/Lower Back). Click on any dot to explore related injuries and log active pain.
                </Text>
              </View>
            )}

            {/* Active Pain summary */}
            <View style={styles.activePainSummary}>
              <Text style={[styles.summaryTitle, { color: colors.textMuted }]}>ACTIVE PAIN MARKERS</Text>
              {activeInjuries.length === 0 ? (
                <Text style={[styles.noPainText, { color: colors.textMuted }]}>No active pain markers logged.</Text>
              ) : (
                activeInjuries.slice(0, 3).map((inj, index) => (
                  <View key={index} style={[styles.miniPainCard, { backgroundColor: colors.bgCard, borderColor: PAIN_TYPE_COLORS[inj.painType] + '50' }]}>
                    <View style={[styles.miniPainDot, { backgroundColor: PAIN_TYPE_COLORS[inj.painType] }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.miniPainPart, { color: colors.textPrimary }]}>{inj.bodyPart}</Text>
                      <Text style={[styles.miniPainType, { color: PAIN_TYPE_COLORS[inj.painType] }]}>
                        {inj.painType.toUpperCase()} {inj.intensity}/10
                      </Text>
                    </View>
                    <Pressable onPress={() => handleResolve(inj)}>
                      <Ionicons name="checkmark-done" size={16} color={COLORS.success} />
                    </Pressable>
                  </View>
                ))
              )}
            </View>
          </View>
        </View>

        {/* Injury Catalog List */}
        <Text style={[styles.catalogTitle, { color: colors.textMuted }]}>COMMON ATHLETIC INJURIES</Text>
        <Animated.View style={[styles.catalogGrid, {
          opacity: catalogAnim,
          transform: [{
            translateY: catalogAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [12, 0],
            })
          }]
        }]}>
          {filteredInjuries.map((inj) => (
            <Pressable
              key={inj.id}
              style={[styles.catalogCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setActiveDetailInjury(inj);
              }}
            >
              <View style={styles.catalogCardLeft}>
                <Ionicons name="pin" size={14} color={COLORS.accent} />
                <Text style={[styles.catalogCardPart, { color: colors.textMuted }]}>{inj.part.toUpperCase()}</Text>
              </View>
              <Text style={[styles.catalogCardName, { color: colors.textPrimary }]}>{inj.name}</Text>
              <View style={styles.catalogBadgeRow}>
                <View style={[styles.catalogBadge, {
                  backgroundColor: inj.category === 'common' ? COLORS.lime + '15' : inj.category === 'rare' ? COLORS.accent + '15' : COLORS.danger + '15',
                  borderColor: inj.category === 'common' ? COLORS.lime + '40' : inj.category === 'rare' ? COLORS.accent + '40' : COLORS.danger + '40'
                }]}>
                  <Text style={[styles.catalogBadgeText, {
                    color: inj.category === 'common' ? COLORS.lime : inj.category === 'rare' ? COLORS.accent : COLORS.danger
                  }]}>
                    {inj.category.toUpperCase()}
                  </Text>
                </View>
              </View>
            </Pressable>
          ))}
          {filteredInjuries.length === 0 && (
            <Text style={[styles.empty, { color: colors.textMuted }]}>No injury profiles matching this body part under this category.</Text>
          )}
        </Animated.View>

        {/* Injury Detail Modal */}
        <Modal visible={!!activeDetailInjury} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <ScrollView style={[styles.detailCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]} contentContainerStyle={{ paddingBottom: 60 }}>
              <View style={styles.modalHeaderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.detailCategory, { color: colors.textMuted }]}>{activeDetailInjury?.category?.toUpperCase()} INJURY</Text>
                  <Text style={[styles.detailTitle, { color: colors.textPrimary }]}>{activeDetailInjury?.name}</Text>
                </View>
                <Pressable style={[styles.closeBtn, { backgroundColor: colors.surface }]} onPress={() => setActiveDetailInjury(null)}>
                  <Ionicons name="close" size={24} color={colors.textPrimary} />
                </Pressable>
              </View>

              <View style={[styles.detailDivider, { backgroundColor: colors.border }]} />

              <Text style={[styles.inputLabel, { color: colors.textMuted }]}>DESCRIPTION</Text>
              <Text style={[styles.detailDesc, { color: colors.textSecondary }]}>{activeDetailInjury?.description}</Text>

              <Text style={[styles.inputLabel, { marginTop: SPACING.md, color: colors.textMuted }]}>SYMPTOMS</Text>
              {activeDetailInjury?.symptoms.map((symp, i) => (
                <View key={i} style={styles.symptomRow}>
                  <Ionicons name="ellipse" size={6} color={COLORS.accent} style={{ marginTop: 6 }} />
                  <Text style={[styles.symptomText, { color: colors.textSecondary }]}>{symp}</Text>
                </View>
              ))}

              <Text style={[styles.inputLabel, { marginTop: SPACING.md, color: colors.textMuted }]}>RISK LEVEL</Text>
              <View style={[styles.riskLevelBadge, {
                backgroundColor: activeDetailInjury?.riskLevel === 'CRITICAL' ? COLORS.danger + '20' : activeDetailInjury?.riskLevel === 'HIGH RISK' ? '#F9731630' : COLORS.lime + '20',
                borderColor: activeDetailInjury?.riskLevel === 'CRITICAL' ? COLORS.danger : activeDetailInjury?.riskLevel === 'HIGH RISK' ? '#F97316' : COLORS.lime
              }]}>
                <Text style={[styles.riskLevelText, {
                  color: activeDetailInjury?.riskLevel === 'CRITICAL' ? COLORS.danger : activeDetailInjury?.riskLevel === 'HIGH RISK' ? '#F97316' : COLORS.lime
                }]}>
                  {activeDetailInjury?.riskLevel}
                </Text>
              </View>

              <Text style={[styles.inputLabel, { marginTop: SPACING.md, color: colors.textMuted }]}>RISKS IF IGNORED</Text>
              <Text style={[styles.detailDesc, { color: colors.textSecondary }]}>{activeDetailInjury?.risksIfIgnored}</Text>

              <Text style={[styles.inputLabel, { marginTop: SPACING.md, color: colors.textMuted }]}>TREATMENT</Text>
              <Text style={[styles.detailDesc, { color: colors.textSecondary }]}>{activeDetailInjury?.treatment}</Text>
            </ScrollView>
          </View>
        </Modal>

        {/* Log Pain Modal */}
        <Modal visible={showLogModal} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>LOG PAIN</Text>
              <Text style={styles.modalRegion}>{selectedRegion?.label?.toUpperCase()}</Text>

              <Text style={[styles.inputLabel, { color: colors.textMuted }]}>PAIN TYPE</Text>
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
                      {type.toUpperCase()}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={[styles.inputLabel, { color: colors.textMuted }]}>INTENSITY: {intensity}/10</Text>
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

              <Text style={[styles.inputLabel, { color: colors.textMuted }]}>NOTES (OPTIONAL)</Text>
              <TextInput
                style={[styles.notesInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Describe the pain, when it started..."
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={3}
              />

              <View style={styles.modalActions}>
                <Pressable style={[styles.btnCancel, { backgroundColor: colors.surface }]} onPress={() => setShowLogModal(false)}>
                  <Text style={[styles.btnCancelText, { color: colors.textMuted }]}>CANCEL</Text>
                </Pressable>
                <Pressable style={[styles.btnSave, saving && { opacity: 0.5 }]} onPress={handleSavePain} disabled={saving}>
                  <Text style={[styles.btnSaveText, { color: COLORS.textInverse }]}>LOG PAIN</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  greeting: { fontFamily: FONTS.mono, fontSize: 13, letterSpacing: 2, textTransform: 'uppercase' },
  name: { fontFamily: FONTS.display, fontSize: 32, marginTop: 4 },
  sectionTitle: { fontFamily: FONTS.display, fontSize: 20, marginBottom: 12, marginTop: 24, paddingHorizontal: 20 },
  alertCard: { flexDirection: 'row', alignItems: 'flex-start', padding: 16, borderRadius: RADIUS.lg, borderWidth: 1, marginTop: 24 },

  content: { padding: SPACING.md, paddingBottom: 140 },
  header: { paddingTop: SPACING.md, marginBottom: SPACING.md },
  title: { fontFamily: FONTS.display, fontSize: 36, color: COLORS.textPrimary, letterSpacing: 3, lineHeight: 40 },
  subtitle: { fontFamily: FONTS.mono, fontSize: 10, color: COLORS.textMuted, letterSpacing: 1.5 },
  
  // Emergency Area
  emergencyCard: {
    backgroundColor: COLORS.bgCard, borderRadius: RADIUS.xl, borderWidth: 1,
    borderColor: COLORS.danger + '40', padding: SPACING.md, marginBottom: SPACING.md,
    gap: SPACING.md,
  },
  emergencyLeft: { flexDirection: 'row', alignItems: 'center' },
  emergencyTitle: { fontFamily: FONTS.display, fontSize: 16, color: COLORS.danger, letterSpacing: 1 },
  emergencyDesc: { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.textMuted },
  emergencyRow: { flexDirection: 'row', gap: SPACING.sm },
  emergencyBtn: {
    flex: 1, flexDirection: 'row', gap: 6, backgroundColor: COLORS.danger,
    borderRadius: RADIUS.md, padding: SPACING.sm + 2, alignItems: 'center', justifyContent: 'center',
  },
  emergencyBtnText: { fontFamily: FONTS.mono, fontSize: 10, color: COLORS.textInverse, fontWeight: '700', letterSpacing: 1 },

  // Catalog Tabs
  catalogTabs: {
    flexDirection: 'row', backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border, padding: 3, marginBottom: SPACING.md,
  },
  catalogTab: {
    flex: 1, flexDirection: 'row', gap: 6, paddingVertical: SPACING.sm,
    borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center',
  },
  catalogTabActive: { backgroundColor: COLORS.border },
  tabDot: { width: 6, height: 6, borderRadius: 3 },
  catalogTabText: { fontFamily: FONTS.mono, fontSize: 10, color: COLORS.textMuted, letterSpacing: 1 },

  // Interactive anatomical model row
  modelContainer: { flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.lg },
  canvasCard: {
    backgroundColor: COLORS.bgCard, borderRadius: RADIUS.xl, borderWidth: 1,
    borderColor: COLORS.border, padding: SPACING.md, alignItems: 'center',
  },
  canvasLabel: { fontFamily: FONTS.mono, fontSize: 8, color: COLORS.textMuted, letterSpacing: 1, marginBottom: 8, width: 170, textAlign: 'center' },
  
  // Model control buttons
  controlsRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
  controlBtn: {
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.sm,
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface,
  },
  controlBtnActive: { backgroundColor: COLORS.cyan, borderColor: COLORS.cyan },
  controlBtnText: { fontFamily: FONTS.mono, fontSize: 8, color: COLORS.textMuted, letterSpacing: 0.5 },

  // Action column details
  actionCol: { flex: 1, gap: SPACING.md },
  panelTitle: { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.textMuted, letterSpacing: 1.5, marginBottom: 2 },
  selectedCard: {
    backgroundColor: COLORS.bgCard, borderRadius: RADIUS.xl, borderWidth: 1,
    borderColor: COLORS.cyan + '40', padding: SPACING.md, alignItems: 'center', gap: SPACING.sm,
  },
  selectedIconWrap: {
    width: 44, height: 44, borderRadius: RADIUS.md,
    backgroundColor: COLORS.cyan + '15', borderWidth: 1, borderColor: COLORS.cyan + '35',
    alignItems: 'center', justifyContent: 'center',
  },
  selectedName: { fontFamily: FONTS.display, fontSize: 18, color: COLORS.textPrimary, letterSpacing: 1 },
  logBtn: {
    flexDirection: 'row', gap: 6, backgroundColor: COLORS.cyan,
    borderRadius: RADIUS.md, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md,
    alignItems: 'center', justifyContent: 'center', width: '100%',
  },
  logBtnText: { fontFamily: FONTS.mono, fontSize: 10, color: COLORS.textInverse, fontWeight: '700', letterSpacing: 1 },
  clearBtn: { paddingVertical: 4, alignItems: 'center' },
  clearBtnText: { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.textMuted, letterSpacing: 1 },

  instructionsCard: {
    backgroundColor: COLORS.bgCard, borderRadius: RADIUS.xl, borderWidth: 1,
    borderColor: COLORS.border, padding: SPACING.md, alignItems: 'center',
  },
  instructionText: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.textMuted, textAlign: 'center', lineHeight: 16 },

  // Active pain summary in sidebar
  activePainSummary: { gap: SPACING.xs, marginTop: SPACING.xs },
  summaryTitle: { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.textMuted, letterSpacing: 1.5 },
  noPainText: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.textMuted, fontStyle: 'italic' },
  miniPainCard: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.sm, borderWidth: 1, padding: 6,
  },
  miniPainDot: { width: 6, height: 6, borderRadius: 3 },
  miniPainPart: { fontFamily: FONTS.body, fontSize: 10, color: COLORS.textPrimary },
  miniPainType: { fontFamily: FONTS.mono, fontSize: 8, letterSpacing: 0.5 },

  // Injury catalog list style
  catalogTitle: { fontFamily: FONTS.mono, fontSize: 10, color: COLORS.textMuted, letterSpacing: 2, marginBottom: SPACING.sm },
  catalogGrid: { gap: SPACING.sm },
  catalogCard: {
    backgroundColor: COLORS.bgCard, borderRadius: RADIUS.xl, borderWidth: 1,
    borderColor: COLORS.border, padding: SPACING.md,
  },
  catalogCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  catalogCardPart: { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.textMuted, letterSpacing: 1 },
  catalogCardName: { fontFamily: FONTS.display, fontSize: 22, color: COLORS.textPrimary, letterSpacing: 1, lineHeight: 24 },
  catalogBadgeRow: { flexDirection: 'row', marginTop: SPACING.sm },
  catalogBadge: {
    borderRadius: RADIUS.full, borderWidth: 1, paddingHorizontal: SPACING.md, paddingVertical: 2,
  },
  catalogBadgeText: { fontFamily: FONTS.mono, fontSize: 9, letterSpacing: 1 },
  empty: { fontFamily: FONTS.mono, fontSize: 11, color: COLORS.textMuted, textAlign: 'center', paddingVertical: SPACING.xl },

  // Overlays & detail models
  modalOverlay: { flex: 1, backgroundColor: '#000000D0', justifyContent: 'flex-end' },
  detailCard: {
    backgroundColor: COLORS.bgCard, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl,
    borderTopWidth: 1, borderColor: COLORS.border, padding: SPACING.lg, maxHeight: '85%',
  },
  modalHeaderRow: { flexDirection: 'row', alignItems: 'center' },
  detailCategory: { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.textMuted, letterSpacing: 1.5 },
  detailTitle: { fontFamily: FONTS.display, fontSize: 28, color: COLORS.textPrimary, letterSpacing: 2, marginTop: 2 },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  detailDivider: { height: 1, backgroundColor: COLORS.border, marginVertical: SPACING.md },
  detailDesc: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.textSecondary, lineHeight: 20 },
  symptomRow: { flexDirection: 'row', gap: 8, marginVertical: 2 },
  symptomText: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.textSecondary },
  riskLevelBadge: {
    borderRadius: RADIUS.sm, borderWidth: 1, paddingVertical: 4, paddingHorizontal: SPACING.md,
    alignSelf: 'flex-start', marginVertical: SPACING.xs,
  },
  riskLevelText: { fontFamily: FONTS.mono, fontSize: 10, fontWeight: '700', letterSpacing: 1 },

  // Log Pain elements
  modalCard: {
    backgroundColor: COLORS.bgCard, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl,
    borderTopWidth: 1, borderColor: COLORS.border, padding: SPACING.lg, paddingBottom: 40,
  },
  modalTitle: { fontFamily: FONTS.display, fontSize: 24, color: COLORS.textPrimary, letterSpacing: 2 },
  modalRegion: { fontFamily: FONTS.mono, fontSize: 11, color: COLORS.cyan, letterSpacing: 2, marginBottom: SPACING.lg },
  inputLabel: { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.textMuted, letterSpacing: 1.5, marginBottom: SPACING.xs },
  painTypeRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md, flexWrap: 'wrap' },
  painTypeBtn: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: RADIUS.full, borderWidth: 1 },
  painTypeTxt: { fontFamily: FONTS.mono, fontSize: 10, letterSpacing: 1 },
  intensityRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.lg, flexWrap: 'wrap' },
  intensityDot: { width: 26, height: 26, borderRadius: 13, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  notesInput: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.sm, borderWidth: 1,
    borderColor: COLORS.border, padding: SPACING.sm, fontFamily: FONTS.body,
    fontSize: 13, color: COLORS.textPrimary, marginBottom: SPACING.lg, minHeight: 72,
  },
  modalActions: { flexDirection: 'row', gap: SPACING.sm },
  btnCancel: { flex: 1, padding: SPACING.md, borderRadius: RADIUS.md, backgroundColor: COLORS.surface, alignItems: 'center' },
  btnCancelText: { fontFamily: FONTS.mono, fontSize: 12, color: COLORS.textMuted, letterSpacing: 1 },
  btnSave: { flex: 2, padding: SPACING.md, borderRadius: RADIUS.md, backgroundColor: COLORS.danger, alignItems: 'center' },
  btnSaveText: { fontFamily: FONTS.mono, fontSize: 12, color: COLORS.textPrimary, letterSpacing: 1 },
});

function CoachInjuriesView() {
  const { profile } = useAppStore();
  const { t } = useTranslation();
  const { colors } = useTheme();

  const [activeLegion, setActiveLegion] = useState<any>(null);
  const [athletes, setAthletes] = useState<any[]>([]);

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

  const activeInjuriesList = athletes.filter(a => activeLegion?.athlete_status?.[a.uid]?.[Object.keys(activeLegion?.athlete_status[a.uid] || {})[0]]?.injuryStatus?.startsWith('Yes'));
  const healthyAthletesList = athletes.filter(a => !activeLegion?.athlete_status?.[a.uid]?.[Object.keys(activeLegion?.athlete_status[a.uid] || {})[0]]?.injuryStatus?.startsWith('Yes'));

  return (
    <ScrollView style={[globalStyles.screen, { backgroundColor: colors.bg }]} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.greeting, { color: colors.textMuted }]}>Injury Dashboard</Text>
          <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>TEAM HEALTH</Text>
        </View>
      </View>

      <Text style={[styles.sectionTitle, { color: colors.textPrimary, paddingHorizontal: 20 }]}>Active Injuries ({activeInjuriesList.length})</Text>
      <View style={{ paddingHorizontal: 20 }}>
        {activeInjuriesList.length === 0 ? (
          <View style={{ padding: 20, alignItems: 'center', backgroundColor: colors.surface, borderRadius: 16 }}>
            <Text style={{ color: colors.textMuted }}>No active injuries reported.</Text>
          </View>
        ) : (
          activeInjuriesList.map(athlete => (
            <View key={athlete.uid} style={{ padding: 16, backgroundColor: COLORS.danger + '15', borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: COLORS.danger + '40', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.danger }}>{athlete.name}</Text>
                <Text style={{ fontSize: 14, color: colors.textSecondary }}>Requires modification/rest</Text>
              </View>
              <Ionicons name="warning" size={24} color={COLORS.danger} />
            </View>
          ))
        )}
      </View>

      <Text style={[styles.sectionTitle, { color: colors.textPrimary, paddingHorizontal: 20, marginTop: 20 }]}>At-Risk Athletes ({healthyAthletesList.length})</Text>
      <View style={{ paddingHorizontal: 20 }}>
        {healthyAthletesList.length === 0 ? (
          <View style={{ padding: 20, alignItems: 'center', backgroundColor: colors.surface, borderRadius: 16 }}>
            <Text style={{ color: colors.textMuted }}>No healthy athletes on roster.</Text>
          </View>
        ) : (
          healthyAthletesList.map(athlete => {
            // Placeholder risk calculation based on sport for Coach Dashboard view
            const riskLevel = athlete.sport === 'Football' || athlete.sport === 'Basketball' ? 'High' : 'Moderate';
            const riskColor = riskLevel === 'High' ? '#FF5A1F' : COLORS.lime;
            
            return (
              <View key={athlete.uid} style={{ padding: 16, backgroundColor: colors.surface, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: colors.textPrimary }}>{athlete.name}</Text>
                  <Text style={{ fontSize: 14, color: colors.textSecondary }}>{athlete.sport}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 12, color: colors.textMuted }}>Injury Risk</Text>
                  <Text style={{ fontSize: 14, fontWeight: 'bold', color: riskColor }}>{riskLevel}</Text>
                </View>
              </View>
            )
          })
        )}
      </View>
    </ScrollView>
  );
}

export default function InjuriesScreen() {
  const { profile } = useAppStore();
  if (profile?.role === 'coach') return <CoachInjuriesView />;
  return <AthleteInjuriesView />;
}
