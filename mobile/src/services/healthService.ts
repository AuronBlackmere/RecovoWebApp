/**
 * healthService.ts — Real device sync for Recovo
 *
 * iOS:     Apple HealthKit via @kingstinct/react-native-healthkit
 * Android: Google Health Connect via react-native-health-connect
 *
 * Smartwatches (Apple Watch, Garmin, Fitbit, Samsung, Polar, Whoop)
 * sync to these platform health stores automatically. Recovo reads
 * the aggregated data — no direct Bluetooth pairing needed.
 */

import { Platform } from 'react-native';

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export interface SyncResult {
  hrv: number | null;
  rhr: number | null;
  heartRate: number | null;
  sleepHours: number | null;
  sleepQuality: number;
  steps: number | null;
  source: string;
  syncedAt: number;
}

export interface HealthPermissionStatus {
  granted: boolean;
  source: string;
}

// ──────────────────────────────────────────────────────────────
// iOS — Apple HealthKit
// ──────────────────────────────────────────────────────────────

let healthkitModule: any = null;

async function getHealthKit() {
  if (Platform.OS !== 'ios') return null;
  if (healthkitModule) return healthkitModule;
  try {
    healthkitModule = await import('@kingstinct/react-native-healthkit');
    return healthkitModule;
  } catch {
    return null;
  }
}

async function requestHealthKitPermissions(): Promise<boolean> {
  const hk = await getHealthKit();
  if (!hk) return false;

  try {
    const { requestAuthorization, HKQuantityTypeIdentifier, HKCategoryTypeIdentifier } = hk;

    await requestAuthorization([
      HKQuantityTypeIdentifier.heartRate,
      HKQuantityTypeIdentifier.restingHeartRate,
      HKQuantityTypeIdentifier.heartRateVariabilitySDNN,
      HKCategoryTypeIdentifier.sleepAnalysis,
      HKQuantityTypeIdentifier.stepCount,
    ]);

    return true;
  } catch (e) {
    console.error('[HealthKit] Permission request failed:', e);
    return false;
  }
}

async function syncFromHealthKit(): Promise<SyncResult> {
  const hk = await getHealthKit();
  if (!hk) throw new Error('Apple HealthKit is not available.');

  const { queryQuantitySamples, queryCategorySamples, HKQuantityTypeIdentifier, HKCategoryTypeIdentifier } = hk;

  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const timeRange = { from: yesterday, to: now };

  // Query all health data in parallel
  const [hrSamples, rhrSamples, hrvSamples, sleepSamples, stepSamples] = await Promise.allSettled([
    queryQuantitySamples(HKQuantityTypeIdentifier.heartRate, { from: yesterday, to: now }),
    queryQuantitySamples(HKQuantityTypeIdentifier.restingHeartRate, { from: yesterday, to: now }),
    queryQuantitySamples(HKQuantityTypeIdentifier.heartRateVariabilitySDNN, { from: yesterday, to: now }),
    queryCategorySamples(HKCategoryTypeIdentifier.sleepAnalysis, { from: yesterday, to: now }),
    queryQuantitySamples(HKQuantityTypeIdentifier.stepCount, { from: yesterday, to: now }),
  ]);

  // Extract latest heart rate
  const hrRecords = hrSamples.status === 'fulfilled' ? hrSamples.value : [];
  const latestHR = hrRecords.length > 0
    ? Math.round(hrRecords[hrRecords.length - 1]?.quantity ?? 0)
    : null;

  // Extract latest resting heart rate
  const rhrRecords = rhrSamples.status === 'fulfilled' ? rhrSamples.value : [];
  const latestRHR = rhrRecords.length > 0
    ? Math.round(rhrRecords[rhrRecords.length - 1]?.quantity ?? 0)
    : null;

  // Extract latest HRV (SDNN in ms)
  const hrvRecords = hrvSamples.status === 'fulfilled' ? hrvSamples.value : [];
  const latestHRV = hrvRecords.length > 0
    ? Math.round((hrvRecords[hrvRecords.length - 1]?.quantity ?? 0) * 1000) // HealthKit returns HRV in seconds
    : null;

  // Calculate total sleep hours from sleep analysis categories
  let sleepHours: number | null = null;
  if (sleepSamples.status === 'fulfilled' && sleepSamples.value.length > 0) {
    const sleepRecords = sleepSamples.value;
    let totalSleepMs = 0;
    for (const sample of sleepRecords) {
      // value 0 = InBed, 1 = Asleep, 2 = Awake — we count InBed + Asleep
      if (sample.value !== 2) {
        const start = new Date(sample.startDate).getTime();
        const end = new Date(sample.endDate).getTime();
        totalSleepMs += end - start;
      }
    }
    sleepHours = parseFloat((totalSleepMs / (1000 * 60 * 60)).toFixed(1));
  }

  // Sum steps
  let steps: number | null = null;
  if (stepSamples.status === 'fulfilled' && stepSamples.value.length > 0) {
    steps = Math.round(stepSamples.value.reduce((sum: number, s: any) => sum + (s.quantity || 0), 0));
  }

  // Sleep quality estimate (based on total duration relative to 8hr target)
  const sleepQuality = sleepHours != null ? Math.min(100, Math.round((sleepHours / 8) * 100)) : 0;

  return {
    hrv: latestHRV,
    rhr: latestRHR,
    heartRate: latestHR,
    sleepHours,
    sleepQuality,
    steps,
    source: 'Apple HealthKit',
    syncedAt: Date.now(),
  };
}


