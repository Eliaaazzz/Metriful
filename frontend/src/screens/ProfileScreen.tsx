import { api } from '@/services/apiClient';
import {
  ArrowRight,
  Barbell,
  Bell,
  BookOpenText,
  Camera,
  CaretRight,
  ChartLine,
  ChartPie,
  CheckCircle,
  Fire,
  ForkKnife,
  GenderFemale,
  GenderMale,
  House,
  Leaf,
  MagicWand,
  PersonSimpleRun,
  Question,
  SignOut,
  Sneaker,
  Target,
  User,
  UserCircleMinus,
  UserGear,
  WarningCircle,
  X,
  type IconProps,
} from 'phosphor-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    KeyboardAvoidingView,
    Linking,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    View
} from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Card, ConsistencyHeatmap, DayHistorySheet, EditNameModal, PersonalRecordsCard, SafeAreaWrapper, Text, WheelPicker } from '@/components';
import { usePersonalRecords } from '@/hooks/usePersonalRecords';
import { useConsistencyCells } from '@/hooks/useConsistencyCells';
import { PermissionRequestModal, PermissionType } from '@/components/common/PermissionRequestModal';
import { StateView } from '@/components/common/StateView';
import useCurrentUser from '@/hooks/useCurrentUser';
import useImageCompressor from '@/hooks/useImageCompressor';
import {
    GeneratedGoals,
    generateGoals,
    GenerateGoalsRequest,
    getActiveGoal,
    GoalType,
    saveGoal,
    Sex,
} from '@/services/geminiApi';
import { useGoalStatistics } from '@/services/goalsApi';
import { HYDRATION_STORAGE_KEY } from '@/stores/useHydrationStore';
import userApi from '@/services/userApi';
import { useAuthStore } from '@/stores';
import type { CurrentUserResponse, UserProfileResponse } from '@/types';
import { APP_NAME, BRAND_COLORS, spacing, useContentBottomPadding } from '@/utils';
import { getUserEmail } from '@/utils/jwtStorage';
import { getTheme } from '@/utils/theme';

export const GENERATED_GOALS_KEY = '@generated_fitness_goals';
const DEFAULT_AVATAR_CONTENT_TYPE = 'image/jpeg';
const MODERATE_T2D_NET_CARB_RISE_MGDL_PER_G = 4;
const MODERATE_T2D_PROTEIN_RISE_MGDL_PER_G = 0.5;
const ESTIMATED_FIBER_RATIO = 0.1;

const estimateBloodSugarRiseMgDl = (carbsG: number, proteinG: number): number => {
  const safeCarbs = Math.max(0, carbsG || 0);
  const safeProtein = Math.max(0, proteinG || 0);
  const estimatedFiber = Math.round(safeCarbs * ESTIMATED_FIBER_RATIO);
  const netCarbs = Math.max(0, safeCarbs - estimatedFiber);
  return Math.round(
    netCarbs * MODERATE_T2D_NET_CARB_RISE_MGDL_PER_G +
    safeProtein * MODERATE_T2D_PROTEIN_RISE_MGDL_PER_G
  );
};

const normalizeGoalMacros = (goals: GeneratedGoals): GeneratedGoals => {
  const macros = goals.macros_grams || {
    protein_g: 0,
    carbs_g: 0,
    fat_g: 0,
    notes: '',
  };

  return {
    ...goals,
    macros_grams: {
      ...macros,
      blood_sugar_rise_mg_dl:
        macros.blood_sugar_rise_mg_dl ??
        estimateBloodSugarRiseMgDl(macros.carbs_g, macros.protein_g),
    },
  };
};

const mapGoalTypeToFitnessGoal = (goalType: GoalType): string => {
  switch (goalType) {
    case 'fat_loss':
      return 'LOSE_WEIGHT';
    case 'muscle_gain':
      return 'GAIN_MUSCLE';
    case 'diabetes_control':
      return 'MAINTAIN';
    default:
      return 'MAINTAIN';
  }
};

const mapFitnessGoalToGoalType = (fitnessGoal?: string | null): GoalType => {
  switch ((fitnessGoal || '').toUpperCase()) {
    case 'LOSE_WEIGHT':
      return 'fat_loss';
    case 'GAIN_MUSCLE':
      return 'muscle_gain';
    case 'MAINTAIN':
      return 'diabetes_control';
    default:
      return 'fat_loss';
  }
};

// Sex selection options with cute icons
const SEX_OPTIONS: Array<{ value: Sex; label: string; Icon: React.ComponentType<IconProps>; color: string }> = [
  { value: 'male', label: 'Male', Icon: GenderMale, color: '#60A5FA' },
  { value: 'female', label: 'Female', Icon: GenderFemale, color: '#F472B6' },
  { value: 'prefer_not_to_say', label: 'Skip', Icon: Question, color: '#A78BFA' },
];

// Goal type options
const GOAL_OPTIONS: Array<{ value: GoalType; label: string; Icon: React.ComponentType<IconProps>; description: string; color: string }> = [
  {
    value: 'fat_loss',
    label: 'Fat Loss',
    Icon: Fire,
    description: 'Burn fat, keep muscle',
    color: '#EF4444'
  },
  {
    value: 'muscle_gain',
    label: 'Build Muscle',
    Icon: Barbell,
    description: 'Grow stronger',
    color: BRAND_COLORS.macros.protein
  },
  {
    value: 'diabetes_control',
    label: 'Nutrition Balance',
    Icon: Leaf,
    description: 'Steady energy and lighter carbs',
    color: BRAND_COLORS.macros.carbs
  },
];

// Generate height data (100-250 cm)
const heightData = Array.from({ length: 151 }, (_, i) => ({
  value: 100 + i,
  label: String(100 + i),
}));

// Generate weight data (30-200 kg)
const weightData = Array.from({ length: 171 }, (_, i) => ({
  value: 30 + i,
  label: String(30 + i),
}));

type Step = 'sex' | 'measurements' | 'goal' | 'generating' | 'complete';

