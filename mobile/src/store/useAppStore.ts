import { create } from 'zustand';
import type { UserProfile, RecoveryEntry, PainMarker, WorkoutSession, DailyStatus } from '@/services/firebase';

interface AppState {
  // Auth
  user: import('firebase/auth').User | null;
  profile: UserProfile | null;
  authLoading: boolean;
  twoFactorVerified: boolean;

  // Data
  workouts: WorkoutSession[];
  recovery: RecoveryEntry[];
  injuries: PainMarker[];
  dailyStatuses: DailyStatus[];

  // Active session
  activeSession: {
    running: boolean;
    startTime: number | null;
    sets: import('@/services/firebase').WorkoutSet[];
    elapsedSeconds: number;
  };

  // Setters
  setUser: (user: import('firebase/auth').User | null) => void;
  setProfile: (profile: UserProfile | null) => void;
  setAuthLoading: (v: boolean) => void;
  setTwoFactorVerified: (v: boolean) => void;
  setWorkouts: (w: WorkoutSession[]) => void;
  setRecovery: (r: RecoveryEntry[]) => void;
  setInjuries: (i: PainMarker[]) => void;
  setDailyStatuses: (d: DailyStatus[]) => void;
  startSession: () => void;
  stopSession: () => void;
  addSet: (set: import('@/services/firebase').WorkoutSet) => void;
  tickSession: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  profile: null,
  authLoading: true,
  twoFactorVerified: false,
  workouts: [],
  recovery: [],
  injuries: [],
  dailyStatuses: [],
  activeSession: { running: false, startTime: null, sets: [], elapsedSeconds: 0 },

  setUser: (user) => set((s) => ({ user, twoFactorVerified: user ? s.twoFactorVerified : false })),
  setProfile: (profile) => set({ profile }),
  setAuthLoading: (v) => set({ authLoading: v }),
  setTwoFactorVerified: (twoFactorVerified) => set({ twoFactorVerified }),
  setWorkouts: (workouts) => set({ workouts }),
  setRecovery: (recovery) => set({ recovery }),
  setInjuries: (injuries) => set({ injuries }),
  setDailyStatuses: (dailyStatuses) => set({ dailyStatuses }),

  startSession: () =>
    set((s) => ({
      activeSession: { ...s.activeSession, running: true, startTime: Date.now(), elapsedSeconds: 0, sets: [] },
    })),

  stopSession: () =>
    set((s) => ({
      activeSession: { ...s.activeSession, running: false },
    })),

  addSet: (newSet) =>
    set((s) => ({
      activeSession: { ...s.activeSession, sets: [...s.activeSession.sets, newSet] },
    })),

  tickSession: () =>
    set((s) => ({
      activeSession: { ...s.activeSession, elapsedSeconds: s.activeSession.elapsedSeconds + 1 },
    })),
}));
