import { Platform } from 'react-native';

let AppleHealthKit: any;
let HealthConnect: any;

try {
  if (Platform.OS === 'ios') {
    AppleHealthKit = require('@kingstinct/react-native-healthkit').default;
  } else if (Platform.OS === 'android') {
    HealthConnect = require('react-native-health-connect');
  }
} catch (e) {
  console.warn('Native health modules not available in this environment.');
}

export interface HealthData {
  hrv: number | null;
  rhr: number | null;
  sleepHours: number | null;
  device: string;
}

export const fetchNativeHealthData = async (): Promise<HealthData | null> => {
  if (Platform.OS === 'web') {
    // Return standard baseline on Web for testing
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          hrv: 55,
          rhr: 60,
          sleepHours: 8.0,
          device: 'Web Baseline',
        });
      }, 1000);
    });
  }

  try {
    if (Platform.OS === 'ios' && AppleHealthKit) {
      const isAvailable = await AppleHealthKit.isHealthDataAvailable();
      if (!isAvailable) throw new Error('HealthKit not available');

      await AppleHealthKit.requestAuthorization([
        AppleHealthKit.HKQuantityTypeIdentifier.restingHeartRate,
        AppleHealthKit.HKQuantityTypeIdentifier.heartRateVariabilitySDNN,
        AppleHealthKit.HKCategoryTypeIdentifier.sleepAnalysis,
      ]);

      const [rhrRecords, hrvRecords, sleepRecords] = await Promise.all([
        AppleHealthKit.queryQuantitySamples(AppleHealthKit.HKQuantityTypeIdentifier.restingHeartRate, { limit: 1 }),
        AppleHealthKit.queryQuantitySamples(AppleHealthKit.HKQuantityTypeIdentifier.heartRateVariabilitySDNN, { limit: 1 }),
        AppleHealthKit.queryCategorySamples(AppleHealthKit.HKCategoryTypeIdentifier.sleepAnalysis, { limit: 1 }),
      ]);

      const rhr = rhrRecords.length ? rhrRecords[0].quantity : 65;
      const hrv = hrvRecords.length ? hrvRecords[0].quantity : 45;
      let sleepHours = 7.5;
      
      if (sleepRecords.length) {
        sleepHours = (new Date(sleepRecords[0].endDate).getTime() - new Date(sleepRecords[0].startDate).getTime()) / 3600000;
      }

      return {
        hrv: Math.round(hrv as number),
        rhr: Math.round(rhr as number),
        sleepHours: parseFloat((sleepHours as number).toFixed(1)),
        device: 'Apple Health',
      };
    } else if (Platform.OS === 'android' && HealthConnect) {
      const isAvailable = await HealthConnect.isAvailable();
      if (!isAvailable) throw new Error('Health Connect not available');

      await HealthConnect.requestPermission([
        { accessType: 'read', recordType: 'RestingHeartRate' },
        { accessType: 'read', recordType: 'HeartRateVariabilityRmssd' },
        { accessType: 'read', recordType: 'SleepSession' }
      ]);

      const now = Date.now();
      const yesterday = new Date(now - 86400000).toISOString();
      const today = new Date(now).toISOString();

      const [rhrData, hrvData, sleepData] = await Promise.all([
        HealthConnect.readRecords('RestingHeartRate', { timeRangeFilter: { operator: 'between', startTime: yesterday, endTime: today } }),
        HealthConnect.readRecords('HeartRateVariabilityRmssd', { timeRangeFilter: { operator: 'between', startTime: yesterday, endTime: today } }),
        HealthConnect.readRecords('SleepSession', { timeRangeFilter: { operator: 'between', startTime: yesterday, endTime: today } }),
      ]);

      const rhr = rhrData.records.length ? rhrData.records[0].beatsPerMinute : 65;
      const hrv = hrvData.records.length ? hrvData.records[0].heartRateVariabilityMillis : 45;
      
      let sleepHours = 7.5;
      if (sleepData.records.length) {
        const sleep = sleepData.records[0];
        sleepHours = (new Date(sleep.endTime).getTime() - new Date(sleep.startTime).getTime()) / 3600000;
      }

      return {
        hrv: Math.round(hrv),
        rhr: Math.round(rhr),
        sleepHours: parseFloat(sleepHours.toFixed(1)),
        device: 'Health Connect',
      };
    }
  } catch (error) {
    console.error('Native Health Sync Error:', error);
    throw error;
  }
  
  return null;
};
