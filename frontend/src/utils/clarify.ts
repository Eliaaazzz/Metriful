/**
 * clarify — "one high-value question at a time" for the meal review screen.
 *
 * Instead of dumping the user into an edit form, ask at most two one-tap questions,
 * ordered by calorie impact (Uber-Eats "substitution" pattern):
 *   1. a portion sanity-check on the lowest-confidence item, and
 *   2. hidden fats (oil/butter/dressing) — the classic photo-nutrition blind spot.
 *
 * Adjustment factors are deliberately conservative, food-science rules of thumb:
 *  - frying adds roughly 15–30% calories through absorbed fat → we use ×1.25 kcal, fat ×1.6;
 *  - "smaller/larger than it looks" → ×0.75 / ×1.25;
 *  - hidden fats: light ≈ 1 tsp oil (~40 kcal), regular ≈ 1 tbsp (~90), heavy ≈ 1.5 tbsp+ (~150).
 * Every answer is still editable afterwards; answering marks the item's confidence resolved
 * so the "Check" chip clears.
 */
import type { DetectedFood } from '@/services/nutritionApi';

export interface ClarifyOption {
  id: string;
  label: string;
}

export interface ClarifyQuestion {
  id: string;
  itemId?: string;
  title: string;
  options: ClarifyOption[];
}

export interface ClarifyResult {
  items: DetectedFood[];
  /** Item ids whose per-unit base nutrition changed (screen refreshes its base map). */
  changedIds: string[];
}

export const LOW_CONFIDENCE_THRESHOLD = 0.6;
export const RESOLVED_CONFIDENCE = 0.85;

const FAT_CARRIER_KEYWORDS = [
  'oil', 'butter', 'margarine', 'dressing', 'mayo', 'mayonnaise', 'aioli', 'gravy',
  'sauce', 'vinaigrette', 'ghee', 'lard', 'cream',
];

const COOKED_DISH_KEYWORDS = [
  'chicken', 'beef', 'steak', 'pork', 'fish', 'salmon', 'shrimp', 'egg', 'tofu',
  'rice', 'noodle', 'pasta', 'stir', 'curry', 'fried', 'roast', 'grilled', 'saut',
];

const HIDDEN_FAT_KCAL: Record<string, number> = { light: 40, regular: 90, heavy: 150 };

const nameMatches = (name: string | undefined, keywords: string[]): boolean => {
  const n = (name || '').toLowerCase();
  return keywords.some((k) => n.includes(k));
};

export function buildClarifyQuestions(items: DetectedFood[]): ClarifyQuestion[] {
  const questions: ClarifyQuestion[] = [];

  // 1. Portion sanity-check on the single lowest-confidence item.
  const uncertain = items
    .filter((i) => typeof i.confidence === 'number' && i.confidence < LOW_CONFIDENCE_THRESHOLD)
    .sort((a, b) => (a.confidence ?? 1) - (b.confidence ?? 1))[0];
  if (uncertain) {
    questions.push({
      id: `portion:${uncertain.id}`,
      itemId: uncertain.id,
      title: `Does "${uncertain.name}" look right?`,
      options: [
        { id: 'right', label: 'Looks right' },
        { id: 'smaller', label: 'Smaller portion' },
        { id: 'larger', label: 'Larger portion' },
        { id: 'not-mine', label: 'Remove it' },
      ],
    });
  }

  // 2. Hidden fats — only when a cooked dish is present and no visible fat carrier was detected.
  const hasFatCarrier = items.some((i) => nameMatches(i.name, FAT_CARRIER_KEYWORDS));
  const hasCookedDish = items.some((i) => nameMatches(i.name, COOKED_DISH_KEYWORDS));
  if (hasCookedDish && !hasFatCarrier) {
    questions.push({
      id: 'hidden-fats',
      title: 'Any oil, butter or dressing that isn’t visible?',
      options: [
        { id: 'none', label: 'None' },
        { id: 'light', label: 'Light' },
        { id: 'regular', label: 'Regular' },
        { id: 'heavy', label: 'Heavy' },
      ],
    });
  }

  return questions.slice(0, 2);
}

const scaleItem = (item: DetectedFood, factor: number): DetectedFood => ({
  ...item,
  calories: item.calories * factor,
  protein: item.protein * factor,
  carbs: item.carbs * factor,
  fat: item.fat * factor,
  fiber: item.fiber != null ? item.fiber * factor : item.fiber,
  sugar: item.sugar != null ? item.sugar * factor : item.sugar,
  glycemicLoad: item.glycemicLoad != null ? item.glycemicLoad * factor : item.glycemicLoad,
});

export function applyClarifyAnswer(
  items: DetectedFood[],
  question: ClarifyQuestion,
  optionId: string
): ClarifyResult {
  if (question.id === 'hidden-fats') {
    const kcal = HIDDEN_FAT_KCAL[optionId];
    if (!kcal) {
      return { items, changedIds: [] };
    }
    const added: DetectedFood = {
      id: `manual-hidden-fats-${Date.now()}`,
      name: 'Cooking oil / dressing (not visible)',
      amount: 1,
      unit: 'serving',
      calories: kcal,
      protein: 0,
      carbs: 0,
      fat: Math.round((kcal / 9) * 10) / 10, // pure fat: 9 kcal per gram
      confidence: 0.7,
    };
    return { items: [...items, added], changedIds: [added.id] };
  }

  if (question.id.startsWith('portion:') && question.itemId) {
    const target = items.find((i) => i.id === question.itemId);
    if (!target) {
      return { items, changedIds: [] };
    }
    if (optionId === 'not-mine') {
      return { items: items.filter((i) => i.id !== question.itemId), changedIds: [] };
    }
    const factor = optionId === 'smaller' ? 0.75 : optionId === 'larger' ? 1.25 : 1;
    const next = items.map((i) => {
      if (i.id !== question.itemId) return i;
      const scaled = factor === 1 ? i : scaleItem(i, factor);
      return { ...scaled, confidence: Math.max(i.confidence ?? 0, RESOLVED_CONFIDENCE) };
    });
    return { items: next, changedIds: factor === 1 ? [] : [question.itemId] };
  }

  return { items, changedIds: [] };
}
