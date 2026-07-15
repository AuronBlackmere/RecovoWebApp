// ─── MET Calorie Calculation ─────────────────────────────────────────────────
// Calories = MET × weight(kg) × duration(hours)

export const MET_VALUES: Record<string, number> = {
  'Running': 9.8,
  'Cycling': 8.0,
  'Swimming': 7.0,
  'Weight Training': 5.0,
  'HIIT': 10.3,
  'Football': 8.3,
  'Basketball': 7.5,
  'Wrestling': 7.7,
  'Boxing': 9.0,
  'Yoga': 3.0,
  'Walking': 3.5,
  'Rowing': 7.0,
  'CrossFit': 8.5,
  'Pilates': 3.8,
  'Stretching': 2.3,
};

export const calculateCalories = (
  metKey: string,
  weightKg: number,
  durationMinutes: number
): number => {
  const met = MET_VALUES[metKey] ?? 5.0;
  return Math.round(met * weightKg * (durationMinutes / 60));
};

// ─── Readiness Score ──────────────────────────────────────────────────────────
// Readiness = (Recovery × 0.7) - (Pain × 0.3)

export const calculateReadiness = (recoveryScore: number, painScore: number): number => {
  const raw = recoveryScore * 0.7 - painScore * 0.3;
  return Math.max(0, Math.min(100, Math.round(raw)));
};

export const calculateRecoveryScore = (hrv: number, rhr: number, sleepHours: number): number => {
  // HRV: higher = better (norm 20–60ms)
  const hrvScore = Math.min(100, (hrv / 60) * 100);
  // RHR: lower = better (norm 40–100 bpm)
  const rhrScore = Math.max(0, Math.min(100, ((100 - rhr) / 60) * 100));
  // Sleep: target 8hrs
  const sleepScore = Math.min(100, (sleepHours / 8) * 100);
  return Math.round((hrvScore * 0.4 + rhrScore * 0.3 + sleepScore * 0.3));
};

export const getReadinessLabel = (score: number, t: Record<string, string>): { label: string; color: string } => {
  if (score >= 85) return { label: t.eliteReady || 'ELITE READY', color: '#00FFA3' };
  if (score >= 70) return { label: t.ready || 'READY', color: '#00E5FF' };
  if (score >= 55) return { label: t.moderate || 'MODERATE', color: '#FFD600' };
  if (score >= 40) return { label: t.low || 'LOW', color: '#FF6B35' };
  return { label: t.critical || 'CRITICAL', color: '#FF1744' };
};

// ─── Kinetic Alert Engine ─────────────────────────────────────────────────────

export interface KineticAlert {
  severity: 'warning' | 'danger';
  message: string;
  action: string;
}

export const runKineticAlertEngine = (
  readiness: number,
  painScore: number,
  recentWorkoutMinutes: number,
  t: Record<string, string>
): KineticAlert | null => {
  const highPain = painScore > 60;
  const lowReadiness = readiness < 45;
  const heavyLoad = recentWorkoutMinutes > 90;

  if (highPain && lowReadiness && heavyLoad) {
    return {
      severity: 'danger',
      message: t.riskDangerMsg || 'Injury Risk Detected — High pain + low readiness + heavy load',
      action: t.riskDangerAction || 'Mandatory rest day. No training today.',
    };
  }
  if (highPain && lowReadiness) {
    return {
      severity: 'warning',
      message: t.riskWarningPainMsg || 'Recovery deficit with active pain markers',
      action: t.riskWarningPainAction || 'Light recovery session only. Monitor pain levels.',
    };
  }
  if (lowReadiness && heavyLoad) {
    return {
      severity: 'warning',
      message: t.riskWarningLoadMsg || 'Heavy training load on a low-readiness day',
      action: t.riskWarningLoadAction || 'Reduce volume by 40%. Prioritize form over intensity.',
    };
  }
  return null;
};

// ─── Streak Calculation ───────────────────────────────────────────────────────

export const calculateStreak = (sessionDates: number[]): number => {
  if (sessionDates.length === 0) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sortedDates = [...sessionDates]
    .map((d) => {
      const date = new Date(d);
      date.setHours(0, 0, 0, 0);
      return date.getTime();
    })
    .sort((a, b) => b - a);

  const unique = [...new Set(sortedDates)];
  let streak = 0;
  let current = today.getTime();

  for (const date of unique) {
    if (date === current || date === current - 86400000) {
      streak++;
      current = date - 86400000;
    } else {
      break;
    }
  }
  return streak;
};

// ─── Format helpers ───────────────────────────────────────────────────────────

export const formatDuration = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

export const formatDate = (timestamp: number): string =>
  new Date(timestamp).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });

// ─── Vulnerability Mapping, Injury Prevention & Recovery Planner ─────────────

export interface Vulnerability {
  bodyPart: string;
  level: 'healthy' | 'low' | 'medium' | 'high' | 'critical';
  reason: string;
  score: number;
}

