import type { DetectedFood } from '@/services/nutritionApi';
import { applyClarifyAnswer, buildClarifyQuestions, RESOLVED_CONFIDENCE } from '../clarify';

const food = (overrides: Partial<DetectedFood>): DetectedFood => ({
  id: 'f1',
  name: 'Grilled chicken',
  amount: 1,
  unit: 'piece',
  calories: 300,
  protein: 30,
  carbs: 5,
  fat: 12,
  confidence: 0.9,
  ...overrides,
});

describe('buildClarifyQuestions', () => {
  it('asks a portion question for the lowest-confidence item only', () => {
    const items = [
      food({ id: 'a', name: 'Rice', confidence: 0.55 }),
      food({ id: 'b', name: 'Mystery stew', confidence: 0.4 }),
      food({ id: 'c', name: 'Olive oil dressing', confidence: 0.95 }),
    ];
    const questions = buildClarifyQuestions(items);
    const portion = questions.find((q) => q.id.startsWith('portion:'));
    expect(portion?.itemId).toBe('b');
  });

  it('asks about hidden fats when a cooked dish has no visible fat carrier', () => {
    const questions = buildClarifyQuestions([food({ name: 'Fried rice with chicken' })]);
    expect(questions.some((q) => q.id === 'hidden-fats')).toBe(true);
  });

  it('skips hidden fats when a fat carrier is already detected', () => {
    const questions = buildClarifyQuestions([
      food({ name: 'Grilled chicken' }),
      food({ id: 'f2', name: 'Ranch dressing' }),
    ]);
    expect(questions.some((q) => q.id === 'hidden-fats')).toBe(false);
  });

  it('never asks more than two questions', () => {
    const items = [
      food({ id: 'a', confidence: 0.3, name: 'Chicken curry' }),
      food({ id: 'b', confidence: 0.4, name: 'Noodles' }),
    ];
    expect(buildClarifyQuestions(items).length).toBeLessThanOrEqual(2);
  });
});

describe('applyClarifyAnswer', () => {
  const items = [food({ id: 'a', confidence: 0.4, calories: 400, protein: 20, carbs: 40, fat: 10 })];
  const question = buildClarifyQuestions(items).find((q) => q.id.startsWith('portion:'))!;

  it('scales the item down for "smaller" and resolves its confidence', () => {
    const { items: next, changedIds } = applyClarifyAnswer(items, question, 'smaller');
    expect(next[0].calories).toBeCloseTo(300);
    expect(next[0].protein).toBeCloseTo(15);
    expect(next[0].confidence).toBe(RESOLVED_CONFIDENCE);
    expect(changedIds).toEqual(['a']);
  });

  it('removes the item for "not-mine"', () => {
    const { items: next } = applyClarifyAnswer(items, question, 'not-mine');
    expect(next).toHaveLength(0);
  });

  it('keeps values for "right" but clears the low-confidence flag', () => {
    const { items: next, changedIds } = applyClarifyAnswer(items, question, 'right');
    expect(next[0].calories).toBe(400);
    expect(next[0].confidence).toBe(RESOLVED_CONFIDENCE);
    expect(changedIds).toEqual([]);
  });

  it('adds a pure-fat item for hidden fats', () => {
    const hidden = { id: 'hidden-fats', title: '', options: [] };
    const { items: next, changedIds } = applyClarifyAnswer(items, hidden, 'regular');
    expect(next).toHaveLength(2);
    const added = next[1];
    expect(added.calories).toBe(90);
    expect(added.fat).toBeCloseTo(10, 0);
    expect(added.protein).toBe(0);
    expect(changedIds).toEqual([added.id]);
  });

  it('changes nothing for hidden fats "none"', () => {
    const hidden = { id: 'hidden-fats', title: '', options: [] };
    const { items: next } = applyClarifyAnswer(items, hidden, 'none');
    expect(next).toBe(items);
  });
});
