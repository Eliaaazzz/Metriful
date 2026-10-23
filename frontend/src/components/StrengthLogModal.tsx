import { Button, DetailBottomSheet, Text } from '@/components';
import {
  EXERCISE_TEMPLATES,
  type MuscleGroup,
  useStrengthLogStore,
  type StrengthSet,
} from '@/stores/useStrengthLogStore';
import { colors, radii, spacing } from '@/utils';
import * as Haptics from 'expo-haptics';
import { Minus, Plus } from 'phosphor-react-native';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

interface StrengthLogModalProps {
  visible: boolean;
  onClose: () => void;
  onLogged?: (entry: { exercise: string; sets: StrengthSet[]; muscleGroup: MuscleGroup }) => void;
}

const DEFAULT_SETS: StrengthSet[] = [
  { reps: 10, weightKg: 40 },
  { reps: 10, weightKg: 40 },
  { reps: 10, weightKg: 40 },
];

/**
 * StrengthLogModal — log a strength exercise (sets/reps/weight) via bottom sheet.
 * Pattern source: Strong / Hevy strength tracker (sets table).
 */
export const StrengthLogModal: React.FC<StrengthLogModalProps> = ({ visible, onClose, onLogged }) => {
  const [group, setGroup] = useState<MuscleGroup>('legs');
  const [exercise, setExercise] = useState('Back Squat');
  const [sets, setSets] = useState<StrengthSet[]>(DEFAULT_SETS);
  const logEntry = useStrengthLogStore((s) => s.logEntry);
  const prs = useStrengthLogStore((s) => s.prs);
  const currentPr = prs[exercise.toLowerCase()];

  const exerciseChoices = useMemo(
    () => EXERCISE_TEMPLATES.find((t) => t.group === group)?.exercises ?? [],
    [group]
  );

  const bump = (idx: number, field: keyof StrengthSet, delta: number) => {
    Haptics.selectionAsync().catch(() => {});
    setSets((prev) =>
      prev.map((s, i) =>
        i === idx ? { ...s, [field]: Math.max(0, (s[field] as number) + delta) } : s
      )
    );
  };

  const addSet = () => {
    const last = sets[sets.length - 1];
    setSets((prev) => [...prev, { ...last }]);
  };

  const removeSet = (idx: number) => {
    if (sets.length <= 1) return;
    setSets((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleLog = () => {
    if (!exercise.trim()) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    logEntry({ exercise, muscleGroup: group, sets });
    onLogged?.({ exercise, sets, muscleGroup: group });
    onClose();
  };

  return (
    <DetailBottomSheet visible={visible} onClose={onClose} title="Log strength session" maxHeightRatio={0.85}>
      <View style={{ gap: spacing.md }}>
        {/* Muscle group chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {(EXERCISE_TEMPLATES.map((t) => t.group) as MuscleGroup[]).map((g) => {
            const active = g === group;
            return (
              <Pressable
                key={g}
                onPress={() => {
                  setGroup(g);
                  setExercise(EXERCISE_TEMPLATES.find((t) => t.group === g)?.exercises[0] ?? '');
                }}
                style={[styles.chip, active && styles.chipActive]}
                hitSlop={6}
              >
                <Text variant="caption" weight="bold" style={active ? styles.chipTextActive : styles.chipText}>
                  {g}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Exercise picker */}
        <View style={{ gap: spacing.xs }}>
          <Text variant="caption" weight="semibold" style={styles.sectionLabel}>Exercise</Text>
          <TextInput
            value={exercise}
            onChangeText={setExercise}
            placeholder="e.g., Back Squat"
            style={styles.input}
          />
          {exerciseChoices.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {exerciseChoices.map((ex) => (
                <Pressable
                  key={ex}
                  onPress={() => setExercise(ex)}
                  style={[styles.chipSmall, ex === exercise && styles.chipSmallActive]}
                  hitSlop={6}
                >
                  <Text variant="caption" style={ex === exercise ? styles.chipTextActive : styles.chipText}>
                    {ex}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
          {currentPr && (
            <Text variant="caption" style={styles.prText}>
              Your PR: {currentPr.bestSetWeightKg}kg × {currentPr.bestSetReps} (est. 1RM {currentPr.oneRmKg}kg)
            </Text>
          )}
        </View>

        {/* Sets table */}
        <View style={{ gap: spacing.xs }}>
          <View style={styles.setHeader}>
            <Text variant="caption" weight="semibold" style={[styles.setCol, styles.setColIdx]}>SET</Text>
            <Text variant="caption" weight="semibold" style={[styles.setCol, styles.setColRest]}>REPS</Text>
            <Text variant="caption" weight="semibold" style={[styles.setCol, styles.setColRest]}>WEIGHT (kg)</Text>
            <View style={styles.setColTrash} />
          </View>
          {sets.map((s, i) => (
            <View key={i} style={styles.setRow}>
              <Text variant="caption" weight="bold" style={[styles.setCol, styles.setColIdx]}>{i + 1}</Text>
              <View style={[styles.setCol, styles.stepper]}>
                <Pressable onPress={() => bump(i, 'reps', -1)} hitSlop={6} style={styles.stepBtn}>
                  <Minus size={12} color={colors.light.textPrimary} weight="bold" />
                </Pressable>
                <Text variant="body" weight="bold">{s.reps}</Text>
                <Pressable onPress={() => bump(i, 'reps', 1)} hitSlop={6} style={styles.stepBtn}>
                  <Plus size={12} color={colors.light.textPrimary} weight="bold" />
                </Pressable>
              </View>
              <View style={[styles.setCol, styles.stepper]}>
                <Pressable onPress={() => bump(i, 'weightKg', -2.5)} hitSlop={6} style={styles.stepBtn}>
                  <Minus size={12} color={colors.light.textPrimary} weight="bold" />
                </Pressable>
                <Text variant="body" weight="bold">{s.weightKg}</Text>
                <Pressable onPress={() => bump(i, 'weightKg', 2.5)} hitSlop={6} style={styles.stepBtn}>
                  <Plus size={12} color={colors.light.textPrimary} weight="bold" />
                </Pressable>
              </View>
              <Pressable onPress={() => removeSet(i)} hitSlop={6} style={styles.setColTrash}>
                <Text variant="caption" style={{ color: '#EF4444' }}>×</Text>
              </Pressable>
            </View>
          ))}
          <Pressable onPress={addSet} style={styles.addSetBtn}>
            <Plus size={12} color={colors.light.textPrimary} weight="bold" />
            <Text variant="caption" weight="bold">Add set</Text>
          </Pressable>
        </View>

        <Button title="Log session" variant="primary" size="medium" onPress={handleLog} />
      </View>
    </DetailBottomSheet>
  );
};

const styles = StyleSheet.create({
  chips: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 2,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(17,17,17,0.08)',
    backgroundColor: 'rgba(17,17,17,0.04)',
  },
  chipActive: { backgroundColor: colors.light.textPrimary, borderColor: colors.light.textPrimary },
  chipSmall: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(17,17,17,0.08)',
    backgroundColor: '#FFFFFF',
  },
  chipSmallActive: { backgroundColor: colors.light.primary, borderColor: colors.light.primary },
  chipText: { color: colors.light.textPrimary },
  chipTextActive: { color: '#FFFFFF' },
  sectionLabel: { color: colors.light.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4 },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(17,17,17,0.10)',
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    color: colors.light.textPrimary,
  },
  prText: { color: colors.light.primary, marginTop: 2 },
  setHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: radii.md,
    paddingHorizontal: 4,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(17,17,17,0.06)',
  },
  setCol: {},
  setColIdx: { width: 30, textAlign: 'center' },
  setColRest: { flex: 1, textAlign: 'center' },
  setColTrash: { width: 24, alignItems: 'center' },
  stepper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
  },
  stepBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(17,17,17,0.06)',
  },
  addSetBtn: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(17,17,17,0.06)',
  },
});

export default StrengthLogModal;