export interface PreventionExercise {
  name: string;
  reps: string;
  desc: string;
  warning?: string;
}

export interface RecoveryStep {
  name: string;
  duration: string;
  desc: string;
}

export const BODY_KEYS = [
  'Head', 'Neck', 'Shoulder', 'Chest', 'Upper Back', 'Core', 'Lower Back',
  'Hip', 'Quad', 'Hamstring', 'Knee', 'Calf', 'Lower Leg', 'Foot', 'Ankle', 'Elbow'
];

// ─── Sport-Specific Risk Profiles ────────────────────────────────────────────
// Maps each sport to body parts with elevated baseline vulnerability scores.
// The AI applies these as pre-existing risk boosts during vulnerability mapping.

export const SPORT_RISK_MAP: Record<string, { part: string; boost: number; reason: string }[]> = {
  Football: [
    { part: 'Knee', boost: 20, reason: 'Sport risk: Pivoting & tackles' },
    { part: 'Ankle', boost: 18, reason: 'Sport risk: Rapid direction changes' },
    { part: 'Hamstring', boost: 15, reason: 'Sport risk: Sprinting load' },
    { part: 'Hip', boost: 12, reason: 'Sport risk: Kicking mechanics' },
    { part: 'Lower Leg', boost: 10, reason: 'Sport risk: Shin contact' },
  ],
  Soccer: [
    { part: 'Knee', boost: 20, reason: 'Sport risk: Pivoting & tackles' },
    { part: 'Ankle', boost: 18, reason: 'Sport risk: Rapid direction changes' },
    { part: 'Hamstring', boost: 15, reason: 'Sport risk: Sprinting load' },
    { part: 'Hip', boost: 12, reason: 'Sport risk: Kicking mechanics' },
  ],
  Basketball: [
    { part: 'Ankle', boost: 22, reason: 'Sport risk: Landing mechanics' },
    { part: 'Knee', boost: 18, reason: 'Sport risk: Jumping/cutting' },
    { part: 'Lower Back', boost: 12, reason: 'Sport risk: Spinal impact on landing' },
    { part: 'Shoulder', boost: 10, reason: 'Sport risk: Overhead shooting' },
  ],
  Running: [
    { part: 'Knee', boost: 20, reason: 'Sport risk: Repetitive impact' },
    { part: 'Ankle', boost: 16, reason: 'Sport risk: Ground-strike load' },
    { part: 'Calf', boost: 15, reason: 'Sport risk: Push-off loading' },
    { part: 'Foot', boost: 14, reason: 'Sport risk: Plantar stress' },
    { part: 'Lower Leg', boost: 12, reason: 'Sport risk: Shin splint risk' },
    { part: 'Hip', boost: 10, reason: 'Sport risk: IT band strain' },
  ],
  Weightlifting: [
    { part: 'Shoulder', boost: 18, reason: 'Sport risk: Overhead pressing' },
    { part: 'Lower Back', boost: 16, reason: 'Sport risk: Spinal compression' },
    { part: 'Knee', boost: 12, reason: 'Sport risk: Squat loading' },
    { part: 'Elbow', boost: 10, reason: 'Sport risk: Pressing/curling stress' },
  ],
  Volleyball: [
    { part: 'Shoulder', boost: 20, reason: 'Sport risk: Spiking mechanics' },
    { part: 'Knee', boost: 18, reason: 'Sport risk: Jump-landing stress' },
    { part: 'Ankle', boost: 15, reason: 'Sport risk: Landing on uneven surfaces' },
    { part: 'Lower Back', boost: 10, reason: 'Sport risk: Rotational force' },
  ],
  Tennis: [
    { part: 'Elbow', boost: 22, reason: 'Sport risk: Racquet impact forces' },
    { part: 'Shoulder', boost: 18, reason: 'Sport risk: Serving mechanics' },
    { part: 'Knee', boost: 14, reason: 'Sport risk: Lateral movement' },
    { part: 'Lower Back', boost: 12, reason: 'Sport risk: Rotational torque' },
  ],
  Badminton: [
    { part: 'Elbow', boost: 20, reason: 'Sport risk: Racquet flick forces' },
    { part: 'Shoulder', boost: 16, reason: 'Sport risk: Overhead smash' },
    { part: 'Knee', boost: 14, reason: 'Sport risk: Lunging' },
    { part: 'Ankle', boost: 12, reason: 'Sport risk: Quick pivots' },
  ],
  Swimming: [
    { part: 'Shoulder', boost: 22, reason: 'Sport risk: Repetitive overhead strokes' },
    { part: 'Lower Back', boost: 14, reason: 'Sport risk: Hyperextension in butterfly/backstroke' },
    { part: 'Neck', boost: 10, reason: 'Sport risk: Breathing rotation' },
    { part: 'Knee', boost: 10, reason: 'Sport risk: Breaststroke kick' },
  ],
  Cycling: [
    { part: 'Knee', boost: 18, reason: 'Sport risk: Repetitive pedaling load' },
    { part: 'Lower Back', boost: 16, reason: 'Sport risk: Forward-flex riding position' },
    { part: 'Hip', boost: 12, reason: 'Sport risk: Hip flexor tightness' },
    { part: 'Neck', boost: 10, reason: 'Sport risk: Extended neck position' },
  ],
  MMA: [
    { part: 'Shoulder', boost: 20, reason: 'Sport risk: Grappling strain' },
    { part: 'Elbow', boost: 18, reason: 'Sport risk: Joint lock exposure' },
    { part: 'Neck', boost: 18, reason: 'Sport risk: Striking/choking forces' },
    { part: 'Knee', boost: 16, reason: 'Sport risk: Takedown mechanics' },
    { part: 'Lower Back', boost: 14, reason: 'Sport risk: Twisting & throws' },
  ],
  Gymnastics: [
    { part: 'Shoulder', boost: 20, reason: 'Sport risk: Ring/bar forces' },
    { part: 'Lower Back', boost: 18, reason: 'Sport risk: Hyperextension landings' },
    { part: 'Ankle', boost: 16, reason: 'Sport risk: Dismount impact' },
    { part: 'Elbow', boost: 14, reason: 'Sport risk: Weight-bearing on hands' },
  ],
  Athletics: [
    { part: 'Hamstring', boost: 18, reason: 'Sport risk: Explosive sprinting' },
    { part: 'Knee', boost: 16, reason: 'Sport risk: Jumping/landing' },
    { part: 'Ankle', boost: 14, reason: 'Sport risk: Ground impact' },
    { part: 'Lower Back', boost: 12, reason: 'Sport risk: Throwing mechanics' },
  ],
  Cricket: [
    { part: 'Shoulder', boost: 18, reason: 'Sport risk: Bowling mechanics' },
    { part: 'Lower Back', boost: 16, reason: 'Sport risk: Bowling rotation' },
    { part: 'Knee', boost: 14, reason: 'Sport risk: Fast bowling load' },
    { part: 'Hamstring', boost: 12, reason: 'Sport risk: Fielding sprints' },
  ],
  Hockey: [
    { part: 'Lower Back', boost: 18, reason: 'Sport risk: Bent-over stance' },
    { part: 'Knee', boost: 16, reason: 'Sport risk: Lateral movement' },
    { part: 'Hip', boost: 14, reason: 'Sport risk: Rotation in hitting' },
    { part: 'Ankle', boost: 12, reason: 'Sport risk: Quick stops' },
  ],
  Boxing: [
    { part: 'Shoulder', boost: 20, reason: 'Sport risk: Punching mechanics' },
    { part: 'Elbow', boost: 16, reason: 'Sport risk: Repetitive extension' },
    { part: 'Neck', boost: 14, reason: 'Sport risk: Impact absorption' },
    { part: 'Lower Back', boost: 12, reason: 'Sport risk: Rotational power' },
  ],
};

