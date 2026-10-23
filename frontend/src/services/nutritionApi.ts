import { MealLogResponse, NutritionInsightResponse, NutritionSummaryResponse } from '@/types/mealPlan';
import { api } from './apiClient';

export interface LogMealPayload {
  mealPlanId?: number | null;
  mealDay?: number | null;
  mealType: string;
  recipeId?: string | null;
  recipeName?: string | null;
  calories?: number | null;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
  consumedAt?: string;
  notes?: string | null;
  imageUrl?: string | null;
}

// Food recognition types (Frontend display format)

export interface DetectedFood {
  id: string;
  name: string;
  amount: number;
  unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sugar?: number;
  confidence?: number;
  glycemicIndex?: number;
  glycemicLoad?: number;
}

export interface TotalNutrition {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sugar?: number;
  netCarbs?: number;
  sugarCubes?: number;
  glycemicLoad?: number;
}

export interface FoodRecognitionResponse {
  items: DetectedFood[];
  totalNutrition: TotalNutrition;
  suggestedMealType?: string;
  imageUrl?: string;
}

export interface DepthItemMetadata {
  volume_cm3?: number;
  area_cm2?: number;
  /** normalized centroid [0,1], top-left origin — lets the backend assign this mask to a food */
  cx?: number;
  cy?: number;
}

export interface FoodRecognitionRequestMetadata {
  img_w_cm?: number;
  real_world_width_cm?: number;
  /** Absolute LiDAR-measured food volume (cm³); enables geometric portion refinement server-side. */
  volume_cm3?: number;
  area_cm2?: number;
  mean_h_cm?: number;
  /** Per-item segmented regions (LiDAR + on-device Vision masks); enables per-item refinement. */
  items?: DepthItemMetadata[];
}

export interface AnalyzeFoodImageOptions {
  sourceMimeType?: string;
  sourceFileName?: string;
}

// Backend API types (matching Java @JsonProperty snake_case)
interface BackendNutritionInfo {
  calories?: number | string | null;
  protein?: number | string | null;
  fat?: number | string | null;
  carbs?: number | string | null;
  fiber?: number | string | null;
  sugar?: number | string | null;
  netCarbs?: number | string | null;
  sugarCubes?: number | string | null;
  glycemicIndex?: number | string | null;
  glycemicLoad?: number | string | null;
}

interface BackendRecognizedFood {
  food_key: string;
  display_name: string;
  estimated_grams: number;
  unit?: string;
  quantity?: number;  // Number of pieces/bowls/servings
  cooking_method?: string;
  confidence: number;
  nutrition?: BackendNutritionInfo;
}

interface BackendFoodRecognitionResponse {
  items?: BackendRecognizedFood[] | null;
  totalNutrition?: BackendNutritionInfo | null;
  suggestedMealType?: string;
  imageUrl?: string;
}

