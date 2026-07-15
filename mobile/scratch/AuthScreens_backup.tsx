import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable,
  KeyboardAvoidingView, Platform, ScrollView, Alert, Animated
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { loginWithEmail, registerWithEmail, createUserProfile, signInWithGoogle, updateUserProfile, savePainMarker } from '@/services/firebase';
import { useAppStore } from '@/store/useAppStore';
import { COLORS, FONTS, SPACING, RADIUS } from '@/utils/theme';
import { getUserProfile } from '@/services/firebase';

import Reanimated, { useAnimatedStyle, withSpring, withTiming, useSharedValue, FadeIn, FadeOut, SlideInRight, SlideOutLeft, SlideInDown } from 'react-native-reanimated';

import { GoogleSignin } from '@react-native-google-signin/google-signin';
import HumanBodySvg, { BodyRegion } from '@/components/HumanBodySvg';
import Svg, { Ellipse, Path as SvgPath, Circle, G } from 'react-native-svg';

if (Platform.OS !== 'web') {
  GoogleSignin.configure({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || 'dummy-client-id.apps.googleusercontent.com',
    // You will need to add your SHA-1 to Firebase and get the webClientId
  });
}

// ─── Login Screen ─────────────────────────────────────────────────────────────

export function LoginScreen() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [step, setStep] = useState<'auth' | '2fa'>('auth');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [code2fa, setCode2fa] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = async () => {
    if (!email || !password) {
      Alert.alert('Missing fields', 'Please enter email and password.');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'login') {
        // Here we could use multiFactor(user).getSession() for real Firebase MFA.
        // For now, if login succeeds, we ask for 2FA.
        await loginWithEmail(email.trim(), password);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setStep('2fa');
      } else {
        if (!name.trim()) { Alert.alert('Name required'); setLoading(false); return; }
        const cred = await registerWithEmail(email.trim(), password);
        await createUserProfile(cred.user.uid, {
          email: email.trim(),
          name: name.trim(),
        });
        // Route to onboarding for role selection
        router.replace('/auth/onboarding');
      }
    } catch (e: any) {
      const msg = e?.code === 'auth/invalid-credential' ? 'Invalid email or password.'
        : e?.code === 'auth/email-already-in-use' ? 'Email already in use.'
        : e?.message ?? 'Something went wrong.';
      Alert.alert('Auth Error', msg);
    }
    setLoading(false);
  };

  const handle2FAVerify = () => {
    if (code2fa.length < 6) {
      Alert.alert('Invalid Code', 'Please enter a 6-digit code.');
      return;
    }
    // Verify MFA (assuming SMS or TOTP backend validation here)
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace('/(tabs)');
  };

  const handleGoogleSignIn = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Not Supported', 'Google Sign-In is not supported on the web version.');
      return;
    }
    try {
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      if (userInfo.data && userInfo.data.idToken) {
        await signInWithGoogle(userInfo.data.idToken);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else if ((userInfo as any).idToken) {
        // Fallback for older versions of the library
        await signInWithGoogle((userInfo as any).idToken);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error: any) {
      Alert.alert('Google Sign-In Error', error.message || 'Something went wrong.');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <LinearGradient
        colors={['#0a0a0f', '#111118', '#0a0a0f']}
        style={styles.gradient}
      />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Logo */}
        <View style={styles.logoSection}>
          <View style={styles.logoMark}>
            <Text style={styles.logoR}>R</Text>
          </View>
          <Text style={styles.logoName}>RECOVO</Text>
          <Text style={styles.logoTagline}>ELITE ATHLETE PERFORMANCE</Text>
        </View>

        {/* Mode Toggle */}
        <View style={styles.modeToggle}>
          {(['login', 'register'] as const).map((m) => (
            <Pressable
              key={m}
              style={[styles.modeBtn, mode === m && styles.modeBtnActive]}
              onPress={() => setMode(m)}
            >
              <Text style={[styles.modeBtnText, mode === m && { color: COLORS.textInverse }]}>
                {m === 'login' ? 'SIGN IN' : 'REGISTER'}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Form */}
        <View style={styles.form}>
          {step === '2fa' ? (
            <>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>TWO-FACTOR AUTHENTICATION</Text>
                <TextInput
                  style={styles.input}
                  value={code2fa}
                  onChangeText={setCode2fa}
                  placeholder="Enter 6-digit code"
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType="number-pad"
                  maxLength={6}
                />
              </View>
              <Pressable
                style={[styles.submitBtn, loading && { opacity: 0.5 }]}
                onPress={handle2FAVerify}
                disabled={loading}
              >
                <Text style={styles.submitBtnText}>VERIFY</Text>
              </Pressable>
            </>
          ) : (
            <>
              {mode === 'register' && (
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>DISPLAY NAME</Text>
                  <TextInput
                    style={styles.input}
                    value={name}
                    onChangeText={setName}
                    placeholder="Your name"
                    placeholderTextColor={COLORS.textMuted}
                    autoCapitalize="words"
                  />
                </View>
              )}

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>EMAIL</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="athlete@recovo.app"
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>PASSWORD</Text>
                <View style={styles.passRow}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="••••••••"
                    placeholderTextColor={COLORS.textMuted}
                    secureTextEntry={!showPass}
                  />
                  <Pressable onPress={() => setShowPass(!showPass)} style={styles.eyeBtn}>
                    <Ionicons name={showPass ? 'eye-off' : 'eye'} size={18} color={COLORS.textMuted} />
                  </Pressable>
                </View>
              </View>

              <Pressable
                style={[styles.submitBtn, loading && { opacity: 0.5 }]}
                onPress={handleSubmit}
                disabled={loading}
              >
                <Text style={styles.submitBtnText}>
                  {loading ? 'PLEASE WAIT...' : mode === 'login' ? 'ENTER RECOVO' : 'CREATE ACCOUNT'}
                </Text>
              </Pressable>

              <Pressable
                style={[styles.submitBtn, { backgroundColor: '#ffffff', marginTop: SPACING.sm }]}
                onPress={handleGoogleSignIn}
                disabled={loading}
              >
                <Ionicons name="logo-google" size={18} color="#000" />
                <Text style={[styles.submitBtnText, { color: '#000' }]}>
                  SIGN IN WITH GOOGLE
                </Text>
              </Pressable>
            </>
          )}
        </View>

        <Text style={styles.footerText}>
          Built by Recovo
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Onboarding Components ───────────────────────────────────────────────────

// ─── Reusable Animated Components ──────────────────────────────────────────

const SPRING_CONFIG = { damping: 14, stiffness: 150 };

function AnimatedPressable({ onPress, disabled, style, children, activeScale = 0.96 }: any) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => {
        if (!disabled) scale.value = withSpring(activeScale, SPRING_CONFIG);
      }}
      onPressOut={() => {
        if (!disabled) scale.value = withSpring(1, SPRING_CONFIG);
      }}
    >
      <Reanimated.View style={[style, animatedStyle]}>
        {children}
      </Reanimated.View>
    </Pressable>
  );
}

const THEMES = {
  dark: {
    bg: '#0A0A0A',
    surface: '#161616',
    surfaceAlt: '#1F1F1F',
    border: '#2A2A2A',
    text: '#F5F5F0',
    textDim: '#8C8C86',
    orange: (COLORS as any).orange || '#FF5A1F',
  },
  light: {
    bg: '#FDFDFB',
    surface: '#FFFFFF',
    surfaceAlt: '#F4F2ED',
    border: '#E7E4DC',
    text: '#161513',
    textDim: '#6B6862',
    orange: (COLORS as any).orange || '#FF5A1F',
  }
};

const BODY_PARTS = [
  { id: 'left-shoulder', label: 'Left Shoulder' },
  { id: 'right-shoulder', label: 'Right Shoulder' },
  { id: 'left-chest', label: 'Left Chest' },
  { id: 'right-chest', label: 'Right Chest' },
  { id: 'core', label: 'Core / Abs' },
  { id: 'left-hip', label: 'Left Hip' },
  { id: 'right-hip', label: 'Right Hip' },
  { id: 'left-quad', label: 'Left Quad' },
  { id: 'right-quad', label: 'Right Quad' },
  { id: 'left-knee', label: 'Left Knee' },
  { id: 'right-knee', label: 'Right Knee' },
  { id: 'left-shin', label: 'Left Shin' },
  { id: 'right-shin', label: 'Right Shin' },
  { id: 'left-foot', label: 'Left Foot' },
  { id: 'right-foot', label: 'Right Foot' },
  { id: 'neck', label: 'Neck' },
  { id: 'head', label: 'Head' },
];

function ProgressBar({ step, total, theme }: any) {
  return (
    <View style={{ flexDirection: 'row', gap: 4, width: '100%' }}>
      {Array.from({ length: total }).map((_, i) => (
        <Reanimated.View
          key={i}
          
          style={{
            flex: 1,
            height: 4,
            borderRadius: 2,
            backgroundColor: i <= step ? theme.orange : theme.border,
            opacity: i <= step ? 1 : 0.4,
          }}
        />
      ))}
    </View>
  );
}

function TopBar({ theme, step, total, onBack, onToggleTheme, isDark }: any) {
  return (
    <Reanimated.View entering={SlideInDown.duration(400)} style={{ paddingHorizontal: 20, paddingTop: 60, paddingBottom: 10, gap: 14, backgroundColor: theme.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <AnimatedPressable onPress={onBack} style={{ padding: 6, opacity: step === 0 ? 0 : 1 }}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </AnimatedPressable>
        <AnimatedPressable
          onPress={onToggleTheme}
          style={{
            backgroundColor: theme.surfaceAlt,
            borderWidth: 1,
            borderColor: theme.border,
            borderRadius: 20,
            paddingVertical: 6,
            paddingHorizontal: 10,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Ionicons name={isDark ? 'moon' : 'sunny'} size={14} color={theme.textDim} />
          <Text style={{ color: theme.textDim, fontSize: 12, fontFamily: FONTS.mono }}>{isDark ? 'Dark' : 'Light'}</Text>
        </AnimatedPressable>
      </View>
      <ProgressBar step={step} total={total} theme={theme} />
    </Reanimated.View>
  );
}

function ContinueBtn({ theme, onClick, disabled, label = 'Continue' }: any) {
  return (
    <AnimatedPressable
      onPress={onClick}
      disabled={disabled}
      style={{
        width: '100%',
        paddingVertical: 18,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: disabled ? theme.border : theme.orange,
        shadowColor: theme.orange,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: disabled ? 0 : 0.3,
        shadowRadius: 8,
        elevation: disabled ? 0 : 4,
      }}
    >
      <Text style={{ fontSize: 16, fontWeight: '800', color: disabled ? theme.textDim : '#0A0A0A', letterSpacing: 0.5 }}>
        {label.toUpperCase()}
      </Text>
    </AnimatedPressable>
  );
}

function OptionCard({ theme, label, sub, selected, onClick }: any) {
  return (
    <AnimatedPressable
      onPress={onClick}
      style={{
        width: '100%',
        padding: 18,
        borderRadius: 16,
        borderWidth: 2,
        borderColor: selected ? theme.orange : theme.border,
        backgroundColor: selected ? theme.orange + '14' : theme.surface,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
      }}
    >
      <View style={{ flex: 1, paddingRight: 10 }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: theme.text, marginBottom: sub ? 4 : 0 }}>{label}</Text>
        {sub && <Text style={{ fontSize: 14, color: theme.textDim, lineHeight: 20 }}>{sub}</Text>}
      </View>
      <Reanimated.View
        style={{
          width: 24,
          height: 24,
          borderRadius: 12,
          borderWidth: 2,
          borderColor: selected ? theme.orange : theme.border,
          backgroundColor: selected ? theme.orange : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {selected && <Ionicons name="checkmark" size={16} color="#0A0A0A" />}
      </Reanimated.View>
    </AnimatedPressable>
  );
}

function Title({ theme, eyebrow, children }: any) {
  return (
    <Reanimated.View entering={SlideInRight.springify().damping(16)} style={{ marginBottom: 24 }}>
      {eyebrow && (
        <Text style={{ color: theme.orange, fontSize: 13, fontWeight: '800', letterSpacing: 1, marginBottom: 10, textTransform: 'uppercase' }}>
          {eyebrow}
        </Text>
      )}
      <Text style={{ fontSize: 32, fontWeight: '900', color: theme.text, lineHeight: 40, letterSpacing: -0.5 }}>{children}</Text>
    </Reanimated.View>
  );
}

function RowData({ theme, label, value, valueColor }: any) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 }}>
      <Text style={{ fontSize: 15, color: theme.textDim, fontWeight: '500' }}>{label}</Text>
      <Text style={{ fontSize: 16, fontWeight: '800', color: valueColor || theme.text }}>{value}</Text>
    </View>
  );
}

// ─── Onboarding Screen ────────────────────────────────────────────────────────

export function OnboardingScreen() {
  const { user, profile, setProfile } = useAppStore();
  const [isDark, setIsDark] = useState(true);
  const theme = isDark ? THEMES.dark : THEMES.light;
  
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<any>({
    role: null,
    goal: null,
    sport: null,
    frequency: null,
    injuryStatus: null,
    bodyParts: [],
    duration: null,
    trainingGoals: [],
    age: null,
    gender: null,
    recoveryRoutine: null,
    sleepHabits: null,
  });

  const [loading, setLoading] = useState(false);

  const setAnswer = (key: string, val: any) => {
    Haptics.selectionAsync();
    setAnswers((a: any) => ({ ...a, [key]: val }));
  };
  
  const toggleMulti = (key: string, val: any) => {
    Haptics.selectionAsync();
    setAnswers((a: any) => ({
      ...a,
      [key]: a[key].includes(val) ? a[key].filter((v: any) => v !== val) : [...a[key], val],
    }));
  };

  const skipBodyMap = answers.injuryStatus === "No, never" || answers.injuryStatus === "Fortunately, I'm completely pain-free right now.";

  const flow = [
    "welcome",
    "role",
    "goal",
    "sport",
    "frequency",
    "reveal1",
    "injury",
    ...(skipBodyMap ? [] : ["bodymap", "duration"]),
    "traininggoals",
    "recoveryroutine",
    "sleephabits",
    "reveal2",
    "age",
    "gender",
    "permission",
    "final",
  ];

  const total = flow.length;
  const current = flow[step];
  
  const next = () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setStep((s) => Math.min(s + 1, total - 1)); };
  const back = () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setStep((s) => Math.max(s - 1, 0)); };

  const handleFinish = async () => {
    setLoading(true);
    if (user) {
      // Ensure we don't overwrite name if profile isn't fully loaded
      let existingProfile = profile;
      if (!existingProfile) {
        existingProfile = await getUserProfile(user.uid) as any;
      }

      const updatedProfile = {
        ...existingProfile,
        uid: user.uid,
        email: existingProfile?.email || user.email || '',
        name: existingProfile?.name || user.displayName || 'Athlete',
        role: answers.role || existingProfile?.role || 'athlete',
        sport: answers.sport || 'Other',
        weight: 70, // Default weight
        onboardingCompleted: true,
        hasSeenTutorial: false,
        onboardingDetails: answers,
      };

      setProfile(updatedProfile as any);

      try {
        if (!existingProfile) {
          await createUserProfile(user.uid, updatedProfile);
        } else {
          await updateUserProfile(user.uid, updatedProfile);
        }

        if (answers.bodyParts.length > 0) {
          const painPromises = answers.bodyParts.map((regionId: string) => 
            savePainMarker(user.uid, {
              bodyPart: regionId,
              intensity: 7,
              timestamp: Date.now(),
              side: 'center',
              x: 50,
              y: 50,
              painType: 'aching',
              resolved: false,
            } as any)
          );
          await Promise.all(painPromises);
        }
      } catch (e) {
        console.error('Failed to save onboarding data', e);
      }
    }
    router.replace('/(tabs)');
    setLoading(false);
  };

  const SPORTS = ["Soccer", "Basketball", "Running", "Weightlifting", "Volleyball", "Tennis", "Cycling", "Other"];

  // Helper to wrap steps in animated view
  const AnimatedStep = ({ children, isCurrent }: any) => {
    if (!isCurrent) return null;
    return (
      <Reanimated.View 
        entering={SlideInRight.springify().damping(18).stiffness(150)} 
        exiting={SlideOutLeft.duration(200)}
        style={{ flex: 1 }}
      >
        {children}
      </Reanimated.View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      {current !== 'welcome' && (
        <TopBar
          theme={theme}
          step={step}
          total={total}
          onBack={back}
          onToggleTheme={() => setIsDark((d) => !d)}
          isDark={isDark}
        />
      )}

      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 40, flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        {/* WELCOME */}
        <AnimatedStep isCurrent={current === 'welcome'}>
          <View style={{ flex: 1, justifyContent: 'space-between' }}>
            <View style={{ alignItems: 'flex-end', paddingTop: 40 }}>
              <AnimatedPressable
                onPress={() => setIsDark(!isDark)}
                style={{
                  backgroundColor: theme.surfaceAlt, borderWidth: 1, borderColor: theme.border,
                  borderRadius: 20, paddingVertical: 6, paddingHorizontal: 10,
                }}
              >
                <Ionicons name={isDark ? 'moon' : 'sunny'} size={14} color={theme.textDim} />
              </AnimatedPressable>
            </View>
            <View style={{ gap: 20, marginTop: 40 }}>
              <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: theme.orange, alignItems: 'center', justifyContent: 'center', shadowColor: theme.orange, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10 }}>
                <Ionicons name="flame" size={34} color="#0A0A0A" />
              </View>
              <Text style={{ fontSize: 44, fontWeight: '900', color: theme.text, lineHeight: 52, letterSpacing: -1 }}>
                Let's build your <Text style={{ color: theme.orange }}>ultimate recovery plan.</Text>
              </Text>
              <Text style={{ fontSize: 18, color: theme.textDim, lineHeight: 28, fontWeight: '500' }}>
                This will only take about 60 seconds. Answer honestly — your responses will completely shape how Recovo analyzes your data and guides your recovery.
              </Text>
            </View>
            <View style={{ marginTop: 60 }}>
              <ContinueBtn theme={theme} onClick={next} label="Let's get started" />
            </View>
          </View>
        </AnimatedStep>

        {/* ROLE */}
        <AnimatedStep isCurrent={current === 'role'}>
          <View style={{ flex: 1 }}>
            <Title theme={theme} eyebrow="Step 1">How will you be using Recovo?</Title>
            <Text style={{ fontSize: 16, color: theme.textDim, marginBottom: 24, lineHeight: 24 }}>
              Are you an athlete looking to manage your own recovery, or a coach managing a roster of athletes?
            </Text>
            {[
              ['Athlete', 'I want to track and optimize my own recovery and performance.'],
              ['Coach', 'I want to monitor my team, analyze their data, and assign recovery protocols.']
            ].map(([label, sub]) => (
              <OptionCard key={label} theme={theme} label={label} sub={sub} selected={answers.role === label.toLowerCase()} onClick={() => setAnswer('role', label.toLowerCase())} />
            ))}
            <View style={{ flex: 1, minHeight: 20 }} />
            <ContinueBtn theme={theme} onClick={next} disabled={!answers.role} />
          </View>
        </AnimatedStep>

        {/* GOAL */}
        <AnimatedStep isCurrent={current === 'goal'}>
          <View style={{ flex: 1 }}>
            <Title theme={theme} eyebrow="Step 2">What is your primary objective with us?</Title>
            <Text style={{ fontSize: 16, color: theme.textDim, marginBottom: 24, lineHeight: 24 }}>
              Understanding your core motivation helps us determine whether we should prioritize deep rehabilitation or peak performance optimization.
            </Text>
            {[
              ['Recovering from an active injury', 'I have a specific issue I am currently trying to heal from.'],
              ['Preventing future injuries', 'I want to stay ahead of the curve and bulletproof my body.'],
              ['Maximizing performance', 'I want to use data to push my physical limits safely.'],
              ['Just exploring the platform', 'I am just curious to see what insights Recovo can offer.']
            ].map(([label, sub]) => (
              <OptionCard key={label} theme={theme} label={label} sub={sub} selected={answers.goal === label} onClick={() => setAnswer('goal', label)} />
            ))}
            <View style={{ flex: 1, minHeight: 20 }} />
            <ContinueBtn theme={theme} onClick={next} disabled={!answers.goal} />
          </View>
        </AnimatedStep>

        {/* SPORT */}
        <AnimatedStep isCurrent={current === 'sport'}>
          <View style={{ flex: 1 }}>
            <Title theme={theme} eyebrow="Step 3">Which sport do you spend the most time on?</Title>
            <Text style={{ fontSize: 16, color: theme.textDim, marginBottom: 24, lineHeight: 24 }}>
              Different sports put stress on completely different biomechanical chains. We use this to predict typical fatigue patterns.
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              {SPORTS.map((s) => (
                <AnimatedPressable
                  key={s}
                  onPress={() => setAnswer('sport', s)}
                  style={{
                    width: '47%', paddingVertical: 20, borderRadius: 16,
                    borderWidth: 2, borderColor: answers.sport === s ? theme.orange : theme.border,
                    backgroundColor: answers.sport === s ? theme.orange + '14' : theme.surface,
                    alignItems: 'center'
                  }}
                >
                  <Text style={{ color: theme.text, fontWeight: '800', fontSize: 16 }}>{s}</Text>
                </AnimatedPressable>
              ))}
            </View>
            <View style={{ flex: 1, minHeight: 20 }} />
            <ContinueBtn theme={theme} onClick={next} disabled={!answers.sport} />
          </View>
        </AnimatedStep>

        {/* FREQUENCY */}
        <AnimatedStep isCurrent={current === 'frequency'}>
          <View style={{ flex: 1 }}>
            <Title theme={theme} eyebrow="Step 4">How frequently are you training?</Title>
            <Text style={{ fontSize: 16, color: theme.textDim, marginBottom: 24, lineHeight: 24 }}>
              This includes practices, gym sessions, and active games. This helps us calculate your baseline acute-to-chronic workload ratio.
            </Text>
            {[
              ['Light: 1–2 times per week', 'I train casually.'],
              ['Moderate: 3–4 times per week', 'I am pretty consistent with my routine.'],
              ['High: 5+ times per week', 'I train almost every single day.'],
              ['Elite: Multiple times daily', 'I am a professional or highly competitive athlete.']
            ].map(([label, sub]) => (
              <OptionCard key={label} theme={theme} label={label} sub={sub} selected={answers.frequency === label} onClick={() => setAnswer('frequency', label)} />
            ))}
            <View style={{ flex: 1, minHeight: 20 }} />
            <ContinueBtn theme={theme} onClick={next} disabled={!answers.frequency} />
          </View>
        </AnimatedStep>

        {/* REVEAL 1 */}
        <AnimatedStep isCurrent={current === 'reveal1'}>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 }}>
            <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: theme.orange + '20', alignItems: 'center', justifyContent: 'center', marginBottom: 32 }}>
              <Ionicons name="analytics" size={40} color={theme.orange} />
            </View>
            <Text style={{ fontSize: 28, fontWeight: '900', color: theme.text, textAlign: 'center', lineHeight: 38, marginBottom: 20 }}>
              Athletes maintaining a <Text style={{ color: theme.orange }}>{answers.frequency?.split(':')[0].toLowerCase() || 'high'}</Text> training load without structured recovery are <Text style={{ textDecorationLine: 'underline' }}>2.4x more likely</Text> to face a season-ending injury.
            </Text>
            <Text style={{ fontSize: 18, color: theme.textDim, textAlign: 'center', lineHeight: 28 }}>
              Let's pinpoint exactly where your body might be holding tension right now.
            </Text>
            <View style={{ flex: 1, minHeight: 40 }} />
            <ContinueBtn theme={theme} onClick={next} label="Analyze my body" />
          </View>
        </AnimatedStep>

        {/* INJURY */}
        <AnimatedStep isCurrent={current === 'injury'}>
          <View style={{ flex: 1 }}>
            <Title theme={theme} eyebrow="Step 5">Are you currently experiencing any physical discomfort?</Title>
            <Text style={{ fontSize: 16, color: theme.textDim, marginBottom: 24, lineHeight: 24 }}>
              Be honest. Ignoring minor tweaks is the easiest way to develop a major mechanical failure later in your season.
            </Text>
            {[
              ['Yes, I am actively injured or in pain', 'It is currently affecting my ability to perform.'],
              ['Yes, but I am in the recovery phase', 'I am rehabbing an issue, but it is improving.'],
              ['No, but I have a history of injuries', 'I am currently fine, but my past haunts me.'],
              ['Fortunately, I\'m completely pain-free right now.', 'My body feels 100% healthy.']
            ].map(([label, sub]) => (
              <OptionCard key={label} theme={theme} label={label} sub={sub} selected={answers.injuryStatus === label} onClick={() => setAnswer('injuryStatus', label)} />
            ))}
            <View style={{ flex: 1, minHeight: 20 }} />
            <ContinueBtn theme={theme} onClick={next} disabled={!answers.injuryStatus} />
          </View>
        </AnimatedStep>

        {/* BODY MAP */}
        <AnimatedStep isCurrent={current === 'bodymap'}>
          <View style={{ flex: 1 }}>
            <Title theme={theme} eyebrow="Step 6">Identify the specific problem areas</Title>
            <Text style={{ fontSize: 15, color: theme.textDim, marginBottom: 12, lineHeight: 22 }}>
              Tap directly on the anatomical model to highlight regions where you feel stiffness, soreness, or sharp pain.
            </Text>
            <View style={{ alignItems: 'center', marginVertical: 10, backgroundColor: theme.surfaceAlt, borderRadius: 24, padding: 20, borderWidth: 1, borderColor: theme.border }}>
              <HumanBodySvg 
                onRegionTap={(region: any) => toggleMulti('bodyParts', region.id)}
                activeRegionIds={new Set(answers.bodyParts)}
                getMarkerColor={() => theme.orange}
              />
            </View>
            <Text style={{ fontSize: 14, fontWeight: '700', color: theme.text, textAlign: 'center', marginBottom: 20 }}>
              {answers.bodyParts.length
                ? BODY_PARTS.filter(p => answers.bodyParts.includes(p.id)).map(p => p.label).join(' · ')
                : 'Select one or more highlighted muscle groups'}
            </Text>
            <View style={{ flex: 1 }} />
            <ContinueBtn theme={theme} onClick={next} disabled={answers.bodyParts.length === 0} />
          </View>
        </AnimatedStep>

        {/* DURATION */}
        <AnimatedStep isCurrent={current === 'duration'}>
          <View style={{ flex: 1 }}>
            <Title theme={theme} eyebrow="Step 7">How long have you been dealing with this issue?</Title>
            <Text style={{ fontSize: 16, color: theme.textDim, marginBottom: 24, lineHeight: 24 }}>
              The duration of the pain completely changes our approach—acute injuries need rest, while chronic pain often requires mobility work.
            </Text>
            {[
              ['Very recently (Just a few days)', 'It started after a recent session or game.'],
              ['A moderate while (A few weeks)', 'It has been lingering for a bit.'],
              ['Chronically (Several months)', 'I have been dealing with it for a whole season.'],
              ['Long-term (Recurring for years)', 'It goes away and always comes back.']
            ].map(([label, sub]) => (
              <OptionCard key={label} theme={theme} label={label} sub={sub} selected={answers.duration === label} onClick={() => setAnswer('duration', label)} />
            ))}
            <View style={{ flex: 1, minHeight: 20 }} />
            <ContinueBtn theme={theme} onClick={next} disabled={!answers.duration} />
          </View>
        </AnimatedStep>

        {/* TRAINING GOALS */}
        <AnimatedStep isCurrent={current === 'traininggoals'}>
          <View style={{ flex: 1 }}>
            <Title theme={theme} eyebrow="Step 8">What is your ultimate training philosophy?</Title>
            <Text style={{ fontSize: 16, color: theme.textDim, marginBottom: 24, lineHeight: 24 }}>
              We need to know what drives you. You can select multiple priorities here.
            </Text>
            {[
              ['Staying completely injury-free', 'Longevity is my absolute priority.'],
              ['Returning to play as fast as possible', 'I need to get back on the field right now.'],
              ['Building long-term robust durability', 'I want my body to handle anything.'],
              ['Performing better under extreme fatigue', 'I want to push my limits without breaking.']
            ].map(([label, sub]) => (
              <OptionCard key={label} theme={theme} label={label} sub={sub} selected={answers.trainingGoals.includes(label)} onClick={() => toggleMulti('trainingGoals', label)} />
            ))}
            <View style={{ flex: 1, minHeight: 20 }} />
            <ContinueBtn theme={theme} onClick={next} disabled={answers.trainingGoals.length === 0} />
          </View>
        </AnimatedStep>

        {/* RECOVERY ROUTINE */}
        <AnimatedStep isCurrent={current === 'recoveryroutine'}>
          <View style={{ flex: 1 }}>
            <Title theme={theme} eyebrow="Step 9">What does your current recovery protocol look like?</Title>
            <Text style={{ fontSize: 16, color: theme.textDim, marginBottom: 24, lineHeight: 24 }}>
              Most athletes train hard, but very few recover hard. What are you actively doing to help your body adapt to the stress?
            </Text>
            {[
              ['Cold therapy & Contrast baths', 'I regularly use ice baths or cold plunges.'],
              ['Mobility, Stretching & Yoga', 'I dedicate time to active flexibility.'],
              ['Tissue work (Massage / Foam rolling)', 'I focus on myofascial release regularly.'],
              ['Honestly, nothing structured at all', 'I just rest and hope for the best.']
            ].map(([label, sub]) => (
              <OptionCard key={label} theme={theme} label={label} sub={sub} selected={answers.recoveryRoutine === label} onClick={() => setAnswer('recoveryRoutine', label)} />
            ))}
            <View style={{ flex: 1, minHeight: 20 }} />
            <ContinueBtn theme={theme} onClick={next} disabled={!answers.recoveryRoutine} />
          </View>
        </AnimatedStep>

        {/* SLEEP HABITS */}
        <AnimatedStep isCurrent={current === 'sleephabits'}>
          <View style={{ flex: 1 }}>
            <Title theme={theme} eyebrow="Step 10">How many hours of high-quality sleep do you get?</Title>
            <Text style={{ fontSize: 16, color: theme.textDim, marginBottom: 24, lineHeight: 24 }}>
              Sleep is the ultimate performance-enhancing drug. If this isn't dialed in, everything else is just a band-aid.
            </Text>
            {[
              ['Severely deprived (Less than 6 hours)', 'I am constantly running on fumes.'],
              ['Bare minimum (6-7 hours)', 'I get by, but I could definitely use more.'],
              ['Optimal (7-8 hours)', 'I am well-rested most of the time.'],
              ['Elite recovery (8+ hours)', 'I prioritize sleep above everything else.']
            ].map(([label, sub]) => (
              <OptionCard key={label} theme={theme} label={label} sub={sub} selected={answers.sleepHabits === label} onClick={() => setAnswer('sleepHabits', label)} />
            ))}
            <View style={{ flex: 1, minHeight: 20 }} />
            <ContinueBtn theme={theme} onClick={next} disabled={!answers.sleepHabits} />
          </View>
        </AnimatedStep>

        {/* REVEAL 2 */}
        <AnimatedStep isCurrent={current === 'reveal2'}>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 }}>
            <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: theme.orange + '20', alignItems: 'center', justifyContent: 'center', marginBottom: 32 }}>
              <Ionicons name="cog" size={40} color={theme.orange} />
            </View>
            <Text style={{ fontSize: 28, fontWeight: '900', color: theme.text, textAlign: 'center', lineHeight: 38, marginBottom: 20 }}>
              We are compiling a protocol specifically centered around <Text style={{ color: theme.orange }}>
                {answers.bodyParts.length ? BODY_PARTS.find((p) => p.id === answers.bodyParts[0])?.label?.toLowerCase() : 'your specific goals'}
              </Text>.
            </Text>
            <Text style={{ fontSize: 18, color: theme.textDim, textAlign: 'center', lineHeight: 28 }}>
              We just need a couple more biometric details to ensure the data models are perfectly calibrated to you.
            </Text>
            <View style={{ flex: 1, minHeight: 40 }} />
            <ContinueBtn theme={theme} onClick={next} label="Final step" />
          </View>
        </AnimatedStep>

        {/* AGE */}
        <AnimatedStep isCurrent={current === 'age'}>
          <View style={{ flex: 1 }}>
            <Title theme={theme} eyebrow="Step 11">What is your current age bracket?</Title>
            <Text style={{ fontSize: 16, color: theme.textDim, marginBottom: 24, lineHeight: 24 }}>
              Tissue elasticity and recovery timelines change drastically as we age. We use this to adjust our workload recommendations.
            </Text>
            {[
              ['Youth (Under 14)', 'Still growing and developing.'],
              ['Teen (14–17)', 'High school level athletics.'],
              ['Prime (18–24)', 'Collegiate or early professional.'],
              ['Veteran (25+)', 'Maintaining peak performance over time.']
            ].map(([label, sub]) => (
              <OptionCard key={label} theme={theme} label={label} sub={sub} selected={answers.age === label} onClick={() => setAnswer('age', label)} />
            ))}
            <View style={{ flex: 1, minHeight: 20 }} />
            <ContinueBtn theme={theme} onClick={next} disabled={!answers.age} />
          </View>
        </AnimatedStep>

        {/* GENDER */}
        <AnimatedStep isCurrent={current === 'gender'}>
          <View style={{ flex: 1 }}>
            <Title theme={theme} eyebrow="Step 12">How do you identify?</Title>
            <Text style={{ fontSize: 16, color: theme.textDim, marginBottom: 24, lineHeight: 24 }}>
              This is completely optional, but biomechanics and injury risk profiles can vary significantly between physiological sexes.
            </Text>
            {[
              ['Male', ''],
              ['Female', ''],
              ['Prefer not to say', '']
            ].map(([label, sub]) => (
              <OptionCard key={label} theme={theme} label={label} sub={sub} selected={answers.gender === label} onClick={() => setAnswer('gender', label)} />
            ))}
            <View style={{ flex: 1, minHeight: 20 }} />
            <ContinueBtn theme={theme} onClick={next} label={answers.gender ? 'Continue' : 'Skip this question'} />
          </View>
        </AnimatedStep>

        {/* PERMISSION */}
        <AnimatedStep isCurrent={current === 'permission'}>
          <View style={{ flex: 1, justifyContent: 'center', paddingVertical: 20 }}>
            <View style={{ alignItems: 'center', marginBottom: 40 }}>
              <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: theme.orange + '20', alignItems: 'center', justifyContent: 'center', marginBottom: 32 }}>
                <Ionicons name="notifications" size={40} color={theme.orange} />
              </View>
              <Text style={{ fontSize: 32, fontWeight: '900', color: theme.text, textAlign: 'center', marginBottom: 20, lineHeight: 38 }}>
                Catch injuries before they happen.
              </Text>
              <Text style={{ fontSize: 18, color: theme.textDim, textAlign: 'center', lineHeight: 28 }}>
                Recovo checks in with you before and after training. We use notifications to ensure minor stiffness doesn't evolve into a major tear.
              </Text>
            </View>
            <View style={{ flex: 1, minHeight: 20 }} />
            <View style={{ gap: 16 }}>
              <ContinueBtn theme={theme} onClick={next} label="Allow push notifications" />
              <AnimatedPressable onPress={next} style={{ padding: 16, alignItems: 'center' }}>
                <Text style={{ color: theme.textDim, fontSize: 16, fontWeight: '600' }}>Maybe later</Text>
              </AnimatedPressable>
            </View>
          </View>
        </AnimatedStep>

        {/* FINAL */}
        <AnimatedStep isCurrent={current === 'final'}>
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <View style={{ alignItems: 'center', marginBottom: 32 }}>
              <Ionicons name="checkmark-circle" size={64} color={theme.orange} style={{ marginBottom: 16 }} />
              <Text style={{ fontSize: 32, fontWeight: '900', color: theme.text, textAlign: 'center', lineHeight: 38 }}>
                Your Recovo protocol is fully generated.
              </Text>
            </View>
            <View style={{ backgroundColor: theme.surface, borderWidth: 2, borderColor: theme.border, borderRadius: 24, padding: 24, gap: 16 }}>
              <RowData theme={theme} label="Primary Role" value={answers.role?.toUpperCase() || 'ATHLETE'} />
              <RowData theme={theme} label="Primary Sport" value={answers.sport || "—"} />
              <RowData theme={theme} label="Weekly Load" value={answers.frequency?.split(':')[0] || "—"} />
              <RowData
                theme={theme}
                label="Calculated Risk"
                value={answers.injuryStatus?.startsWith("Yes") ? "ELEVATED" : "MODERATE"}
                valueColor={theme.orange}
              />
              <RowData theme={theme} label="Core Focus" value={answers.goal?.includes("injury") && !answers.goal?.includes("Prevent") ? "REHABILITATION" : "OPTIMIZATION"} />
            </View>
            <View style={{ flex: 1, minHeight: 40 }} />
            <ContinueBtn theme={theme} onClick={handleFinish} disabled={loading} label={loading ? "PREPARING DASHBOARD..." : "Enter Recovo Workspace"} />
          </View>
        </AnimatedStep>
      </ScrollView>
    </View>
  );
}