// ─── Sport-Specific Prevention Drills ────────────────────────────────────────
// These fill in when the generic prevention routine is short, tailored to the sport.

const SPORT_PREVENTION_DRILLS: Record<string, Omit<PreventionExercise, 'warning'>[]> = {
  Football: [
    { name: 'Nordic Hamstring Curls', reps: '3 sets x 5 reps', desc: 'FIFA 11+ eccentric hamstring drill — reduces hamstring injuries by 51% in footballers.' },
    { name: 'Lateral Band Walks', reps: '2 sets x 15 steps', desc: 'Activates gluteus medius for lateral stability during cutting and direction changes.' },
    { name: 'Single-Leg RDLs', reps: '3 sets x 8 reps per side', desc: 'Builds unilateral hip and hamstring strength for sprint deceleration.' },
  ],
  Soccer: [
    { name: 'Nordic Hamstring Curls', reps: '3 sets x 5 reps', desc: 'FIFA 11+ eccentric hamstring drill — reduces hamstring injuries by 51% in footballers.' },
    { name: 'Lateral Band Walks', reps: '2 sets x 15 steps', desc: 'Activates gluteus medius for lateral stability during cutting and direction changes.' },
    { name: 'Copenhagen Adductor Holds', reps: '3 sets x 15s per side', desc: 'Strengthens inner thigh for groin injury prevention.' },
  ],
  Basketball: [
    { name: 'Depth Jump Landings', reps: '3 sets x 6 reps', desc: 'Trains proper landing mechanics to protect ACL and ankle.' },
    { name: 'Ankle Alphabet Drills', reps: '2 sets per foot', desc: 'Full ankle range of motion for proprioceptive control.' },
    { name: 'Box Jumps (Focus on Landing)', reps: '3 sets x 8 reps', desc: 'Eccentric loading for knee stabilizers.' },
  ],
  Running: [
    { name: 'Calf Eccentrics (Slow Negatives)', reps: '3 sets x 12 reps', desc: 'Builds Achilles tendon resilience for high-mileage runners.' },
    { name: 'Single-Leg Glute Bridge', reps: '3 sets x 12 reps per side', desc: 'Corrects hip drop during running gait.' },
    { name: 'Banded Clamshells', reps: '2 sets x 20 reps', desc: 'Activates gluteus medius to prevent IT band syndrome.' },
  ],
  Weightlifting: [
    { name: 'Face Pulls', reps: '3 sets x 15 reps', desc: 'Balances pressing volume with rear delt / rotator cuff work.' },
    { name: 'Dead Bugs', reps: '3 sets x 10 reps per side', desc: 'Teaches core bracing under spinal load.' },
    { name: 'Banded Pull-Aparts', reps: '3 sets x 20 reps', desc: 'Primes scapular retractors before heavy pressing.' },
  ],
  Volleyball: [
    { name: 'Eccentric Calf Raises', reps: '3 sets x 12 reps', desc: 'Protects patellar tendon from repetitive jumping.' },
    { name: 'Shoulder I-Y-T Raises', reps: '2 sets x 10 reps', desc: 'Strengthens rotator cuff for overhead spiking.' },
    { name: 'Single-Leg Squat to Box', reps: '3 sets x 8 per leg', desc: 'Builds unilateral landing strength.' },
  ],
  Tennis: [
    { name: 'Eccentric Wrist Extensions', reps: '3 sets x 15 reps', desc: 'Targets tennis elbow prevention at the extensor insertion.' },
    { name: 'External Rotation with Band', reps: '3 sets x 12 reps', desc: 'Strengthens rotator cuff for serving.' },
    { name: 'Side Plank with Rotation', reps: '2 sets x 10 per side', desc: 'Builds core rotational stability.' },
  ],
  MMA: [
    { name: 'Neck Harness Extensions', reps: '2 sets x 15 reps', desc: 'Builds neck strength to absorb striking forces.' },
    { name: 'Shoulder Dislocations (Band)', reps: '2 sets x 15 reps', desc: 'Increases shoulder ROM for grappling positions.' },
    { name: 'Hip Flexor Stretch (Half-Kneeling)', reps: '2 sets x 45s per side', desc: 'Counters tight hips from guard work.' },
  ],
  Swimming: [
    { name: 'Band External Rotations (90°)', reps: '3 sets x 15 reps', desc: 'Critical rotator cuff maintenance for swimmers.' },
    { name: 'Prone Y-Raises', reps: '2 sets x 12 reps', desc: 'Strengthens lower traps for stroke efficiency.' },
    { name: 'Cat-Cow Stretches', reps: '2 sets x 10 cycles', desc: 'Mobilizes thoracic spine for breathing mechanics.' },
  ],
  Cycling: [
    { name: 'Standing Hip Flexor Stretch', reps: '2 sets x 45s per side', desc: 'Counters chronic hip flexion from bike position.' },
    { name: 'Foam Roll IT Band', reps: '2 mins per side', desc: 'Releases lateral knee tension from pedaling.' },
    { name: 'Thoracic Extension over Roller', reps: '2 sets x 10 reps', desc: 'Opens up rounded upper back from aero position.' },
  ],
};