const ProfileScreen = () => {
  // Always use light mode
  const theme = getTheme('light');
  const reduceMotion = useReducedMotion();
  const navigation = useNavigation<any>();
  const currentUser = useCurrentUser();
  const queryClient = useQueryClient();

  const hasAnimated = useRef(false);
  const staggerEnter = useCallback((index: number) => {
    if (reduceMotion || hasAnimated.current) return undefined;
    return FadeInDown.duration(300).delay(index * 80);
  }, [reduceMotion]);
  useEffect(() => { hasAnimated.current = true; }, []);
  const userId = currentUser.data?.userId || '';
  const stats = useGoalStatistics(userId);

  // Goals generation state
  const [showGoalsModal, setShowGoalsModal] = useState(false);
  const [generatedGoals, setGeneratedGoals] = useState<GeneratedGoals | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // Avatar upload state with high-performance compression
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarCacheKey, setAvatarCacheKey] = useState(Date.now());

  // Apple HIG pre-permission modal state
  const [permissionModal, setPermissionModal] = useState<{ visible: boolean; type: PermissionType }>({
    visible: false, type: 'photoLibrary',
  });
  const avatarUrl = currentUser.data?.profile?.avatarUrl;

  // Use the image compressor hook for non-blocking compression
  // - compressImage: Off-main-thread compression (Web Worker on web, expo-image-manipulator on native)
  // - optimisticAvatarUri: Instant local preview for immediate UI feedback
  const {
    compress: compressImage,
    previewUri: optimisticAvatarUri,
    setPreviewUri: setOptimisticAvatarUri,
  } = useImageCompressor({
    defaultOptions: {
      maxDimension: 512, // Avatar images don't need to be large
      quality: 0.85,
    },
  });

  // Edit name modal state
  const [showEditNameModal, setShowEditNameModal] = useState(false);
  const [isUpdatingName, setIsUpdatingName] = useState(false);

  // Helper to get the "Cache Busted" URL - ensures Image component treats it as a new resource
  const getAvatarUri = (url: string) => {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}v=${avatarCacheKey}`;
  };

  // Profile input state
  const [selectedSex, setSelectedSex] = useState<Sex | null>(null);
  const [heightCm, setHeightCm] = useState(170);
  const [weightKg, setWeightKg] = useState(70);
  const [selectedGoalType, setSelectedGoalType] = useState<GoalType | null>(null);
  const [step, setStep] = useState<Step>('sex');

  // Load saved goals and email on mount
  React.useEffect(() => {
    loadSavedGoals();
    loadUserEmail();
  }, []);

  // Debug: Monitor showGoalsModal state changes
  React.useEffect(() => {
    console.log('[ProfileScreen] showGoalsModal changed to:', showGoalsModal);
  }, [showGoalsModal]);

  const loadUserEmail = async () => {
    const email = await getUserEmail();
    setUserEmail(email);
  };

  // Handle username update
  const handleUpdateUsername = async (newUsername: string) => {
    // Store previous data for rollback
    const previousData = queryClient.getQueryData(['current-user']);

    // Optimistic update for immediate UI feedback
    queryClient.setQueryData(['current-user'], (old: any) => ({
      ...old,
      username: newUsername,
    }));

    setIsUpdatingName(true);
    try {
      const updatedUser = await userApi.updateUsername(newUsername);

      // Update cache with server response to ensure consistency
      queryClient.setQueryData(['current-user'], (old: any) => ({
        ...old,
        ...updatedUser,
      }));

      // Close modal FIRST before any query invalidation to prevent re-render interference
      setShowEditNameModal(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Invalidate queries AFTER modal is closed to ensure other screens get fresh data
      // Use setTimeout to ensure modal close state is committed before refetch triggers re-render
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['current-user'] });
      }, 0);
    } catch (error) {
      // Rollback on error
      queryClient.setQueryData(['current-user'], previousData);
      Alert.alert('Error', 'Failed to update name. Please try again.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsUpdatingName(false);
    }
  };

  const handleAvatarPress = async () => {
    // Show pre-permission modal before accessing photo library (Apple HIG)
    setPermissionModal({ visible: true, type: 'photoLibrary' });
  };

  // Called after user taps "Allow" in the pre-permission modal
  const handleAvatarPermissionAllowed = async () => {
    setPermissionModal((p) => ({ ...p, visible: false }));
    await pickImage('library');
  };

  const pickImage = async (source: 'camera' | 'library') => {
    try {
      // Request permissions via system dialog
      if (source === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Camera access needed',
            'Allow camera access in Settings to take photos.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => Linking.openSettings() },
            ]
          );
          return;
        }
      } else {
        if (Platform.OS !== 'web') {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert(
              'Photo access needed',
              'Allow photo library access in Settings to select photos.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Open Settings', onPress: () => Linking.openSettings() },
              ]
            );
            return;
          }
        }
      }

      // Launch picker
      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
          });

      if (!result.canceled && result.assets[0]) {
        const selectedUri = result.assets[0].uri;

        // === Optimistic UI (方案 C) ===
        // Show local preview IMMEDIATELY - user sees instant feedback
        setOptimisticAvatarUri(selectedUri);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

        // Set loading state for spinner overlay
        setIsUploadingAvatar(true);

        // === Double rAF (方案 B) ===
        // Ensures loading spinner renders on screen BEFORE heavy work begins
        // First rAF: browser prepares to paint the loading state
        // Second rAF: previous frame committed to GPU, safe to start heavy work
        requestAnimationFrame(() => {
          requestAnimationFrame(async () => {
            try {
              // Step 1: Compress image off-main-thread (Web Worker on web, expo-image-manipulator on native)
              // This keeps the UI at 60fps even for 4K/10MB images
              console.log('[ProfileScreen] Starting off-thread compression...');
              const compressed = await compressImage(selectedUri);
              console.log('[ProfileScreen] Compression complete:', {
                originalSize: compressed.originalSize,
                compressedSize: compressed.size,
                ratio: (compressed.ratio * 100).toFixed(1) + '%',
                duration: compressed.duration.toFixed(0) + 'ms',
              });

              // Step 2: Upload the compressed image
              // On native, we use the compressed URI; on web, we use the blob
              if (compressed.uri) {
                await uploadAvatar(compressed.uri);
              } else if (compressed.blob) {
                await uploadAvatarBlob(compressed.blob);
              } else {
                throw new Error('No compressed image data');
              }
            } catch (error) {
              console.error('[ProfileScreen] Compression/upload error:', error);
              Alert.alert('Error', 'Failed to process image. Please try again.');
              setIsUploadingAvatar(false);
              setOptimisticAvatarUri(null);
            }
          });
        });
      }
    } catch (error) {
      console.error('[ProfileScreen] Image picker error:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
      setIsUploadingAvatar(false);
      setOptimisticAvatarUri(null);
    }
  };

  const uploadAvatar = async (imageUri: string) => {
    // Note: isUploadingAvatar and optimisticAvatarUri are already set in pickImage
    try {
      // Step 1: Convert image URI to blob first to get the actual MIME type
      const imageResponse = await fetch(imageUri);
      const blob = await imageResponse.blob();

      // Determine content type dynamically
      let contentType = blob.type;

      // Fallback if blob type is missing or generic (common on some Android versions)
      if (!contentType || contentType === 'application/octet-stream') {
        const ext = imageUri.split('.').pop()?.toLowerCase();
        if (ext === 'png') contentType = 'image/png';
        else if (ext === 'webp') contentType = 'image/webp';
        else contentType = DEFAULT_AVATAR_CONTENT_TYPE;
      }

      console.log('[ProfileScreen] Image blob type:', blob.type, 'Detected content type:', contentType, 'Size:', blob.size);

      // Check file size (max 5MB for avatars)
      const MAX_AVATAR_SIZE = 5 * 1024 * 1024; // 5MB
      if (blob.size > MAX_AVATAR_SIZE) {
        Alert.alert('Image Too Large', 'Please select an image smaller than 5MB.');
        // Rollback optimistic preview on validation error
        setOptimisticAvatarUri(null);
        setIsUploadingAvatar(false);
        return;
      }

      // Step 2: Get presigned URL from backend with the correct content type
      const presignResponse = await api.post<{
        uploadUrl: string;
        publicUrl: string;
        fileKey: string;
      }>('/api/v1/user/avatar/presign', {
        fileType: contentType,
      });

      console.log('[ProfileScreen] Got presigned URL:', presignResponse.uploadUrl.substring(0, 50) + '...');

      // Step 3: Upload image to R2 using presigned URL with timeout and retry
      // IMPORTANT: Use native fetch (not axios) to avoid Authorization header conflicts
      const uploadWithRetry = async (retries = 2): Promise<Response> => {
        for (let attempt = 0; attempt <= retries; attempt++) {
          try {
            // Create AbortController for timeout (60 seconds for upload)
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 60000);

            const response = await fetch(presignResponse.uploadUrl, {
              method: 'PUT',
              headers: {
                'Content-Type': contentType,
              },
              body: blob,
              signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (response.ok) {
              return response;
            }

            // If not ok and we have retries left, try again
            if (attempt < retries) {
              console.warn(`[ProfileScreen] Upload attempt ${attempt + 1} failed with status ${response.status}, retrying...`);
              await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1))); // Exponential backoff
              continue;
            }

            return response;
          } catch (error: any) {
            if (error.name === 'AbortError') {
              console.error(`[ProfileScreen] Upload attempt ${attempt + 1} timed out`);
              if (attempt < retries) {
                await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
                continue;
              }
              throw new Error('Upload timed out. Please check your network connection and try again.');
            }

            // Network error - retry if we have attempts left
            if (attempt < retries) {
              console.warn(`[ProfileScreen] Upload attempt ${attempt + 1} failed:`, error.message, ', retrying...');
              await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
              continue;
            }
            throw error;
          }
        }
        throw new Error('Upload failed after all retries');
      };

      const uploadResponse = await uploadWithRetry();

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text().catch(() => '');
        console.error('[ProfileScreen] R2 upload failed:', uploadResponse.status, errorText);
        throw new Error(`Upload failed: ${uploadResponse.status}. Please try again.`);
      }

      console.log('[ProfileScreen] Image uploaded to R2');

      // Step 4: Confirm upload with backend
      const updatedProfile = await api.post<UserProfileResponse>('/api/v1/user/avatar/confirm', {
        publicUrl: presignResponse.publicUrl,
        fileKey: presignResponse.fileKey,
      });

      console.log('[ProfileScreen] Avatar confirmed, updated profile:', updatedProfile);
      console.log('[ProfileScreen] Updated profile avatarUrl:', updatedProfile?.avatarUrl);
      console.log('[ProfileScreen] Presigned publicUrl:', presignResponse.publicUrl);

      // Update the cached current user so the UI switches to server URL
      const newAvatarUrl = updatedProfile?.avatarUrl ?? presignResponse.publicUrl;
      console.log('[ProfileScreen] Setting new avatar URL:', newAvatarUrl);

      queryClient.setQueryData<CurrentUserResponse>(['current-user'], (old) => {
        if (!old) return old as any;
        return {
          ...old,
          profile: {
            ...(old.profile ?? {}),
            avatarUrl: newAvatarUrl,
          },
        };
      });

      // Update cache key to force Image component to re-fetch with new URL
      const newCacheKey = Date.now();
      setAvatarCacheKey(newCacheKey);

      // === Success: Clear optimistic preview and loading state ===
      // The Image component will now render with the server URL
      setOptimisticAvatarUri(null);
      setIsUploadingAvatar(false);

      // Invalidate queries in background (no await) - cache update already applied
      // This ensures other screens get fresh data on next access without causing a refresh
      queryClient.invalidateQueries({ queryKey: ['current-user'] });
      queryClient.invalidateQueries({ queryKey: ['user-profile'] });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

    } catch (error) {
      console.error('[ProfileScreen] Avatar upload error:', error);
      Alert.alert('Upload Failed', 'Failed to upload avatar. Please try again.');
      // === Failure: Rollback optimistic preview ===
      setOptimisticAvatarUri(null);
      setIsUploadingAvatar(false);
    }
  };

  /**
   * Upload avatar from a Blob (web platform after compression)
   * Shares the same upload logic but skips the URI-to-blob conversion
   */
  const uploadAvatarBlob = async (blob: Blob) => {
    try {
      const contentType = blob.type || DEFAULT_AVATAR_CONTENT_TYPE;
      console.log('[ProfileScreen] Uploading compressed blob:', contentType, 'Size:', blob.size);

      // Check file size (max 5MB for avatars - should be well under after compression)
      const MAX_AVATAR_SIZE = 5 * 1024 * 1024;
      if (blob.size > MAX_AVATAR_SIZE) {
        Alert.alert('Image Too Large', 'Please select a smaller image.');
        setOptimisticAvatarUri(null);
        setIsUploadingAvatar(false);
        return;
      }

      // Get presigned URL
      const presignResponse = await api.post<{
        uploadUrl: string;
        publicUrl: string;
        fileKey: string;
      }>('/api/v1/user/avatar/presign', {
        fileType: contentType,
      });

      // Upload to R2
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      const uploadResponse = await fetch(presignResponse.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        body: blob,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.status}`);
      }

      console.log('[ProfileScreen] Compressed image uploaded to R2');

      // Confirm with backend
      const updatedProfile = await api.post<UserProfileResponse>('/api/v1/user/avatar/confirm', {
        publicUrl: presignResponse.publicUrl,
        fileKey: presignResponse.fileKey,
      });

      // Update cache
      const newAvatarUrl = updatedProfile?.avatarUrl ?? presignResponse.publicUrl;
      queryClient.setQueryData<CurrentUserResponse>(['current-user'], (old) => {
        if (!old) return old as any;
        return {
          ...old,
          profile: { ...(old.profile ?? {}), avatarUrl: newAvatarUrl },
        };
      });

      setAvatarCacheKey(Date.now());
      setOptimisticAvatarUri(null);
      setIsUploadingAvatar(false);

      queryClient.invalidateQueries({ queryKey: ['current-user'] });
      queryClient.invalidateQueries({ queryKey: ['user-profile'] });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

    } catch (error) {
      console.error('[ProfileScreen] Blob upload error:', error);
      Alert.alert('Upload Failed', 'Failed to upload avatar. Please try again.');
      setOptimisticAvatarUri(null);
      setIsUploadingAvatar(false);
    }
  };

  const loadSavedGoals = async () => {
    try {
      // First try to load from database (authoritative source)
      if (userId) {
        try {
          const dbGoal = await getActiveGoal(userId);
          if (dbGoal) {
            const normalizedDbGoal = normalizeGoalMacros(dbGoal);
            console.log('[ProfileScreen] Loaded goal from database');
            setGeneratedGoals(normalizedDbGoal);
            // Also cache in AsyncStorage for offline access
            await AsyncStorage.setItem(GENERATED_GOALS_KEY, JSON.stringify(normalizedDbGoal));
            return;
          }
        } catch (dbError) {
          console.warn('[ProfileScreen] Failed to load goal from database:', dbError);
        }
      }

      // Fallback to AsyncStorage (for offline/quick access)
      const saved = await AsyncStorage.getItem(GENERATED_GOALS_KEY);
      if (saved) {
        console.log('[ProfileScreen] Loaded goal from AsyncStorage');
        setGeneratedGoals(normalizeGoalMacros(JSON.parse(saved)));
        return;
      }

      // Last resort: check if user profile has partial goals from backend
      const profile = currentUser.data?.profile;
      if (profile?.dailyCalorieTarget) {
        // Reconstruct goals from backend profile (partial data)
        const backendGoals: GeneratedGoals = {
          goalType: mapFitnessGoalToGoalType(profile.fitnessGoal),
          dailyCalories: {
            target: profile.dailyCalorieTarget,
            min: Math.round(profile.dailyCalorieTarget * 0.9),
            max: Math.round(profile.dailyCalorieTarget * 1.1),
            rationale: 'Restored from your saved profile',
          },
          macros_grams: {
            protein_g: profile.dailyProteinTarget || 130,
            carbs_g: profile.dailyCarbsTarget || 220,
            fat_g: profile.dailyFatTarget || 70,
            blood_sugar_rise_mg_dl: estimateBloodSugarRiseMgDl(
              profile.dailyCarbsTarget || 220,
              profile.dailyProteinTarget || 130
            ),
            notes: 'Restored from your saved profile',
          },
          sugarLimit_g_per_day: 25,
          fiberTarget_g_per_day: 25,
          weeklyActivityPlan: {
            cardio_minutes_per_week: 150,
            strength_sessions_per_week: 3,
            steps_per_day_target: 8000,
            notes: '',
          },
          milestonesChecklist: [],
          safetyNote: 'Goals restored from your profile. Regenerate for updated recommendations.',
        };
        setGeneratedGoals(backendGoals);
        await AsyncStorage.setItem(GENERATED_GOALS_KEY, JSON.stringify(backendGoals));
      }
    } catch (error) {
      console.error('Failed to load saved goals:', error);
    }
  };

  const performLogout = async () => {
    try {
      // Clear generated goals from AsyncStorage
      await AsyncStorage.removeItem(GENERATED_GOALS_KEY);

      // Clear React Query cache
      queryClient.clear();

      // Sign out via Zustand store (handles token cleanup + navigation)
      await useAuthStore.getState().signOut();
    } catch (error) {
      console.error('Logout failed:', error);
      Alert.alert('Error', 'Failed to logout. Please try again.');
    }
  };

  const handleLogout = () => {
    // On web, fall back to native confirm since Alert can be ignored by browsers
    if (Platform.OS === 'web') {
      const confirmed = typeof window !== 'undefined' ? window.confirm(`Logout of ${APP_NAME}?`) : true;
      if (confirmed) {
        performLogout();
      }
      return;
    }

    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: performLogout,
        },
      ]
    );
  };

  const performDeleteAccount = async () => {
    try {
      await userApi.deleteAccount();
      // Clear local data
      await AsyncStorage.multiRemove([GENERATED_GOALS_KEY, HYDRATION_STORAGE_KEY]);
      queryClient.clear();
      // Sign out and navigate to login
      await useAuthStore.getState().signOut();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Failed to delete account:', error);
      Alert.alert('Error', 'Failed to delete account. Please try again.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const handleCloseAccount = () => {
    // On web, fall back to native confirm since Alert can be ignored by browsers
    if (Platform.OS === 'web') {
      const confirmed = typeof window !== 'undefined' 
        ? window.confirm('Are you sure you want to permanently delete your account? This action cannot be undone and all your data will be lost.') 
        : true;
      if (confirmed) {
        performDeleteAccount();
      }
      return;
    }

    Alert.alert(
      'Close Account',
      'Are you sure you want to permanently delete your account? This action cannot be undone and all your data will be lost.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: performDeleteAccount,
        },
      ]
    );
  };

  const handleGenerateGoals = async () => {
    if (!selectedSex || !selectedGoalType || !userId) return;

    setStep('generating');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    try {
      const request: GenerateGoalsRequest = {
        sex: selectedSex,
        heightCm,
        weightKg,
        goalType: selectedGoalType,
        age: 30, // Default age
        activityLevel: 'medium',
      };

      const goals = normalizeGoalMacros(await generateGoals(request));
      setGeneratedGoals(goals);

      // Save to AsyncStorage for quick offline access
      await AsyncStorage.setItem(GENERATED_GOALS_KEY, JSON.stringify(goals));

      // Save complete goals to database (new API)
      try {
        await saveGoal(userId, goals, {
          sex: selectedSex,
          heightCm,
          weightKg,
          age: 30,
          activityLevel: 'medium',
        });
        console.log('[ProfileScreen] Goals saved to database successfully');
      } catch (saveError) {
        console.warn('[ProfileScreen] Failed to save goals to database:', saveError);
        // Don't fail the whole operation - goals are still in AsyncStorage
      }

      // Also update UserProfile for backwards compatibility
      try {
        await userApi.upsertProfile({
          heightCm,
          weightKg,
          fitnessGoal: mapGoalTypeToFitnessGoal(selectedGoalType),
          dailyCalorieTarget: goals.dailyCalories.target,
          dailyProteinTarget: goals.macros_grams.protein_g,
          dailyCarbsTarget: goals.macros_grams.carbs_g,
          dailyFatTarget: goals.macros_grams.fat_g,
        });
      } catch (profileError) {
        console.warn('[ProfileScreen] Failed to update profile:', profileError);
      }

      queryClient.invalidateQueries({ queryKey: ['weekly-insights'] });
      queryClient.invalidateQueries({ queryKey: ['dailyNutrition'] });
      queryClient.invalidateQueries({ queryKey: ['current-user'] });
      queryClient.invalidateQueries({ queryKey: ['active-goal'] });

      setStep('complete');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (error) {
      console.error('Failed to generate goals:', error);
      Alert.alert('Error', 'Failed to generate goals. Please try again.');
      setStep('goal');
    }
  };

  const resetGoalsModal = () => {
    console.log('[ProfileScreen] resetGoalsModal called');
    setStep('sex');
    setSelectedSex(null);
    setHeightCm(170);
    setWeightKg(70);
    setSelectedGoalType(null);
    setShowGoalsModal(false);
    console.log('[ProfileScreen] Modal state reset to false');
  };

  const handleSaveAndClose = () => {
    console.log('[ProfileScreen] handleSaveAndClose called');
    // Goals are already saved in handleGenerateGoals
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    
    // Close modal immediately (synchronously)
    console.log('[ProfileScreen] Closing modal immediately');
    setShowGoalsModal(false);
    
    // Reset modal state and navigate in next tick
    setTimeout(() => {
      console.log('[ProfileScreen] Resetting modal state');
      setStep('sex');
      setSelectedSex(null);
      setHeightCm(170);
      setWeightKg(70);
      setSelectedGoalType(null);
      
      console.log('[ProfileScreen] Navigating to Dashboard');
      navigation.navigate('Dashboard');
    }, 0);
  };

  const canProceedToMeasurements = selectedSex !== null;
  const canProceedToGoal = heightCm >= 100 && weightKg >= 30;
  const canGenerate = selectedGoalType !== null;

  // Phosphor icon mapping for menu items
  const menuIconMap: Record<string, React.ComponentType<IconProps>> = {
    'dumbbell': Barbell,
    'book-open-variant': BookOpenText,
    'food-apple': ForkKnife,
    'chart-line': ChartLine,
    'account-edit-outline': UserGear,
    'food-apple-outline': ForkKnife,
    'bell-outline': Bell,
    'account-remove-outline': UserCircleMinus,
  };
  const menuAccentMap: Record<string, { iconColor: string; iconBg: string }> = {
    'dumbbell': { iconColor: '#F97316', iconBg: '#FFF1E5' },
    'book-open-variant': { iconColor: '#2F7A6A', iconBg: '#EAF8F2' },
    'food-apple': { iconColor: '#84A13E', iconBg: '#F1F5E8' },
    'chart-line': { iconColor: '#3B82F6', iconBg: '#EEF6FF' },
    'account-edit-outline': { iconColor: '#111111', iconBg: '#F8F4ED' },
    'food-apple-outline': { iconColor: '#0F766E', iconBg: '#ECFEFF' },
    'bell-outline': { iconColor: '#A16207', iconBg: '#FEF3C7' },
    'account-remove-outline': { iconColor: '#DC2626', iconBg: '#FEE2E2' },
  };

  const renderMenuItem = (
    icon: string,
    title: string,
    subtitle: string,
    onPress: () => void,
    badge?: string | number
  ) => {
    const IconComponent = menuIconMap[icon] || Target;
    const accent = menuAccentMap[icon] || { iconColor: '#111111', iconBg: '#F8F4ED' };
    return (
    <Pressable
      style={({ pressed }) => [
        styles.menuItem,
        pressed && styles.menuItemPressed,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={subtitle}
    >
      <View style={[styles.menuIcon, { backgroundColor: accent.iconBg }]}>
        <IconComponent size={24} color={accent.iconColor} />
      </View>
      <View style={styles.menuContent}>
        <Text variant="body" weight="semibold" style={styles.menuTitle}>{title}</Text>
        <Text variant="caption" style={styles.menuSubtitle}>{subtitle}</Text>
      </View>
      {badge !== undefined && (
        <View style={styles.badge}>
          <Text variant="caption" weight="bold" style={styles.badgeText}>{badge}</Text>
        </View>
      )}
      <CaretRight size={20} color="#6B665F" />
    </Pressable>
  );
  };
  // last seen

  // Get safe area insets for full-screen modal
  const insets = useSafeAreaInsets();

  const renderGoalsModal = () => (
    <Modal
      visible={showGoalsModal}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={resetGoalsModal}
    >
      <KeyboardAvoidingView
        style={styles.modalContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Fixed App Bar */}
        <View style={[styles.modalAppBar, { paddingTop: insets.top + 8 }]}>
          {/* Home Button - Navigate back to Dashboard */}
          <Pressable
            onPress={() => {
              resetGoalsModal();
              navigation.navigate('Dashboard');
            }}
            style={styles.homeButton}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Go to Home"
          >
            <House size={22} color={BRAND_COLORS.primary} />
          </Pressable>
          <Text variant="heading2" weight="bold" style={[styles.modalTitle, styles.modalTitleCentered, { color: theme.colors.textPrimary }]}>
            {step === 'sex' && 'About You'}
            {step === 'measurements' && 'Your Stats'}
            {step === 'goal' && 'Your Goal'}
            {step === 'generating' && 'Creating Goals'}
            {step === 'complete' && 'Your Goals'}
          </Text>
          <Pressable
            onPress={resetGoalsModal}
            style={styles.closeButton}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <X size={24} color={theme.colors.textSecondary} />
          </Pressable>
        </View>

        {/* Scrollable Content Area */}
        <ScrollView
          style={styles.modalScrollView}
          contentContainerStyle={[
            styles.modalScrollContent,
            { paddingBottom: step === 'complete' ? 100 : 120 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Step 1: Sex Selection */}
          {step === 'sex' && (
            <View style={styles.stepContent}>
              <Text variant="body" style={[styles.stepDescription, { color: theme.colors.textSecondary }]}>
                Let's personalize your fitness journey! First, tell us about yourself:
              </Text>

              <Text variant="heading3" weight="semibold" style={[styles.stepLabel, { color: theme.colors.textPrimary }]}>
                I am...
              </Text>

              <View style={styles.sexOptions}>
                {SEX_OPTIONS.map((option) => (
                  <Pressable
                    key={option.value}
                    style={({ pressed }) => [
                      styles.sexOption,
                      selectedSex === option.value && { backgroundColor: option.color },
                      pressed && styles.optionPressed,
                    ]}
                    onPress={() => {
                      setSelectedSex(option.value);
                      Haptics.selectionAsync().catch(() => {});
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={option.label}
                    accessibilityState={{ selected: selectedSex === option.value }}
                  >
                    <option.Icon
                      size={40}
                      color={selectedSex === option.value ? '#FFF' : option.color}
                    />
                    <Text
                      variant="body"
                      weight="semibold"
                      style={[
                        { color: theme.colors.textPrimary },
                        selectedSex === option.value ? styles.optionTextSelected : {}
                      ]}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {/* Step 2: Height & Weight with Wheel Pickers */}
          {step === 'measurements' && (
            <View style={styles.stepContent}>
              <Text variant="body" style={[styles.stepDescription, { color: theme.colors.textSecondary }]}>
                Now let's get your measurements for accurate calculations:
              </Text>

              <View style={styles.wheelPickersContainer}>
                <WheelPicker
                  data={heightData}
                  selectedValue={heightCm}
                  onValueChange={(value) => setHeightCm(value as number)}
                  label="Height"
                  unit="cm"
                />

                <WheelPicker
                  data={weightData}
                  selectedValue={weightKg}
                  onValueChange={(value) => setWeightKg(value as number)}
                  label="Weight"
                  unit="kg"
                />
              </View>
            </View>
          )}

          {/* Step 3: Goal Selection */}
          {step === 'goal' && (
            <View style={styles.stepContent}>
              <Text variant="body" style={[styles.stepDescription, { color: theme.colors.textSecondary }]}>
                What's your primary fitness goal?
              </Text>

              <View style={styles.goalOptions}>
                {GOAL_OPTIONS.map((option) => (
                  <Pressable
                    key={option.value}
                    style={({ pressed }) => [
                      styles.goalOption,
                      selectedGoalType === option.value && {
                        borderColor: option.color,
                        backgroundColor: `${option.color}20`,
                      },
                      pressed && styles.optionPressed,
                    ]}
                    onPress={() => {
                      setSelectedGoalType(option.value);
                      Haptics.selectionAsync().catch(() => {});
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`${option.label}: ${option.description}`}
                    accessibilityState={{ selected: selectedGoalType === option.value }}
                  >
                    <View style={[styles.goalIconContainer, { backgroundColor: `${option.color}20` }]}>
                      <option.Icon
                        size={28}
                        color={option.color}
                      />
                    </View>
                    <View style={styles.goalTextContainer}>
                      <Text variant="body" weight="bold" style={{ color: theme.colors.textPrimary }}>{option.label}</Text>
                      <Text variant="caption" style={[styles.goalDescription, { color: theme.colors.textSecondary }]}>
                        {option.description}
                      </Text>
                    </View>
                    {selectedGoalType === option.value && (
                      <CheckCircle size={24} color={option.color} weight="fill" />
                    )}
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {/* Step 4: Generating (with overlay effect) */}
          {step === 'generating' && (
            <View style={styles.generatingContent}>
              <View style={styles.generatingOverlay}>
                <View style={styles.generatingInner}>
                  <ActivityIndicator size="large" color={BRAND_COLORS.primary} />
                  <Text variant="heading3" weight="semibold" style={[styles.generatingText, { color: theme.colors.textPrimary }]}>
                    Building your plan...
                  </Text>
                  <Text variant="caption" style={[styles.generatingSubtext, { color: theme.colors.textSecondary }]}>
                    We’re turning your profile into a clear daily starting point
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Step 5: Complete - Show Generated Goals */}
          {step === 'complete' && generatedGoals && (
            <View style={styles.completeContent}>
              <View style={styles.successIcon}>
                <CheckCircle size={56} color="#10B981" weight="fill" />
              </View>
              <Text variant="heading3" weight="bold" style={styles.successTitle}>
                Plan ready
              </Text>

              {/* Daily Calories */}
              <Card style={styles.goalCard}>
                <View style={styles.goalCardHeader}>
                  <Fire size={24} color="#EF4444" weight="fill" />
                  <Text variant="body" weight="semibold">Daily Calories</Text>
                </View>
                <Text variant="heading2" weight="bold" style={styles.goalValue}>
                  {generatedGoals.dailyCalories.target} kcal
                </Text>
                <Text variant="caption" style={styles.goalRange}>
                  Range: {generatedGoals.dailyCalories.min} - {generatedGoals.dailyCalories.max} kcal
                </Text>
                <Text variant="caption" style={styles.goalRationale}>
                  {generatedGoals.dailyCalories.rationale}
                </Text>
              </Card>

              {/* Macros */}
              <Card style={styles.goalCard}>
                <View style={styles.goalCardHeader}>
                  <ChartPie size={24} color={BRAND_COLORS.primary} />
                  <Text variant="body" weight="semibold">Daily Macros</Text>
                </View>
                <View style={styles.macrosRow}>
                  <View style={styles.macroItem}>
                    <Text variant="heading3" weight="bold" style={{ color: BRAND_COLORS.macros.protein }}>
                      {generatedGoals.macros_grams.protein_g}g
                    </Text>
                    <Text variant="caption">Protein</Text>
                  </View>
                  <View style={styles.macroItem}>
                    <Text variant="heading3" weight="bold" style={{ color: BRAND_COLORS.macros.carbs }}>
                      {generatedGoals.macros_grams.carbs_g}g
                    </Text>
                    <Text variant="caption">Carbs</Text>
                  </View>
                  <View style={styles.macroItem}>
                    <Text variant="heading3" weight="bold" style={{ color: BRAND_COLORS.macros.fat }}>
                      {generatedGoals.macros_grams.fat_g}g
                    </Text>
                    <Text variant="caption">Fat</Text>
                  </View>
                </View>
                <Text variant="caption" style={styles.goalRationale}>
                  {generatedGoals.macros_grams.notes}
                </Text>
              </Card>

              {/* Other Targets */}
              <Card style={styles.goalCard}>
                <View style={styles.goalCardHeader}>
                  <Target size={24} color={theme.colors.info} />
                  <Text variant="body" weight="semibold" style={{ color: theme.colors.textPrimary }}>Daily Targets</Text>
                </View>
                <View style={styles.targetRow}>
                  <Leaf size={20} color={theme.colors.success} />
                  <Text variant="body" style={{ color: theme.colors.textSecondary }}>Fiber Target: {generatedGoals.fiberTarget_g_per_day}g</Text>
                </View>
                <View style={styles.targetRow}>
                  <PersonSimpleRun size={20} color={theme.colors.error} />
                  <Text variant="body" style={{ color: theme.colors.textSecondary }}>
                    Cardio: {generatedGoals.weeklyActivityPlan.cardio_minutes_per_week} min/week
                  </Text>
                </View>
                <View style={styles.targetRow}>
                  <Barbell size={20} color={BRAND_COLORS.primary} />
                  <Text variant="body" style={{ color: theme.colors.textSecondary }}>
                    Strength: {generatedGoals.weeklyActivityPlan.strength_sessions_per_week}x/week
                  </Text>
                </View>
                <View style={styles.targetRow}>
                  <Sneaker size={20} color={theme.colors.info} />
                  <Text variant="body" style={{ color: theme.colors.textSecondary }}>
                    Steps: {generatedGoals.weeklyActivityPlan.steps_per_day_target.toLocaleString()}/day
                  </Text>
                </View>
              </Card>

              {/* Safety Note */}
              <Card style={[styles.goalCard, styles.safetyCard, { backgroundColor: theme.colors.warning + '15', borderColor: theme.colors.warning + '40' }]}>
                <View style={styles.safetyHeader}>
                  <WarningCircle size={20} color={theme.colors.warning} />
                  <Text variant="caption" weight="semibold" style={[styles.safetyTitle, { color: theme.colors.warning }]}>
                    Important Note
                  </Text>
                </View>
                <Text variant="caption" style={[styles.safetyText, { color: theme.colors.textSecondary }]}>
                  {generatedGoals.safetyNote}
                </Text>
              </Card>
            </View>
          )}
        </ScrollView>

        {/* Fixed Bottom CTA */}
        {step !== 'generating' && (
          <View style={[styles.modalBottomCta, { paddingBottom: insets.bottom + 12 }]}>
            {step === 'sex' && (
              <Pressable
                style={({ pressed }) => [
                  styles.ctaButton,
                  !canProceedToMeasurements && styles.ctaButtonDisabled,
                  pressed && canProceedToMeasurements && styles.ctaButtonPressed,
                ]}
                disabled={!canProceedToMeasurements}
                onPress={() => setStep('measurements')}
                accessibilityRole="button"
                accessibilityLabel="Continue to measurements"
                accessibilityState={{ disabled: !canProceedToMeasurements }}
              >
                <Text variant="body" weight="bold" style={[styles.ctaButtonText, { color: '#FFFFFF' }]}>
                  Continue
                </Text>
              </Pressable>
            )}

            {step === 'measurements' && (
              <View style={styles.buttonRow}>
                <Pressable
                  style={({ pressed }) => [
                    styles.secondaryButton,
                    pressed && styles.secondaryButtonPressed,
                  ]}
                  onPress={() => setStep('sex')}
                  accessibilityRole="button"
                  accessibilityLabel="Go back to sex selection"
                >
                  <Text variant="body" weight="semibold" style={styles.secondaryButtonText}>
                    Back
                  </Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.ctaButton,
                    styles.ctaButtonFlex,
                    !canProceedToGoal && styles.ctaButtonDisabled,
                    pressed && canProceedToGoal && styles.ctaButtonPressed,
                  ]}
                  disabled={!canProceedToGoal}
                  onPress={() => setStep('goal')}
                  accessibilityRole="button"
                  accessibilityLabel="Continue to goal selection"
                  accessibilityState={{ disabled: !canProceedToGoal }}
                >
                  <Text variant="body" weight="bold" style={styles.ctaButtonText}>
                    Continue
                  </Text>
                </Pressable>
              </View>
            )}

            {step === 'goal' && (
              <View style={styles.buttonRow}>
                <Pressable
                  style={({ pressed }) => [
                    styles.secondaryButton,
                    pressed && styles.secondaryButtonPressed,
                  ]}
                  onPress={() => setStep('measurements')}
                  accessibilityRole="button"
                  accessibilityLabel="Go back to measurements"
                >
                  <Text variant="body" weight="semibold" style={styles.secondaryButtonText}>
                    Back
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.generateButton,
                    !canGenerate && styles.generateButtonDisabled,
                  ]}
                  disabled={!canGenerate}
                  onPress={handleGenerateGoals}
                  accessibilityRole="button"
                  accessibilityLabel="Build your fitness plan"
                  accessibilityState={{ disabled: !canGenerate }}
                >
                  <View
                    style={[
                      styles.generateButtonGradient,
                      !canGenerate && styles.generateButtonGradientDisabled,
                    ]}
                  >
                    <MagicWand size={20} color="#FFF" />
                    <Text variant="body" weight="bold" style={styles.generateButtonText}>
                      Build Plan
                    </Text>
                  </View>
                </Pressable>
              </View>
            )}

            {step === 'complete' && (
              <Pressable
                style={({ pressed }) => [
                  styles.ctaButton,
                  pressed && styles.ctaButtonPressed,
                ]}
                onPress={handleSaveAndClose}
                accessibilityRole="button"
                accessibilityLabel="Save goals and go to dashboard"
              >
                <Text variant="body" weight="bold" style={[styles.ctaButtonText, { color: '#FFFFFF' }]}>
                  Save & View Dashboard
                </Text>
              </Pressable>
            )}
          </View>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );

  if (currentUser.isLoading) {
    return (
      <SafeAreaWrapper>
        <StateView type="loading" title="Loading Profile..." />
      </SafeAreaWrapper>
    );
  }

  if (currentUser.isError) {
    return (
      <SafeAreaWrapper>
        <StateView
          type="error"
          title="Unable to load profile"
          onRetry={() => currentUser.refetch()}
        />
      </SafeAreaWrapper>
    );
  }

  const displayName = currentUser.data?.username || userEmail?.split('@')[0] || 'User';
  const currentStreak = currentUser.data?.currentStreak || 0;

  // F7 — Personal records
  const personalRecords = usePersonalRecords(currentStreak);

  // F13 — Consistency heatmap
  const heatmapCells = useConsistencyCells(12);

  // F14 — Day history sheet
  const [dayDetail, setDayDetail] = useState<string | undefined>(undefined);
  const goalTypeLabel = generatedGoals?.goalType
    ? GOAL_OPTIONS.find(g => g.value === generatedGoals.goalType)?.label
    : null;
  const profileSummary = generatedGoals
    ? `${goalTypeLabel || 'Active'} plan live · ${generatedGoals.dailyCalories.target} kcal target`
    : 'Set a plan to personalize calories, macros, and your dashboard.';

  // Calculate bottom padding to account for tab bar
  const contentBottomPadding = useContentBottomPadding(spacing.xl);

  // Determine which avatar to display:
  // 1. Optimistic preview (local file) - shows immediately after selection
  // 2. Server URL with cache busting - shows after upload completes
  // 3. Default icon - when no avatar exists
  const displayAvatarUri = optimisticAvatarUri || (avatarUrl ? getAvatarUri(avatarUrl) : undefined);

  return (
    <SafeAreaWrapper>
      <View style={styles.screenRoot}>
        {Platform.OS !== 'web' && (
          <View pointerEvents="none" style={styles.mobileBackdropLayer}>
            <View style={[styles.mobileBackdropBand, styles.mobileBackdropBandWarm]} />
            <View style={[styles.mobileBackdropBand, styles.mobileBackdropBandMint]} />
            <View style={[styles.mobileBackdropBand, styles.mobileBackdropBandSky]} />
          </View>
        )}
        <ScrollView
          style={[styles.container, { backgroundColor: 'transparent' }]}
          contentContainerStyle={[styles.content, { paddingBottom: contentBottomPadding }]}
        >
        {/* Profile Header */}
        <Animated.View entering={staggerEnter(0)} style={styles.header}>
          <View style={styles.headerTopRow}>
            <Text variant="label" weight="bold" style={styles.headerKicker}>PROFILE</Text>
            <View style={[styles.headerStatusPill, generatedGoals ? styles.headerStatusPillActive : styles.headerStatusPillIdle]}>
              <Text variant="caption" weight="bold" style={[styles.headerStatusText, generatedGoals ? styles.headerStatusTextActive : styles.headerStatusTextIdle]}>
                {generatedGoals ? 'PLAN READY' : 'SET YOUR PLAN'}
              </Text>
            </View>
          </View>
          {/* Single Pressable for entire avatar area to avoid touch conflicts */}
          <Pressable
            style={({ pressed }) => [
              styles.avatarContainer,
              pressed && !isUploadingAvatar && { opacity: 0.7 },
            ]}
            onPress={handleAvatarPress}
            disabled={isUploadingAvatar}
            accessibilityRole="button"
            accessibilityLabel="Change profile photo"
          >
            <View
              style={[
                styles.avatar,
              ]}
            >
              {/* Avatar content - prioritizes optimistic preview for instant feedback */}
              {displayAvatarUri ? (
                <Image
                  key={optimisticAvatarUri ? 'optimistic' : avatarCacheKey}
                  source={{ uri: displayAvatarUri }}
                  style={styles.avatarImage}
                />
              ) : (
                <User size={40} color={BRAND_COLORS.primary} />
              )}
              {/* Loading overlay - shows spinner while uploading (optimistic preview visible underneath) */}
              {isUploadingAvatar && (
                <View style={styles.avatarLoadingOverlay}>
                  <ActivityIndicator size="small" color={BRAND_COLORS.primary} />
                </View>
              )}
            </View>
            <View
              style={[
                styles.editAvatarBtn,
                isUploadingAvatar && { opacity: 0.5 },
              ]}
              pointerEvents="none"
            >
              <Camera size={14} color="#FFF" />
            </View>
          </Pressable>
          <Text variant="heading2" weight="bold" style={styles.profileName}>Hi, {displayName}</Text>
          <Text variant="body" style={styles.profileSummary}>{profileSummary}</Text>
          <View style={styles.profileMetaRow}>
            <View style={[styles.profileMetaPill, styles.profileMetaWarm]}>
              <Text variant="caption" weight="bold" style={styles.profileMetaText}>
                {generatedGoals ? `${generatedGoals.dailyCalories.target} kcal` : 'General reference'}
              </Text>
            </View>
            <View style={[styles.profileMetaPill, styles.profileMetaMint]}>
              <Text variant="caption" weight="bold" style={styles.profileMetaText}>
                {currentStreak} day streak
              </Text>
            </View>
          </View>
          <Text variant="caption" style={styles.email}>{userEmail}</Text>
        </Animated.View>

        {/* F7 — Personal Records (Strava-style PR grid) */}
        <PersonalRecordsCard records={personalRecords} />

        {/* F13 — Consistency heatmap (GitHub style) */}
        <ConsistencyHeatmap
          cells={heatmapCells}
          weeks={12}
          onDayPress={(cell) => setDayDetail(cell.date)}
        />

        {/* Goals Status */}
        {generatedGoals ? (
          <Card style={styles.goalsStatusCard}>
            <View style={styles.goalsStatusHeader}>
              <CheckCircle size={24} color={theme.colors.success} weight="fill" />
              <Text variant="body" weight="semibold" style={styles.goalsStatusTitle}>Active Plan</Text>
              {goalTypeLabel && (
                <View style={styles.goalTypeBadge}>
                  <Text variant="caption" weight="bold" style={styles.goalTypeBadgeText}>
                    {goalTypeLabel}
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.goalsPreview}>
              <View style={styles.goalsPreviewRow}>
                <Text variant="caption" style={styles.goalsPreviewLabel}>Daily Target:</Text>
                <Text variant="body" weight="bold" style={styles.goalsPreviewValue}>
                  {generatedGoals.dailyCalories.target} kcal
                </Text>
              </View>
              <View style={styles.goalsPreviewRow}>
                <Text variant="caption" style={styles.goalsPreviewLabel}>Macros:</Text>
                <Text variant="body" weight="semibold" style={styles.goalsPreviewMacroValue}>
                  P: {generatedGoals.macros_grams.protein_g}g | C: {generatedGoals.macros_grams.carbs_g}g | F: {generatedGoals.macros_grams.fat_g}g
                </Text>
              </View>
            </View>
            <Button
              title="Refresh Plan"
              variant="primary"
              onPress={() => setShowGoalsModal(true)}
              style={styles.refreshPlanButton}
              textColor="#FFFFFF"
            />
          </Card>
        ) : (
          <Pressable
            style={({ pressed }) => [
              styles.generateGoalsCard,
              pressed && styles.generateGoalsCardPressed,
            ]}
            onPress={() => setShowGoalsModal(true)}
            accessibilityRole="button"
            accessibilityLabel="Set your fitness goals"
          >
            <View style={styles.generateGoalsInner}>
              <View style={styles.generateGoalsIcon}>
                <Target size={22} color={BRAND_COLORS.primary} />
              </View>
              <View style={styles.generateGoalsCopy}>
                <Text variant="body" weight="bold" style={styles.generateGoalsTitle}>
                  Set Your Plan
                </Text>
                <Text variant="caption" style={styles.generateGoalsText} numberOfLines={2}>
                  Build calorie and macro targets that match your routine
                </Text>
              </View>
              <View style={styles.generateGoalsCta}>
                <Text variant="caption" weight="semibold" style={styles.generateGoalsCtaText}>
                  Start
                </Text>
                <ArrowRight size={16} color={BRAND_COLORS.primary} />
              </View>
            </View>
          </Pressable>
        )}

        {/* Menu Items */}
        <Animated.View entering={staggerEnter(2)} style={styles.menuSection}>
          <Text variant="heading3" weight="semibold" style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
            Your Library
          </Text>
          {renderMenuItem(
            'dumbbell',
            'Saved Workouts',
            'Your bookmarked workouts',
            () => navigation.navigate('SavedWorkouts' as any)
          )}
          {renderMenuItem(
            'book-open-variant',
            'Saved Recipes',
            'Your favorite recipes',
            () => navigation.navigate('SavedRecipes' as any)
          )}
          {renderMenuItem(
            'food-apple',
            'Meal History',
            'View your nutrition logs',
            () => navigation.navigate('MealHistory' as any)
          )}
          {renderMenuItem(
            'chart-line',
            'Weekly Insights',
            'Analyze your nutrition trends',
            () => navigation.navigate('WeeklyInsights' as any)
          )}
          {renderMenuItem(
            'chart-timeline-variant',
            'Behavior Insights',
            'Explore habits linked to your Daily Score',
            () => navigation.navigate('Insights' as any)
          )}
        </Animated.View>

        <Animated.View entering={staggerEnter(3)} style={styles.menuSection}>
          <Text variant="heading3" weight="semibold" style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
            Settings
          </Text>
          {renderMenuItem(
            'account-edit-outline',
            'Account Details',
            'Change name',
            () => setShowEditNameModal(true)
          )}
          {renderMenuItem(
            'food-apple-outline',
            'Nutrition Sources',
            'Data sources & disclaimer',
            () => navigation.navigate('AboutNutritionData' as any)
          )}
          {renderMenuItem(
            'bell-outline',
            'Notifications',
            'Manage reminders',
            () => Alert.alert('Coming Soon', 'Notification settings will be available soon.')
          )}
          {renderMenuItem(
            'account-remove-outline',
            'Close Account',
            'Permanently delete your account',
            handleCloseAccount
          )}
        </Animated.View>

        {/* Logout Button */}
        <Pressable
          style={({ pressed }) => [
            styles.logoutButton,
            pressed && styles.logoutButtonPressed,
          ]}
          onPress={handleLogout}
          accessibilityRole="button"
          accessibilityLabel="Logout from your account"
        >
          <SignOut size={20} color={theme.colors.error} />
          <Text variant="body" weight="semibold" style={styles.logoutText}>
            Logout
          </Text>
        </Pressable>
        </ScrollView>
      </View>

      {/* Only render Modal when it should be visible */}
      {showGoalsModal && renderGoalsModal()}

      {/* Edit Name Modal */}
      <EditNameModal
        visible={showEditNameModal}
        onDismiss={() => setShowEditNameModal(false)}
        onSave={handleUpdateUsername}
        currentName={currentUser.data?.username || ''}
        isLoading={isUpdatingName}
      />

      {/* F14 — Day history sheet */}
      <DayHistorySheet date={dayDetail} onClose={() => setDayDetail(undefined)} />

      {/* Apple HIG pre-permission modal — photo library access for avatar */}
      <PermissionRequestModal
        visible={permissionModal.visible}
        permissionType={permissionModal.type}
        onAllow={handleAvatarPermissionAllowed}
        onCancel={() => setPermissionModal((p) => ({ ...p, visible: false }))}
      />
    </SafeAreaWrapper>
  );
};

const styles = StyleSheet.create({
  screenRoot: {
    flex: 1,
    backgroundColor: '#FFF9F2',
  },
  mobileBackdropLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  mobileBackdropBand: {
    position: 'absolute',
    borderRadius: 999,
  },
  mobileBackdropBandWarm: {
    width: 220,
    height: 220,
    top: -70,
    right: -70,
    backgroundColor: 'rgba(255, 211, 182, 0.4)',
  },
  mobileBackdropBandMint: {
    width: 220,
    height: 220,
    top: 320,
    left: -110,
    backgroundColor: 'rgba(197, 242, 225, 0.34)',
  },
  mobileBackdropBandSky: {
    width: 250,
    height: 250,
    bottom: 180,
    right: -130,
    backgroundColor: 'rgba(208, 231, 255, 0.28)',
  },
  container: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    // paddingBottom is set dynamically via useContentBottomPadding
  },
  header: {
    alignItems: 'center',
    padding: spacing.xl,
    borderRadius: 32,
    backgroundColor: '#FFFEFB',
    borderWidth: 1,
    borderColor: '#E9DED0',
    marginBottom: spacing.lg,
    shadowColor: '#111111',
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 24,
    shadowOpacity: 0.06,
    elevation: 7,
  },
  headerTopRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  headerKicker: {
    color: '#8A7560',
    letterSpacing: 1.2,
  },
  headerStatusPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  headerStatusPillActive: {
    backgroundColor: '#ECF9F3',
    borderColor: '#CBEBDD',
  },
  headerStatusPillIdle: {
    backgroundColor: '#FFF1E5',
    borderColor: '#F3D8BF',
  },
  headerStatusText: {
    fontSize: 11,
    letterSpacing: 0.3,
  },
  headerStatusTextActive: {
    color: '#2F7A6A',
  },
  headerStatusTextIdle: {
    color: '#8C4A1D',
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: spacing.md,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FBF8F1',
    borderWidth: 1,
    borderColor: '#E9E0D4',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editAvatarBtn: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: BRAND_COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    elevation: 5, // Android shadow/z-index
  },
  profileName: {
    color: '#111111',
  },
  profileSummary: {
    color: '#374151',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 22,
  },
  profileMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  profileMetaPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  profileMetaWarm: {
    backgroundColor: '#FFF4EA',
    borderColor: '#F3D7BE',
  },
  profileMetaMint: {
    backgroundColor: '#ECF9F3',
    borderColor: '#CBEBDD',
  },
  profileMetaText: {
    color: '#111111',
    fontSize: 12,
  },
  email: {
    opacity: 0.7,
    marginTop: spacing.xs,
    color: '#6B665F',
  },
  goalsStatusCard: {
    padding: spacing.lg,
    marginBottom: spacing.lg,
    gap: spacing.md,
    backgroundColor: '#FFFEFB',
    borderColor: '#E9DED0',
    borderWidth: 1,
    borderRadius: 28,
  },
  goalsStatusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  goalsStatusTitle: {
    color: '#111111',
  },
  goalTypeBadge: {
    backgroundColor: '#111111',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 'auto',
  },
  goalTypeBadgeText: {
    color: '#FFF',
    fontSize: 11,
  },
  goalsPreview: {
    backgroundColor: '#FBF8F1',
    padding: spacing.md,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E9E0D4',
    gap: spacing.xs,
  },
  goalsPreviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  goalsPreviewLabel: {
    opacity: 0.8,
    color: '#6B665F',
  },
  goalsPreviewValue: {
    color: '#111111',
  },
  goalsPreviewMacroValue: {
    color: '#111111',
  },
  refreshPlanButton: {
    backgroundColor: '#111111',
  },
  generateGoalsCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E7DCCF',
    backgroundColor: '#FFFEFB',
    padding: spacing.lg,
    marginBottom: spacing.lg,
    shadowColor: '#111111',
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 22,
    shadowOpacity: 0.05,
    elevation: 6,
    ...(Platform.OS === 'web' && {
      cursor: 'pointer' as any,
      transition: 'all 0.15s ease-out',
    }),
  },
  generateGoalsCardPressed: {
    backgroundColor: '#FFF7EF',
  },
  generateGoalsInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  generateGoalsIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FFF1E5',
    borderWidth: 1,
    borderColor: '#F3D8BF',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  generateGoalsCopy: {
    flex: 1,
    minWidth: 0,
  },
  generateGoalsTitle: {
    color: BRAND_COLORS.textPrimary,
  },
  generateGoalsText: {
    color: '#6B665F',
    marginTop: 2,
  },
  generateGoalsCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#FBF8F1',
    borderWidth: 1,
    borderColor: '#E9E0D4',
    flexShrink: 0,
  },
  generateGoalsCtaText: {
    color: BRAND_COLORS.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  menuSection: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    marginBottom: spacing.sm,
    color: '#111111',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFEFB',
    padding: spacing.md,
    borderRadius: 22,
    marginBottom: spacing.sm,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: '#E9DED0',
    shadowColor: '#111111',
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    shadowOpacity: 0.04,
    elevation: 4,
  },
  menuItemPressed: {
    opacity: 0.82,
  },
  menuIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuContent: {
    flex: 1,
  },
  menuTitle: {
    color: '#111111',
  },
  menuSubtitle: {
    opacity: 1,
    color: '#6B665F',
  },
  badge: {
    backgroundColor: '#111111',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#F5C2C7',
    backgroundColor: '#FFFEFB',
    gap: spacing.sm,
  },
  logoutButtonPressed: {
    backgroundColor: '#FFF4F5',
  },
  logoutText: {
    color: '#EF4444',
  },
  // Full-screen modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFF9F2',
  },
  modalAppBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#ECE3D7',
    backgroundColor: '#FFFDF9',
  },
  homeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FBF8F1',
    borderWidth: 1,
    borderColor: '#E9E0D4',
  },
  modalTitle: {
    flex: 1,
  },
  modalTitleCentered: {
    textAlign: 'center',
    marginHorizontal: spacing.sm,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FBF8F1',
    borderWidth: 1,
    borderColor: '#E9E0D4',
  },
  modalScrollView: {
    flex: 1,
  },
  modalScrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    flexGrow: 1,
  },
  modalBottomCta: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#ECE3D7',
    backgroundColor: '#FFFDF9',
  },
  ctaButton: {
    backgroundColor: '#111111',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    ...(Platform.OS === 'web' && {
      cursor: 'pointer',
    }),
  },
  ctaButtonFlex: {
    flex: 1,
  },
  ctaButtonDisabled: {
    opacity: 0.5,
  },
  ctaButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  ctaButtonText: {
    color: '#FFFFFF',
  },
  secondaryButton: {
    paddingVertical: 16,
    paddingHorizontal: spacing.xl,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E9DED0',
    minHeight: 52,
  },
  secondaryButtonPressed: {
    opacity: 0.7,
  },
  secondaryButtonText: {
    color: '#111111',
  },
  stepContent: {
    flex: 1,
    gap: spacing.xl,
    justifyContent: 'center',
  },
  optionPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  stepDescription: {
    opacity: 0.7,
    lineHeight: 22,
  },
  stepLabel: {
    marginTop: spacing.sm,
  },
  sexOptions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  sexOption: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: 16,
    backgroundColor: '#FBF8F1',
    borderWidth: 1,
    borderColor: '#E9E0D4',
    gap: spacing.sm,
  },
  optionTextSelected: {
    color: '#FFF',
  },
  wheelPickersContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: spacing.lg,
  },
  goalOptions: {
    gap: spacing.md,
  },
  goalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: 16,
    backgroundColor: '#FBF8F1',
    borderWidth: 2,
    borderColor: '#E9E0D4',
    gap: spacing.md,
  },
  goalIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  goalTextContainer: {
    flex: 1,
  },
  goalDescription: {
    opacity: 0.78,
    marginTop: 2,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  generateButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  generateButtonDisabled: {
    opacity: 0.5,
  },
  generateButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: spacing.sm,
    backgroundColor: '#111111',
  },
  generateButtonGradientDisabled: {
    backgroundColor: '#6B7280',
  },
  generateButtonText: {
    color: '#FFF',
  },
  generatingContent: {
    flex: 1,
    justifyContent: 'center',
  },
  generatingOverlay: {
    flex: 1,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E9DED0',
  },
  generatingInner: {
    alignItems: 'center',
    gap: spacing.md,
  },
  generatingText: {
    textAlign: 'center',
    marginTop: spacing.md,
  },
  generatingSubtext: {
    opacity: 0.6,
    textAlign: 'center',
  },
  completeContent: {
    flex: 1,
  },
  successIcon: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  successTitle: {
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  goalCard: {
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
    backgroundColor: '#FFFEFB',
    borderWidth: 1,
    borderColor: '#E9DED0',
    borderRadius: 24,
  },
  goalCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  goalValue: {
    color: BRAND_COLORS.primary,
    fontSize: 32,
  },
  goalRange: {
    opacity: 0.6,
  },
  goalRationale: {
    opacity: 0.7,
    lineHeight: 20,
    marginTop: spacing.xs,
  },
  macrosRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: spacing.sm,
  },
  macroItem: {
    alignItems: 'center',
  },
  targetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 4,
  },
  safetyCard: {
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  safetyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  safetyTitle: {
    color: '#F59E0B',
  },
  safetyText: {
    opacity: 0.8,
    lineHeight: 18,
  },
});

export default ProfileScreen;
