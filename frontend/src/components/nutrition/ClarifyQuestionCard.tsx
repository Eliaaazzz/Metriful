/**
 * ClarifyQuestionCard — one high-value question at a time (never a form).
 *
 * Rendered above the detected-items list when the analysis left something worth a
 * one-tap answer (low-confidence portion, hidden fats). Answering applies immediately;
 * "Skip" dismisses without judgment.
 */
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Question } from 'phosphor-react-native';

import { Text } from '@/components/Text';
import { BRAND_COLORS } from '@/utils';
import type { ClarifyQuestion } from '@/utils/clarify';

interface ClarifyQuestionCardProps {
  question: ClarifyQuestion;
  /** e.g. "1 of 2" when more than one question is queued */
  positionLabel?: string;
  onAnswer: (optionId: string) => void;
  onSkip: () => void;
}

export function ClarifyQuestionCard({ question, positionLabel, onAnswer, onSkip }: ClarifyQuestionCardProps) {
  return (
    <View style={styles.card} accessibilityLabel={`Quick question: ${question.title}`}>
      <View style={styles.headerRow}>
        <View style={styles.iconWrap}>
          <Question size={18} color={BRAND_COLORS.primaryDark} weight="bold" />
        </View>
        <Text variant="caption" weight="bold" style={styles.eyebrow}>
          QUICK CHECK{positionLabel ? ` · ${positionLabel}` : ''}
        </Text>
        <Pressable
          onPress={onSkip}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Skip this question"
        >
          <Text variant="caption" weight="semibold" style={styles.skip}>
            Skip
          </Text>
        </Pressable>
      </View>

      <Text variant="heading4" weight="semibold" style={styles.title}>
        {question.title}
      </Text>

      <View style={styles.optionsRow}>
        {question.options.map((option) => (
          <Pressable
            key={option.id}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              onAnswer(option.id);
            }}
            style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
            accessibilityRole="button"
            accessibilityLabel={option.label}
          >
            <Text variant="body" weight="semibold" style={styles.optionText}>
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(201, 106, 52, 0.25)',
    backgroundColor: BRAND_COLORS.primaryContainer,
    padding: 16,
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: 'rgba(201, 106, 52, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    flex: 1,
    color: BRAND_COLORS.primaryDark,
    letterSpacing: 1,
  },
  skip: {
    color: BRAND_COLORS.textMuted,
  },
  title: {
    color: BRAND_COLORS.textPrimary,
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  option: {
    minHeight: 44,
    borderRadius: 999,
    paddingHorizontal: 16,
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: BRAND_COLORS.border,
  },
  optionPressed: {
    opacity: 0.75,
  },
  optionText: {
    color: BRAND_COLORS.textPrimary,
  },
});

export default ClarifyQuestionCard;