// ─── Sport-Specific Recovery Mobility Drills ──────────────────────────────────

const SPORT_RECOVERY_DRILLS: Record<string, RecoveryStep[]> = {
  Football: [
    { name: 'Hip Flexor Opener', duration: '2 mins per side', desc: 'Releases hip flexors tightened by sprinting and kicking mechanics.' },
    { name: 'Hamstring PNF Stretch', duration: '90s per side', desc: 'Contract-relax stretching for sprint-loaded hamstrings.' },
  ],
  Soccer: [
    { name: 'Adductor Stretch (Butterfly)', duration: '2 mins', desc: 'Opens inner thigh muscles stressed during kicking.' },
    { name: 'Piriformis Stretch', duration: '90s per side', desc: 'Releases deep glute rotators tight from direction changes.' },
  ],
  Basketball: [
    { name: 'Ankle CARs (Circles)', duration: '1 min per foot', desc: 'Full ankle range recovery after jumping and landing.' },
    { name: 'Quad Foam Roll', duration: '2 mins per side', desc: 'Releases quad tension from explosive jumps.' },
  ],
  Running: [
    { name: 'Quad Couch Stretch', duration: '2 mins per side', desc: 'Opens hip flexors and quads shortened during runs.' },
    { name: 'Calf & Achilles Stretch', duration: '90s per side', desc: 'Eases calf and Achilles tension from repetitive ground strikes.' },
  ],
  Weightlifting: [
    { name: 'Doorway Pec Stretch', duration: '2 mins', desc: 'Restores shoulder positioning after pressing.' },
    { name: 'Thread the Needle', duration: '1 min per side', desc: 'Decompresses thoracic spine after heavy loads.' },
  ],
  Swimming: [
    { name: 'Sleeper Stretch', duration: '90s per side', desc: 'Restores internal rotation lost during repetitive strokes.' },
    { name: 'Lat Foam Roll', duration: '2 mins per side', desc: 'Releases lat tightness from pulling through water.' },
  ],
  Cycling: [
    { name: 'Pigeon Pose', duration: '2 mins per side', desc: 'Deep hip opener for cyclists with chronic flexor tightness.' },
    { name: 'Standing Quad Stretch', duration: '90s per side', desc: 'Lengthens quads shortened by hours of pedaling.' },
  ],
  MMA: [
    { name: 'Neck Side Stretch', duration: '45s per side', desc: 'Releases neck tension from striking and grappling.' },
    { name: 'Shoulder Cross-Body Stretch', duration: '1 min per side', desc: 'Restores shoulder ROM after clinch work.' },
  ],
};

