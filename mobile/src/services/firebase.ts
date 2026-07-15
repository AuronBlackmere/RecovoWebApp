import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  initializeAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithCredential,
  onAuthStateChanged,
  User,
  sendPasswordResetEmail,
  updateEmail,
  deleteUser,
} from 'firebase/auth';
import {
  getDatabase,
  ref,
  set,
  get,
  onValue,
  push,
  update,
  remove,
  query,
  orderByChild,
  equalTo,
  DataSnapshot,
} from 'firebase/database';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Use persistent auth for React Native
const auth = getAuth(app);

const db = getDatabase(app);

// ─── Auth ────────────────────────────────────────────────────────────────────

export const loginWithEmail = (email: string, password: string) =>
  signInWithEmailAndPassword(auth, email, password);

export const registerWithEmail = (email: string, password: string) =>
  createUserWithEmailAndPassword(auth, email, password);

export const logout = () => signOut(auth);

export const subscribeToAuth = (cb: (user: User | null) => void) =>
  onAuthStateChanged(auth, cb);

export const sendPasswordReset = (email: string) => sendPasswordResetEmail(auth, email);
export const updateAuthEmail = (user: User, email: string) => updateEmail(user, email);
export const deleteCurrentUser = (user: User) => deleteUser(user);

// Google Sign-In
export const signInWithGoogle = async (idToken: string) => {
  const credential = GoogleAuthProvider.credential(idToken);
  return signInWithCredential(auth, credential);
};

export { auth, db };

// ─── User Profile ────────────────────────────────────────────────────────────

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  role: 'athlete' | 'coach';
  sport: string;
  weight?: number; // kg — for MET calorie calc
  createdAt: number;
  legionId?: string;
  legionCode?: string;
  onboardingCompleted?: boolean;
  hasSeenTutorial?: boolean;
  [key: string]: any; // Catch-all for settings and other properties
}

export const createUserProfile = async (uid: string, data: Partial<UserProfile>) => {
  await set(ref(db, `users/${uid}`), {
    ...data,
    uid,
    createdAt: Date.now(),
  });
};

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  const snap = await get(ref(db, `users/${uid}`));
  return snap.exists() ? (snap.val() as UserProfile) : null;
};

export const updateUserProfile = (uid: string, data: Partial<UserProfile>) =>
  update(ref(db, `users/${uid}`), data);

export const subscribeToUserProfile = (uid: string, cb: (profile: UserProfile | null) => void) =>
  onValue(ref(db, `users/${uid}`), (snap) => cb(snap.exists() ? snap.val() : null));

// ─── Workout Sessions ────────────────────────────────────────────────────────

export interface WorkoutSet {
  exercise: string;
  sets: number;
  reps: number;
  weight: number; // kg
  duration: number; // minutes
  met: number;
}

export interface WorkoutSession {
  id?: string;
  uid: string;
  date: number;
  duration: number; // minutes
  caloriesBurned: number;
  sets: WorkoutSet[];
  notes?: string;
}

export const saveWorkoutSession = async (uid: string, session: Omit<WorkoutSession, 'id'>) => {
  try {
    const newRef = push(ref(db, `workouts/${uid}`));
    await set(newRef, { ...session, id: newRef.key });
    return newRef.key;
  } catch (error) {
    console.error('Firebase saveWorkoutSession Error:', error);
    throw error;
  }
};

export const subscribeToWorkouts = (uid: string, cb: (sessions: WorkoutSession[]) => void) =>
  onValue(ref(db, `workouts/${uid}`), (snap) => {
    if (!snap.exists()) { cb([]); return; }
    const raw = snap.val();
    cb(Object.values(raw) as WorkoutSession[]);
  });

// ─── Recovery & Device Sync ──────────────────────────────────────────────────

export interface RecoveryEntry {
  id?: string;
  uid: string;
  date: number;
  hrv: number;
  rhr: number;
  sleepHours: number;
  sleepQuality: number; // 0–100
  recoveryScore: number;
  readinessScore: number;
  painScore: number;
}

export const saveRecoveryEntry = async (uid: string, entry: Omit<RecoveryEntry, 'id'>) => {
  const newRef = push(ref(db, `recovery/${uid}`));
  await set(newRef, { ...entry, id: newRef.key });
};

export const subscribeToRecovery = (uid: string, cb: (entries: RecoveryEntry[]) => void) =>
  onValue(ref(db, `recovery/${uid}`), (snap) => {
    if (!snap.exists()) { cb([]); return; }
    cb(Object.values(snap.val()) as RecoveryEntry[]);
  });

// ─── Injuries ────────────────────────────────────────────────────────────────

export interface PainMarker {
  id?: string;
  uid: string;
  bodyPart: string;
  side: 'left' | 'right' | 'center';
  x: number; // % on body canvas
  y: number;
  painType: 'sharp' | 'dull' | 'burning' | 'aching';
  intensity: number; // 1–10
  notes?: string;
  timestamp: number;
  resolved: boolean;
}

export const savePainMarker = async (uid: string, marker: Omit<PainMarker, 'id'>) => {
  const newRef = push(ref(db, `injuries/${uid}`));
  await set(newRef, { ...marker, id: newRef.key });
  return newRef.key;
};

export const resolvePainMarker = (uid: string, markerId: string) =>
  update(ref(db, `injuries/${uid}/${markerId}`), { resolved: true });

export const subscribeToInjuries = (uid: string, cb: (markers: PainMarker[]) => void) =>
  onValue(ref(db, `injuries/${uid}`), (snap) => {
    if (!snap.exists()) { cb([]); return; }
    cb(Object.values(snap.val()) as PainMarker[]);
  });