// ──────────────────────────────────────────────────────────────
// Android — Google Health Connect
// ──────────────────────────────────────────────────────────────

let healthConnectModule: any = null;

async function getHealthConnect() {
  if (Platform.OS !== 'android') return null;
  if (healthConnectModule) return healthConnectModule;
  try {
    healthConnectModule = await import('react-native-health-connect');
    return healthConnectModule;
  } catch {
    return null;
  }
}

async function requestHealthConnectPermissions(): Promise<boolean> {
  const hc = await getHealthConnect();
  if (!hc) return false;

  try {
    const { initialize, requestPermission } = hc;

    // Initialize the Health Connect client
    await initialize();

    // Request read permissions
    const granted = await requestPermission([
      { accessType: 'read', recordType: 'HeartRate' },
      { accessType: 'read', recordType: 'RestingHeartRate' },
      { accessType: 'read', recordType: 'HeartRateVariability' },
      { accessType: 'read', recordType: 'SleepSession' },
      { accessType: 'read', recordType: 'Steps' },
    ]);

    return granted.length > 0;
  } catch (e) {
    console.error('[HealthConnect] Permission request failed:', e);
    return false;
  }
}

async function syncFromHealthConnect(): Promise<SyncResult> {
  const hc = await getHealthConnect();
  if (!hc) throw new Error('Google Health Connect is not available.');

  const { readRecords, initialize } = hc;

  await initialize();

  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const timeRangeFilter = {
    operator: 'between',
    startTime: yesterday.toISOString(),
    endTime: now.toISOString(),
  };

  // Query all health data in parallel
  const [hrResult, rhrResult, hrvResult, sleepResult, stepsResult] = await Promise.allSettled([
    readRecords('HeartRate', { timeRangeFilter }),
    readRecords('RestingHeartRate', { timeRangeFilter }),
    readRecords('HeartRateVariability', { timeRangeFilter }),
    readRecords('SleepSession', { timeRangeFilter }),
    readRecords('Steps', { timeRangeFilter }),
  ]);

  // Extract latest heart rate
  let latestHR: number | null = null;
  if (hrResult.status === 'fulfilled' && hrResult.value.records?.length > 0) {
    const records = hrResult.value.records;
    const lastRecord = records[records.length - 1];
    latestHR = lastRecord.samples?.[lastRecord.samples.length - 1]?.beatsPerMinute
      ?? Math.round(lastRecord.beatsPerMinute ?? 0);
  }

  // Extract latest resting heart rate
  let latestRHR: number | null = null;
  if (rhrResult.status === 'fulfilled' && rhrResult.value.records?.length > 0) {
    const records = rhrResult.value.records;
    latestRHR = Math.round(records[records.length - 1]?.beatsPerMinute ?? 0);
  }

  // Extract latest HRV
  let latestHRV: number | null = null;
  if (hrvResult.status === 'fulfilled' && hrvResult.value.records?.length > 0) {
    const records = hrvResult.value.records;
    latestHRV = Math.round(records[records.length - 1]?.heartRateVariabilityMillis ?? 0);
  }

  // Calculate total sleep hours
  let sleepHours: number | null = null;
  if (sleepResult.status === 'fulfilled' && sleepResult.value.records?.length > 0) {
    let totalMs = 0;
    for (const session of sleepResult.value.records) {
      const start = new Date(session.startTime).getTime();
      const end = new Date(session.endTime).getTime();
      totalMs += end - start;
    }
    sleepHours = parseFloat((totalMs / (1000 * 60 * 60)).toFixed(1));
  }

  // Sum steps
  let steps: number | null = null;
  if (stepsResult.status === 'fulfilled' && stepsResult.value.records?.length > 0) {
    steps = stepsResult.value.records.reduce((sum: number, r: any) => sum + (r.count || 0), 0);
  }

  const sleepQuality = sleepHours != null ? Math.min(100, Math.round((sleepHours / 8) * 100)) : 0;

  return {
    hrv: latestHRV,
    rhr: latestRHR,
    heartRate: latestHR,
    sleepHours,
    sleepQuality,
    steps,
    source: 'Google Health Connect',
    syncedAt: Date.now(),
  };
}


