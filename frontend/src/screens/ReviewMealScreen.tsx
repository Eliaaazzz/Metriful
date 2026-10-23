import { AIDisclaimer } from '@/components/common/AIDisclaimer';
import { PermissionRequestModal } from '@/components/common/PermissionRequestModal';
import { RecognitionProcessingHero } from '@/components/common/RecognitionProcessingHero';
import { ClarifyQuestionCard } from '@/components/nutrition/ClarifyQuestionCard';
import { DetectedItemRow } from '@/components/nutrition/DetectedItemRow';
import { HowEstimatedSheet } from '@/components/nutrition/HowEstimatedSheet';
import { ShareMealSheet } from '@/components/nutrition/ShareMealSheet';
import { NutritionSummaryCard } from '@/components/nutrition/NutritionSummaryCard';
import { ScanStagesList } from '@/components/nutrition/ScanStagesList';
import { CameraView } from '@/components/CameraView';
import { VisionCameraView } from '@/components/VisionCameraView';
import { useCameraPermission } from '@/hooks/useCameraPermission';
import { useDailyNutrition } from '@/hooks/useDailyNutrition';
import { useDeviceCapabilities } from '@/hooks/useDeviceCapabilities';
import { trackEvent } from '@/services/analytics';
import nutritionApi, {
  DetectedFood,
  TotalNutrition,
} from '@/services/nutritionApi';
import { useScanStore } from '@/stores';
import { applyClarifyAnswer, buildClarifyQuestions, ClarifyQuestion } from '@/utils/clarify';
import { normalizeMimeType } from '@/utils/imageSource';
import { buildNextStep } from '@/utils/nextStep';
import { BRAND_COLORS, DEFAULT_MEAL_IMAGE_WIDTH_CM, NUTRITION_REFERENCES, openExternalUrl } from '@/utils';
import { ArrowLeft, Camera, Check, ImageSquare, MagnifyingGlass, SealCheck, WarningCircle } from 'phosphor-react-native';
import { Image as ExpoImage } from 'expo-image';

/**
 * Merge duplicate food items by name, combining their nutritional values.
 * Example: 8 "Fried Chicken" items become 1 item with amount=8 and summed nutrition.
 */
function mergeDuplicateFoods(foods: DetectedFood[]): DetectedFood[] {
  const merged = new Map<string, DetectedFood>();

  for (const food of foods) {
    const key = food.name.toLowerCase().trim();
    const existing = merged.get(key);

    if (existing) {
      // Merge: sum nutrition values and increment amount
      merged.set(key, {
        ...existing,
        amount: existing.amount + (food.amount || 1),
        calories: existing.calories + food.calories,
        protein: existing.protein + food.protein,
        carbs: existing.carbs + food.carbs,
        fat: existing.fat + food.fat,
      });
    } else {
      // First occurrence: clone with amount defaulting to 1
      merged.set(key, {
        ...food,
        amount: food.amount || 1,
        unit: food.unit || 'piece',
      });
    }
  }

  return Array.from(merged.values());
}
import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const SUCCESS_GRADIENT = [BRAND_COLORS.secondary, BRAND_COLORS.primary] as const;
const CARD_SHADOW = {
  shadowColor: '#0F172A',
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 0.06,
  shadowRadius: 18,
  elevation: 3,
} as const;
const ENTRANCE_EASING = Easing.bezier(0.2, 0.8, 0.2, 1);

const hasMeaningfulNutrition = (value: TotalNutrition | null): boolean => {
  if (!value) return false;
  return [value.calories, value.protein, value.carbs, value.fat].some((metric) => Number(metric) > 0);
};

const hasBreakdownItems = (foods: DetectedFood[]): boolean => foods.some((food) => Number(food.amount) > 0);
const normalizeRouteMimeType = normalizeMimeType;

type WebSelectedImage = {
  uri: string;
  mimeType?: string;
  fileName?: string;
};

const pickWebImageFile = (useCamera = false): Promise<WebSelectedImage | null> => {
  if (typeof document === 'undefined' || typeof window === 'undefined' || typeof URL === 'undefined') {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    // On iPad Safari, capture="environment" opens the rear camera directly
    if (useCamera) {
      input.setAttribute('capture', 'environment');
    }
    input.tabIndex = -1;
    input.setAttribute('aria-hidden', 'true');
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    input.style.width = '1px';
    input.style.height = '1px';
    input.style.opacity = '0';
    input.style.pointerEvents = 'none';

    let finished = false;

    const cleanup = () => {
      input.removeEventListener('change', handleChange);
      window.removeEventListener('focus', handleWindowFocus);
      if (input.parentNode) {
        input.parentNode.removeChild(input);
      }
    };

    const finish = (value: WebSelectedImage | null) => {
      if (finished) return;
      finished = true;
      cleanup();
      resolve(value);
    };

    const handleChange = () => {
      const file = input.files?.[0];
      if (!file) {
        finish(null);
        return;
      }

      finish({
        uri: URL.createObjectURL(file),
        mimeType: file.type || undefined,
        fileName: file.name || undefined,
      });
    };

    const handleWindowFocus = () => {
      window.setTimeout(() => {
        if (!finished && !input.files?.length) {
          finish(null);
        }
      }, 300);
    };

    input.addEventListener('change', handleChange);
    window.addEventListener('focus', handleWindowFocus);
    document.body.appendChild(input);
    input.click();
  });
};

