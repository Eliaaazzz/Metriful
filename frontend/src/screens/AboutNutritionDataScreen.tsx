import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ArrowLeft, ArrowSquareOut, WarningCircle } from 'phosphor-react-native';

import { SafeAreaWrapper, Text } from '@/components';
import type { GeneratedGoals } from '@/services/geminiApi';
import {
  ABOUT_NUTRITION_REFERENCE_ORDER,
  BRAND_COLORS,
  getNutritionTargetExplanation,
  openExternalUrl,
  spacing,
} from '@/utils';

const GENERATED_GOALS_KEY = '@generated_fitness_goals';

function SourceCard({ title, body, url, domainLabel }: { title: string; body: string; url: string; domainLabel: string }) {
  return (
    <View style={styles.sourceCard}>
      <Text style={styles.sourceTitle}>{title}</Text>
      <Text style={styles.sourceBody}>{body}</Text>
      <Text style={styles.sourceMeta}>{domainLabel}</Text>
      <Pressable
        onPress={() => openExternalUrl(url, 'Unable to open source', 'Please open the reference in your browser.')}
        style={styles.linkRow}
      >
        <ArrowSquareOut size={14} color={BRAND_COLORS.secondary} />
        <Text style={styles.linkText}>{title}</Text>
      </Pressable>
    </View>
  );
}

// Default values when user has no plan (FDA Daily Values)
const DEFAULT_TARGETS = { calories: 2000, protein: 50, carbs: 275, fat: 78 };