// ──────────────────────────────────────────────────────────────
// Public API — Platform-agnostic
// ──────────────────────────────────────────────────────────────

export const healthService = {
  /**
   * Check if health data APIs are available on this device
   */
  isAvailable: async (): Promise<boolean> => {
    if (Platform.OS === 'ios') {
      const hk = await getHealthKit();
      return hk != null;
    }
    if (Platform.OS === 'android') {
      const hc = await getHealthConnect();
      if (!hc) return false;
      try {
        const { getSdkStatus, SdkAvailabilityStatus, initialize } = hc;
        await initialize();
        const status = await getSdkStatus();
        return status === SdkAvailabilityStatus.SDK_AVAILABLE;
      } catch {
        return false;
      }
    }
    return false;
  },

  /**
   * Request health data permissions from the user
   */
  requestPermissions: async (): Promise<HealthPermissionStatus> => {
    if (Platform.OS === 'ios') {
      const granted = await requestHealthKitPermissions();
      return { granted, source: 'Apple HealthKit' };
    }
    if (Platform.OS === 'android') {
      const granted = await requestHealthConnectPermissions();
      return { granted, source: 'Google Health Connect' };
    }
    return { granted: false, source: 'Unsupported platform' };
  },

  /**
   * Sync biometric data from the platform health store
   * Reads: Heart Rate, Resting HR, HRV, Sleep, Steps from the last 24 hours
   */
  syncDeviceData: async (): Promise<SyncResult> => {
    if (Platform.OS === 'ios') {
      return syncFromHealthKit();
    }
    if (Platform.OS === 'android') {
      return syncFromHealthConnect();
    }
    throw new Error('Health data sync is only available on iOS and Android devices.');
  },

  /**
   * Get the platform health source name
   */
  getSourceName: (): string => {
    if (Platform.OS === 'ios') return 'Apple HealthKit';
    if (Platform.OS === 'android') return 'Google Health Connect';
    return 'Unknown';
  },
};
