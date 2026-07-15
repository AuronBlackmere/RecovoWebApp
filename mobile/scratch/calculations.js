"use strict";
// ─── MET Calorie Calculation ─────────────────────────────────────────────────
// Calories = MET × weight(kg) × duration(hours)
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateRecoveryPlan = exports.generateInjuryPreventionRoutine = exports.calculateVulnerabilities = exports.BODY_KEYS = exports.formatDate = exports.formatDuration = exports.calculateStreak = exports.runKineticAlertEngine = exports.getReadinessLabel = exports.calculateRecoveryScore = exports.calculateReadiness = exports.calculateCalories = exports.MET_VALUES = void 0;
exports.MET_VALUES = {
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
const calculateCalories = (metKey, weightKg, durationMinutes) => {
    var _a;
    const met = (_a = exports.MET_VALUES[metKey]) !== null && _a !== void 0 ? _a : 5.0;
    return Math.round(met * weightKg * (durationMinutes / 60));
};
exports.calculateCalories = calculateCalories;
// ─── Readiness Score ──────────────────────────────────────────────────────────
// Readiness = (Recovery × 0.7) - (Pain × 0.3)
const calculateReadiness = (recoveryScore, painScore) => {
    const raw = recoveryScore * 0.7 - painScore * 0.3;
    return Math.max(0, Math.min(100, Math.round(raw)));
};
exports.calculateReadiness = calculateReadiness;
const calculateRecoveryScore = (hrv, rhr, sleepHours) => {
    // HRV: higher = better (norm 20–60ms)
    const hrvScore = Math.min(100, (hrv / 60) * 100);
    // RHR: lower = better (norm 40–100 bpm)
    const rhrScore = Math.max(0, Math.min(100, ((100 - rhr) / 60) * 100));
    // Sleep: target 8hrs
    const sleepScore = Math.min(100, (sleepHours / 8) * 100);
    return Math.round((hrvScore * 0.4 + rhrScore * 0.3 + sleepScore * 0.3));
};
exports.calculateRecoveryScore = calculateRecoveryScore;
const getReadinessLabel = (score, t) => {
    if (score >= 85)
        return { label: t.eliteReady || 'ELITE READY', color: '#00FFA3' };
    if (score >= 70)
        return { label: t.ready || 'READY', color: '#00E5FF' };
    if (score >= 55)
        return { label: t.moderate || 'MODERATE', color: '#FFD600' };
    if (score >= 40)
        return { label: t.low || 'LOW', color: '#FF6B35' };
    return { label: t.critical || 'CRITICAL', color: '#FF1744' };
};
exports.getReadinessLabel = getReadinessLabel;
const runKineticAlertEngine = (readiness, painScore, recentWorkoutMinutes, t) => {
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
exports.runKineticAlertEngine = runKineticAlertEngine;
// ─── Streak Calculation ───────────────────────────────────────────────────────
const calculateStreak = (sessionDates) => {
    if (sessionDates.length === 0)
        return 0;
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
        }
        else {
            break;
        }
    }
    return streak;
};
exports.calculateStreak = calculateStreak;
// ─── Format helpers ───────────────────────────────────────────────────────────
const formatDuration = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0)
        return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};