// ─── Onboarding body-part ID → BODY_KEYS mapping ────────────────────────────
// Maps the questionnaire pain body-part IDs to our vulnerability system keys.

const PAIN_PART_TO_BODY_KEY: Record<string, string> = {
  // 2D onboarding IDs
  'head': 'Head',
  'neck': 'Neck',
  'shoulder-l': 'Shoulder', 'shoulder-r': 'Shoulder',
  'chest': 'Chest',
  'upper-back': 'Upper Back',
  'elbow-l': 'Elbow', 'elbow-r': 'Elbow',
  'core': 'Core',
  'lowback': 'Lower Back',
  'hip-l': 'Hip', 'hip-r': 'Hip',
  'wrist-l': 'Elbow', 'wrist-r': 'Elbow',
  'quad-l': 'Quad', 'quad-r': 'Quad',
  'knee-l': 'Knee', 'knee-r': 'Knee',
  'shin-l': 'Lower Leg', 'shin-r': 'Lower Leg',
  'ankle-l': 'Ankle', 'ankle-r': 'Ankle',

  // 3D model IDs
  'left-shoulder': 'Shoulder',
  'right-shoulder': 'Shoulder',
  'lower-back': 'Lower Back',
  'left-hip': 'Hip',
  'right-hip': 'Hip',
  'left-quad': 'Quad',
  'right-quad': 'Quad',
  'left-hamstring': 'Hamstring',
  'right-hamstring': 'Hamstring',
  'left-knee': 'Knee',
  'right-knee': 'Knee',
  'left-calf': 'Calf',
  'right-calf': 'Calf',
  'left-shin': 'Lower Leg',
  'right-shin': 'Lower Leg',
  'left-foot': 'Foot',
  'right-foot': 'Foot',
  'left-ankle': 'Ankle',
  'right-ankle': 'Ankle',
  'left-elbow': 'Elbow',
  'right-elbow': 'Elbow',
};

interface ProfileContext {
  sport?: string;
  painBodyParts?: string[];
  injuryStatus?: string;
  trainingFrequency?: string;
  ageRange?: string;
}

