import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { logout } from '@/services/firebase';
import { useAppStore } from '@/store/useAppStore';
import { COLORS, FONTS, SPACING, RADIUS } from '@/utils/theme';
import Animated, {
  FadeInDown, useSharedValue, useAnimatedStyle, withTiming, withSpring,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function TwoFactorScreen() {
  const { profile, setTwoFactorVerified } = useAppStore();
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);

  const scale = useSharedValue(1);
  const buttonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handleVerify = () => {
    if (pin.length !== 4) {
      Alert.alert('Invalid Code', 'Please enter a 4-digit passcode.');
      return;
    }

    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Verify code matching the user's stored PIN
    if (pin === profile?.twoFactorPin) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTwoFactorVerified(true); // Redirection guard triggers tabs navigation automatically
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Verification Failed', 'The passcode you entered is incorrect.');
      setPin('');
    }
    setLoading(false);
  };

  const handleSignOut = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await logout();
      router.replace('/auth/login');
    } catch {
      Alert.alert('Error', 'Failed to sign out.');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <LinearGradient
        colors={['#0A0A0B', '#131316', '#0A0A0B']}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={styles.container}>
        <Animated.View
          entering={FadeInDown.duration(400).springify()}
          style={styles.card}
        >
          <View style={styles.iconCircle}>
            <Ionicons name="shield-checkmark" size={32} color={COLORS.accent} />
          </View>

          <Text style={styles.title}>Verification Required</Text>
          <Text style={styles.subtitle}>
            Enter the 4-digit security PIN set on your profile.
          </Text>

          <TextInput
            style={styles.pinInput}
            value={pin}
            onChangeText={(text) => setPin(text.replace(/[^0-9]/g, ''))}
            keyboardType="numeric"
            maxLength={4}
            secureTextEntry
            placeholder="••••"
            placeholderTextColor={COLORS.textMuted}
            autoFocus
          />

          <AnimatedPressable
            onPressIn={() => { scale.value = withTiming(0.96, { duration: 80 }); }}
            onPressOut={() => { scale.value = withSpring(1, { damping: 10, stiffness: 250 }); }}
            onPress={handleVerify}
            style={[styles.verifyBtn, buttonStyle]}
            disabled={loading}
          >
            <Text style={styles.verifyBtnText}>
              {loading ? 'VERIFYING...' : 'CONFIRM ACCESS'}
            </Text>
          </AnimatedPressable>
        </Animated.View>

        <Pressable onPress={handleSignOut} style={styles.signOutBtn}>
          <Text style={styles.signOutText}>LOG OUT</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    alignItems: 'center',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.accent + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  title: {
    fontFamily: FONTS.display,
    fontSize: 28,
    color: COLORS.textPrimary,
    letterSpacing: 1,
    marginBottom: SPACING.xs,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: SPACING.lg,
  },
  pinInput: {
    width: '100%',
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    color: COLORS.textPrimary,
    fontFamily: FONTS.mono,
    fontSize: 28,
    textAlign: 'center',
    letterSpacing: 16,
    paddingVertical: SPACING.md,
    marginBottom: SPACING.lg,
  },
  verifyBtn: {
    width: '100%',
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  verifyBtnText: {
    fontFamily: FONTS.mono,
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textInverse,
    letterSpacing: 1,
  },
  signOutBtn: {
    marginTop: SPACING.xl,
    padding: SPACING.sm,
  },
  signOutText: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    color: COLORS.textMuted,
    letterSpacing: 1.5,
  },
});
