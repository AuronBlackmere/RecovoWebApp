import { useEffect, useRef } from 'react';
import { Stack, router, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useAppStore } from '@/store/useAppStore';
import { COLORS } from '@/utils/theme';
import {
  subscribeToAuth,
  subscribeToUserProfile,
  subscribeToWorkouts,
  subscribeToRecovery,
  subscribeToInjuries,
  subscribeToDailyStatus,
  getUserProfile,
} from '@/services/firebase';

function NavigationWrapper({ children }: { children: React.ReactNode }) {
  const { user, profile, authLoading, twoFactorVerified } = useAppStore();
  const segments = useSegments();

  useEffect(() => {
    if (authLoading) return;

    const inAuthGroup = segments[0] === 'auth';
    const inTabsGroup = segments[0] === '(tabs)';

    if (!user) {
      if (!inAuthGroup) {
        router.replace('/auth/login');
      }
    } else {
      const requires2fa = !!(profile?.twoFactorAuth && profile?.twoFactorPin && !twoFactorVerified);

      if (requires2fa) {
        if ((segments[1] as string) !== 'two-factor') {
          router.replace('/auth/two-factor' as any);
        }
      } else {
        const hasIncompleteProfile = !profile || !profile.sport || !profile.onboardingCompleted;
        if (hasIncompleteProfile) {
          if (segments[1] !== 'onboarding') {
            router.replace('/auth/onboarding');
          }
        } else {
          if (!inTabsGroup) {
            router.replace('/(tabs)');
          }
        }
      }
    }
  }, [user, profile, authLoading, twoFactorVerified, segments]);

  if (authLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0A0A0B', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={COLORS.accent} size="large" />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  const { setUser, setProfile, setAuthLoading, setWorkouts, setRecovery, setInjuries, setDailyStatuses } = useAppStore();

  // Keep refs to unsubscribe data listeners when user changes
  const dataUnsubs = useRef<Array<() => void>>([]);

  useEffect(() => {
    // Subscribe to Firebase auth state changes
    const unsubAuth = subscribeToAuth(async (firebaseUser) => {
      // Tear down previous data listeners
      dataUnsubs.current.forEach((fn) => fn());
      dataUnsubs.current = [];

      setUser(firebaseUser);

      if (!firebaseUser) {
        setProfile(null);
        setWorkouts([]);
        setRecovery([]);
        setInjuries([]);
        setDailyStatuses([]);
        setAuthLoading(false);
        return;
      }

      // Load profile once then subscribe to changes
      try {
        const profile = await getUserProfile(firebaseUser.uid);
        setProfile(profile);
      } catch {
        setProfile(null);
      }

      setAuthLoading(false);

      // Subscribe to realtime data
      const u1 = subscribeToUserProfile(firebaseUser.uid, (p) => setProfile(p));
      const u2 = subscribeToWorkouts(firebaseUser.uid, (w) => setWorkouts(w));
      const u3 = subscribeToRecovery(firebaseUser.uid, (r) => setRecovery(r));
      const u4 = subscribeToInjuries(firebaseUser.uid, (i) => setInjuries(i));
      const u5 = subscribeToDailyStatus(firebaseUser.uid, (d) => setDailyStatuses(d));

      dataUnsubs.current = [u1, u2, u3, u4, u5];
    });

    return () => {
      unsubAuth();
      dataUnsubs.current.forEach((fn) => fn());
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" backgroundColor="#0A0A0B" />
      <NavigationWrapper>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: '#0A0A0B' },
          }}
        />
      </NavigationWrapper>
    </GestureHandlerRootView>
  );
}