export const calculateVulnerabilities = (
  workouts: any[],
  injuries: any[],
  profile?: ProfileContext | null
): Vulnerability[] => {
  // Initialize default states
  const partMap: Record<string, { score: number; reasons: string[] }> = {};
  for (const key of BODY_KEYS) {
    partMap[key] = { score: 0, reasons: [] };
  }

  // 1. Process active logged pain points
  const activeInjuries = injuries.filter((i) => !i.resolved);
  for (const i of activeInjuries) {
    if (partMap[i.bodyPart]) {
      const pScore = 65 + (i.intensity || 5) * 3.5;
      partMap[i.bodyPart].score = Math.max(partMap[i.bodyPart].score, pScore);
      partMap[i.bodyPart].reasons.push(
        `Active Pain: ${i.painType.toUpperCase()} (intensity ${i.intensity || 5}/10)`
      );
    }
  }

  // 2. Process workload fatigue from recent workouts (last 5 days)
  const now = Date.now();
  const recentWorkouts = workouts.filter((w) => now - w.date <= 5 * 24 * 60 * 60 * 1000);

  for (const w of recentWorkouts) {
    const isRunning = w.type === 'running' || !w.sets || w.sets.some((s: any) => s.exercise?.toLowerCase().includes('run'));
    
    if (isRunning) {
      // Lower body fatigue
      const dur = w.duration || 30;
      const add = dur > 45 ? 25 : 15;
      for (const key of ['Knee', 'Foot', 'Ankle', 'Calf', 'Lower Leg']) {
        partMap[key].score += add;
        partMap[key].reasons.push(`Workload: Running (${dur} mins)`);
      }
    } else {
      // Resistance workout set fatigue mapping
      const sets = w.sets || [];
      for (const set of sets) {
        const ex = (set.exercise || '').toLowerCase();
        if (ex.includes('squat') || ex.includes('leg press') || ex.includes('lunge')) {
          partMap['Quad'].score += 5;
          partMap['Knee'].score += 5;
          partMap['Quad'].reasons.push(`Load: Squats/Lunges`);
          partMap['Knee'].reasons.push(`Load: Knee loading`);
        }
        if (ex.includes('deadlift') || ex.includes('back extension') || ex.includes('good morning') || ex.includes('swing')) {
          partMap['Lower Back'].score += 6;
          partMap['Hamstring'].score += 5;
          partMap['Hip'].score += 4;
          partMap['Lower Back'].reasons.push(`Load: Spinal shear`);
          partMap['Hamstring'].reasons.push(`Load: Posterior chain load`);
        }
        if (ex.includes('bench') || ex.includes('press') || ex.includes('push') || ex.includes('dip')) {
          partMap['Shoulder'].score += 4;
          partMap['Chest'].score += 4;
          partMap['Elbow'].score += 3;
          partMap['Shoulder'].reasons.push(`Load: Pressing movement`);
        }
        if (ex.includes('pull') || ex.includes('row') || ex.includes('chin')) {
          partMap['Upper Back'].score += 4;
          partMap['Elbow'].score += 3;
          partMap['Shoulder'].score += 2;
          partMap['Upper Back'].reasons.push(`Load: Pulling movement`);
        }
        if (ex.includes('crunch') || ex.includes('raise') || ex.includes('plank') || ex.includes('sit')) {
          partMap['Core'].score += 4;
          partMap['Core'].reasons.push(`Load: Core activation`);
        }
      }
    }
  }

  // 3. Sport-specific baseline risk boosts (from questionnaire)
  if (profile?.sport) {
    const sportKey = profile.sport;
    const risks = SPORT_RISK_MAP[sportKey] || [];
    for (const risk of risks) {
      if (partMap[risk.part]) {
        partMap[risk.part].score += risk.boost;
        partMap[risk.part].reasons.push(risk.reason);
      }
    }
  }

  // 4. Pre-existing pain areas from onboarding questionnaire
  if (profile?.painBodyParts && profile.painBodyParts.length > 0) {
    const isActive = profile.injuryStatus === 'Yes, actively';
    const isRecovering = profile.injuryStatus === 'Yes, but recovering';
    for (const partId of profile.painBodyParts) {
      const bodyKey = PAIN_PART_TO_BODY_KEY[partId];
      if (bodyKey && partMap[bodyKey]) {
        const boost = isActive ? 30 : isRecovering ? 15 : 8;
        partMap[bodyKey].score += boost;
        partMap[bodyKey].reasons.push(
          isActive ? 'Questionnaire: Active pain reported' : 
          isRecovering ? 'Questionnaire: Recovering from injury' :
          'Questionnaire: History of pain'
        );
      }
    }
  }

  // 5. Training frequency amplifier (higher frequency = more cumulative load)
  if (profile?.trainingFrequency) {
    const freq = profile.trainingFrequency;
    let multiplier = 1.0;
    if (freq.includes('5') || freq.includes('6') || freq.includes('7') || freq.toLowerCase().includes('daily')) {
      multiplier = 1.2; // +20% for very high frequency
    } else if (freq.includes('3') || freq.includes('4')) {
      multiplier = 1.05; // +5% for moderate-high
    }
    if (multiplier > 1.0) {
      for (const key of BODY_KEYS) {
        if (partMap[key].score > 0) {
          partMap[key].score = Math.round(partMap[key].score * multiplier);
        }
      }
    }
  }

  // 6. Age range adjustment (older athletes have slower tissue recovery)
  if (profile?.ageRange) {
    const age = profile.ageRange;
    if (age.includes('35') || age.includes('40') || age.includes('45') || age.includes('50') || age === '35+') {
      for (const key of BODY_KEYS) {
        if (partMap[key].score > 0) {
          partMap[key].score += 5; // Small durability offset
          partMap[key].reasons.push('Age factor: Longer tissue recovery');
        }
      }
    }
  }

  // 7. Compile, scale, and label level
  return BODY_KEYS.map((key) => {
    const raw = partMap[key];
    const score = Math.min(100, Math.round(raw.score));
    
    let level: Vulnerability['level'] = 'healthy';
    if (score >= 80) level = 'critical';
    else if (score >= 50) level = 'high';
    else if (score >= 25) level = 'medium';
    else if (score > 0) level = 'low';

    // Group matching reasons to avoid list clutter
    const uniqueReasonsSet = new Set(raw.reasons);
    const reasonText = uniqueReasonsSet.size > 0
      ? Array.from(uniqueReasonsSet).slice(0, 3).join(' | ')
      : 'No fatigue or active pain';

    return {
      bodyPart: key,
      level,
      reason: reasonText,
      score,
    };
  });
};

