export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  role: 'athlete' | 'coach';
  sport: string;
  weight?: number;
  createdAt: number;
  legionId?: string;
  legionCode?: string;
}

export interface Legion {
  id: string;
  name: string;
  coachUid: string;
  inviteCode: string;
  sport: string;
  createdAt: number;
  athleteUids: Record<string, boolean>;
}

export interface DailyStatus {
  uid: string;
  date: number;
  mood: number;
  energy: number;
  stress: number;
  sleepQuality: number;
  notes?: string;
  legionId?: string;
}

export interface RecoveryEntry {
  uid: string;
  date: number;
  hrv: number;
  rhr: number;
  sleepHours: number;
  sleepQuality: number;
  recoveryScore: number;
  readinessScore: number;
  painScore: number;
}

export interface PainMarker {
  id?: string;
  uid: string;
  bodyPart: string;
  painType: 'sharp' | 'dull' | 'burning' | 'aching';
  intensity: number;
  resolved: boolean;
  timestamp: number;
}

export interface AthleteRoster {
  profile: UserProfile;
  latestStatus?: DailyStatus;
  latestRecovery?: RecoveryEntry;
  activeInjuries: PainMarker[];
  readiness: number;
}

export type ReadinessLevel = 'ELITE' | 'HIGH' | 'MODERATE' | 'LOW' | 'CRITICAL';

export const getReadinessLevel = (score: number): ReadinessLevel => {
  if (score >= 85) return 'ELITE';
  if (score >= 70) return 'HIGH';
  if (score >= 55) return 'MODERATE';
  if (score >= 40) return 'LOW';
  return 'CRITICAL';
};

export const READINESS_COLORS: Record<ReadinessLevel, string> = {
  ELITE: '#4ADE80',
  HIGH: '#3B82F6',
  MODERATE: '#FCD34D',
  LOW: '#F97316',
  CRITICAL: '#F87171',
};

export const calculateReadiness = (recoveryScore: number, painScore: number): number =>
  Math.max(0, Math.min(100, Math.round(recoveryScore * 0.7 - painScore * 0.3)));
