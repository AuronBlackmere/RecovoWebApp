import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, Animated, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { COLORS, FONTS, SPACING, RADIUS } from '@/utils/theme';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

const TUTORIAL_STEPS = [
  {
    title: 'TRACKS',
    icon: 'barbell',
    color: COLORS.cyan,
    desc: 'Log your sets and reps seamlessly. Our AI builds custom injury prevention warmups based on your sport and pain markers.',
  },
  {
    title: 'RECOVERY',
    icon: 'pulse',
    color: '#F43F5E',
    desc: 'Sync real health data like HRV and Sleep directly from Apple Health or Google Fit to calculate your daily Readiness score.',
  },
  {
    title: 'INJURIES',
    icon: 'body',
    color: '#EAB308',
    desc: 'Experiencing pain? Mark it on the interactive 3D heatmap. The app automatically adapts your AI workouts to protect those areas.',
  },
  {
    title: 'LEGION',
    icon: 'shield',
    color: '#8B5CF6',
    desc: 'Join a Legion. Compare readiness scores with your teammates, check the leaderboard, and communicate with your coach.',
  }
];

export function AppTutorial({ visible, onComplete }: { visible: boolean; onComplete: () => void }) {
  const [step, setStep] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  if (!visible) return null;

  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step < TUTORIAL_STEPS.length - 1) {
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
        setStep(step + 1);
        Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
      });
    } else {
      onComplete();
    }
  };

  const current = TUTORIAL_STEPS[step];

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <LinearGradient colors={['rgba(10,10,15,0.95)', 'rgba(10,10,15,0.98)']} style={StyleSheet.absoluteFillObject} />
        
        <View style={styles.content}>
          <Text style={styles.welcomeTitle}>WELCOME TO RECOVO</Text>
          <Text style={styles.welcomeSub}>Let's take a quick tour.</Text>

          <Animated.View style={[styles.card, { opacity: fadeAnim, borderColor: current.color }]}>
            <View style={[styles.iconBox, { backgroundColor: current.color + '20' }]}>
              <Ionicons name={current.icon as any} size={48} color={current.color} />
            </View>
            <Text style={[styles.stepTitle, { color: current.color }]}>{current.title}</Text>
            <Text style={styles.stepDesc}>{current.desc}</Text>
          </Animated.View>

          <View style={styles.footer}>
            <View style={styles.dots}>
              {TUTORIAL_STEPS.map((_, i) => (
                <View key={i} style={[styles.dot, i === step && { backgroundColor: COLORS.cyan, width: 24 }]} />
              ))}
            </View>

            <Pressable style={styles.btnNext} onPress={handleNext}>
              <Text style={styles.btnNextText}>
                {step === TUTORIAL_STEPS.length - 1 ? "GOT IT, LET'S GO!" : "NEXT"}
              </Text>
              <Ionicons name={step === TUTORIAL_STEPS.length - 1 ? 'checkmark' : 'arrow-forward'} size={16} color={COLORS.bg} />
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    width: '90%',
    maxWidth: 400,
    alignItems: 'center',
  },
  welcomeTitle: {
    fontFamily: FONTS.display,
    fontSize: 24,
    color: COLORS.textPrimary,
    letterSpacing: 2,
    marginBottom: 4,
  },
  welcomeSub: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    color: COLORS.textMuted,
    letterSpacing: 1,
    marginBottom: SPACING.xxl,
  },
  card: {
    width: '100%',
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  iconBox: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  stepTitle: {
    fontFamily: FONTS.display,
    fontSize: 28,
    letterSpacing: 2,
    marginBottom: SPACING.md,
  },
  stepDesc: {
    fontFamily: FONTS.body,
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  footer: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.xxl,
  },
  dots: {
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.border,
  },
  btnNext: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.cyan,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.full,
  },
  btnNextText: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    color: COLORS.bg,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