const PREVENTION_DATABASE: Record<string, Omit<PreventionExercise, 'warning'>[]> = {
  Knee: [
    { name: 'Tibialis Raises', reps: '3 sets x 15 reps', desc: 'Strengthens the shin stabilizers to absorb ground impact.' },
    { name: 'Poliquin Step-Ups', reps: '3 sets x 12 reps per side', desc: 'Isolates the VMO (quad muscle) to improve kneecap tracking.' }
  ],
  Shoulder: [
    { name: 'Band External Rotations', reps: '3 sets x 15 reps', desc: 'Strengthens rotator cuff external stabilizers.' },
    { name: 'Scapular Y-T-W Exercises', reps: '2 sets x 10 reps', desc: 'Activates lower/middle traps and shoulder blade control.' }
  ],
  'Lower Back': [
    { name: 'Bird-Dogs (Holds)', reps: '3 sets x 8 reps per side', desc: 'Stabilizes the lumbar spine and trains bracing.' },
    { name: 'McGill Curl-Ups', reps: '3 sets x 10s holds', desc: 'Tones abdominal wall without flexing the lower back.' }
  ],
  Ankle: [
    { name: 'Single-Leg Balance Stand', reps: '3 sets x 45s holds', desc: 'Promotes ankle stability and proprioceptive feedback.' },
    { name: 'Ankle Band Inversions', reps: '2 sets x 15 reps', desc: 'Reinforces lateral ankle ligament strength.' }
  ],
  Foot: [
    { name: 'Towel Arch Scrunches', reps: '3 sets x 12 reps', desc: 'Strengthens intrinsic foot arch muscles.' },
    { name: 'Plantar Fascia Stretch', reps: '2 sets x 30s', desc: 'Stretches structural connective tissue under the foot.' }
  ],
  Hamstring: [
    { name: 'Glute Bridges (Single Leg)', reps: '3 sets x 12 reps', desc: 'Builds hamstring hip extension support.' },
    { name: 'Romanian Deadlifts (Empty Bar)', reps: '2 sets x 10 reps', desc: 'Active dynamic elongation of hamstrings.' }
  ],
  Elbow: [
    { name: 'Reverse Wrist Curls', reps: '3 sets x 15 reps', desc: 'Strengthens forearm extensors to avoid tennis elbow.' },
    { name: 'Wrist Flexor Stretch', reps: '2 sets x 30s', desc: 'Eases forearm tension pulling on epicondyles.' }
  ],
  'Upper Back': [
    { name: 'Band Face-Pulls', reps: '3 sets x 12 reps', desc: 'Counteracts slouched posture and strengthens upper back.' }
  ],
  Hip: [
    { name: 'Hip 90/90 Stretches', reps: '2 sets x 8 rotations', desc: 'Improves active internal/external rotational ranges.' },
    { name: 'Glute Clamshells', reps: '3 sets x 15 reps', desc: 'Activates gluteus medius to stabilize pelvis.' }
  ],
  Calf: [
    { name: 'Standing Wall Calf Stretch', reps: '3 sets x 30s holds', desc: 'Lengthens tight calves to decrease Achilles load.' }
  ],
  'Lower Leg': [
    { name: 'Heel Walks', reps: '2 sets x 1 min', desc: 'Activates tibialis anterior to ward off shin splints.' }
  ]
};

