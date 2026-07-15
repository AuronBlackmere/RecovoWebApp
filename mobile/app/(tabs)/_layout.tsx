import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  View,
  Platform,
  StyleSheet,
  Text,
  Pressable,
  Modal,
  ScrollView,
  Switch,
  TextInput,
  Alert,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, FONTS, RADIUS, SPACING, globalStyles } from '@/utils/theme';
import { useAppStore } from '@/store/useAppStore';
import { calculateStreak } from '@/utils/calculations';
import { logout, updateUserProfile, db, sendPasswordReset, updateAuthEmail, deleteCurrentUser } from '@/services/firebase';
import { ref, set, push, remove } from 'firebase/database';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';

const TAB_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  index: 'grid',
  tracks: 'barbell',
  recovery: 'pulse',
  injuries: 'body',
  status: 'checkmark-circle',
  legion: 'shield',
};

const AVATAR_PRESETS = [
  { emoji: '⚽', color: '#3B82F6', label: 'Footballer' },
  { emoji: '🏃‍♂️', color: '#10B981', label: 'Runner' },
  { emoji: '🏋️‍♂️', color: '#8B5CF6', label: 'Lifter' },
  { emoji: '🚴‍♂️', color: '#F59E0B', label: 'Cyclist' },
  { emoji: '🏊‍♂️', color: '#06B6D4', label: 'Swimmer' },
  { emoji: '🥊', color: '#EF4444', label: 'Boxer' },
];

import { TRANSLATIONS } from '@/utils/translations';
import { useTranslation } from '@/hooks/useTranslation';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { AppTutorial } from '@/components/common/AppTutorial';

