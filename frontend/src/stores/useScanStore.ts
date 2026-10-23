/**
 * useScanStore — background-capable meal-scan manager (Uber-Eats "order tracking" pattern).
 *
 * The analyze pipeline (compress → upload+analyze) used to live inside ReviewMealScreen's
 * effect, so leaving the screen threw the result away. Moving it here means:
 *  - the user can tap "Continue in background" and keep using the app;
 *  - Dashboard can show a live status chip ("Lunch scan is almost ready…");
 *  - the result waits (unconsumed) until the user returns to review it.
 *
 * One scan at a time — starting a new scan replaces the previous one.
 */
import { Platform } from 'react-native';
import { create } from 'zustand';
import * as Haptics from 'expo-haptics';

import nutritionApi, {
  FoodRecognitionRequestMetadata,
  FoodRecognitionResponse,
} from '@/services/nutritionApi';
import { compressImage, uriToBlob } from '@/utils/imageCompression/compressionService';
import { isHeicLikeSource, normalizeMimeType } from '@/utils/imageSource';
import { mealSlotForHour, ScanStatus } from '@/utils/scanStages';

export interface StartScanParams {
  imageUri: string;
  imageMimeType?: string | null;
  imageFileName?: string | null;
  metadata: FoodRecognitionRequestMetadata;
}

export interface ScanError {
  title: string;
  message: string;
}

export interface ActiveScan {
  scanId: string;
  status: Exclude<ScanStatus, 'idle'>;
  startedAt: number;
  expectedMs: number;
  imageUri: string;
  /** Compressed preview once available (falls back to imageUri). */
  processedImageUri: string;
  mealSlot: ReturnType<typeof mealSlotForHour>;
  /** True when a LiDAR volume accompanied the request (portions measured, not guessed). */
  usedDepth: boolean;
  response: FoodRecognitionResponse | null;
  error: ScanError | null;
  /** True once the review screen has displayed this result (hides the home chip). */
  consumed: boolean;
}

interface ScanStoreState {
  scan: ActiveScan | null;
  startScan: (params: StartScanParams) => string;
  markConsumed: (scanId: string) => void;
  clearScan: (scanId?: string) => void;
}

const COMPRESS_OPTIONS = {
  maxDimension: Platform.OS === 'web' ? 1024 : 896,
  quality: Platform.OS === 'web' ? 0.76 : 0.68,
  targetSize: Platform.OS === 'web' ? 900_000 : 650_000,
} as const;

/** Rolling window of recent scan durations → honest ETA for the staged progress UI. */
const recentDurations: number[] = [6000];
const expectedDurationMs = (): number =>
  Math.round(recentDurations.reduce((a, b) => a + b, 0) / recentDurations.length);
const recordDuration = (ms: number) => {
  if (Number.isFinite(ms) && ms > 500 && ms < 120_000) {
    recentDurations.push(ms);
    if (recentDurations.length > 5) recentDurations.shift();
  }
};

let scanCounter = 0;

export function parseAnalysisError(error: unknown): ScanError {
  const errorString =
    (error as any)?.message || (error as any)?.data?.message || String(error ?? '');

  if (errorString.includes('too large') || errorString.includes('10MB')) {
    return {
      title: 'Image Too Large',
      message:
        'The image is too large. Please take a photo with lower resolution or try a different image.',
    };
  }
  if (errorString.includes('API key expired') || errorString.includes('API_KEY_INVALID')) {
    return {
      title: 'Service Temporarily Unavailable',
      message:
        'The food recognition service is temporarily unavailable. Please try again later or contact support.',
    };
  }
  if (errorString.includes('providers failed') || errorString.includes('recognize foods')) {
    return {
      title: 'Recognition Failed',
      message:
        'Could not recognize food in this image. Please try taking a clearer photo with good lighting, capturing the food from above.',
    };
  }
  if (
    errorString.includes('Network') ||
    errorString.includes('fetch') ||
    errorString.includes('CONNECTION')
  ) {
    return {
      title: 'Connection Error',
      message:
        'Unable to connect to the server. Please check your internet connection and try again.',
    };
  }
  if (errorString.includes('timeout') || errorString.includes('408')) {
    return {
      title: 'Request Timeout',
      message: 'The analysis is taking too long. Please try again with a smaller image.',
    };
  }
  return { title: 'Analysis Failed', message: 'Failed to analyze the image. Please try again.' };
}