export const generateInjuryPreventionRoutine = (
  type: string,
  exercises: string[],
  vulnerabilities: Vulnerability[],
  sport?: string,
  isCoach?: boolean
): PreventionExercise[] => {
  const routine: PreventionExercise[] = [];
  const addedNames = new Set<string>();

  if (isCoach) {
    // Coach Team-Sync Warmups
    return [
      { name: 'Squad Dynamic Lunges', reps: '3 sets x 20 meters', desc: 'Sync movement across the team. Opens hips and activates quads simultaneously.' },
      { name: 'Partner Resistance Sprints', reps: '3 sets x 15 meters', desc: 'Pair athletes up with resistance bands. Builds explosive power and team camaraderie.' },
      { name: 'Synchronized Plyo Jumps', reps: '3 sets x 10 jumps', desc: 'Listen to the coach whistle. Promotes explosive tendon elasticity and reaction time.' },
      { name: 'Circle Banded Walk', reps: '2 sets x 30 seconds', desc: 'Team forms a circle with lateral band walks. Excellent glute medius activation.' }
    ];
  }

  // 1. Primary Baseline: Sport-Specific Prevention Drills
  if (sport) {
    const sportDrills = SPORT_PREVENTION_DRILLS[sport];
    if (sportDrills) {
      for (const drill of sportDrills) {
        routine.push(drill);
        addedNames.add(drill.name);
      }
    }
  }

  // 2. Prioritize parts with active vulnerabilities (score >= 25)
  const priorityParts = vulnerabilities
    .filter((v) => v.score >= 25)
    .sort((a, b) => b.score - a.score);

  for (const vp of priorityParts) {
    const drills = PREVENTION_DATABASE[vp.bodyPart];
    if (drills) {
      drills.forEach((drill) => {
        if (!addedNames.has(drill.name)) {
          let warning: string | undefined;
          let reps = drill.reps;
          if (vp.level === 'critical') {
            warning = `⚠️ INTENSITY CAP: Lower workout weight by 40-50% to protect your ${vp.bodyPart}.`;
            reps = '2 sets x 8-10 reps (Light)';
          } else if (vp.level === 'high') {
            warning = `⚠️ WARNING: Monitor your ${vp.bodyPart}. Limit heavy load.`;
            reps = '2 sets x 10-12 reps';
          }
          if (routine.length < 5) { // Cap total drills
            routine.push({
              ...drill,
              reps,
              warning,
            });
            addedNames.add(drill.name);
          }
        }
      });
    }
  }

  // 3. Fallback: Add base activation drills based on session type if still short
  if (routine.length < 3) {
    let fallbackDrills: Omit<PreventionExercise, 'warning'>[] = [];
    if (type === 'running') {
      fallbackDrills = (PREVENTION_DATABASE['Knee'] || []).concat(PREVENTION_DATABASE['Ankle'] || []);
    } else if (type === 'weightlifting') {
      fallbackDrills = (PREVENTION_DATABASE['Shoulder'] || []).concat(PREVENTION_DATABASE['Lower Back'] || []);
    } else {
      fallbackDrills = (PREVENTION_DATABASE['Shoulder'] || []).concat(PREVENTION_DATABASE['Hip'] || []);
    }
    
    for (const d of fallbackDrills) {
       if (routine.length < 4 && !addedNames.has(d.name)) {
         routine.push(d);
         addedNames.add(d.name);
       }
    }
  }

  return routine;
};

export const generateRecoveryPlan = (
  type: string,
  durationMinutes: number,
  setsCount: number,
  distanceKm?: number,
  sport?: string
): { intensity: 'low' | 'medium' | 'high'; steps: RecoveryStep[] } => {
  // Compute session workload intensity
  let workload = 0;
  if (type === 'running') {
    const dist = distanceKm || (durationMinutes * 0.15);
    workload = dist * 10 + durationMinutes * 0.4;
  } else {
    workload = setsCount * 6 + durationMinutes * 0.5;
  }

  let intensity: 'low' | 'medium' | 'high' = 'low';
  if (workload >= 70) intensity = 'high';
  else if (workload >= 35) intensity = 'medium';

  const steps: RecoveryStep[] = [];

  // 1. Sport-specific recovery drills (if sport has tailored mobility)
  const sportDrills = sport ? SPORT_RECOVERY_DRILLS[sport] : null;
  if (sportDrills && sportDrills.length > 0) {
    sportDrills.forEach((drill) => steps.push(drill));
  } else if (type === 'running') {
    // Fallback: generic running recovery
    steps.push({
      name: 'Quad Couch Stretch',
      duration: '2 mins per side',
      desc: 'Opens up hip flexors and quads heavily shortened during runs.'
    });
    steps.push({
      name: 'Calf & Achilles Stretch',
      duration: '90s per side',
      desc: 'Eases tension on calf muscles and Achilles tendon to maintain ankle flexibility.'
    });
  } else {
    // Fallback: generic resistance recovery
    steps.push({
      name: 'Doorway Pec Stretch',
      duration: '2 mins',
      desc: 'Restores shoulder positioning by opening tight chest fibers.'
    });
    steps.push({
      name: 'Thread the Needle',
      duration: '1 min per side',
      desc: 'Decompresses thoracic spine and opens up shoulders.'
    });
  }

  // 2. Nervous system down-regulation breathing
  if (intensity === 'high') {
    steps.push({
      name: '4-7-8 Down-Regulation Breathing',
      duration: '4 mins',
      desc: 'Inhale 4s, hold 7s, exhale 8s. Activates parasympathetic recovery response immediately.'
    });
    steps.push({
      name: 'Aggressive Hydration & Nutrient Feed',
      duration: 'Immediate',
      desc: 'Drink 600ml water + electrolytes. Consume 25-30g protein within 45 mins to accelerate tissue repair.'
    });
  } else if (intensity === 'medium') {
    steps.push({
      name: 'Box Breathing Cooldown',
      duration: '3 mins',
      desc: 'Inhale 4s, hold 4s, exhale 4s, hold 4s. Lowers heart rate and blood pressure.'
    });
    steps.push({
      name: 'Hydration Intake',
      duration: 'Within 30 mins',
      desc: 'Drink 500ml water to replace fluid loss.'
    });
  } else {
    steps.push({
      name: 'Light Static Stretches & Deep Breathing',
      duration: '2 mins',
      desc: 'Gently return body to stasis. Breathe deeply and walk slowly.'
    });
  }

  return { intensity, steps };
};