export function AboutNutritionDataScreen() {
  const navigation = useNavigation();
  const [generatedGoals, setGeneratedGoals] = useState<GeneratedGoals | null>(null);

  useEffect(() => {
    const loadGoals = async () => {
      try {
        const saved = await AsyncStorage.getItem(GENERATED_GOALS_KEY);
        if (saved) {
          setGeneratedGoals(JSON.parse(saved));
        }
      } catch (error) {
        console.warn('[AboutNutritionDataScreen] Failed to load saved goals:', error);
      }
    };

    void loadGoals();
  }, []);

  const targetExplanation = useMemo(() => getNutritionTargetExplanation(generatedGoals), [generatedGoals]);
  const overflowReferences = ABOUT_NUTRITION_REFERENCE_ORDER.filter(
    (reference) => !targetExplanation.references.some((item) => item.id === reference.id)
  );

  // Values to display: use plan if available, otherwise FDA defaults
  const displayTargets = generatedGoals
    ? {
        calories: generatedGoals.dailyCalories.target,
        protein: generatedGoals.macros_grams.protein_g,
        carbs: generatedGoals.macros_grams.carbs_g,
        fat: generatedGoals.macros_grams.fat_g,
      }
    : DEFAULT_TARGETS;

  return (
    <SafeAreaWrapper>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Back button */}
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.6 }]}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ArrowLeft size={20} color={BRAND_COLORS.textPrimary} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>

        <Text style={styles.heading}>About Nutrition Data</Text>
        <Text style={styles.referenceLead}>
          Direct references and calculation notes for the calorie, macro, and estimated glycemic-impact values shown in Metriful. All values are estimates, not measurements.
        </Text>

        <Text style={styles.sectionTitle}>Current Dashboard Targets</Text>
        <View style={styles.currentTargetCard}>
          <Text style={styles.currentTargetTitle}>{targetExplanation.title}</Text>
          <Text style={styles.currentTargetBody}>{targetExplanation.summary}</Text>
          <Text style={styles.currentTargetMeta}>
            {targetExplanation.inputSummary || 'Build Plan currently defaults to age 30 and medium activity unless a saved plan includes different inputs.'}
          </Text>

          <View style={styles.currentTargetGrid}>
            <View style={styles.metricPill}>
              <Text style={styles.metricValue}>{displayTargets.calories}</Text>
              <Text style={styles.metricLabel}>kcal/day</Text>
            </View>
            <View style={styles.metricPill}>
              <Text style={styles.metricValue}>{displayTargets.protein}g</Text>
              <Text style={styles.metricLabel}>Protein</Text>
            </View>
            <View style={styles.metricPill}>
              <Text style={styles.metricValue}>{displayTargets.carbs}g</Text>
              <Text style={styles.metricLabel}>Carbs</Text>
            </View>
            <View style={styles.metricPill}>
              <Text style={styles.metricValue}>{displayTargets.fat}g</Text>
              <Text style={styles.metricLabel}>Fat</Text>
            </View>
          </View>

          <Text style={styles.explanationLine}>Calories: {targetExplanation.calorieDetail}</Text>
          <Text style={styles.explanationLine}>Macros: {targetExplanation.macroDetail}</Text>
          <Text style={styles.explanationLine}>{targetExplanation.bloodSugarDetail}</Text>
        </View>

        <Text style={styles.sectionTitle}>Direct References</Text>
        {targetExplanation.references.map((reference) => (
          <SourceCard
            key={reference.id}
            title={reference.title}
            body={reference.summary}
            url={reference.url}
            domainLabel={reference.domainLabel}
          />
        ))}

        {overflowReferences.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Reference Library</Text>
            <View style={styles.referenceList}>
              {overflowReferences.map((reference) => (
                <Pressable
                  key={reference.id}
                  onPress={() => openExternalUrl(reference.url, 'Unable to open source', 'Please open the reference in your browser.')}
                  style={styles.referenceListItem}
                >
                  <Text style={styles.referenceTitle}>{reference.shortLabel}</Text>
                  <Text style={styles.referenceDomain}>{reference.domainLabel}</Text>
                </Pressable>
              ))}
            </View>
          </>
        )}

        <Text style={styles.sectionTitle}>AI-Generated Estimates</Text>
        <Text style={styles.paragraph}>
          When you scan a meal using your camera, nutritional values such as calories, protein,
          carbohydrates, fat, and sugar are estimated using AI image recognition. These values are
          approximate and may not match the exact nutritional content of your food.
        </Text>

        <View style={styles.disclaimerBox}>
          <WarningCircle size={18} color={BRAND_COLORS.warning} style={styles.disclaimerIcon} />
          <Text style={styles.disclaimerText}>
            AI-generated nutritional estimates are for informational purposes only and are not
            intended as medical or dietary advice. Always consult a qualified healthcare
            professional before making changes to your diet, especially if you have diabetes or
            other health conditions.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    paddingBottom: spacing['2xl'],
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  backText: {
    fontSize: 15,
    fontWeight: '600',
    color: BRAND_COLORS.textPrimary,
  },
  heading: {
    fontSize: 26,
    fontWeight: '700',
    color: BRAND_COLORS.textPrimary,
    marginBottom: spacing.sm,
  },
  referenceLead: {
    fontSize: 14,
    lineHeight: 22,
    color: BRAND_COLORS.textMuted,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: BRAND_COLORS.textPrimary,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  currentTargetCard: {
    backgroundColor: '#FBF8F2',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E7DED1',
    padding: spacing.md,
    gap: spacing.sm,
  },
  currentTargetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: BRAND_COLORS.textPrimary,
  },
  currentTargetBody: {
    fontSize: 14,
    lineHeight: 22,
    color: '#374151',
  },
  currentTargetMeta: {
    fontSize: 12,
    lineHeight: 18,
    color: BRAND_COLORS.textMuted,
  },
  currentTargetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  metricPill: {
    minWidth: 92,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E7DED1',
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '700',
    color: BRAND_COLORS.textPrimary,
  },
  metricLabel: {
    marginTop: 2,
    fontSize: 11,
    color: BRAND_COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  explanationLine: {
    fontSize: 13,
    lineHeight: 20,
    color: '#4B5563',
  },
  paragraph: {
    fontSize: 14,
    lineHeight: 22,
    color: BRAND_COLORS.textMuted,
    marginBottom: spacing.md,
  },
  sourceCard: {
    backgroundColor: BRAND_COLORS.surfaceVariant,
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: BRAND_COLORS.border,
  },
  sourceTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: BRAND_COLORS.textPrimary,
    marginBottom: 6,
  },
  sourceBody: {
    fontSize: 13,
    lineHeight: 20,
    color: BRAND_COLORS.textDisabled,
  },
  sourceMeta: {
    marginTop: 10,
    fontSize: 11,
    fontWeight: '600',
    color: BRAND_COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 10,
  },
  linkText: {
    fontSize: 13,
    fontWeight: '600',
    color: BRAND_COLORS.secondary,
    textDecorationLine: 'underline',
    flex: 1,
  },
  referenceList: {
    gap: spacing.sm,
  },
  referenceListItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BRAND_COLORS.border,
    padding: spacing.md,
  },
  referenceTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: BRAND_COLORS.textPrimary,
  },
  referenceDomain: {
    marginTop: 4,
    fontSize: 12,
    color: BRAND_COLORS.textMuted,
  },
  disclaimerBox: {
    flexDirection: 'row',
    backgroundColor: '#FFFBEB',
    borderRadius: 16,
    padding: spacing.md,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: '#FDE68A',
    gap: spacing.sm,
  },
  disclaimerIcon: {
    marginTop: 2,
  },
  disclaimerText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    color: '#92400E',
  },
});