export const useScanStore = create<ScanStoreState>((set, get) => ({
  scan: null,

  startScan: (params) => {
    scanCounter += 1;
    const scanId = `scan-${Date.now()}-${scanCounter}`;
    const startedAt = Date.now();

    set({
      scan: {
        scanId,
        status: 'compressing',
        startedAt,
        expectedMs: expectedDurationMs(),
        imageUri: params.imageUri,
        processedImageUri: params.imageUri,
        mealSlot: mealSlotForHour(new Date().getHours()),
        usedDepth: typeof params.metadata.volume_cm3 === 'number' && params.metadata.volume_cm3 > 0,
        response: null,
        error: null,
        consumed: false,
      },
    });

    void runScan(scanId, params, startedAt, set, get);
    return scanId;
  },

  markConsumed: (scanId) => {
    const current = get().scan;
    if (current?.scanId === scanId && !current.consumed) {
      set({ scan: { ...current, consumed: true } });
    }
  },

  clearScan: (scanId) => {
    const current = get().scan;
    if (!scanId || current?.scanId === scanId) {
      set({ scan: null });
    }
  },
}));

type SetState = (partial: Partial<ScanStoreState>) => void;
type GetState = () => ScanStoreState;

/** Update the active scan only if it is still the one this run belongs to (not replaced). */
function patchScan(
  scanId: string,
  set: SetState,
  get: GetState,
  patch: Partial<ActiveScan>
): boolean {
  const current = get().scan;
  if (!current || current.scanId !== scanId) return false;
  set({ scan: { ...current, ...patch } });
  return true;
}

async function runScan(
  scanId: string,
  params: StartScanParams,
  startedAt: number,
  set: SetState,
  get: GetState
): Promise<void> {
  let uploadUri = params.imageUri;
  let uploadMimeType = normalizeMimeType(params.imageMimeType);
  let uploadFileName = params.imageFileName ?? undefined;

  // HEIC/HEIF: skip client-side compression, send original (see imageSource.ts).
  if (!isHeicLikeSource(uploadMimeType, params.imageFileName || params.imageUri)) {
    try {
      // compressImage takes a URI on native but a Blob on web (see compressionService).
      const input = Platform.OS === 'web' ? await uriToBlob(params.imageUri) : params.imageUri;
      const compressed = await compressImage(input, COMPRESS_OPTIONS);
      if (Platform.OS === 'web' && compressed?.blob && typeof URL !== 'undefined') {
        compressed.uri = URL.createObjectURL(compressed.blob);
      }
      if (compressed?.uri) {
        uploadUri = compressed.uri;
        uploadMimeType = 'image/jpeg';
        if (!patchScan(scanId, set, get, { processedImageUri: compressed.uri })) return;
      }
    } catch {
      // Compression is an optimization — analyze the original on any failure.
    }
  }

  if (!patchScan(scanId, set, get, { status: 'analyzing' })) return;

  try {
    let response: FoodRecognitionResponse;
    try {
      response = await nutritionApi.analyzeFoodImage(uploadUri, params.metadata, {
        sourceMimeType: uploadMimeType,
        sourceFileName: uploadFileName,
      });
    } catch (firstError) {
      if (uploadUri === params.imageUri) throw firstError;
      // Compressed upload failed — retry once with the untouched original.
      patchScan(scanId, set, get, { processedImageUri: params.imageUri });
      response = await nutritionApi.analyzeFoodImage(params.imageUri, params.metadata, {
        sourceMimeType: normalizeMimeType(params.imageMimeType),
        sourceFileName: params.imageFileName ?? undefined,
      });
    }

    recordDuration(Date.now() - startedAt);
    if (patchScan(scanId, set, get, { status: 'ready', response })) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  } catch (error) {
    patchScan(scanId, set, get, { status: 'error', error: parseAnalysisError(error) });
  }
}

export default useScanStore;