const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#0A0A0A' },
  screen: { flex: 1 },
  gradient: { flex: 1 },
  content: { flexGrow: 1, paddingBottom: 40 },
  container: { flexGrow: 1 },
  header: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, paddingBottom: 40 },
  
  logoSection: { alignItems: 'center', marginTop: 80, marginBottom: 40 },
  logoMark: { width: 64, height: 64, borderRadius: 20, backgroundColor: '#FF5A1F', alignItems: 'center', justifyContent: 'center', marginBottom: 20, shadowColor: '#FF5A1F', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16 },
  logoR: { fontFamily: FONTS.display, fontSize: 32, color: '#0A0A0A' },
  logoName: { fontFamily: FONTS.display, fontSize: 40, color: COLORS.textPrimary, letterSpacing: 8, lineHeight: 44 },
  logoTagline: { fontFamily: FONTS.mono, fontSize: 13, color: COLORS.textMuted, marginTop: 10, letterSpacing: 2, textTransform: 'uppercase' },

  modeToggle: { flexDirection: 'row', alignSelf: 'center', backgroundColor: COLORS.surface, borderRadius: RADIUS.full, padding: 4, marginBottom: 40, borderWidth: 1, borderColor: COLORS.border },
  modeBtn: { paddingVertical: 8, paddingHorizontal: 24, borderRadius: RADIUS.full },
  modeBtnActive: { backgroundColor: '#FF5A1F' },
  modeBtnText: { fontFamily: FONTS.mono, fontSize: 13, color: COLORS.textMuted, fontWeight: '600' },
  
  logoBox: { width: 80, height: 80, borderRadius: 24, backgroundColor: '#FF5A1F', alignItems: 'center', justifyContent: 'center', shadowColor: '#FF5A1F', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16, marginBottom: 24 },
  
  form: { paddingHorizontal: SPACING.xl, gap: SPACING.lg },
  inputWrap: { gap: SPACING.xs },
  inputGroup: { gap: SPACING.xs },
  inputLabel: { fontSize: 13, fontFamily: FONTS.mono, color: COLORS.textMuted, letterSpacing: 1 },
  input: { height: 56, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: SPACING.lg, color: COLORS.textPrimary, fontSize: 16, backgroundColor: COLORS.surface },
  passWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, backgroundColor: COLORS.surface },
  passRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, backgroundColor: COLORS.surface },
  passInput: { flex: 1, height: 56, paddingHorizontal: SPACING.lg, color: COLORS.textPrimary, fontSize: 16 },
  eyeBtn: { padding: SPACING.md },
  
  btn: { height: 56, backgroundColor: '#FF5A1F', borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center', marginTop: SPACING.md, shadowColor: '#FF5A1F', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  btnText: { fontFamily: FONTS.body, fontWeight: '600', fontSize: 16, color: '#0A0A0A', letterSpacing: 1 },
  
  submitBtn: { height: 56, backgroundColor: '#FF5A1F', borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center', marginTop: SPACING.md, shadowColor: '#FF5A1F', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  submitBtnText: { fontFamily: FONTS.body, fontWeight: '600', fontSize: 16, color: '#0A0A0A', letterSpacing: 1 },
  
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: SPACING.md },
  line: { flex: 1, height: 1, backgroundColor: COLORS.border },
  or: { color: COLORS.textMuted, paddingHorizontal: SPACING.md, fontSize: 14 },
  
  googleBtn: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderRadius: RADIUS.md, gap: SPACING.sm },
  googleText: { fontFamily: FONTS.body, fontWeight: '600', fontSize: 16, color: '#000000' },
  
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: SPACING.xl, paddingBottom: 40 },
  footerText: { color: COLORS.textMuted, fontSize: 15 },
  footerLink: { color: '#FF5A1F', fontFamily: FONTS.body, fontWeight: '700', fontSize: 15, padding: SPACING.xs },
});