export const fetchTeamInjuries = async (uids: string[]): Promise<PainMarker[]> => {
  const promises = uids.map(uid => get(ref(db, `injuries/${uid}`)));
  const snaps = await Promise.all(promises);
  const allInjuries: PainMarker[] = [];
  snaps.forEach(snap => {
    if (snap.exists()) {
      allInjuries.push(...(Object.values(snap.val()) as PainMarker[]));
    }
  });
  return allInjuries;
};

// ─── Daily Status ────────────────────────────────────────────────────────────

export interface DailyStatus {
  id?: string;
  uid: string;
  date: number;
  mood: number; // 1–5
  energy: number; // 1–5
  stress: number; // 1–5
  sleepQuality: number; // 1–5
  notes?: string;
  legionId?: string;
}

export const saveDailyStatus = async (uid: string, status: Omit<DailyStatus, 'id'>) => {
  const today = new Date().toISOString().split('T')[0];
  await set(ref(db, `daily_status/${uid}/${today}`), status);
  // Mirror to legion if athlete has one
  if (status.legionId) {
    await set(ref(db, `legions/${status.legionId}/athlete_status/${uid}/${today}`), status);
  }
};

export const subscribeToDailyStatus = (uid: string, cb: (entries: DailyStatus[]) => void) =>
  onValue(ref(db, `daily_status/${uid}`), (snap) => {
    if (!snap.exists()) { cb([]); return; }
    cb(Object.values(snap.val()) as DailyStatus[]);
  });

// ─── Legion ──────────────────────────────────────────────────────────────────

export interface Legion {
  id: string;
  name: string;
  coachUid: string;
  inviteCode: string;
  sport: string;
  createdAt: number;
  athleteUids: Record<string, boolean>;
}

export const forgeLegion = async (coachUid: string, name: string, sport: string): Promise<string> => {
  const inviteCode = Math.random().toString(36).slice(2, 8).toUpperCase();
  const newRef = push(ref(db, 'legions'));
  const legionId = newRef.key!;
  await set(newRef, {
    id: legionId,
    name,
    coachUid,
    inviteCode,
    sport,
    createdAt: Date.now(),
    athleteUids: {},
  });
  await set(ref(db, `inviteCodes/${inviteCode}`), legionId);
  await update(ref(db, `users/${coachUid}`), { legionId, legionCode: inviteCode });
  return inviteCode;
};

export const joinLegion = async (uid: string, inviteCode: string): Promise<boolean> => {
  const code = inviteCode.toUpperCase();
  const inviteSnap = await get(ref(db, `inviteCodes/${code}`));
  if (!inviteSnap.exists()) return false;
  const legionId = inviteSnap.val();
  await set(ref(db, `legions/${legionId}/athleteUids/${uid}`), true);
  await update(ref(db, `users/${uid}`), { legionId, legionCode: code });
  return true;
};

export const subscribeToLegion = (legionId: string, cb: (legion: Legion | null) => void) =>
  onValue(ref(db, `legions/${legionId}`), (snap) =>
    cb(snap.exists() ? snap.val() : null)
  );

export const subscribeToLegionAthleteStatus = (
  legionId: string,
  cb: (statuses: Record<string, Record<string, DailyStatus>>) => void
) =>
  onValue(ref(db, `legions/${legionId}/athlete_status`), (snap) =>
    cb(snap.exists() ? snap.val() : {})
  );

// ─── Coach Notes ──────────────────────────────────────────────────────────────

export interface CoachNote {
  id?: string;
  athleteUid: string;
  coachUid: string;
  message: string;
  timestamp: number;
}

export const saveCoachNote = async (athleteUid: string, note: Omit<CoachNote, 'id'>) => {
  const newRef = push(ref(db, `coach_notes/${athleteUid}`));
  await set(newRef, { ...note, id: newRef.key });
};

export const subscribeToCoachNotes = (athleteUid: string, cb: (notes: CoachNote[]) => void) =>
  onValue(ref(db, `coach_notes/${athleteUid}`), (snap) => {
    if (!snap.exists()) { cb([]); return; }
    // Sort descending by timestamp
    const sorted = (Object.values(snap.val()) as CoachNote[]).sort((a, b) => b.timestamp - a.timestamp);
    cb(sorted);
  });

export const fetchAthleteProfiles = async (uids: string[]): Promise<UserProfile[]> => {
  const promises = uids.map(uid => get(ref(db, `users/${uid}`)));
  const snaps = await Promise.all(promises);
  return snaps.filter(s => s.exists()).map(s => s.val() as UserProfile);
};



// ─── Inbox Messages ────────────────────────────────────────────────────────
export interface InboxMessage {
  id: string;
  athleteUid: string;
  coachUid: string;
  title: string;
  message: string;
  type: 'workout_assignment' | 'coach_note' | 'alert';
  data?: any; // e.g. the workout payload
  timestamp: number;
  read: boolean;
}

export const saveInboxMessage = async (athleteUid: string, message: Omit<InboxMessage, 'id' | 'read'>) => {
  const newRef = push(ref(db, `users/${athleteUid}/inbox`));
  await set(newRef, {
    ...message,
    id: newRef.key,
    read: false,
  });
};

export const subscribeToInbox = (uid: string, cb: (messages: InboxMessage[]) => void) => {
  return onValue(ref(db, `users/${uid}/inbox`), (snap) => {
    const data = snap.val();
    if (!data) return cb([]);
    const messages = Object.values(data) as InboxMessage[];
    cb(messages.sort((a, b) => b.timestamp - a.timestamp));
  });
};

export const markInboxMessageRead = async (uid: string, messageId: string) => {
  await update(ref(db, `users/${uid}/inbox/${messageId}`), { read: true });
};