const toNumber = (value: number | string | null | undefined): number | undefined => {
  if (value == null || value === '') return undefined;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const hasMeaningfulNutrition = (nutrition: TotalNutrition): boolean => {
  return [nutrition.calories, nutrition.protein, nutrition.carbs, nutrition.fat].some(
    (value) => Number(value) > 0
  );
};

export interface SaveMealPayload {
  imageUri: string;
  items: DetectedFood[];
  totalNutrition: TotalNutrition;
  mealType?: string;
  notes?: string;
  imageUrl?: string;
}

// When userId is 'me', the backend extracts user from JWT token
// Otherwise use the provided userId
const resolveUserId = (userId: string): string | undefined => {
  if (userId === 'me') {
    return undefined; // Backend will use authenticated user from JWT
  }
  return userId;
};

const logMeal = async (userId: string, payload: LogMealPayload): Promise<MealLogResponse> => {
  // Build request body, filtering out null/undefined values to avoid serialization issues
  const body: Record<string, any> = {
    mealType: payload.mealType,
    consumedAt: payload.consumedAt || new Date().toISOString(),
  };

  // Only include optional fields if they have values
  if (payload.mealPlanId != null) body.mealPlanId = payload.mealPlanId;
  if (payload.mealDay != null) body.mealDay = payload.mealDay;
  if (payload.recipeId != null) body.recipeId = payload.recipeId;
  if (payload.recipeName != null) body.recipeName = payload.recipeName;
  if (payload.calories != null) body.calories = payload.calories;
  if (payload.protein != null) body.protein = payload.protein;
  if (payload.carbs != null) body.carbs = payload.carbs;
  if (payload.fat != null) body.fat = payload.fat;
  if (payload.notes != null) body.notes = payload.notes;
  if (payload.imageUrl != null) body.imageUrl = payload.imageUrl;

  // Only include userId if not using 'me' (JWT-based auth)
  const resolvedUserId = resolveUserId(userId);
  if (resolvedUserId) {
    body.userId = resolvedUserId;
  }

  console.log('[NutritionApi] logMeal body:', JSON.stringify(body, null, 2));

  return await api.post<MealLogResponse>('/api/v1/meals', body);
};

const getDailySummary = async (userId: string, date?: string): Promise<NutritionSummaryResponse> => {
  const queryParams = new URLSearchParams();
  const resolvedUserId = resolveUserId(userId);
  if (resolvedUserId) {
    queryParams.append('userId', resolvedUserId);
  }
  if (date) {
    queryParams.append('date', date);
  }
  const queryString = queryParams.toString();
  return await api.get<NutritionSummaryResponse>(
    `/api/v1/nutrition/summary/daily${queryString ? `?${queryString}` : ''}`
  );
};

const getWeeklySummary = async (userId: string, weekStart?: string): Promise<NutritionSummaryResponse> => {
  const queryParams = new URLSearchParams();
  const resolvedUserId = resolveUserId(userId);
  if (resolvedUserId) {
    queryParams.append('userId', resolvedUserId);
  }
  if (weekStart) {
    queryParams.append('weekStart', weekStart);
  }
  const queryString = queryParams.toString();
  return await api.get<NutritionSummaryResponse>(
    `/api/v1/nutrition/summary/weekly${queryString ? `?${queryString}` : ''}`
  );
};

/** Delete a logged meal — used by the post-log Undo affordance. */
const deleteMeal = async (mealId: number): Promise<void> => {
  await api.delete<void>(`/api/v1/meals/${mealId}`);
};

const getWeeklyInsight = async (userId: string, weekStart?: string): Promise<NutritionInsightResponse> => {
  const queryParams = new URLSearchParams();
  const resolvedUserId = resolveUserId(userId);
  if (resolvedUserId) {
    queryParams.append('userId', resolvedUserId);
  }
  if (weekStart) {
    queryParams.append('weekStart', weekStart);
  }
  const queryString = queryParams.toString();
  return await api.get<NutritionInsightResponse>(
    `/api/v1/nutrition/insights/weekly${queryString ? `?${queryString}` : ''}`
  );
};

// Transform backend response to frontend format (legacy endpoint)
const transformBackendResponse = (backendResponse: BackendFoodRecognitionResponse): FoodRecognitionResponse => {
  const rawItems = Array.isArray(backendResponse.items) ? backendResponse.items : [];

  const items: DetectedFood[] = rawItems.map((item, index) => {
    // Use quantity for piece/bowl/serving units, grams for 'g' unit
    const unit = item.unit || 'g';
    const isCountableUnit = ['piece', 'bowl', 'serving', 'slice', 'cup'].includes(unit);
    const amount = isCountableUnit 
      ? (item.quantity || 1)      // Use quantity (1, 2, 3 pieces)
      : (item.estimated_grams || 100);  // Use grams (40g, 100g)
    
    return {
      id: item.food_key || `item-${index}`,
      name: item.display_name || 'Unknown Food',
      amount,
      unit,
      calories: toNumber(item.nutrition?.calories) || 0,
      protein: toNumber(item.nutrition?.protein) || 0,
      carbs: toNumber(item.nutrition?.carbs) || 0,
      fat: toNumber(item.nutrition?.fat) || 0,
      fiber: toNumber(item.nutrition?.fiber),
      sugar: toNumber(item.nutrition?.sugar),
      confidence: item.confidence,
      glycemicIndex: toNumber(item.nutrition?.glycemicIndex),
      glycemicLoad: toNumber(item.nutrition?.glycemicLoad),
    };
  });

  const totalNutrition: TotalNutrition = {
    calories: toNumber(backendResponse.totalNutrition?.calories) || 0,
    protein: toNumber(backendResponse.totalNutrition?.protein) || 0,
    carbs: toNumber(backendResponse.totalNutrition?.carbs) || 0,
    fat: toNumber(backendResponse.totalNutrition?.fat) || 0,
    fiber: toNumber(backendResponse.totalNutrition?.fiber),
    sugar: toNumber(backendResponse.totalNutrition?.sugar),
    netCarbs: toNumber(backendResponse.totalNutrition?.netCarbs),
    sugarCubes: toNumber(backendResponse.totalNutrition?.sugarCubes),
    glycemicLoad: toNumber(backendResponse.totalNutrition?.glycemicLoad),
  };

  if (items.length === 0 && hasMeaningfulNutrition(totalNutrition)) {
    items.push({
      id: 'detected-meal-summary',
      name: backendResponse.suggestedMealType || 'Detected meal',
      amount: 1,
      unit: 'serving',
      calories: totalNutrition.calories,
      protein: totalNutrition.protein,
      carbs: totalNutrition.carbs,
      fat: totalNutrition.fat,
      fiber: totalNutrition.fiber,
      sugar: totalNutrition.sugar,
      glycemicLoad: totalNutrition.glycemicLoad,
    });
  }

  return {
    items,
    totalNutrition,
    suggestedMealType: backendResponse.suggestedMealType,
    imageUrl: backendResponse.imageUrl,
  };
};

// Analyze food image with Gemini 3 Pro AI (Elite Sports Nutritionist)
const analyzeFoodImage = async (
  imageUri: string,
  metadata?: FoodRecognitionRequestMetadata,
  options?: AnalyzeFoodImageOptions
): Promise<FoodRecognitionResponse> => {
  console.log('[NutritionApi] Analyzing with Gemini 3 Pro Elite Sports Nutritionist...');

  // Compress on client: 1024px JPEG ~150KB instead of raw 3MB.
  // Saves ~1-2s (faster upload + backend skips redundant compression).
  // Gemini 2.0 Flash handles 1024px fine for food recognition.
  const backendResponse = await api.uploadImage<BackendFoodRecognitionResponse>(
    '/api/v1/nutrition/analyze',
    imageUri,
    metadata,
    {
      skipMobileCompression: false,
      sourceMimeType: options?.sourceMimeType,
      sourceFileName: options?.sourceFileName,
    }
  );

  console.log('[NutritionApi] Gemini 3 Pro response:', JSON.stringify(backendResponse, null, 2));

  // Transform backend response to frontend format
  const transformedResponse = transformBackendResponse(backendResponse);

  console.log('[NutritionApi] Transformed response:', JSON.stringify(transformedResponse, null, 2));

  return transformedResponse;
};

// Save analyzed meal to today's log
const saveMealFromImage = async (payload: SaveMealPayload): Promise<MealLogResponse> => {
  // Validate nutrition values - ensure they're valid numbers
  const calories = Math.round(payload.totalNutrition.calories || 0);
  const protein = Math.round(payload.totalNutrition.protein || 0);
  const carbs = Math.round(payload.totalNutrition.carbs || 0);
  const fat = Math.round(payload.totalNutrition.fat || 0);

  // Validate that we have at least some nutrition data
  if (calories === 0 && protein === 0 && carbs === 0 && fat === 0) {
    throw new Error('No nutrition data available to save');
  }

  // Build food items in the format expected by backend (CreateMealRequest.FoodItemRequest)
  const foodItems = payload.items.map((item, index) => ({
    foodKey: `detected_${index}_${item.name.toLowerCase().replace(/\s+/g, '_')}`,
    displayName: item.name,
    grams: Math.round(item.amount),
    calories: item.calories,
    protein: item.protein,
    fat: item.fat,
    carbs: item.carbs,
    confidence: item.confidence || 0.8,
  }));

  // Build the request payload for /api/v1/nutrition/meals
  // The backend will extract userId from JWT token
  // IMPORTANT: Backend expects "note" (singular), not "notes"
  const mealPayload = {
    mealType: payload.mealType || 'other',
    items: foodItems,
    note: payload.notes || `Detected: ${payload.items.map(f => f.name).join(', ')}`.slice(0, 500),
    imageUrl: payload.imageUrl || null, // Use uploaded image URL when available
  };

  console.log('[NutritionApi] Saving meal with payload:', JSON.stringify(mealPayload, null, 2));

  // POST to /api/v1/meals - accepts items array and extracts userId from JWT
  return await api.post<MealLogResponse>('/api/v1/meals', mealPayload);
};

// Update an existing meal with modified food items
const updateMeal = async (mealId: number, payload: SaveMealPayload): Promise<MealLogResponse> => {
  // Validate nutrition values - ensure they're valid numbers
  const calories = Math.round(payload.totalNutrition.calories || 0);
  const protein = Math.round(payload.totalNutrition.protein || 0);
  const carbs = Math.round(payload.totalNutrition.carbs || 0);
  const fat = Math.round(payload.totalNutrition.fat || 0);

  // Validate that we have at least some nutrition data
  if (calories === 0 && protein === 0 && carbs === 0 && fat === 0) {
    throw new Error('No nutrition data available to save');
  }

  // Build food items in the format expected by backend (CreateMealRequest.FoodItemRequest)
  const foodItems = payload.items.map((item, index) => ({
    foodKey: `detected_${index}_${item.name.toLowerCase().replace(/\s+/g, '_')}`,
    displayName: item.name,
    grams: Math.round(item.amount),
    calories: item.calories,
    protein: item.protein,
    fat: item.fat,
    carbs: item.carbs,
    confidence: item.confidence || 0.8,
  }));

  // Build the request payload
  // IMPORTANT: Backend expects "note" (singular), not "notes"
  const mealPayload = {
    mealType: payload.mealType || 'other',
    items: foodItems,
    note: payload.notes || `Detected: ${payload.items.map(f => f.name).join(', ')}`.slice(0, 500),
    imageUrl: payload.imageUrl || null,
  };

  console.log('[NutritionApi] Updating meal', mealId, 'with payload:', JSON.stringify(mealPayload, null, 2));

  return await api.put<MealLogResponse>(`/api/v1/meals/${mealId}`, mealPayload);
};

export default {
  logMeal,
  getDailySummary,
  getWeeklySummary,
  getWeeklyInsight,
  analyzeFoodImage,
  saveMealFromImage,
  updateMeal,
  deleteMeal,
};
