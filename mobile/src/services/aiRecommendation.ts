import { UserProfile, DailyStatus, WorkoutSession, PainMarker } from './firebase';

export interface AIRecommendation {
  shouldRest: boolean;
  restReason: string;
  recoveryPlan: string;
  medicalAdvice: string;
}

export async function fetchAIRecommendations(
  profile: UserProfile | null,
  dailyStatus: DailyStatus[],
  workouts: WorkoutSession[],
  injuries: PainMarker[]
): Promise<AIRecommendation | null> {
  // Simulate network delay to make it feel like AI generation
  await new Promise(resolve => setTimeout(resolve, 1500));

  try {
    const isCoach = profile?.role === 'coach';

    const activeInjuries = injuries.filter(i => !i.resolved);
    const hasHighPain = activeInjuries.some(i => i.intensity >= 6);
    
    let shouldRest = false;
    let restReason = '';
    let recoveryPlan = '';
    let medicalAdvice = '';

    if (isCoach) {
      // Coach Team-level AI Logic
      const injuredAthletesCount = new Set(activeInjuries.map(i => i.uid)).size;
      const totalAthletes = injuredAthletesCount; // Simplified heuristic if full roster not passed
      
      if (injuredAthletesCount >= 3 || hasHighPain) {
        shouldRest = false;
        restReason = `${injuredAthletesCount} athletes are carrying active pain markers. Team injury risk is currently elevated.`;
        recoveryPlan = `Prioritize technical/tactical drills today. Implement a mandatory 20-minute squad foam rolling and banded mobility session post-practice. Keep high-speed loading to a minimum.`;
        medicalAdvice = `Check in personally with the athletes reporting high intensity pain. Consider rotating them out of contact drills.`;
      } else if (activeInjuries.length > 0) {
        shouldRest = false;
        restReason = `Minor lingering pain markers detected across the squad.`;
        recoveryPlan = `Standard practice load is approved, but allocate an extra 10 minutes to the dynamic warm-up. Ensure hydration protocols are strictly followed.`;
        medicalAdvice = `Monitor athletes reporting dull pain to ensure it doesn't escalate into a strain.`;
      } else {
        shouldRest = false;
        restReason = `Squad health looks optimal.`;
        recoveryPlan = `Green light for a high-intensity session. The team is primed for heavy tactical loading and high-speed conditioning.`;
        medicalAdvice = `No critical medical interventions needed today. Keep pushing them!`;
      }
    } else {
      // Individual Athlete AI Logic
      if (hasHighPain) {
        shouldRest = true;
        restReason = 'Active high-intensity pain detected. Training could worsen the injury.';
        recoveryPlan = 'Total rest today. Apply ice to inflamed areas for 15 minutes every few hours. Keep the affected area elevated if possible.';
        medicalAdvice = 'Since pain levels are severe, please consult a physician or physical therapist if it does not improve in 48 hours.';
      } else if (activeInjuries.length > 0) {
        shouldRest = true;
        restReason = 'You have unresolved pain markers that need time to heal.';
        recoveryPlan = 'Active recovery only. Perform light mobility work or a very slow 15-minute walk. Avoid any loading on the affected joints.';
        medicalAdvice = 'Monitor your pain. If it worsens during daily activities, stop immediately.';
      } else {
        // Analyze recent workouts and sleep
        const recentWorkouts = workouts.slice(0, 3);
        const totalRecentDuration = recentWorkouts.reduce((sum, w) => sum + (w.duration || 0), 0);
        
        let lowSleep = false;
        if (dailyStatus.length > 0) {
          const lastStatus = dailyStatus[dailyStatus.length - 1];
          if (lastStatus.sleepQuality <= 2) {
            lowSleep = true;
          }
        }

        if (totalRecentDuration > 120 && lowSleep) {
          shouldRest = true;
          restReason = 'High recent training volume combined with poor sleep recovery.';
          recoveryPlan = 'Focus strictly on down-regulation. 15 minutes of box breathing, followed by foam rolling major muscle groups (quads, lats, calves). Prioritize going to bed early tonight.';
          medicalAdvice = '';
        } else if (totalRecentDuration > 150) {
          shouldRest = false;
          restReason = '';
          recoveryPlan = 'You are carrying significant training fatigue. Consider a deload session (50% normal volume) today. Spend 10 extra minutes on your warm-up and stretch post-workout.';
          medicalAdvice = '';
        } else if (lowSleep) {
          shouldRest = false;
          restReason = '';
          recoveryPlan = 'Your sleep was subpar. Avoid max-effort lifts today. Focus on moderate intensity and ensure you are fully hydrated. Add 5 minutes of cool-down breathing.';
          medicalAdvice = '';
        } else {
          shouldRest = false;
          restReason = '';
          recoveryPlan = 'You are fully primed and recovered. Green light for a high-intensity session today. Go crush it!';
          medicalAdvice = '';
        }
      }
    }

    return {
      shouldRest,
      restReason,
      recoveryPlan,
      medicalAdvice,
    };
  } catch (error) {
    console.error('Error generating AI recommendations locally:', error);
    return null;
  }
}