exports.formatDuration = formatDuration;
const formatDate = (timestamp) => new Date(timestamp).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
});
exports.formatDate = formatDate;
exports.BODY_KEYS = [
    'Head', 'Neck', 'Shoulder', 'Chest', 'Upper Back', 'Core', 'Lower Back',
    'Hip', 'Quad', 'Hamstring', 'Knee', 'Calf', 'Lower Leg', 'Foot', 'Ankle', 'Elbow'
];
const calculateVulnerabilities = (workouts, injuries) => {
    // Initialize default states
    const partMap = {};
    for (const key of exports.BODY_KEYS) {
        partMap[key] = { score: 0, reasons: [] };
    }
    // 1. Process active logged pain points
    const activeInjuries = injuries.filter((i) => !i.resolved);
    for (const i of activeInjuries) {
        if (partMap[i.bodyPart]) {
            const pScore = 65 + (i.intensity || 5) * 3.5;
            partMap[i.bodyPart].score = Math.max(partMap[i.bodyPart].score, pScore);
            partMap[i.bodyPart].reasons.push(`Active Pain: ${i.painType.toUpperCase()} (intensity ${i.intensity || 5}/10)`);
        }
    }
    // 2. Process workload fatigue from recent workouts (last 5 days)
    const now = Date.now();
    const recentWorkouts = workouts.filter((w) => now - w.date <= 5 * 24 * 60 * 60 * 1000);
    for (const w of recentWorkouts) {
        const isRunning = w.type === 'running' || !w.sets || w.sets.some((s) => { var _a; return (_a = s.exercise) === null || _a === void 0 ? void 0 : _a.toLowerCase().includes('run'); });
        if (isRunning) {
            // Lower body fatigue
            const dur = w.duration || 30;
            const add = dur > 45 ? 25 : 15;
            for (const key of ['Knee', 'Foot', 'Ankle', 'Calf', 'Lower Leg']) {
                partMap[key].score += add;
                partMap[key].reasons.push(`Workload: Running (${dur} mins)`);
            }
        }
        else {
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
    // 3. Compile, scale, and label level
    return exports.BODY_KEYS.map((key) => {
        const raw = partMap[key];
        const score = Math.min(100, Math.round(raw.score));
        let level = 'healthy';
        if (score >= 80)
            level = 'critical';
        else if (score >= 50)
            level = 'high';
        else if (score >= 25)
            level = 'medium';
        else if (score > 0)
            level = 'low';
        // Group matching reasons to avoid list clutter
        const uniqueReasonsSet = new Set(raw.reasons);
        const reasonText = uniqueReasonsSet.size > 0
            ? Array.from(uniqueReasonsSet).slice(0, 2).join(' | ')
            : 'No fatigue or active pain';
        return {
            bodyPart: key,
            level,
            reason: reasonText,
            score,
        };
    });
};
exports.calculateVulnerabilities = calculateVulnerabilities;
const PREVENTION_DATABASE = {
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
const generateInjuryPreventionRoutine = (type, exercises, vulnerabilities) => {
    const routine = [];
    const addedParts = new Set();
    // 1. Prioritize parts with active vulnerabilities (score >= 25)
    const priorityParts = vulnerabilities
        .filter((v) => v.score >= 25)
        .sort((a, b) => b.score - a.score);
    for (const vp of priorityParts) {
        const drills = PREVENTION_DATABASE[vp.bodyPart];
        if (drills) {
            addedParts.add(vp.bodyPart);
            drills.forEach((drill) => {
                let warning;
                let reps = drill.reps;
                if (vp.level === 'critical') {
                    warning = `⚠️ INTENSITY CAP: Lower workout weight by 40-50% to protect your ${vp.bodyPart}.`;
                    reps = '2 sets x 8-10 reps (Light)';
                }
                else if (vp.level === 'high') {
                    warning = `⚠️ WARNING: Monitor your ${vp.bodyPart}. Limit heavy load.`;
                    reps = '2 sets x 10-12 reps';
                }
                routine.push(Object.assign(Object.assign({}, drill), { reps,
                    warning }));
            });
        }
    }
    // 2. Add base activation drills based on session type if routine is short
    if (routine.length < 3) {
        if (type === 'running') {
            const kneeDrills = PREVENTION_DATABASE['Knee'] || [];
            const ankleDrills = PREVENTION_DATABASE['Ankle'] || [];
            kneeDrills.concat(ankleDrills).forEach((d) => {
                if (routine.length < 4)
                    routine.push(d);
            });
        }
        else if (type === 'weightlifting') {
            const shoulderDrills = PREVENTION_DATABASE['Shoulder'] || [];
            const backDrills = PREVENTION_DATABASE['Lower Back'] || [];
            shoulderDrills.concat(backDrills).forEach((d) => {
                if (routine.length < 4)
                    routine.push(d);
            });
        }
        else { // calisthenics or general
            const shoulderDrills = PREVENTION_DATABASE['Shoulder'] || [];
            const hipDrills = PREVENTION_DATABASE['Hip'] || [];
            shoulderDrills.concat(hipDrills).forEach((d) => {
                if (routine.length < 4)
                    routine.push(d);
            });
        }
    }
    return routine;
};
exports.generateInjuryPreventionRoutine = generateInjuryPreventionRoutine;
const generateRecoveryPlan = (type, durationMinutes, setsCount, distanceKm) => {
    // Compute session workload intensity
    let workload = 0;
    if (type === 'running') {
        const dist = distanceKm || (durationMinutes * 0.15); // estimation if no distance
        workload = dist * 10 + durationMinutes * 0.4;
    }
    else {
        workload = setsCount * 6 + durationMinutes * 0.5;
    }
    let intensity = 'low';
    if (workload >= 70)
        intensity = 'high';
    else if (workload >= 35)
        intensity = 'medium';
    const steps = [];
    // 1. Mobility drill suggestion matching session type
    if (type === 'running') {
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
    }
    else {
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
    }
    else if (intensity === 'medium') {
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
    }
    else {
        steps.push({
            name: 'Light Static Stretches & Deep Breathing',
            duration: '2 mins',
            desc: 'Gently return body to stasis. Breathe deeply and walk slowly.'
        });
    }
    return { intensity, steps };
};
exports.generateRecoveryPlan = generateRecoveryPlan;