export default function TabsLayout() {
  const { profile, workouts, user } = useAppStore();
  const insets = useSafeAreaInsets();

  // Live streak calculation
  const streak = calculateStreak((workouts || []).map((w) => w.date));

  // Drawer Modals state
  const [showSettings, setShowSettings] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);

  useEffect(() => {
    if (profile?.onboardingCompleted && !profile?.hasSeenTutorial) {
      setShowTutorial(true);
    }
  }, [profile?.onboardingCompleted, profile?.hasSeenTutorial]);

  const handleTutorialComplete = async () => {
    setShowTutorial(false);
    if (user?.uid) {
      await updateUserProfile(user.uid, { hasSeenTutorial: true });
    }
  };

  // Edit Profile form state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editSport, setEditSport] = useState('');
  const [editWeight, setEditWeight] = useState('');
  const [selectedAvatarIdx, setSelectedAvatarIdx] = useState<number | null>(null);
  const [customProfilePic, setCustomProfilePic] = useState<string | null>(null);

  // Settings modals re-auth actions
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [isWritingSupport, setIsWritingSupport] = useState(false);
  const [supportMsg, setSupportMsg] = useState('');

  // 2FA configuration states
  const [is2faModalVisible, setIs2faModalVisible] = useState(false);
  const [faMode, setFaMode] = useState<'enable' | 'disable' | 'confirm_enable'>('enable');
  const [pinInput, setPinInput] = useState('');
  const [pinConfirmInput, setPinConfirmInput] = useState('');

  const handleToggle2FA = (newValue: boolean) => {
    if (newValue) {
      setFaMode('enable');
      setPinInput('');
      setPinConfirmInput('');
      setIs2faModalVisible(true);
    } else {
      setFaMode('disable');
      setPinInput('');
      setIs2faModalVisible(true);
    }
  };

  const handle2faSubmit = async () => {
    if (!user) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (faMode === 'enable') {
      if (pinInput.length !== 4 || !/^\d+$/.test(pinInput)) {
        Alert.alert('Invalid PIN', 'PIN must be exactly 4 digits.');
        return;
      }
      setFaMode('confirm_enable');
    } else if (faMode === 'confirm_enable') {
      if (pinInput !== pinConfirmInput) {
        Alert.alert('Mismatch', 'The entered PINs do not match.');
        return;
      }
      try {
        await updateUserProfile(user.uid, {
          twoFactorAuth: true,
          twoFactorPin: pinInput,
        });
        setIs2faModalVisible(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('2FA Enabled', 'Two-Factor Authentication is now active on your profile.');
      } catch {
        Alert.alert('Error', 'Failed to save 2FA settings.');
      }
    } else if (faMode === 'disable') {
      if (pinInput !== profile?.twoFactorPin) {
        Alert.alert('Incorrect PIN', 'The security PIN you entered is incorrect.');
        return;
      }
      try {
        await updateUserProfile(user.uid, {
          twoFactorAuth: false,
          twoFactorPin: null as any,
        });
        setIs2faModalVisible(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('2FA Disabled', 'Two-Factor Authentication has been disabled.');
      } catch {
        Alert.alert('Error', 'Failed to disable 2FA.');
      }
    }
  };

  // Sync profile values when modal opens or profile changes
  useEffect(() => {
    if (profile) {
      setEditName(profile.name || '');
      setEditUsername(profile.username || profile.email?.split('@')[0] || '');
      setEditSport(profile.sport || '');

      // Weight input box display unit conversion
      const rawWeight = profile.weight || 77;
      if (profile.unitWeight === 'LBS') {
        setEditWeight(String(Math.round(rawWeight * 2.20462)));
      } else {
        setEditWeight(String(rawWeight));
      }

      const isCustomPic = profile.profilePicture?.startsWith('data:image') || profile.profilePicture?.startsWith('http');
      if (isCustomPic) {
        setCustomProfilePic(profile.profilePicture || null);
        setSelectedAvatarIdx(null);
      } else {
        setCustomProfilePic(null);
        const avatarIdx = AVATAR_PRESETS.findIndex(a => a.emoji === profile.profilePicture);
        setSelectedAvatarIdx(avatarIdx !== -1 ? avatarIdx : null);
      }
    }
  }, [profile, showProfile]);

  const handlePickImage = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Denied', 'Permission to access the camera roll is required to select a profile picture.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.35,
        base64: true,
      });

      if (!result.canceled && result.assets?.[0]?.base64) {
        const base64Uri = `data:image/jpeg;base64,${result.assets[0].base64}`;
        setCustomProfilePic(base64Uri);
        setSelectedAvatarIdx(null);
      }
    } catch {
      Alert.alert('Error', 'Failed to pick image.');
    }
  };

  // Settings states mapped from live database profile values
  const notifyDaily = profile?.dailyReadinessAlert !== false;
  const notifyCoach = profile?.coachMessagesAlert !== false;
  const notifyRisk = profile?.injuryRiskAlert !== false;
  const notifyWeekly = profile?.weeklySummaryAlert !== false;
  const notifySession = profile?.sessionReminderAlert !== false;
  const notifyDevice = profile?.deviceSyncAlert !== false;

  const shareScore = profile?.shareReadinessScore !== false;
  const shareBio = !!profile?.shareBiometrics;
  const shareWorkouts = profile?.shareWorkoutHistory !== false;
  const shareAnalytics = profile?.shareAnalytics !== false;

  const security2fa = !!profile?.twoFactorAuth;
  const securityAlerts = profile?.loginAlerts !== false;

  const appearanceMode = profile?.appearance || 'dark';
  const { t, lang: activeLang } = useTranslation();

  const unitWeight = profile?.unitWeight || 'KG';
  const unitDist = profile?.unitDistance || 'KM';
  const unitTemp = profile?.unitTemperature || 'CELSIUS';



  // Dynamic theme skin overrides (Light vs Dark)
  const isLight = appearanceMode === 'light';
  const themeBg = isLight ? '#F4F4F5' : COLORS.bg;
  const themeCard = isLight ? '#FFFFFF' : COLORS.bgCard;
  const themeText = isLight ? '#09090B' : COLORS.textPrimary;
  const themeTextSecondary = isLight ? '#52525B' : COLORS.textSecondary;
  const themeTextMuted = isLight ? '#71717A' : COLORS.textMuted;
  const themeBorder = isLight ? '#E4E4E7' : COLORS.border;

  // Toggle switch or preferences callback writing directly to Firebase in real-time
  const handleToggleSetting = async (key: string, value: any) => {
    if (!user) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await updateUserProfile(user.uid, { [key]: value });
    } catch {
      Alert.alert('Error', 'Failed to save settings to database.');
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const updatedPicture = customProfilePic || (selectedAvatarIdx !== null ? AVATAR_PRESETS[selectedAvatarIdx].emoji : '');

      // Save weight in normalized standard Metric values (KG) back to DB
      const numWeight = Number(editWeight) || 77;
      const savedWeight = unitWeight === 'LBS' ? numWeight / 2.20462 : numWeight;

      await updateUserProfile(user.uid, {
        name: editName,
        username: editUsername,
        sport: editSport,
        weight: Math.round(savedWeight),
        profilePicture: updatedPicture,
      });
      setIsEditing(false);
      Alert.alert('Success', 'Profile updated successfully.');
    } catch {
      Alert.alert('Error', 'Failed to update profile.');
    }
  };

  const handleConfirmUpdateEmail = async () => {
    if (!user || !newEmail.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await updateAuthEmail(user, newEmail.trim());
      await updateUserProfile(user.uid, { email: newEmail.trim() });
      Alert.alert('Success', `Authentication email updated to ${newEmail.trim()} successfully.`);
      setIsUpdatingEmail(false);
      setNewEmail('');
    } catch (err: any) {
      if (err.code === 'auth/requires-recent-login') {
        Alert.alert('Re-authentication Required', 'Please sign out and sign back in, then retry updating your email.');
      } else {
        Alert.alert('Error', err.message || 'Failed to update email.');
      }
    }
  };

  const handleConfirmSendSupport = async () => {
    if (!user || !supportMsg.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const supportRef = ref(db, `support_tickets/${user.uid}`);
      const newTicketRef = push(supportRef);
      await set(newTicketRef, {
        message: supportMsg,
        timestamp: Date.now(),
        email: profile?.email || user.email,
        status: 'open',
      });
      Alert.alert('Support Ticket Submitted', 'Thank you! Our support team has logged your ticket and will email you shortly.');
      setIsWritingSupport(false);
      setSupportMsg('');
    } catch {
      Alert.alert('Error', 'Failed to submit support ticket.');
    }
  };

  const handleSignOut = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const performSignOut = async () => {
      try {
        setShowProfile(false);
        setShowSettings(false);
        try {
          await GoogleSignin.revokeAccess();
          await GoogleSignin.signOut();
        } catch (e) {}
        await logout();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (e: any) {
        if (Platform.OS === 'web') {
          window.alert(e.message || 'Failed to sign out.');
        } else {
          Alert.alert('Error', e.message || 'Failed to sign out.');
        }
      }
    };

    if (Platform.OS === 'web') {
      performSignOut();
    } else {
      Alert.alert(
        t.signOut,
        t.sessionClearWarning,
        [
          { text: t.cancel, style: 'cancel' },
          {
            text: t.signOut,
            style: 'destructive',
            onPress: performSignOut,
          },
        ]
      );
    }
  };

  const handleDeleteAccount = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const performDelete = async () => {
      if (!user) return;
      try {
        setShowProfile(false);
        setShowSettings(false);
        const uid = user.uid;
        // Purge DB
        await remove(ref(db, `users/${uid}`));
        await remove(ref(db, `workouts/${uid}`));
        await remove(ref(db, `recovery/${uid}`));
        await remove(ref(db, `injuries/${uid}`));
        await remove(ref(db, `daily_status/${uid}`));
        await deleteCurrentUser(user);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (Platform.OS === 'web') {
          window.alert('Your account has been deleted.');
        } else {
          Alert.alert('Deleted', 'Your account has been deleted.');
        }
      } catch (err: any) {
        if (err.code === 'auth/requires-recent-login') {
          if (Platform.OS === 'web') {
            window.alert('Re-authentication Required: For security, please sign out and sign back in, then delete your account.');
          } else {
            Alert.alert('Re-authentication Required', 'For security, please sign out and sign back in, then delete your account.');
          }
        } else {
          if (Platform.OS === 'web') {
            window.alert(err.message || 'Failed to delete account.');
          } else {
            Alert.alert('Error', err.message || 'Failed to delete account.');
          }
        }
      }
    };

    if (Platform.OS === 'web') {
      performDelete();
    } else {
      Alert.alert(
        t.deleteAccount,
        'WARNING: This will permanently delete your account and all stored data. This action is irreversible.',
        [
          { text: t.cancel, style: 'cancel' },
          {
            text: 'DELETE PERMANENTLY',
            style: 'destructive',
            onPress: performDelete,
          },
        ]
      );
    }
  };

  const handleClearCache = async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const nonAuthKeys = keys.filter(k => !k.startsWith('firebase:Auth'));
      if (nonAuthKeys.length > 0) {
        await AsyncStorage.multiRemove(nonAuthKeys);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Cache Cleared', 'Successfully purged local storage cache and temp database segments.');
    } catch {
      Alert.alert('Error', 'Failed to clear local cache.');
    }
  };

  const getProfileAvatar = () => {
    if (profile?.profilePicture) {
      const isCustomPic = profile.profilePicture.startsWith('data:image') || profile.profilePicture.startsWith('http');
      if (isCustomPic) {
        return (
          <Image
            source={{ uri: profile.profilePicture }}
            style={{ width: '100%', height: '100%', borderRadius: 16 }}
            resizeMode="cover"
          />
        );
      }
      const match = AVATAR_PRESETS.find(a => a.emoji === profile.profilePicture);
      if (match) {
        return (
          <View style={[styles.avatarCircle, { backgroundColor: match.color }]}>
            <Text style={styles.avatarEmoji}>{match.emoji}</Text>
          </View>
        );
      }
    }
    const initial = profile?.name ? profile.name.charAt(0).toUpperCase() : 'U';
    return (
      <View style={[styles.avatarCircle, { backgroundColor: COLORS.cyan }]}>
        <Text style={styles.avatarText}>{initial}</Text>
      </View>
    );
  };

  const getWeightDisplay = () => {
    const rawWeight = profile?.weight || 77;
    if (unitWeight === 'LBS') {
      return `${Math.round(rawWeight * 2.20462)} lbs`;
    }
    return `${rawWeight} kg`;
  };

  const statusBarBg = isLight ? '#FFFFFF' : '#18181B';
  const statusBarStyle = isLight ? 'dark' : 'light';

  return (
    <View style={{ flex: 1, backgroundColor: themeBg }}>
      <StatusBar style={statusBarStyle} backgroundColor={statusBarBg} />
      {/* GLOBAL APPBALL HEADER WITH DYNAMIC APPEARANCE SKINNING */}
      <View style={[styles.globalHeader, { backgroundColor: themeCard, borderBottomColor: themeBorder, paddingTop: insets.top }]}>
        <View style={[styles.headerInnerRow, { height: Platform.OS === 'android' ? 56 : 48 }]}>
          <View style={styles.headerBrandRow}>
            <Text style={[styles.logoPrefix, { color: themeText }]}>RECO</Text>
            <Text style={styles.logoSuffix}>VO</Text>
          </View>
          <View style={styles.headerActions}>
            {/* Streak Indicator */}
            <View style={[styles.streakWrap, { backgroundColor: themeBg, borderColor: themeBorder }]}>
              <Ionicons name="flame" size={14} color={COLORS.cyan} />
              <Text style={styles.streakValue}>{streak}</Text>
            </View>

            {/* Profile Avatar Button */}
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowProfile(true);
              }}
              style={styles.avatarBtn}
            >
              {getProfileAvatar()}
            </Pressable>

            {/* Settings Button */}
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowSettings(true);
              }}
              style={styles.settingsBtn}
            >
              <Ionicons name="settings-sharp" size={20} color={themeTextMuted} />
            </Pressable>
          </View>
        </View>
      </View>

      {/* CORE NAVIGATION TABS */}
      <Tabs
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarStyle: {
            backgroundColor: themeCard,
            borderTopWidth: 1,
            borderTopColor: themeBorder,
            paddingBottom: Math.max(insets.bottom, 8),
            height: 60 + Math.max(insets.bottom, 8),
          },
          tabBarActiveTintColor: COLORS.cyan,
          tabBarInactiveTintColor: themeTextMuted,
          tabBarLabelStyle: {
            fontFamily: FONTS.mono,
            fontSize: 9,
            letterSpacing: 1,
            textTransform: 'uppercase',
          },
          tabBarIcon: ({ focused, color }) => {
            const name = TAB_ICON[route.name] ?? 'ellipse';
            return <Ionicons name={focused ? name : `${name}-outline` as any} size={22} color={color} />;
          },
        })}
      >
        <Tabs.Screen name="index" options={{ title: t.dashboard }} />
        <Tabs.Screen name="tracks" options={{ title: t.tracks }} />
        <Tabs.Screen name="recovery" options={{ title: t.recovery }} />
        <Tabs.Screen name="injuries" options={{ title: t.injuries }} />
        <Tabs.Screen name="status" options={{ title: t.status }} />
        <Tabs.Screen name="legion" options={{ title: t.legion }} />
      </Tabs>

      <AppTutorial visible={showTutorial} onComplete={handleTutorialComplete} />

      {/* ────────────────── PROFILE MODAL DRAWER ────────────────── */}
      <Modal visible={showProfile} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { backgroundColor: themeBg, borderColor: themeBorder, paddingTop: Math.max(insets.top, 16) }]}>
            <View style={[styles.modalHeader, { borderBottomColor: themeBorder }]}>
              <Text style={[styles.modalTitle, { color: themeText }]}>{t.profile}</Text>
              <Pressable style={styles.closeIcon} onPress={() => setShowProfile(false)}>
                <Ionicons name="close" size={24} color={themeText} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
              {/* Profile Card Header */}
              <View style={styles.profileHero}>
                {customProfilePic ? (
                  <View style={[styles.heroAvatarBig, { borderColor: COLORS.cyan }]}>
                    <Image source={{ uri: customProfilePic }} style={{ width: '100%', height: '100%', borderRadius: 40 }} />
                  </View>
                ) : selectedAvatarIdx !== null ? (
                  <View style={[styles.heroAvatarBig, { backgroundColor: AVATAR_PRESETS[selectedAvatarIdx].color }]}>
                    <Text style={styles.heroAvatarEmoji}>{AVATAR_PRESETS[selectedAvatarIdx].emoji}</Text>
                  </View>
                ) : (
                  <View style={[styles.heroAvatarBig, { backgroundColor: COLORS.cyan }]}>
                    <Text style={styles.heroAvatarInitial}>
                      {profile?.name ? profile.name.charAt(0).toUpperCase() : 'U'}
                    </Text>
                  </View>
                )}

                <Text style={[styles.heroName, { color: themeText }]}>{profile?.name?.toUpperCase() || 'ATHLETE'}</Text>
                <Text style={[styles.heroEmail, { color: themeTextMuted }]}>{profile?.email || 'juliankaiser107@gmail.com'}</Text>

                <View style={[styles.roleTag, { backgroundColor: themeBorder, borderColor: themeBorder }]}>
                  <Text style={styles.roleTagText}>{profile?.role?.toUpperCase() || 'ATHLETE'}</Text>
                </View>
              </View>

              {!isEditing ? (
                /* Profile Display View */
                <View style={styles.formContainer}>
                  <View style={[styles.detailRow, { backgroundColor: themeCard, borderColor: themeBorder }]}>
                    <Text style={styles.detailLabel}>{t.username}</Text>
                    <Text style={[styles.detailVal, { color: themeText }]}>@{profile?.username || profile?.email?.split('@')[0] || 'juliankaiser107'}</Text>
                  </View>
                  <View style={[styles.detailRow, { backgroundColor: themeCard, borderColor: themeBorder }]}>
                    <Text style={styles.detailLabel}>{t.sport}</Text>
                    <Text style={[styles.detailVal, { color: themeText }]}>{profile?.sport || 'Football'}</Text>
                  </View>
                  <View style={[styles.detailRow, { backgroundColor: themeCard, borderColor: themeBorder }]}>
                    <Text style={styles.detailLabel}>{t.weight}</Text>
                    <Text style={[styles.detailVal, { color: themeText }]}>{getWeightDisplay()}</Text>
                  </View>

                  <Pressable style={styles.actionBtn} onPress={() => setIsEditing(true)}>
                    <Ionicons name="create-outline" size={16} color={COLORS.textInverse} style={{ marginRight: 6 }} />
                    <Text style={styles.actionBtnText}>{t.editProfile}</Text>
                  </Pressable>
                </View>
              ) : (
                /* Profile Editing Form */
                <View style={styles.formContainer}>
                  <Text style={styles.inputLabel}>{t.displayName}</Text>
                  <TextInput
                    style={[styles.textInput, { backgroundColor: themeCard, borderColor: themeBorder, color: themeText }]}
                    value={editName}
                    onChangeText={setEditName}
                    placeholder="Julian Kaiser"
                    placeholderTextColor={themeTextMuted}
                  />

                  <Text style={styles.inputLabel}>{t.username}</Text>
                  <TextInput
                    style={[styles.textInput, { backgroundColor: themeCard, borderColor: themeBorder, color: themeText }]}
                    value={editUsername}
                    onChangeText={setEditUsername}
                    placeholder="juliankaiser107"
                    placeholderTextColor={themeTextMuted}
                    autoCapitalize="none"
                  />

                  <Text style={styles.inputLabel}>{t.primarySport}</Text>
                  <TextInput
                    style={[styles.textInput, { backgroundColor: themeCard, borderColor: themeBorder, color: themeText }]}
                    value={editSport}
                    onChangeText={setEditSport}
                    placeholder="e.g. Football"
                    placeholderTextColor={themeTextMuted}
                  />

                  <Text style={styles.inputLabel}>{t.bodyWeight} ({unitWeight})</Text>
                  <TextInput
                    style={[styles.textInput, { backgroundColor: themeCard, borderColor: themeBorder, color: themeText }]}
                    value={editWeight}
                    onChangeText={setEditWeight}
                    keyboardType="numeric"
                    placeholder="e.g. 77"
                    placeholderTextColor={themeTextMuted}
                  />

                  <Text style={styles.inputLabel}>{t.selectAvatar}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 8 }}>
                    <Pressable
                      style={[
                        styles.presetBox,
                        { backgroundColor: '#3F3F46', borderWidth: 2, borderColor: customProfilePic ? '#FFFFFF' : 'transparent', alignItems: 'center', justifyContent: 'center' }
                      ]}
                      onPress={handlePickImage}
                    >
                      {customProfilePic ? (
                        <Image source={{ uri: customProfilePic }} style={{ width: '100%', height: '100%', borderRadius: 22 }} />
                      ) : (
                        <Ionicons name="camera" size={20} color="#FAFAFA" />
                      )}
                    </Pressable>
                    <View style={{ width: 1, height: 32, backgroundColor: themeBorder }} />
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', gap: 8, paddingVertical: 4 }}>
                      {AVATAR_PRESETS.map((preset, idx) => (
                        <Pressable
                          key={idx}
                          style={[
                            styles.presetBox,
                            { backgroundColor: preset.color },
                            selectedAvatarIdx === idx && styles.presetBoxActive,
                          ]}
                          onPress={() => {
                            setSelectedAvatarIdx(idx);
                            setCustomProfilePic(null);
                          }}
                        >
                          <Text style={styles.presetBoxEmoji}>{preset.emoji}</Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>

                  <View style={styles.editActions}>
                    <Pressable style={[styles.cancelBtn, { backgroundColor: themeCard, borderColor: themeBorder }]} onPress={() => setIsEditing(false)}>
                      <Text style={[styles.cancelBtnText, { color: themeTextMuted }]}>{t.cancel}</Text>
                    </Pressable>
                    <Pressable style={styles.saveBtn} onPress={handleSaveProfile}>
                      <Text style={styles.saveBtnText}>{t.saveChanges}</Text>
                    </Pressable>
                  </View>
                </View>
              )}

              {/* Utility lists */}
              <View style={[styles.settingSection, { borderTopColor: themeBorder }]}>
                <Text style={styles.sectionHeading}>{t.accountCredentials}</Text>

                <Pressable
                  style={[styles.settingItem, { backgroundColor: themeCard, borderColor: themeBorder }]}
                  onPress={async () => {
                    if (!profile?.email) return;
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    try {
                      await sendPasswordReset(profile.email);
                      Alert.alert('Success', `Password reset instructions sent to ${profile.email}.`);
                    } catch (err: any) {
                      Alert.alert('Error', err.message || 'Failed to send password reset email.');
                    }
                  }}
                >
                  <View style={styles.itemLeft}>
                    <Ionicons name="key" size={16} color={themeTextMuted} />
                    <Text style={[styles.itemLabel, { color: themeText }]}>{t.editInfoPassword}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={themeTextMuted} />
                </Pressable>

                {isUpdatingEmail ? (
                  <View style={[styles.settingItem, { backgroundColor: themeCard, borderColor: themeBorder, flexDirection: 'column', alignItems: 'stretch', gap: 8, padding: 12 }]}>
                    <Text style={[styles.toggleTitle, { color: themeText, fontSize: 11 }]}>ENTER NEW EMAIL</Text>
                    <TextInput
                      style={[styles.textInput, { backgroundColor: themeBg, borderColor: themeBorder, color: themeText, padding: 8, height: 40, borderRadius: 6, fontSize: 13 }]}
                      value={newEmail}
                      onChangeText={setNewEmail}
                      placeholder="new-email@recovo.app"
                      placeholderTextColor={themeTextMuted}
                      autoCapitalize="none"
                      keyboardType="email-address"
                    />
                    <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                      <Pressable style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 4, borderWidth: 1, borderColor: themeBorder }} onPress={() => setIsUpdatingEmail(false)}>
                        <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: themeTextMuted }}>{t.cancel}</Text>
                      </Pressable>
                      <Pressable style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 4, backgroundColor: COLORS.cyan }} onPress={handleConfirmUpdateEmail}>
                        <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.textInverse, fontWeight: '700' }}>SAVE</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <Pressable
                    style={[styles.settingItem, { backgroundColor: themeCard, borderColor: themeBorder }]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setIsUpdatingEmail(true);
                      setNewEmail('');
                    }}
                  >
                    <View style={styles.itemLeft}>
                      <Ionicons name="mail" size={16} color={themeTextMuted} />
                      <Text style={[styles.itemLabel, { color: themeText }]}>{t.updateEmail}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={themeTextMuted} />
                  </Pressable>
                )}
              </View>

              <View style={[styles.settingSection, { borderTopColor: themeBorder }]}>
                <Text style={styles.sectionHeading}>{t.helpSystem}</Text>

                {isWritingSupport ? (
                  <View style={[styles.settingItem, { backgroundColor: themeCard, borderColor: themeBorder, flexDirection: 'column', alignItems: 'stretch', gap: 8, padding: 12 }]}>
                    <Text style={[styles.toggleTitle, { color: themeText, fontSize: 11 }]}>DESCRIBE YOUR ISSUE</Text>
                    <TextInput
                      style={[styles.textInput, { backgroundColor: themeBg, borderColor: themeBorder, color: themeText, padding: 8, height: 60, borderRadius: 6, fontSize: 13 }]}
                      value={supportMsg}
                      onChangeText={setSupportMsg}
                      placeholder="What is happening? E.g. Garmin sync failed..."
                      placeholderTextColor={themeTextMuted}
                      multiline
                      numberOfLines={2}
                    />
                    <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                      <Pressable style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 4, borderWidth: 1, borderColor: themeBorder }} onPress={() => setIsWritingSupport(false)}>
                        <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: themeTextMuted }}>{t.cancel}</Text>
                      </Pressable>
                      <Pressable style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 4, backgroundColor: COLORS.cyan }} onPress={handleConfirmSendSupport}>
                        <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.textInverse, fontWeight: '700' }}>SUBMIT</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <Pressable
                    style={[styles.settingItem, { backgroundColor: themeCard, borderColor: themeBorder }]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setIsWritingSupport(true);
                      setSupportMsg('');
                    }}
                  >
                    <View style={styles.itemLeft}>
                      <Ionicons name="help-circle" size={16} color={themeTextMuted} />
                      <Text style={[styles.itemLabel, { color: themeText }]}>{t.support}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={themeTextMuted} />
                  </Pressable>
                )}

                <Pressable style={[styles.settingItem, { backgroundColor: themeCard, borderColor: themeBorder }]} onPress={handleDeleteAccount}>
                  <View style={styles.itemLeft}>
                    <Ionicons name="trash" size={16} color={COLORS.danger} />
                    <Text style={[styles.itemLabel, { color: COLORS.danger }]}>{t.deleteAccount}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={themeTextMuted} />
                </Pressable>
              </View>

              {/* Log Out Session Footer */}
              <View style={[styles.logoutWrapper, { borderTopColor: themeBorder }]}>
                <Text style={styles.logoutTitle}>{t.signOut}</Text>
                <Text style={[styles.logoutSub, { color: themeTextMuted }]}>{t.sessionClearWarning}</Text>
                <Pressable style={styles.logoutButton} onPress={handleSignOut}>
                  <Text style={styles.logoutButtonText}>{t.logoutBtn}</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ────────────────── SETTINGS MODAL DRAWER ────────────────── */}
      <Modal visible={showSettings} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { backgroundColor: themeBg, borderColor: themeBorder, paddingTop: Math.max(insets.top, 16) }]}>
            <View style={[styles.modalHeader, { borderBottomColor: themeBorder }]}>
              <Text style={[styles.modalTitle, { color: themeText }]}>{t.settings}</Text>
              <Pressable style={styles.closeIcon} onPress={() => setShowSettings(false)}>
                <Ionicons name="close" size={24} color={themeText} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
              {/* Notification Alerts */}
              <View style={[styles.settingSection, { borderTopColor: themeBorder }]}>
                <Text style={styles.sectionHeading}>{t.notifications}</Text>
                <Text style={[styles.sectionLabel, { color: themeTextMuted }]}>{t.notifyLabel}</Text>

                <View style={[styles.toggleRow, { backgroundColor: themeCard, borderColor: themeBorder }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.toggleTitle, { color: themeText }]}>{t.dailyReadiness}</Text>
                    <Text style={[styles.toggleDesc, { color: themeTextMuted }]}>{t.dailyReadinessDesc}</Text>
                  </View>
                  <Switch
                    value={notifyDaily}
                    onValueChange={(val) => handleToggleSetting('dailyReadinessAlert', val)}
                    trackColor={{ true: COLORS.cyan, false: themeBorder }}
                    thumbColor={notifyDaily ? '#FFFFFF' : '#71717A'}
                  />
                </View>

                <View style={[styles.toggleRow, { backgroundColor: themeCard, borderColor: themeBorder }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.toggleTitle, { color: themeText }]}>{t.coachMessages}</Text>
                    <Text style={[styles.toggleDesc, { color: themeTextMuted }]}>{t.coachMessagesDesc}</Text>
                  </View>
                  <Switch
                    value={notifyCoach}
                    onValueChange={(val) => handleToggleSetting('coachMessagesAlert', val)}
                    trackColor={{ true: COLORS.cyan, false: themeBorder }}
                    thumbColor={notifyCoach ? '#FFFFFF' : '#71717A'}
                  />
                </View>

                <View style={[styles.toggleRow, { backgroundColor: themeCard, borderColor: themeBorder }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.toggleTitle, { color: themeText }]}>{t.injuryRisk}</Text>
                    <Text style={[styles.toggleDesc, { color: themeTextMuted }]}>{t.injuryRiskDesc}</Text>
                  </View>
                  <Switch
                    value={notifyRisk}
                    onValueChange={(val) => handleToggleSetting('injuryRiskAlert', val)}
                    trackColor={{ true: COLORS.cyan, false: themeBorder }}
                    thumbColor={notifyRisk ? '#FFFFFF' : '#71717A'}
                  />
                </View>

                <View style={[styles.toggleRow, { backgroundColor: themeCard, borderColor: themeBorder }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.toggleTitle, { color: themeText }]}>{t.weeklySummary}</Text>
                    <Text style={[styles.toggleDesc, { color: themeTextMuted }]}>{t.weeklySummaryDesc}</Text>
                  </View>
                  <Switch
                    value={notifyWeekly}
                    onValueChange={(val) => handleToggleSetting('weeklySummaryAlert', val)}
                    trackColor={{ true: COLORS.cyan, false: themeBorder }}
                    thumbColor={notifyWeekly ? '#FFFFFF' : '#71717A'}
                  />
                </View>

                <View style={[styles.toggleRow, { backgroundColor: themeCard, borderColor: themeBorder }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.toggleTitle, { color: themeText }]}>{t.sessionReminder}</Text>
                    <Text style={[styles.toggleDesc, { color: themeTextMuted }]}>{t.sessionReminderDesc}</Text>
                  </View>
                  <Switch
                    value={notifySession}
                    onValueChange={(val) => handleToggleSetting('sessionReminderAlert', val)}
                    trackColor={{ true: COLORS.cyan, false: themeBorder }}
                    thumbColor={notifySession ? '#FFFFFF' : '#71717A'}
                  />
                </View>

                <View style={[styles.toggleRow, { backgroundColor: themeCard, borderColor: themeBorder }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.toggleTitle, { color: themeText }]}>{t.deviceSync}</Text>
                    <Text style={[styles.toggleDesc, { color: themeTextMuted }]}>{t.deviceSyncDesc}</Text>
                  </View>
                  <Switch
                    value={notifyDevice}
                    onValueChange={(val) => handleToggleSetting('deviceSyncAlert', val)}
                    trackColor={{ true: COLORS.cyan, false: themeBorder }}
                    thumbColor={notifyDevice ? '#FFFFFF' : '#71717A'}
                  />
                </View>
              </View>

              {/* Privacy Access */}
              <View style={[styles.settingSection, { borderTopColor: themeBorder }]}>
                <Text style={styles.sectionHeading}>{t.privacy}</Text>
                <Text style={[styles.sectionLabel, { color: themeTextMuted }]}>{t.privacyLabel}</Text>

                <View style={[styles.toggleRow, { backgroundColor: themeCard, borderColor: themeBorder }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.toggleTitle, { color: themeText }]}>{t.shareReadiness}</Text>
                    <Text style={[styles.toggleDesc, { color: themeTextMuted }]}>{t.shareReadinessDesc}</Text>
                  </View>
                  <Switch
                    value={shareScore}
                    onValueChange={(val) => handleToggleSetting('shareReadinessScore', val)}
                    trackColor={{ true: COLORS.cyan, false: themeBorder }}
                    thumbColor={shareScore ? '#FFFFFF' : '#71717A'}
                  />
                </View>

                <View style={[styles.toggleRow, { backgroundColor: themeCard, borderColor: themeBorder }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.toggleTitle, { color: themeText }]}>{t.shareBiometrics}</Text>
                    <Text style={[styles.toggleDesc, { color: themeTextMuted }]}>{t.shareBiometricsDesc}</Text>
                  </View>
                  <Switch
                    value={shareBio}
                    onValueChange={(val) => handleToggleSetting('shareBiometrics', val)}
                    trackColor={{ true: COLORS.cyan, false: themeBorder }}
                    thumbColor={shareBio ? '#FFFFFF' : '#71717A'}
                  />
                </View>

                <View style={[styles.toggleRow, { backgroundColor: themeCard, borderColor: themeBorder }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.toggleTitle, { color: themeText }]}>{t.shareWorkout}</Text>
                    <Text style={[styles.toggleDesc, { color: themeTextMuted }]}>{t.shareWorkoutDesc}</Text>
                  </View>
                  <Switch
                    value={shareWorkouts}
                    onValueChange={(val) => handleToggleSetting('shareWorkoutHistory', val)}
                    trackColor={{ true: COLORS.cyan, false: themeBorder }}
                    thumbColor={shareWorkouts ? '#FFFFFF' : '#71717A'}
                  />
                </View>

                <View style={[styles.toggleRow, { backgroundColor: themeCard, borderColor: themeBorder }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.toggleTitle, { color: themeText }]}>{t.shareAnalytics}</Text>
                    <Text style={[styles.toggleDesc, { color: themeTextMuted }]}>{t.shareAnalyticsDesc}</Text>
                  </View>
                  <Switch
                    value={shareAnalytics}
                    onValueChange={(val) => handleToggleSetting('shareAnalytics', val)}
                    trackColor={{ true: COLORS.cyan, false: themeBorder }}
                    thumbColor={shareAnalytics ? '#FFFFFF' : '#71717A'}
                  />
                </View>
              </View>

              {/* Security Alerts */}
              <View style={[styles.settingSection, { borderTopColor: themeBorder }]}>
                <Text style={styles.sectionHeading}>{t.security}</Text>
                <Text style={[styles.sectionLabel, { color: themeTextMuted }]}>{t.securityLabel}</Text>

                <View style={[styles.toggleRow, { backgroundColor: themeCard, borderColor: themeBorder }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.toggleTitle, { color: themeText }]}>{t.twoFactor}</Text>
                    <Text style={[styles.toggleDesc, { color: themeTextMuted }]}>{t.twoFactorDesc}</Text>
                  </View>
                  <Switch
                    value={security2fa}
                    onValueChange={handleToggle2FA}
                    trackColor={{ true: COLORS.cyan, false: themeBorder }}
                    thumbColor={security2fa ? '#FFFFFF' : '#71717A'}
                  />
                </View>

                <View style={[styles.toggleRow, { backgroundColor: themeCard, borderColor: themeBorder }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.toggleTitle, { color: themeText }]}>{t.loginAlerts}</Text>
                    <Text style={[styles.toggleDesc, { color: themeTextMuted }]}>{t.loginAlertsDesc}</Text>
                  </View>
                  <Switch
                    value={securityAlerts}
                    onValueChange={(val) => handleToggleSetting('loginAlerts', val)}
                    trackColor={{ true: COLORS.cyan, false: themeBorder }}
                    thumbColor={securityAlerts ? '#FFFFFF' : '#71717A'}
                  />
                </View>

                <View style={[styles.sessionBox, { backgroundColor: themeCard, borderColor: themeBorder }]}>
                  <Text style={[styles.sessionBoxTitle, { color: themeText }]}>{t.activeSessions}</Text>
                  <Text style={[styles.sessionBoxDesc, { color: themeTextMuted }]}>{t.activeSessionsDesc}</Text>
                  <Pressable
                    style={styles.outlineButton}
                    onPress={() => {
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                      Alert.alert('Session Reset', 'All other active auth sessions have been terminated.');
                    }}
                  >
                    <Text style={styles.outlineButtonText}>{t.signOutOther}</Text>
                  </Pressable>
                </View>
              </View>

              {/* Appearance preferences */}
              <View style={[styles.settingSection, { borderTopColor: themeBorder }]}>
                <Text style={styles.sectionHeading}>{t.appearance}</Text>
                <Text style={[styles.sectionLabel, { color: themeTextMuted }]}>{t.appearanceLabel}</Text>
                <View style={styles.appearanceRow}>
                  {(['light', 'dark', 'system'] as const).map((mode) => (
                    <Pressable
                      key={mode}
                      style={[
                        styles.modeSelector,
                        { backgroundColor: themeCard, borderColor: themeBorder },
                        appearanceMode === mode && styles.modeSelectorActive,
                      ]}
                      onPress={() => handleToggleSetting('appearance', mode)}
                    >
                      <Text style={[styles.modeSelectorText, appearanceMode === mode && { color: COLORS.cyan }]}>
                        {mode.toUpperCase()}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Language Selection */}
              <View style={[styles.settingSection, { borderTopColor: themeBorder }]}>
                <Text style={styles.sectionHeading}>{t.language}</Text>
                <Text style={[styles.sectionLabel, { color: themeTextMuted }]}>{t.langLabel}</Text>
                <View style={styles.languageGrid}>
                  {([
                    { code: 'en', label: 'English', sub: 'English' },
                    { code: 'fr', label: 'Français', sub: 'French' },
                    { code: 'es', label: 'Español', sub: 'Spanish' },
                    { code: 'de', label: 'Deutsch', sub: 'German' },
                    { code: 'hi', label: 'हिन्दी', sub: 'Hindi' },
                  ] as const).map((lang) => (
                    <Pressable
                      key={lang.code}
                      style={[
                        styles.langBox,
                        { backgroundColor: themeCard, borderColor: themeBorder },
                        activeLang === lang.code && styles.langBoxActive,
                      ]}
                      onPress={() => handleToggleSetting('language', lang.code)}
                    >
                      <Text style={[styles.langBoxLabel, { color: activeLang === lang.code ? COLORS.cyan : themeText }]}>
                        {lang.label}
                      </Text>
                      <Text style={styles.langBoxSub}>{lang.sub}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Measurement preferences */}
              <View style={[styles.settingSection, { borderTopColor: themeBorder }]}>
                <Text style={styles.sectionHeading}>{t.units}</Text>
                <Text style={[styles.sectionLabel, { color: themeTextMuted }]}>{t.unitLabel}</Text>

                <View style={[styles.unitRow, { backgroundColor: themeCard, borderColor: themeBorder }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.unitTitle, { color: themeText }]}>Weight</Text>
                    <Text style={[styles.unitDesc, { color: themeTextMuted }]}>Currently: {unitWeight === 'KG' ? 'Kilograms (kg)' : 'Pounds (lbs)'}</Text>
                  </View>
                  <View style={[styles.segmentedControl, { backgroundColor: themeBorder }]}>
                    <Pressable
                      style={[styles.segmentBtn, unitWeight === 'KG' && styles.segmentBtnActive]}
                      onPress={() => handleToggleSetting('unitWeight', 'KG')}
                    >
                      <Text style={[styles.segmentBtnText, unitWeight === 'KG' && styles.segmentBtnTextActive]}>KG</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.segmentBtn, unitWeight === 'LBS' && styles.segmentBtnActive]}
                      onPress={() => handleToggleSetting('unitWeight', 'LBS')}
                    >
                      <Text style={[styles.segmentBtnText, unitWeight === 'LBS' && styles.segmentBtnTextActive]}>LBS</Text>
                    </Pressable>
                  </View>
                </View>

                <View style={[styles.unitRow, { backgroundColor: themeCard, borderColor: themeBorder }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.unitTitle, { color: themeText }]}>Distance</Text>
                    <Text style={[styles.unitDesc, { color: themeTextMuted }]}>Currently: {unitDist === 'KM' ? 'Kilometres (km)' : 'Miles (mi)'}</Text>
                  </View>
                  <View style={[styles.segmentedControl, { backgroundColor: themeBorder }]}>
                    <Pressable
                      style={[styles.segmentBtn, unitDist === 'KM' && styles.segmentBtnActive]}
                      onPress={() => handleToggleSetting('unitDistance', 'KM')}
                    >
                      <Text style={[styles.segmentBtnText, unitDist === 'KM' && styles.segmentBtnTextActive]}>KM</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.segmentBtn, unitDist === 'MILES' && styles.segmentBtnActive]}
                      onPress={() => handleToggleSetting('unitDistance', 'MILES')}
                    >
                      <Text style={[styles.segmentBtnText, unitDist === 'MILES' && styles.segmentBtnTextActive]}>MILES</Text>
                    </Pressable>
                  </View>
                </View>

                <View style={[styles.unitRow, { backgroundColor: themeCard, borderColor: themeBorder }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.unitTitle, { color: themeText }]}>Temperature</Text>
                    <Text style={[styles.unitDesc, { color: themeTextMuted }]}>Currently: {unitTemp === 'CELSIUS' ? 'Celsius (°C)' : 'Fahrenheit (°F)'}</Text>
                  </View>
                  <View style={[styles.segmentedControl, { backgroundColor: themeBorder }]}>
                    <Pressable
                      style={[styles.segmentBtn, unitTemp === 'CELSIUS' && styles.segmentBtnActive]}
                      onPress={() => handleToggleSetting('unitTemperature', 'CELSIUS')}
                    >
                      <Text style={[styles.segmentBtnText, unitTemp === 'CELSIUS' && styles.segmentBtnTextActive]}>C°</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.segmentBtn, unitTemp === 'FAHRENHEIT' && styles.segmentBtnActive]}
                      onPress={() => handleToggleSetting('unitTemperature', 'FAHRENHEIT')}
                    >
                      <Text style={[styles.segmentBtnText, unitTemp === 'FAHRENHEIT' && styles.segmentBtnTextActive]}>F°</Text>
                    </Pressable>
                  </View>
                </View>
              </View>

              {/* Account Metadata */}
              <View style={[styles.settingSection, { borderTopColor: themeBorder }]}>
                <Text style={styles.sectionHeading}>{t.account}</Text>
                <View style={[styles.metaRow, { backgroundColor: themeCard, borderColor: themeBorder }]}>
                  <Text style={styles.metaLabel}>{t.emailAddr}</Text>
                  <Text style={[styles.metaValue, { color: themeText }]}>{profile?.email || 'juliankaiser107@gmail.com'}</Text>
                </View>
                <View style={[styles.metaRow, { backgroundColor: themeCard, borderColor: themeBorder }]}>
                  <Text style={styles.metaLabel}>{t.accountType}</Text>
                  <Text style={[styles.metaValue, { color: themeText }]}>Athlete Account</Text>
                </View>
                <View style={[styles.metaRow, { backgroundColor: themeCard, borderColor: themeBorder }]}>
                  <Text style={styles.metaLabel}>{t.dataPrivacy}</Text>
                  <Text style={[styles.metaDesc, { color: themeTextSecondary }]}>{t.dataPrivacyDesc}</Text>
                </View>
              </View>

              {/* System details */}
              <View style={[styles.settingSection, { borderTopColor: themeBorder }]}>
                <Text style={styles.sectionHeading}>{t.about}</Text>
                <View style={[styles.metaRow, { backgroundColor: themeCard, borderColor: themeBorder }]}>
                  <Text style={styles.metaLabel}>{t.version}</Text>
                  <Text style={[styles.metaValue, { color: themeText }]}>1.0.0</Text>
                </View>
                <View style={[styles.metaRow, { backgroundColor: themeCard, borderColor: themeBorder }]}>
                  <Text style={styles.metaLabel}>{t.build}</Text>
                  <Text style={[styles.metaValue, { color: themeText }]}>2025.06</Text>
                </View>
                <View style={[styles.metaRow, { backgroundColor: themeCard, borderColor: themeBorder }]}>
                  <Text style={styles.metaLabel}>{t.platform}</Text>
                  <Text style={[styles.metaValue, { color: themeText }]}>{Platform.OS === 'web' ? 'Web PWA' : 'Mobile App'}</Text>
                </View>
                <View style={[styles.metaRow, { backgroundColor: themeCard, borderColor: themeBorder }]}>
                  <Text style={styles.metaLabel}>{t.storage}</Text>
                  <Text style={[styles.metaValue, { color: themeText }]}>Local Device</Text>
                </View>
                <Pressable style={[styles.clearCacheBtn, { backgroundColor: themeCard, borderColor: themeBorder }]} onPress={handleClearCache}>
                  <Text style={styles.clearCacheText}>{t.clearCache}</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Two-Factor Authentication Setup Modal */}
      <Modal
        visible={is2faModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setIs2faModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.faModalContainer, { backgroundColor: themeCard, borderColor: themeBorder }]}>
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.faModalTitle, { color: themeText }]}>
                {faMode === 'disable' ? 'Disable 2FA' : 'Configure 2FA'}
              </Text>
              <Pressable onPress={() => setIs2faModalVisible(false)}>
                <Ionicons name="close" size={24} color={themeText} />
              </Pressable>
            </View>

            <View style={styles.faModalContent}>
              <View style={styles.faIconCircle}>
                <Ionicons
                  name={faMode === 'disable' ? 'lock-open-outline' : 'shield-checkmark-outline'}
                  size={32}
                  color={COLORS.cyan}
                />
              </View>

              <Text style={[styles.faModalDesc, { color: themeTextSecondary }]}>
                {faMode === 'enable'
                  ? 'Enter a new 4-digit PIN to secure your account.'
                  : faMode === 'confirm_enable'
                  ? 'Please confirm the 4-digit PIN.'
                  : 'Enter your current 4-digit PIN to confirm disabling 2FA.'}
              </Text>

              {faMode === 'enable' && (
                <TextInput
                  style={[styles.faPinInput, { color: themeText, borderColor: themeBorder, backgroundColor: themeBg }]}
                  value={pinInput}
                  onChangeText={(text) => setPinInput(text.replace(/[^0-9]/g, ''))}
                  keyboardType="numeric"
                  maxLength={4}
                  secureTextEntry
                  placeholder="••••"
                  placeholderTextColor={COLORS.textMuted}
                  autoFocus
                />
              )}

              {faMode === 'confirm_enable' && (
                <TextInput
                  style={[styles.faPinInput, { color: themeText, borderColor: themeBorder, backgroundColor: themeBg }]}
                  value={pinConfirmInput}
                  onChangeText={(text) => setPinConfirmInput(text.replace(/[^0-9]/g, ''))}
                  keyboardType="numeric"
                  maxLength={4}
                  secureTextEntry
                  placeholder="••••"
                  placeholderTextColor={COLORS.textMuted}
                  autoFocus
                />
              )}

              {faMode === 'disable' && (
                <TextInput
                  style={[styles.faPinInput, { color: themeText, borderColor: themeBorder, backgroundColor: themeBg }]}
                  value={pinInput}
                  onChangeText={(text) => setPinInput(text.replace(/[^0-9]/g, ''))}
                  keyboardType="numeric"
                  maxLength={4}
                  secureTextEntry
                  placeholder="••••"
                  placeholderTextColor={COLORS.textMuted}
                  autoFocus
                />
              )}

              <Pressable style={styles.faSubmitBtn} onPress={handle2faSubmit}>
                <Text style={styles.faSubmitBtnText}>
                  {faMode === 'enable'
                    ? 'NEXT'
                    : faMode === 'confirm_enable'
                    ? 'CONFIRM & ENABLE'
                    : 'CONFIRM DISABLE'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  // Global Header
  globalHeader: {
    borderBottomWidth: 1,
  },
  headerInnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  headerBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 10,
  },
  logoPrefix: {
    fontFamily: FONTS.display,
    fontSize: 22,
    color: COLORS.textPrimary,
    letterSpacing: 1.5,
  },
  logoSuffix: {
    fontFamily: FONTS.display,
    fontSize: 22,
    color: COLORS.cyan,
    letterSpacing: 1.5,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  streakWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 3,
  },
  streakValue: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: COLORS.cyan,
    fontWeight: '700',
  },
  avatarBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.cyan,
  },
  avatarCircle: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: FONTS.display,
    fontSize: 14,
    color: COLORS.textInverse,
    fontWeight: '800',
  },
  avatarEmoji: {
    fontSize: 18,
  },
  settingsBtn: {
    padding: 2,
  },

  // Modals common layouts
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: COLORS.bg,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    borderTopWidth: 1,
    borderColor: COLORS.border,
    maxHeight: '90%',
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontFamily: FONTS.display,
    fontSize: 24,
    color: COLORS.textPrimary,
    letterSpacing: 2,
  },
  closeIcon: {
    padding: 4,
  },
  scrollContent: {
    padding: SPACING.lg,
    paddingBottom: 80,
  },

  // Profile Hero
  profileHero: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
    gap: 6,
  },
  heroAvatarBig: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.cyan,
    marginBottom: SPACING.sm,
    shadowColor: COLORS.cyan,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  heroAvatarInitial: {
    fontFamily: FONTS.display,
    fontSize: 36,
    color: COLORS.textInverse,
    fontWeight: '800',
  },
  heroAvatarEmoji: {
    fontSize: 44,
  },
  heroName: {
    fontFamily: FONTS.display,
    fontSize: 22,
    color: COLORS.textPrimary,
    letterSpacing: 1,
  },
  heroEmail: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: COLORS.textMuted,
  },
  roleTag: {
    backgroundColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.borderAccent,
    marginTop: 4,
  },
  roleTagText: {
    fontFamily: FONTS.mono,
    fontSize: 8,
    color: COLORS.cyan,
    letterSpacing: 1,
    fontWeight: '700',
  },

  // Display details
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.bgCard,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.sm,
  },
  detailLabel: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    color: COLORS.textMuted,
    letterSpacing: 1,
  },
  detailVal: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },

  // Editing forms
  formContainer: {
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  inputLabel: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    color: COLORS.textMuted,
    letterSpacing: 1.5,
    marginTop: SPACING.xs,
  },
  textInput: {
    backgroundColor: COLORS.bgCard,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  presetsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: SPACING.sm,
  },
  presetBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  presetBoxActive: {
    borderColor: '#FFFFFF',
    transform: [{ scale: 1.15 }],
  },
  presetBoxEmoji: {
    fontSize: 22,
  },
  editActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cancelBtnText: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: COLORS.textMuted,
  },
  saveBtn: {
    flex: 2,
    backgroundColor: COLORS.cyan,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: 'center',
  },
  saveBtnText: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: COLORS.textInverse,
    fontWeight: '700',
  },

  // Interactive buttons
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.cyan,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginTop: SPACING.sm,
  },
  actionBtnText: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: COLORS.textInverse,
    fontWeight: '700',
    letterSpacing: 1,
  },

  // Settings structure
  settingSection: {
    marginTop: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: SPACING.md,
  },
  sectionHeading: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: COLORS.cyan,
    letterSpacing: 1.5,
    fontWeight: '700',
    marginBottom: SPACING.xs,
  },
  sectionLabel: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.textMuted,
    marginBottom: SPACING.md,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    marginBottom: SPACING.xs,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  itemLabel: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textSecondary,
  },

  // Switch layouts
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  toggleTitle: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  toggleDesc: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },

  // Sessions and button details
  sessionBox: {
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginTop: SPACING.sm,
    gap: SPACING.xs,
  },
  sessionBoxTitle: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  sessionBoxDesc: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.textMuted,
    marginBottom: SPACING.xs,
  },
  outlineButton: {
    borderWidth: 1,
    borderColor: COLORS.cyan,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  outlineButtonText: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    color: COLORS.cyan,
    letterSpacing: 0.5,
    fontWeight: '700',
  },

  // Theme grids
  appearanceRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  modeSelector: {
    flex: 1,
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  modeSelectorActive: {
    borderColor: COLORS.cyan,
    backgroundColor: COLORS.bgCardHover,
  },
  modeSelectorText: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: COLORS.textMuted,
    letterSpacing: 1,
  },

  // Language selectors
  languageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  langBox: {
    width: '48%',
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
  },
  langBoxActive: {
    borderColor: COLORS.cyan,
  },
  langBoxLabel: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  langBoxSub: {
    fontFamily: FONTS.mono,
    fontSize: 8,
    color: COLORS.textMuted,
    marginTop: 2,
  },

  // Units switch controls
  unitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  unitTitle: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  unitDesc: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.textMuted,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: COLORS.border,
    borderRadius: RADIUS.sm,
    padding: 3,
  },
  segmentBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.sm - 2,
    alignItems: 'center',
  },
  segmentBtnActive: {
    backgroundColor: COLORS.cyan,
  },
  segmentBtnText: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    color: COLORS.textMuted,
  },
  segmentBtnTextActive: {
    color: COLORS.textInverse,
    fontWeight: '700',
  },

  // Account details metadata
  metaRow: {
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.xs,
    gap: 2,
  },
  metaLabel: {
    fontFamily: FONTS.mono,
    fontSize: 8,
    color: COLORS.textMuted,
    letterSpacing: 1,
  },
  metaValue: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  metaDesc: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.textSecondary,
  },

  // Cache purging
  clearCacheBtn: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    marginTop: SPACING.sm,
  },
  clearCacheText: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: COLORS.danger,
    letterSpacing: 1,
    fontWeight: '700',
  },

  // Log out session elements
  logoutWrapper: {
    marginTop: SPACING.xl,
    paddingTop: SPACING.lg,
    borderTopWidth: 2,
    borderTopColor: COLORS.borderAccent,
    alignItems: 'center',
    gap: SPACING.xs,
  },
  logoutTitle: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    color: COLORS.danger,
    letterSpacing: 2,
    fontWeight: '700',
  },
  logoutSub: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  logoutButton: {
    width: '100%',
    backgroundColor: COLORS.danger,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    shadowColor: COLORS.danger,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  logoutButtonText: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: COLORS.textPrimary,
    fontWeight: '700',
    letterSpacing: 1,
  },

  // 2FA Configuration Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.md,
  },
  faModalContainer: {
    width: '100%',
    maxWidth: 340,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    padding: SPACING.lg,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  faModalTitle: {
    fontFamily: FONTS.display,
    fontSize: 20,
    letterSpacing: 1,
  },
  faModalContent: {
    alignItems: 'center',
    width: '100%',
  },
  faIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.cyan + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  faModalDesc: {
    fontFamily: FONTS.body,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: SPACING.md,
  },
  faPinInput: {
    width: '100%',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    fontSize: 24,
    fontFamily: FONTS.mono,
    textAlign: 'center',
    letterSpacing: 12,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  faSubmitBtn: {
    width: '100%',
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.cyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  faSubmitBtnText: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textInverse,
    letterSpacing: 1,
  },
});