export function ReviewMealScreen({ route, navigation }: any) {
  // Support both new image analysis and viewing/editing saved meals
  const { imageUri, imageMimeType, imageFileName, meal, openCamera, imgWcm, volumeCm3, items: lidarItems, scanId: routeScanId } = route.params ?? {};
  const isViewingExisting = !!meal;
  // On web, camera is not available — skip camera UI and auto-open gallery
  const shouldShowCamera = !!openCamera && !imageUri && !isViewingExisting && Platform.OS !== 'web';

  const cameraPerm = useCameraPermission();
  const capabilities = useDeviceCapabilities();
  // Use the depth-aware camera only on devices with a real depth sensor (LiDAR/ToF);
  // everything else (and web) keeps the existing basic camera. Safe either way: when no
  // real depth is available the computed imgWcm is null and we fall back to scaleHintCm.
  const useDepthCapture = Platform.OS !== 'web' && (capabilities.hasLiDAR || capabilities.hasToF);
  const scaleHintCm = typeof imgWcm === 'number' ? imgWcm : DEFAULT_MEAL_IMAGE_WIDTH_CM;
  // Absolute LiDAR food volume (cm³) captured at photo time; enables geometric portion refinement
  // on the backend. Undefined for gallery photos / non-depth devices, where the backend no-ops.
  const volumeHintCm = typeof volumeCm3 === 'number' && volumeCm3 > 0 ? volumeCm3 : undefined;
  // Per-item LiDAR regions captured at photo time → per-item portion refinement server-side (each
  // food corrected by its own volume × density). Mapped to the backend's snake_case shape; cleared
  // for gallery photos / retakes (see resets below) so no stale per-item volumes leak into analysis.
  const itemsHint = Array.isArray(lidarItems) && lidarItems.length > 0
    ? lidarItems
        .filter((r: any) => r && typeof r.volumeCm3 === 'number' && r.volumeCm3 > 0)
        .map((r: any) => ({ volume_cm3: r.volumeCm3, area_cm2: r.areaCm2, cx: r.cx, cy: r.cy }))
    : undefined;

  const insets = useSafeAreaInsets();
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();
  const queryClient = useQueryClient();
  const hasRequestedCameraPermissionRef = useRef(false);
  const webObjectUrlRef = useRef<string | null>(null);
  const lastAnalyzedImageUriRef = useRef<string | null>(null);
  const [loading, setLoading] = useState(!isViewingExisting); // Don't show loading for existing meals
  const [phase, setPhase] = useState<1 | 2 | 3>(1);
  // Analysis runs in the scan store (not this component) so it survives leaving the screen;
  // `activeScanId` binds this screen to one scan — either the one it started, or a background
  // scan it was reopened for via the Dashboard status chip ({ scanId } route param).
  const [activeScanId, setActiveScanId] = useState<string | undefined>(
    typeof routeScanId === 'string' ? routeScanId : undefined
  );
  const appliedScanIdRef = useRef<string | null>(null);
  const storeScan = useScanStore((s) => s.scan);
  const scan = storeScan && storeScan.scanId === activeScanId ? storeScan : null;
  const [items, setItems] = useState<DetectedFood[]>(() => {
    // Initialize with existing meal data if viewing
    if (meal?.foodItems) {
      const rawItems = meal.foodItems.map((food: any, index: number) => ({
        id: food.foodKey || `item-${index}`,
        name: food.displayName,
        amount: 1, // Each record represents 1 item
        unit: 'piece',
        calories: food.calories,
        protein: food.protein,
        carbs: food.carbs,
        fat: food.fat,
        confidence: food.confidence,
      }));
      // Merge duplicate items (e.g., 8 "Fried Chicken" -> 1 item with amount=8)
      return mergeDuplicateFoods(rawItems);
    }
    return [];
  });
  const [total, setTotal] = useState<TotalNutrition | null>(() => {
    // Initialize with existing meal totals if viewing
    if (meal) {
      return {
        calories: meal.totalCalories || 0,
        protein: meal.totalProtein || 0,
        carbs: meal.totalCarbs || 0,
        fat: meal.totalFat || 0,
      };
    }
    return null;
  });

  // Keep track of base nutrition values (per 1 unit) to avoid NaN when amount goes to 0 and back
  const [baseNutrition] = useState<Map<string, any>>(new Map());

  const [processedImageUri, setProcessedImageUri] = useState<string>(imageUri || meal?.imageUrl || '');
  const [serverImageUrl, setServerImageUrl] = useState<string | undefined>(meal?.imageUrl || undefined);
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successAnim] = useState(new Animated.Value(0));
  const [heroAnim] = useState(new Animated.Value(isViewingExisting ? 1 : 0));
  const [statusAnim] = useState(new Animated.Value(isViewingExisting ? 1 : 0));
  const [detailsAnim] = useState(new Animated.Value(isViewingExisting ? 1 : 0));
  const [retryCount, setRetryCount] = useState(0);
  const [analysisError, setAnalysisError] = useState<{ title: string; message: string } | null>(null);
  const [mealId] = useState<number | undefined>(meal?.id);
  // Nutrition-cart interactions: one-question clarifications, per-item portion factors,
  // manual add, "How was this estimated?" sheet, and the post-log value snapshot.
  const [clarifyQueue, setClarifyQueue] = useState<ClarifyQuestion[]>([]);
  const [clarifyTotal, setClarifyTotal] = useState(0);
  const [portionFactors, setPortionFactors] = useState<Map<string, number>>(new Map());
  const [howSheetVisible, setHowSheetVisible] = useState(false);
  const [shareSheetVisible, setShareSheetVisible] = useState(false);
  const [savedMealId, setSavedMealId] = useState<number | null>(null);
  const [postLog, setPostLog] = useState<{
    kcalRemaining: number | null;
    proteinRemaining: number | null;
    nextStep: string;
    mealSlot: string;
  } | null>(null);
  const [undoing, setUndoing] = useState(false);
  const dailyNutrition = useDailyNutrition();
  const MAX_RETRIES = 3;
  const contentMaxWidth = Platform.OS === 'web' ? 760 : viewportWidth;
  const previewWidth = Math.max(0, Math.min(viewportWidth - 32, contentMaxWidth - 32));
  const imagePreviewHeight =
    Platform.OS === 'web'
      ? Math.max(220, Math.min(Math.round(previewWidth * 0.58), 360, Math.round(viewportHeight * 0.34)))
      : Math.max(220, Math.min(Math.round(previewWidth * 0.75), Math.round(viewportHeight * 0.42)));
  const hasDetectedResults = hasBreakdownItems(items);
  const hasVisibleTotals = hasMeaningfulNutrition(total);
  const canSaveMeal = hasDetectedResults && hasVisibleTotals;
  const isNarrowPhone = viewportWidth < 390;

  // Pre-permission modal for photo library ("Pick another" flow)
  const [galleryPermModal, setGalleryPermModal] = useState(false);

  const navigateToHome = () => {
    navigation.navigate('Main', { screen: 'Dashboard' });
  };

  const rememberWebObjectUrl = (uri?: string | null) => {
    if (Platform.OS !== 'web' || typeof URL === 'undefined' || !uri?.startsWith('blob:')) {
      return;
    }

    if (webObjectUrlRef.current && webObjectUrlRef.current !== uri) {
      URL.revokeObjectURL(webObjectUrlRef.current);
    }

    webObjectUrlRef.current = uri;
  };

  const prepareSelectedImageForAnalysis = (assetUri: string) => {
    setLoading(true);
    setAnalysisError(null);
    setPhase(1);
    setItems([]);
    setTotal(null);
    setSaving(false);
    setProcessedImageUri(assetUri);
    setServerImageUrl(undefined);
    baseNutrition.clear();
    setShowSuccess(false);
    setClarifyQueue([]);
    setClarifyTotal(0);
    setPortionFactors(new Map());
    setSavedMealId(null);
    setPostLog(null);
    successAnim.setValue(0);
  };

  const applySelectedImage = (asset: { uri: string; mimeType?: string | null; fileName?: string | null }) => {
    // A new photo supersedes any in-flight or finished background scan.
    useScanStore.getState().clearScan();
    appliedScanIdRef.current = null;
    prepareSelectedImageForAnalysis(asset.uri);
    rememberWebObjectUrl(asset.uri);
    navigation.setParams({
      imageUri: asset.uri,
      imageMimeType: asset.mimeType,
      imageFileName: asset.fileName,
      openCamera: false,
      imgWcm: scaleHintCm,
      scanId: undefined,
      // Gallery images carry no depth — clear any stale LiDAR volume/regions from a prior capture.
      volumeCm3: null,
      items: null,
    });
  };

  const handleRetake = () => {
    if (Platform.OS === 'web') {
      void openGallery();
      return;
    }

    // Retaking abandons the current scan; the next capture starts a fresh one.
    useScanStore.getState().clearScan();
    appliedScanIdRef.current = null;
    setActiveScanId(undefined);

    // Directly reopen the in-app camera from review state.
    navigation.setParams({
      imageUri: undefined,
      imageMimeType: undefined,
      imageFileName: undefined,
      openCamera: true,
      imgWcm: scaleHintCm,
      scanId: undefined,
      // Reset LiDAR volume/regions on retake; the next capture supplies a fresh reading (or none).
      volumeCm3: null,
      items: null,
    });
  };

  // Recalculate total nutrition whenever items change
  useEffect(() => {
    if (items.length === 0) return;

    const newTotal: TotalNutrition = items.reduce(
      (acc, item) => ({
        calories: acc.calories + (item.calories || 0),
        protein: acc.protein + (item.protein || 0),
        carbs: acc.carbs + (item.carbs || 0),
        fat: acc.fat + (item.fat || 0),
        fiber: (acc.fiber || 0) + (item.fiber || 0),
        sugar: (acc.sugar || 0) + (item.sugar || 0),
        glycemicLoad: (acc.glycemicLoad || 0) + (item.glycemicLoad || 0),
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, glycemicLoad: 0 }
    );

    // Apply calculated values
    if (newTotal.sugar) {
      newTotal.sugarCubes = newTotal.sugar / 4;
    }
    if (newTotal.fiber) {
      newTotal.netCarbs = Math.max(0, newTotal.carbs - newTotal.fiber);
    }

    setTotal(newTotal);
  }, [items]);

  // Camera permission is now requested via the "Continue" button in the pre-prompt UI,
  // not auto-triggered. We only track the ref for refresh logic.
  useEffect(() => {
    if (!shouldShowCamera) {
      hasRequestedCameraPermissionRef.current = false;
    }
  }, [shouldShowCamera]);

  // On web, show permission modal when camera was requested (camera not available on web).
  const [showWebPermissionModal, setShowWebPermissionModal] = useState(
    Platform.OS === 'web' && !!openCamera && !imageUri && !isViewingExisting
  );

  useEffect(() => {
    return () => {
      if (webObjectUrlRef.current && typeof URL !== 'undefined') {
        URL.revokeObjectURL(webObjectUrlRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      return;
    }

    setShowWebPermissionModal(!!openCamera && !imageUri && !isViewingExisting);
  }, [imageUri, isViewingExisting, openCamera]);

  const handleWebPermissionAllow = async () => {
    setShowWebPermissionModal(false);
    try {
      // When openCamera is true, use capture="environment" so iPad Safari opens the device camera
      const asset = await pickWebImageFile(!!openCamera);
      if (!asset?.uri) {
        navigation.setParams({ openCamera: false });
        setLoading(false);
        navigateToHome();
        return;
      }

      applySelectedImage(asset);
    } catch {
      navigation.setParams({ openCamera: false });
      setLoading(false);
      navigateToHome();
    }
  };

  const handleWebPermissionCancel = () => {
    setShowWebPermissionModal(false);
    navigation.setParams({ openCamera: false });
    setLoading(false);
    navigateToHome();
  };

  useEffect(() => {
    if (shouldShowCamera) {
      return;
    }

    heroAnim.setValue(0);
    statusAnim.setValue(0);
    detailsAnim.setValue(isViewingExisting ? 1 : 0);

    Animated.stagger(90, [
      Animated.timing(heroAnim, {
        toValue: 1,
        duration: 360,
        easing: ENTRANCE_EASING,
        useNativeDriver: true,
      }),
      Animated.timing(statusAnim, {
        toValue: 1,
        duration: 320,
        easing: ENTRANCE_EASING,
        useNativeDriver: true,
      }),
    ]).start();
  }, [detailsAnim, heroAnim, isViewingExisting, shouldShowCamera, statusAnim, imageUri]);

  useEffect(() => {
    if (loading) {
      detailsAnim.setValue(0);
      return;
    }

    Animated.timing(detailsAnim, {
      toValue: 1,
      duration: 340,
      easing: ENTRANCE_EASING,
      useNativeDriver: true,
    }).start();
  }, [detailsAnim, loading, canSaveMeal, analysisError]);

  useEffect(() => {
    // Skip analysis if viewing existing meal
    if (isViewingExisting) {
      // For existing meals, pre-populate base nutrition
      items.forEach(item => {
        if (!baseNutrition.has(item.id) && item.amount > 0) {
          baseNutrition.set(item.id, {
            calories: item.calories / item.amount,
            protein: item.protein / item.amount,
            carbs: item.carbs / item.amount,
            fat: item.fat / item.amount,
            fiber: item.fiber ? item.fiber / item.amount : 0,
            sugar: item.sugar ? item.sugar / item.amount : 0,
            glycemicLoad: item.glycemicLoad ? item.glycemicLoad / item.amount : 0,
          });
        }
      });
      return;
    }

    // No new photo: either we're re-attached to a background scan via { scanId } (leave loading
    // on — the consume effect below resolves it) or there is simply nothing to do.
    if (!imageUri) {
      if (!routeScanId) {
        setLoading(false);
      }
      return;
    }

    // Reset retry counter when the user supplies a different photo
    if (imageUri !== lastAnalyzedImageUriRef.current) {
      lastAnalyzedImageUriRef.current = imageUri;
      setRetryCount(0);
    }

    // Reset all state when imageUri changes (new photo taken)
    setLoading(true);
    setAnalysisError(null);
    setPhase(1);
    setItems([]);
    setTotal(null);
    setSaving(false);
    setProcessedImageUri(imageUri);
    setServerImageUrl(undefined);
    baseNutrition.clear();

    setShowSuccess(false);
    successAnim.setValue(0);

    // Hand the pipeline (compress → upload+analyze) to the scan store: it keeps running if the
    // user leaves this screen ("Continue in background"), and the Dashboard chip can track it.
    appliedScanIdRef.current = null;
    const newScanId = useScanStore.getState().startScan({
      imageUri,
      imageMimeType,
      imageFileName,
      metadata: { img_w_cm: scaleHintCm, volume_cm3: volumeHintCm, items: itemsHint },
    });
    setActiveScanId(newScanId);
  }, [imageFileName, imageMimeType, imageUri, retryCount, isViewingExisting]);

  // Consume the bound scan's state (result, error, progress) from the store.
  useEffect(() => {
    if (isViewingExisting || !activeScanId) {
      return;
    }

    if (!storeScan || storeScan.scanId !== activeScanId) {
      // The scan was replaced or cleared elsewhere; a chip-reopened screen has nothing to wait for.
      if (routeScanId === activeScanId) {
        setLoading(false);
      }
      return;
    }

    if (storeScan.processedImageUri) {
      setProcessedImageUri((prev) => (prev === storeScan.processedImageUri ? prev : storeScan.processedImageUri));
    }

    if (storeScan.status === 'ready' && storeScan.response) {
      if (appliedScanIdRef.current === activeScanId) {
        return;
      }
      appliedScanIdRef.current = activeScanId;

      const response = storeScan.response;
      // Store base nutrition for adjustment math
      response.items.forEach(item => {
        if (item.amount > 0) {
          baseNutrition.set(item.id, {
            calories: item.calories / item.amount,
            protein: item.protein / item.amount,
            carbs: item.carbs / item.amount,
            fat: item.fat / item.amount,
            fiber: item.fiber ? item.fiber / item.amount : 0,
            sugar: item.sugar ? item.sugar / item.amount : 0,
            glycemicLoad: item.glycemicLoad ? item.glycemicLoad / item.amount : 0,
          });
        }
      });

      setItems(response.items);
      setTotal(response.totalNutrition);
      setServerImageUrl(response.imageUrl);
      setAnalysisError(null);
      setLoading(false);
      // One-question-at-a-time clarifications (low-confidence portion, hidden fats).
      const questions = buildClarifyQuestions(response.items);
      setClarifyQueue(questions);
      setClarifyTotal(questions.length);
      setPortionFactors(new Map());
      useScanStore.getState().markConsumed(activeScanId);
    } else if (storeScan.status === 'error' && storeScan.error) {
      setAnalysisError(storeScan.error);
      setLoading(false);
      useScanStore.getState().markConsumed(activeScanId);
    } else {
      setLoading(true);
    }
  }, [storeScan, activeScanId, isViewingExisting, routeScanId]);

  // Drive the hero's phase (Scan → Portion → Macros) from real scan progress.
  useEffect(() => {
    if (!loading || !scan) {
      return;
    }
    const tick = () => {
      if (scan.status === 'compressing') {
        setPhase(1);
        return;
      }
      const fraction = (Date.now() - scan.startedAt) / (scan.expectedMs || 6000);
      setPhase(fraction < 0.45 ? 1 : fraction < 0.75 ? 2 : 3);
    };
    tick();
    const timer = setInterval(tick, 500);
    return () => clearInterval(timer);
  }, [loading, scan?.scanId, scan?.status, scan?.startedAt, scan?.expectedMs]);

  const openGallery = async () => {
    // On native, show pre-permission modal before accessing photo library
    if (Platform.OS !== 'web') {
      const { status: currentStatus } = await ImagePicker.getMediaLibraryPermissionsAsync();
      if (currentStatus !== 'granted') {
        setGalleryPermModal(true);
        return;
      }
    }
    await doOpenGallery();
  };

  const doOpenGallery = async () => {
    try {
      if (Platform.OS === 'web') {
        const asset = await pickWebImageFile();
        if (!asset?.uri) {
          return;
        }

        applySelectedImage(asset);
        return;
      }

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

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        aspect: [4, 3],
        quality: 0.65,
      });

      if (result.canceled || !result.assets?.[0]?.uri) {
        return;
      }

      applySelectedImage(result.assets[0]);
    } catch (err) {
      console.error('Gallery pick failed', err);
      Alert.alert('Error', 'Could not open gallery: ' + (err as Error)?.message);
    }
  };

  // On web, show permission modal before opening gallery
  if (showWebPermissionModal) {
    return (
      <SafeAreaView style={styles.container}>
        <PermissionRequestModal
          visible={true}
          permissionType={openCamera ? 'camera' : 'photoLibrary'}
          onAllow={handleWebPermissionAllow}
          onCancel={handleWebPermissionCancel}
        />
      </SafeAreaView>
    );
  }

  if (shouldShowCamera) {
    const permissionGranted = cameraPerm.state === 'granted';

    if (!permissionGranted) {
      const isAwaitingSystemPrompt = cameraPerm.state === 'undetermined';

      return (
        <SafeAreaView style={styles.container}>
          {isAwaitingSystemPrompt ? (
            /* Apple HIG pre-permission modal — shown before system camera dialog */
            <PermissionRequestModal
              visible={true}
              permissionType="camera"
              onAllow={() => cameraPerm.request()}
              onCancel={navigateToHome}
            />
          ) : (
            <View style={styles.permissionContainer}>
              <Text style={styles.permissionTitle}>Camera access is off</Text>
              <Text style={styles.permissionSubtitle}>
                To scan a meal with the camera, enable camera access in Settings.
              </Text>

              <Pressable onPress={cameraPerm.openSettings} style={styles.permissionPrimaryBtn}>
                <Text style={styles.permissionPrimaryBtnText}>Open Settings</Text>
              </Pressable>
              <Pressable
                onPress={navigateToHome}
                style={styles.permissionSecondaryBtn}
              >
                <Text style={styles.permissionSecondaryBtnText}>Go back</Text>
              </Pressable>
            </View>
          )}
        </SafeAreaView>
      );
    }

    const handleCameraCancel = () => {
      if (navigation.canGoBack()) navigation.goBack();
      else navigation.navigate('Main', { screen: 'Dashboard' });
    };

    return (
      <View style={styles.cameraContainer}>
        {useDepthCapture ? (
          <VisionCameraView
            onCapture={(uri, metadata) => navigation.setParams({
              imageUri: uri,
              imageMimeType: undefined,
              imageFileName: undefined,
              openCamera: false,
              // Use the depth-derived real-world width when available; otherwise fall back.
              imgWcm: typeof metadata?.imgWcm === 'number' ? metadata.imgWcm : scaleHintCm,
              // Absolute LiDAR food volume for geometric portion refinement (null on non-depth captures).
              volumeCm3: typeof metadata?.volumeCm3 === 'number' ? metadata.volumeCm3 : null,
              // Per-item segmented regions for per-item refinement (null when segmentation absent).
              items: Array.isArray(metadata?.items) ? metadata.items : null,
            })}
            onCancel={handleCameraCancel}
            onGalleryPress={openGallery}
            guideText="Align food here"
            processing={false}
            autoUsePhoto
          />
        ) : (
          <CameraView
            onCapture={(uri) => navigation.setParams({
              imageUri: uri,
              imageMimeType: undefined,
              imageFileName: undefined,
              openCamera: false,
              imgWcm: scaleHintCm,
              // Basic (non-depth) camera has no LiDAR volume/regions — never refine on stale data.
              volumeCm3: null,
              items: null,
            })}
            onCancel={handleCameraCancel}
            onGalleryPress={openGallery}
            guideText="Align food here"
            processing={false}
            showReticle
            captureButtonVariant="glass"
            autoUsePhoto
          />
        )}
      </View>
    );
  }

  const handleAmountChange = (id: string, delta: number) => {
    const factor = portionFactors.get(id) ?? 1;
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const newAmount = Math.max(0, item.amount + delta);
          const base = baseNutrition.get(id);

          if (!base) {
            // Fallback to ratio if base not stored (unlikely)
            const ratio = item.amount > 0 ? newAmount / item.amount : 0;
            return {
              ...item,
              amount: newAmount,
              calories: item.calories * ratio,
              protein: item.protein * ratio,
              carbs: item.carbs * ratio,
              fat: item.fat * ratio,
              fiber: item.fiber ? item.fiber * ratio : undefined,
              sugar: item.sugar ? item.sugar * ratio : undefined,
              glycemicLoad: item.glycemicLoad ? item.glycemicLoad * ratio : undefined,
            };
          }

          const scale = newAmount * factor;
          return {
            ...item,
            amount: newAmount,
            calories: base.calories * scale,
            protein: base.protein * scale,
            carbs: base.carbs * scale,
            fat: base.fat * scale,
            fiber: base.fiber ? base.fiber * scale : undefined,
            sugar: base.sugar ? base.sugar * scale : undefined,
            glycemicLoad: base.glycemicLoad ? base.glycemicLoad * scale : undefined,
          };
        }
        return item;
      })
    );
  };

  /** One-tap ½× / 1× / 1½× portion multiplier relative to the detected size. */
  const handlePortionFactor = (id: string, factor: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setPortionFactors((prev) => new Map(prev).set(id, factor));
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const base = baseNutrition.get(id);
        if (!base || item.amount <= 0) return item;
        const scale = item.amount * factor;
        return {
          ...item,
          calories: base.calories * scale,
          protein: base.protein * scale,
          carbs: base.carbs * scale,
          fat: base.fat * scale,
          fiber: base.fiber ? base.fiber * scale : undefined,
          sugar: base.sugar ? base.sugar * scale : undefined,
          glycemicLoad: base.glycemicLoad ? base.glycemicLoad * scale : undefined,
        };
      })
    );
  };

  /** Remove a mis-recognized item entirely. */
  const handleRemoveItem = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setItems((prev) => prev.filter((item) => item.id !== id));
    setClarifyQueue((prev) => prev.filter((q) => q.itemId !== id));
  };

  /** Apply a one-tap clarify answer; refresh per-unit bases for changed/added items. */
  const handleClarifyAnswer = (question: ClarifyQuestion, optionId: string) => {
    setItems((prev) => {
      const { items: next, changedIds } = applyClarifyAnswer(prev, question, optionId);
      changedIds.forEach((id) => {
        const changed = next.find((i) => i.id === id);
        if (changed && changed.amount > 0) {
          baseNutrition.set(id, {
            calories: changed.calories / changed.amount,
            protein: changed.protein / changed.amount,
            carbs: changed.carbs / changed.amount,
            fat: changed.fat / changed.amount,
            fiber: changed.fiber ? changed.fiber / changed.amount : 0,
            sugar: changed.sugar ? changed.sugar / changed.amount : 0,
            glycemicLoad: changed.glycemicLoad ? changed.glycemicLoad / changed.amount : 0,
          });
          setPortionFactors((prevFactors) => new Map(prevFactors).set(id, 1));
        }
      });
      return next;
    });
    setClarifyQueue((prev) => prev.filter((q) => q.id !== question.id));
  };

  const handleClarifySkip = (question: ClarifyQuestion) => {
    setClarifyQueue((prev) => prev.filter((q) => q.id !== question.id));
  };

  const handleSave = async () => {
    if (!total) return;

    setSaving(true);
    try {
      if (isViewingExisting && mealId) {
        // Update existing meal
        await nutritionApi.updateMeal(mealId, {
          imageUri: processedImageUri,
          items: items,
          totalNutrition: total,
          imageUrl: serverImageUrl || processedImageUri,
          mealType: meal?.mealType,
        });

        // Invalidate caches so data refreshes
        queryClient.invalidateQueries({ queryKey: ['dailyNutrition'] });
        queryClient.invalidateQueries({ queryKey: ['meal-history'] });
        queryClient.invalidateQueries({ queryKey: ['weekly-insights'] });

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        // Navigate back immediately for updates (no success animation needed)
        setSaving(false);
        if (navigation.canGoBack()) {
          navigation.goBack();
        } else {
          navigation.navigate('Main', { screen: 'Dashboard' });
        }
        return;
      }

      const savedMeal = await nutritionApi.saveMealFromImage({
        imageUri: processedImageUri,
        items: items,
        totalNutrition: total,
        // Prefer server URL if upload succeeded; otherwise fall back to local processed image
        imageUrl: serverImageUrl || processedImageUri,
      });
      setSavedMealId(savedMeal?.id ?? null);

      trackEvent('meal_logged', { source: 'scan', item_count: items.length });

      // Immediate value: what's left today (computed from the pre-save snapshot so the
      // just-saved meal isn't double counted) and ONE concrete next step.
      const daily = dailyNutrition.data;
      const kcalRemaining = daily.goal - (daily.calories + total.calories);
      const proteinRemaining = daily.protein.goal - (daily.protein.current + total.protein);
      setPostLog({
        kcalRemaining: Number.isFinite(kcalRemaining) ? kcalRemaining : null,
        proteinRemaining: Number.isFinite(proteinRemaining) ? proteinRemaining : null,
        nextStep: buildNextStep({
          kcalRemaining: Number.isFinite(kcalRemaining) ? kcalRemaining : 0,
          proteinRemaining: Number.isFinite(proteinRemaining) ? proteinRemaining : 0,
          hour: new Date().getHours(),
        }),
        // Captured before clearScan() below nulls the bound scan.
        mealSlot: scan?.mealSlot ?? 'Meal',
      });

      // The scan is fully consumed once saved — drop it so the Dashboard chip disappears.
      if (activeScanId) {
        useScanStore.getState().clearScan(activeScanId);
      }

      // Invalidate caches so dashboard, meal log, and insights refresh immediately
      queryClient.invalidateQueries({ queryKey: ['dailyNutrition'] });
      queryClient.invalidateQueries({ queryKey: ['meal-history'] });
      queryClient.invalidateQueries({ queryKey: ['weekly-insights'] });
      // Note: Streak is now updated on login (via /me endpoint), not on meal logging

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Show the post-log sheet (stays until the user taps Done/Undo — no auto-navigation,
      // so Undo is a real option rather than a race against a timer).
      setShowSuccess(true);
      Animated.timing(successAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    } catch (error) {
      console.error('Save failed:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      const status = typeof (error as any)?.status === 'number' ? (error as any).status : undefined;

      let title = 'Save failed';
      let message = 'Failed to save meal. Please try again.';

      if (status === 401 || status === 403 || errorMessage.includes('session has expired')) {
        title = 'Sign in required';
        message = 'Your session is no longer valid. Please sign in again, then retry saving this meal.';
      } else if (status === 408 || errorMessage.toLowerCase().includes('timeout')) {
        title = 'Save timed out';
        message = 'The server took too long to save this meal. This usually points to a backend issue rather than the photo itself. Please retry in a moment.';
      } else if (errorMessage.includes('Network') || errorMessage.includes('fetch')) {
        title = 'Connection error';
        message = 'Could not reach the server while saving. Check your connection and try again.';
      }

      Alert.alert(title, message);
      setSaving(false);
    }
  };

  /** Post-log Undo: deletes the just-created meal and returns to the editable review state. */
  const handleUndoSave = async () => {
    if (!savedMealId || undoing) return;
    setUndoing(true);
    try {
      await nutritionApi.deleteMeal(savedMealId);
      queryClient.invalidateQueries({ queryKey: ['dailyNutrition'] });
      queryClient.invalidateQueries({ queryKey: ['meal-history'] });
      queryClient.invalidateQueries({ queryKey: ['weekly-insights'] });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      setSavedMealId(null);
      setPostLog(null);
      setShowSuccess(false);
      setSaving(false);
      successAnim.setValue(0);
    } catch {
      Alert.alert('Undo failed', 'Could not remove the meal. You can delete it from your meal history.');
    } finally {
      setUndoing(false);
    }
  };

  const loadingText =
    phase === 1
      ? 'Detecting food…'
      : phase === 2
      ? 'Estimating 3D portion volume…'
      : 'Calculating nutrition…';
  const loadingSubtitle =
    phase === 1
      ? 'Reading the visible ingredients and dish boundaries.'
      : phase === 2
      ? 'Using plate scale to estimate depth and portion size.'
      : 'Turning the portion estimate into calories and macros.';
  const phaseLabels = ['Scan', 'Portion', 'Macros'] as const;
  const heroAnimatedStyle = {
    opacity: heroAnim,
    transform: [
      {
        translateY: heroAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [18, 0],
        }),
      },
      {
        scale: heroAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.985, 1],
        }),
      },
    ],
  };
  const statusAnimatedStyle = {
    opacity: statusAnim,
    transform: [
      {
        translateY: statusAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [20, 0],
        }),
      },
    ],
  };
  const detailsAnimatedStyle = {
    opacity: detailsAnim,
    transform: [
      {
        translateY: detailsAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [24, 0],
        }),
      },
    ],
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable 
          onPress={() => {
            if (navigation.canGoBack()) {
              navigation.goBack();
            } else {
              navigation.navigate('Main', { screen: 'Dashboard' });
            }
          }} 
          style={styles.backButton}
        >
          <ArrowLeft size={24} color="#000" />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {isViewingExisting ? 'Meal Details' : 'Review your meal'}
        </Text>
        {isViewingExisting ? (
          <Pressable
            onPress={() => setShareSheetVisible(true)}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Share this meal"
          >
            <Text style={styles.headerShareText}>Share</Text>
          </Pressable>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      <ScrollView
        style={[styles.scrollView, Platform.OS === 'web' && styles.scrollViewWeb]}
        contentContainerStyle={[styles.content, { paddingBottom: 160 + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        showsVerticalScrollIndicator
      >
        <View style={[styles.reviewBody, { maxWidth: contentMaxWidth }]}>
          {loading ? (
            <Animated.View style={[styles.processingHeroWrap, heroAnimatedStyle]}>
              <RecognitionProcessingHero
                imageUri={processedImageUri}
                modeLabel="METRIFUL MEAL SCAN"
                title={loadingText}
                subtitle={loadingSubtitle}
                activePhase={phase}
                phaseLabels={phaseLabels}
                callouts={['Food contours', 'Volume pass', 'Macro estimate']}
              />
              {/* Uber-Eats-style process visibility: staged checklist + honest ETA + escape hatch */}
              <ScanStagesList
                status={scan?.status ?? 'analyzing'}
                startedAt={scan?.startedAt ?? null}
                expectedMs={scan?.expectedMs ?? 6000}
                onContinueInBackground={() => {
                  navigation.navigate('Main', { screen: 'Dashboard' });
                }}
              />
            </Animated.View>
          ) : (
            <View style={[styles.imageFrame, { height: imagePreviewHeight }]}>
              <Animated.View style={[styles.imageContainer, heroAnimatedStyle]}>
                {processedImageUri ? (
                  Platform.OS === 'web' ? (
                    <ExpoImage
                      source={{ uri: processedImageUri }}
                      style={styles.image}
                      contentFit="cover"
                      transition={120}
                      cachePolicy="memory-disk"
                    />
                  ) : (
                    <Image source={{ uri: processedImageUri }} style={styles.image} resizeMode="cover" />
                  )
                ) : (
                  <View style={styles.image} />
                )}
                <View style={[styles.photoBadgeRow, isNarrowPhone && styles.photoBadgeRowCompact]} pointerEvents="none">
                  <View style={styles.photoTag}>
                    <Text style={styles.photoTagText}>Photo ready</Text>
                  </View>
                  <View style={styles.previewBadge}>
                    <Text style={styles.previewBadgeText}>Instant preview</Text>
                  </View>
                </View>
              </Animated.View>
            </View>
          )}

          {!isViewingExisting && (
            <Animated.View style={[styles.imageActionRow, isNarrowPhone && styles.stackedActionRow, statusAnimatedStyle]}>
              <Pressable
                style={styles.imageActionBtn}
                onPress={handleRetake}
              >
                <Camera size={18} color="#0F172A" />
                <Text style={styles.imageActionBtnText}>Retake</Text>
              </Pressable>
              <Pressable style={styles.imageActionBtn} onPress={openGallery}>
                <ImageSquare size={18} color="#0F172A" />
                <Text style={styles.imageActionBtnText}>Choose another</Text>
              </Pressable>
            </Animated.View>
          )}

          {canSaveMeal && (
            <Animated.View style={[styles.statusCard, statusAnimatedStyle]}>
              <View style={styles.statusHeader}>
                <View
                  style={[
                    styles.statusIconWrap,
                    styles.statusIconWrapSuccess,
                  ]}
                >
                  <SealCheck size={22} color="#047857" weight="fill" />
                </View>
                <View style={styles.statusCopy}>
                  <Text style={styles.loadingTitle}>
                    Analysis complete
                  </Text>
                  <Text style={styles.loadingSubtitle}>
                    {`${items.length} detected ${items.length === 1 ? 'item' : 'items'} ready to review and save.`}
                  </Text>
                </View>
              </View>

              <View style={styles.phaseRow}>
                {phaseLabels.map((label, index) => {
                  const isActive = canSaveMeal;
                  return (
                    <View key={label} style={[styles.phasePill, isActive && styles.phasePillActive]}>
                      <Text style={[styles.phasePillText, isActive && styles.phasePillTextActive]}>{label}</Text>
                    </View>
                  );
                })}
              </View>
            </Animated.View>
          )}

          {!loading && canSaveMeal ? (
            <Animated.View style={detailsAnimatedStyle}>
              {total && <NutritionSummaryCard total={total} />}
              <Pressable
                onPress={() => setHowSheetVisible(true)}
                style={styles.howEstimatedLink}
                accessibilityRole="button"
                accessibilityLabel="How was this estimated?"
              >
                <Text style={styles.howEstimatedLinkText}>How was this estimated?</Text>
              </Pressable>
              <AIDisclaimer />

              {/* One high-value question at a time — never a form */}
              {!isViewingExisting && clarifyQueue.length > 0 && (
                <ClarifyQuestionCard
                  question={clarifyQueue[0]}
                  positionLabel={clarifyTotal > 1 ? `${clarifyTotal - clarifyQueue.length + 1} of ${clarifyTotal}` : undefined}
                  onAnswer={(optionId) => handleClarifyAnswer(clarifyQueue[0], optionId)}
                  onSkip={() => handleClarifySkip(clarifyQueue[0])}
                />
              )}

              <View style={[styles.sectionHeader, isNarrowPhone && styles.sectionHeaderCompact]}>
                <Text style={styles.sectionTitle}>Detected items</Text>
                <Text style={styles.sectionCaption}>Adjust portions before saving</Text>
              </View>
              {items.map((item) => (
                <DetectedItemRow
                  key={item.id}
                  item={item}
                  onIncrease={() => handleAmountChange(item.id, 1)}
                  onDecrease={() => handleAmountChange(item.id, -1)}
                  onRemove={items.length > 1 ? () => handleRemoveItem(item.id) : undefined}
                  portionFactor={portionFactors.get(item.id) ?? 1}
                  onPortionFactor={(factor) => handlePortionFactor(item.id, factor)}
                />
              ))}

              {total?.glycemicLoad != null && (
                <View style={styles.glCard}>
                  <Text style={styles.glCardTitle}>Estimated Glycemic Impact</Text>
                  <View style={styles.glRow}>
                    <View style={styles.glBarBg}>
                      <View
                        style={[
                          styles.glBarFill,
                          {
                            width: `${Math.min(100, (total.glycemicLoad / 40) * 100)}%`,
                            backgroundColor:
                              total.glycemicLoad <= 10
                                ? '#22C55E'
                                : total.glycemicLoad <= 20
                                ? '#F59E0B'
                                : '#EF4444',
                          },
                        ]}
                      />
                    </View>
                    <Text
                      style={[
                        styles.glValue,
                        {
                          color:
                            total.glycemicLoad <= 10
                              ? '#16A34A'
                              : total.glycemicLoad <= 20
                              ? '#D97706'
                              : '#DC2626',
                        },
                      ]}
                    >
                      GL {Math.round(total.glycemicLoad)}
                    </Text>
                  </View>
                  <Text style={styles.glLabel}>
                    {total.glycemicLoad <= 10
                      ? 'Low — gentle on blood sugar'
                      : total.glycemicLoad <= 20
                      ? 'Medium — moderate blood sugar rise'
                      : 'High — may raise blood sugar noticeably'}
                  </Text>
                  <Text style={styles.glDisclaimer}>
                    General estimate from carbohydrate content — not a personal blood-glucose
                    measurement or medical prediction.
                  </Text>
                  <Pressable
                    onPress={() => openExternalUrl(
                      NUTRITION_REFERENCES.glycemicLoad.url,
                      'Unable to open source',
                      'Please visit the Harvard Health glycemic load guide in your browser.'
                    )}
                    style={styles.glSourceRow}
                  >
                    <Text style={styles.glSourceLabel}>Direct reference:</Text>
                    <Text style={styles.glSourceLink}>{NUTRITION_REFERENCES.glycemicLoad.shortLabel}</Text>
                  </Pressable>
                </View>
              )}

              <Text style={styles.aiDisclaimer}>
                AI estimate — not medical advice.{' '}
                <Text
                  style={styles.aiDisclaimerLink}
                  onPress={() => navigation.navigate('AboutNutritionData' as any)}
                >
                  View direct sources
                </Text>
              </Text>
            </Animated.View>
          ) : (
            <Animated.View style={detailsAnimatedStyle}>
              {analysisError ? (
                <View style={styles.errorStateCard}>
                  <View style={styles.errorStateIconWrap}>
                    <WarningCircle size={28} color="#DC2626" weight="fill" />
                  </View>
                  <Text style={styles.errorStateTitle}>{analysisError.title}</Text>
                  <Text style={styles.errorStateBody}>{analysisError.message}</Text>
                  <View style={[styles.emptyActionRow, isNarrowPhone && styles.stackedActionRow]}>
                    {retryCount < MAX_RETRIES && (
                    <Pressable
                      style={[styles.inlineActionBtn, styles.inlineActionBtnPrimary]}
                      onPress={() => {
                        setAnalysisError(null);
                        setRetryCount(prev => prev + 1);
                        }}
                      >
                        <Text style={styles.inlineActionBtnPrimaryText}>
                          Try Again ({MAX_RETRIES - retryCount} left)
                        </Text>
                      </Pressable>
                    )}
                    <Pressable
                      style={[styles.inlineActionBtn, styles.inlineActionBtnPrimary]}
                      onPress={handleRetake}
                    >
                      <Text style={styles.inlineActionBtnPrimaryText}>
                        {Platform.OS === 'web' ? 'Choose photo' : 'Retake photo'}
                      </Text>
                    </Pressable>
                    <Pressable style={styles.inlineActionBtn} onPress={openGallery}>
                      <Text style={styles.inlineActionBtnText}>Pick another</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <View style={styles.emptyStateCard}>
                  <View style={styles.emptyStateIconWrap}>
                    <MagnifyingGlass size={28} color="#B45309" />
                  </View>
                  <Text style={styles.emptyStateTitle}>We could not confirm the meal contents</Text>
                  <Text style={styles.emptyStateBody}>
                    Try a photo with stronger lighting, less background clutter, and the entire plate visible from above.
                  </Text>
                  <View style={[styles.emptyActionRow, isNarrowPhone && styles.stackedActionRow]}>
                    <Pressable
                      style={[styles.inlineActionBtn, styles.inlineActionBtnPrimary]}
                      onPress={handleRetake}
                    >
                      <Text style={styles.inlineActionBtnPrimaryText}>
                        {Platform.OS === 'web' ? 'Choose photo' : 'Retake photo'}
                      </Text>
                    </Pressable>
                    <Pressable style={styles.inlineActionBtn} onPress={openGallery}>
                      <Text style={styles.inlineActionBtnText}>Pick another</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </Animated.View>
          )}
        </View>
      </ScrollView>

      {/* Show save/update button */}
      {!loading && !showSuccess && canSaveMeal && (
        <View style={[styles.bottomBar, { paddingBottom: Math.max(16, insets.bottom) }]}>
          <Pressable
            onPress={handleSave}
            disabled={saving}
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.saveButtonText}>
                {isViewingExisting ? 'Save Changes' : 'Save to today'}
              </Text>
            )}
          </Pressable>
        </View>
      )}

      {/* Post-log value sheet: what happened, what's left today, ONE next step, and Undo. */}
      {showSuccess && total && (
        <Animated.View
          style={[
            styles.successOverlay,
            { opacity: successAnim },
          ]}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            accessibilityLabel="Dismiss and go to home"
            onPress={() => {
              setShowSuccess(false);
              navigation.navigate('Main', { screen: 'Dashboard' });
            }}
          />
          <Animated.View
            style={[
              styles.successCard,
              {
                transform: [
                  {
                    scale: successAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.8, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <LinearGradient
              colors={SUCCESS_GRADIENT}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.successHeader}
            />

            <View style={styles.successBody}>
              <View style={styles.successIconCircle}>
                <Check size={44} color="#0E7490" />
              </View>
              <Text style={styles.successTitle}>{postLog?.mealSlot ?? 'Meal'} logged</Text>
              <View style={styles.successStats}>
                <View style={styles.successStatItem}>
                  <Text style={styles.successStatValue}>+{Math.round(total.calories)}</Text>
                  <Text style={styles.successStatLabel}>kcal</Text>
                </View>
                <View style={styles.successStatDivider} />
                <View style={styles.successStatItem}>
                  <Text style={styles.successStatValue}>+{Math.round(total.protein)}g</Text>
                  <Text style={styles.successStatLabel}>protein</Text>
                </View>
                <View style={styles.successStatDivider} />
                <View style={styles.successStatItem}>
                  <Text style={styles.successStatValue}>+{Math.round(total.carbs)}g</Text>
                  <Text style={styles.successStatLabel}>carbs</Text>
                </View>
              </View>

              {postLog && postLog.kcalRemaining != null && postLog.proteinRemaining != null && (
                <View style={styles.remainingRow}>
                  <Text style={styles.remainingText}>
                    {postLog.kcalRemaining >= 0
                      ? `${Math.round(postLog.kcalRemaining)} kcal remaining today`
                      : `About ${Math.abs(Math.round(postLog.kcalRemaining))} kcal above today’s current target`}
                  </Text>
                  <Text style={styles.remainingText}>
                    {postLog.proteinRemaining > 0
                      ? `${Math.round(postLog.proteinRemaining)} g protein remaining`
                      : 'Protein target reached'}
                  </Text>
                </View>
              )}

              {postLog?.nextStep && (
                <View style={styles.nextStepCard}>
                  <Text style={styles.nextStepLabel}>Best next step</Text>
                  <Text style={styles.nextStepText}>{postLog.nextStep}</Text>
                </View>
              )}

              <View style={styles.postLogActions}>
                {savedMealId != null && (
                  <Pressable
                    onPress={handleUndoSave}
                    disabled={undoing}
                    style={[styles.postLogUndoBtn, undoing && { opacity: 0.6 }]}
                    accessibilityRole="button"
                    accessibilityLabel="Undo saving this meal"
                  >
                    {undoing ? (
                      <ActivityIndicator size="small" color="#0F172A" />
                    ) : (
                      <Text style={styles.postLogUndoText}>Undo</Text>
                    )}
                  </Pressable>
                )}
                <Pressable
                  onPress={() => {
                    setShowSuccess(false);
                    navigation.navigate('Main', { screen: 'Dashboard' });
                  }}
                  style={styles.postLogDoneBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Done"
                >
                  <Text style={styles.postLogDoneText}>Done</Text>
                </Pressable>
              </View>
            </View>
          </Animated.View>
        </Animated.View>
      )}
      {/* Opt-in share (existing meals): sensitive fields off by default */}
      {isViewingExisting && total && (
        <ShareMealSheet
          visible={shareSheetVisible}
          onClose={() => setShareSheetVisible(false)}
          meal={{
            mealType: meal?.mealType || 'Meal',
            foodNames: items.map((i) => i.name).filter(Boolean),
            calories: total.calories,
            protein: total.protein ?? null,
          }}
        />
      )}
      {/* "How was this estimated?" trust drawer */}
      <HowEstimatedSheet
        visible={howSheetVisible}
        onClose={() => setHowSheetVisible(false)}
        usedDepth={scan?.usedDepth ?? Boolean(volumeHintCm)}
        itemCount={items.length}
        avgConfidence={(() => {
          const withConf = items.filter((i) => typeof i.confidence === 'number');
          if (withConf.length === 0) return null;
          return withConf.reduce((acc, i) => acc + (i.confidence ?? 0), 0) / withConf.length;
        })()}
        onViewSources={() => {
          setHowSheetVisible(false);
          navigation.navigate('AboutNutritionData' as any);
        }}
      />
      {/* Pre-permission modal for photo library (Pick another flow) */}
      <PermissionRequestModal
        visible={galleryPermModal}
        permissionType="photoLibrary"
        onAllow={async () => {
          setGalleryPermModal(false);
          await doOpenGallery();
        }}
        onCancel={() => setGalleryPermModal(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 14,
  },
  permissionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  permissionSubtitle: {
    fontSize: 14,
    color: '#374151',
    textAlign: 'center',
    lineHeight: 20,
  },
  permissionPrimaryBtn: {
    width: '100%',
    maxWidth: 360,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#111827',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 6,
  },
  permissionPrimaryBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  permissionSecondaryBtn: {
    width: '100%',
    maxWidth: 360,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  permissionSecondaryBtnText: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '700',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  headerSpacer: {
    width: 40,
  },
  headerShareText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0891B2',
  },
  content: {
    paddingBottom: 120, // Extra space for absolute positioned bottom bar
    paddingTop: 8,
  },
  reviewBody: {
    width: '100%',
    alignSelf: 'center',
    gap: 2,
  },
  scrollView: {
    flex: 1,
    minHeight: 0,
  },
  scrollViewWeb: {
    minHeight: 0,
    overflowY: 'auto' as any,
    overflowX: 'hidden' as any,
    touchAction: 'pan-y',
    WebkitOverflowScrolling: 'touch',
  } as any,
  imageFrame: {
    margin: 16,
    borderRadius: 28,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#0F172A',
    ...CARD_SHADOW,
  },
  processingHeroWrap: {
    margin: 16,
    ...CARD_SHADOW,
  },
  imageContainer: {
    flex: 1,
    minHeight: 0,
  },
  image: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  photoBadgeRow: {
    position: 'absolute',
    top: 14,
    left: 14,
    right: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  photoBadgeRowCompact: {
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
  },
  photoTag: {
    backgroundColor: 'rgba(15,23,42,0.74)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  photoTagText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  previewBadge: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  previewBadgeText: {
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '700',
  },
  imageActionRow: {
    marginHorizontal: 16,
    marginTop: -4,
    marginBottom: 8,
    flexDirection: 'row',
    gap: 12,
  },
  imageActionBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...CARD_SHADOW,
  },
  imageActionBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    flexShrink: 1,
    textAlign: 'center',
  },
  statusCard: {
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 18,
    gap: 16,
    ...CARD_SHADOW,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  statusIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusIconWrapLoading: {
    backgroundColor: 'rgba(6, 182, 212, 0.14)',
  },
  statusIconWrapSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.14)',
  },
  statusIconWrapWarning: {
    backgroundColor: 'rgba(245, 158, 11, 0.16)',
  },
  statusCopy: {
    flex: 1,
  },
  phaseRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  phasePill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: '#F1F5F9',
  },
  phasePillActive: {
    backgroundColor: 'rgba(6, 182, 212, 0.14)',
  },
  phasePillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  phasePillTextActive: {
    color: '#0E7490',
  },
  loadingContainer: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 18,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  loadingCopy: {
    flex: 1,
  },
  loadingTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  loadingSubtitle: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 19,
    color: '#6B7280',
  },
  glCard: {
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 20,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    ...CARD_SHADOW,
  },
  glCardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 10,
  },
  glRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  glBarBg: {
    flex: 1,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#F3F4F6',
    overflow: 'hidden',
  },
  glBarFill: {
    height: '100%',
    borderRadius: 5,
  },
  glValue: {
    fontSize: 15,
    fontWeight: '700',
    minWidth: 50,
  },
  glLabel: {
    marginTop: 8,
    fontSize: 13,
    color: '#6B7280',
  },
  glDisclaimer: {
    marginTop: 6,
    fontSize: 11,
    lineHeight: 16,
    color: '#9CA3AF',
  },
  glSourceRow: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 4,
  },
  glSourceLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  glSourceLink: {
    fontSize: 12,
    color: '#0891B2',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  aiDisclaimer: {
    marginHorizontal: 16,
    marginTop: 16,
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  aiDisclaimerLink: {
    fontSize: 12,
    color: '#0891B2',
    fontWeight: '600',
  },
  sectionHeader: {
    marginHorizontal: 16,
    marginTop: 18,
    marginBottom: 6,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionHeaderCompact: {
    alignItems: 'flex-start',
    flexDirection: 'column',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
  },
  sectionCaption: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  emptyStateCard: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#FDE68A',
    backgroundColor: '#FFFBEB',
    padding: 20,
    alignItems: 'center',
    ...CARD_SHADOW,
  },
  emptyStateIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyStateTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: '#78350F',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyStateBody: {
    fontSize: 14,
    lineHeight: 21,
    color: '#92400E',
    textAlign: 'center',
  },
  errorStateCard: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
    padding: 20,
    alignItems: 'center',
    ...CARD_SHADOW,
  },
  errorStateIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: 'rgba(220, 38, 38, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  errorStateTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: '#991B1B',
    textAlign: 'center',
    marginBottom: 8,
  },
  errorStateBody: {
    fontSize: 14,
    lineHeight: 21,
    color: '#B91C1C',
    textAlign: 'center',
  },
  emptyActionRow: {
    width: '100%',
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
  },
  stackedActionRow: {
    flexDirection: 'column',
  },
  inlineActionBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  inlineActionBtnPrimary: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  inlineActionBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
  },
  inlineActionBtnPrimaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    zIndex: 10,
    elevation: 12,
  },
  saveButton: {
    backgroundColor: BRAND_COLORS.primary,
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  // Success overlay styles - 淡粉色弹窗
  successOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    zIndex: 30,
    elevation: 20,
  },
  successCard: {
    width: '85%',
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    ...CARD_SHADOW,
  },
  successHeader: {
    height: 72,
    width: '100%',
  },
  successBody: {
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  successIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(6, 182, 212, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 4,
  },
  successStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    backgroundColor: 'rgba(6, 182, 212, 0.08)',
    borderRadius: 16,
    padding: 12,
  },
  successStatItem: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  successStatValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
  },
  successStatLabel: {
    fontSize: 12,
    color: '#6C6A7E',
    marginTop: 2,
  },
  successStatDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(15,23,42,0.12)',
  },
  successSubtitle: {
    fontSize: 14,
    color: '#6C6A7E',
    marginTop: 8,
  },
  successTapHint: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 16,
  },
  howEstimatedLink: {
    marginHorizontal: 16,
    marginTop: 8,
    minHeight: 40,
    justifyContent: 'center',
  },
  howEstimatedLinkText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0891B2',
    textDecorationLine: 'underline',
  },
  remainingRow: {
    marginTop: 10,
    gap: 2,
    alignItems: 'center',
  },
  remainingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  nextStepCard: {
    marginTop: 12,
    alignSelf: 'stretch',
    borderRadius: 14,
    backgroundColor: 'rgba(201, 106, 52, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(201, 106, 52, 0.18)',
    padding: 12,
    gap: 4,
  },
  nextStepLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    color: '#A7552A',
    textTransform: 'uppercase',
  },
  nextStepText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#3E3C38',
  },
  postLogActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    alignSelf: 'stretch',
  },
  postLogUndoBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  postLogUndoText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  postLogDoneBtn: {
    flex: 2,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: BRAND_COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postLogDoneText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
