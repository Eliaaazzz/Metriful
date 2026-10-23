/**
 * InsightCard unit tests.
 *
 * Covers: positive vs negative accent, sentence + disclaimer rendering, pin
 * toggle callback, confidence chip presence.
 */
import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import { InsightCard } from '../InsightCard';
import type { Insight } from '@/types/insights';

jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn().mockResolvedValue(undefined),
}));

const baseInsight: Insight = {
  id: 1,
  behaviorKey: 'breakfast_logged',
  label: 'Logged breakfast',
  deltaScore: 8.4,
  cohensD: 0.72,
  pValue: 0.012,
  sampleYes: 18,
  sampleNo: 24,
  confidence: 'med',
  positive: true,
  sentence: 'On days you logged breakfast, your Daily Score is 8.4 points higher (n=42).',
  disclaimer: 'AI-generated — verify with a healthcare professional.',
  computedAt: '2026-05-06T03:00:00Z',
  pinned: false,
};

describe('InsightCard', () => {
  it('renders the server-provided sentence and disclaimer', () => {
    const { getByText } = render(<InsightCard insight={baseInsight} />);
    expect(
      getByText(/On days you logged breakfast, your Daily Score is 8.4 points higher/),
    ).toBeTruthy();
    expect(getByText(/AI-generated/)).toBeTruthy();
  });

  it('renders confidence + sample size', () => {
    const { getByText } = render(<InsightCard insight={baseInsight} />);
    expect(getByText(/Med confidence · n=42/)).toBeTruthy();
  });

  it('shows a + sign for positive deltas and − for negative', () => {
    const { getByText, rerender } = render(<InsightCard insight={baseInsight} />);
    expect(getByText('+8.4')).toBeTruthy();

    const negative: Insight = { ...baseInsight, positive: false, deltaScore: -5.2 };
    rerender(<InsightCard insight={negative} />);
    expect(getByText('−5.2')).toBeTruthy();
  });

  it('fires onTogglePin when the pin button is pressed', () => {
    const onTogglePin = jest.fn();
    const { getByTestId } = render(
      <InsightCard insight={baseInsight} onTogglePin={onTogglePin} />,
    );
    fireEvent.press(getByTestId('insight-pin-1'));
    expect(onTogglePin).toHaveBeenCalledWith(baseInsight);
  });

  it('passes the insight to onPress when the card is tapped', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <InsightCard insight={baseInsight} onPress={onPress} />,
    );
    fireEvent.press(getByTestId('insight-card-1'));
    expect(onPress).toHaveBeenCalledWith(baseInsight);
  });
});
