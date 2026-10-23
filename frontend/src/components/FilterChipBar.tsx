import { Text } from './Text';
import { colors, spacing } from '@/utils';
import { Check, Funnel } from 'phosphor-react-native';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';

export interface FilterChip {
  id: string;
  label: string;
  /** Optional emoji or icon prefix shown before the label */
  emoji?: string;
}

interface FilterChipBarProps {
  chips: FilterChip[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onClear?: () => void;
  /** Render a "Funnel" icon as the first item that opens advanced filters */
  onOpenAdvanced?: () => void;
}

/**
 * FilterChipBar — sticky multi-select chip row above a list.
 * Pattern source: Uber Eats home filter pill bar ("Under 30 min", "Free delivery", etc.).
 */
export const FilterChipBar: React.FC<FilterChipBarProps> = ({
  chips,
  selectedIds,
  onToggle,
  onClear,
  onOpenAdvanced,
}) => {
  const hasSelection = selectedIds.size > 0;

  return (
    <View style={styles.wrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {onOpenAdvanced && (
          <Pressable
            onPress={onOpenAdvanced}
            style={[styles.chip, styles.iconChip]}
            hitSlop={6}
          >
            <Funnel size={16} color={colors.light.textPrimary} weight="bold" />
          </Pressable>
        )}

        {hasSelection && onClear && (
          <Pressable
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              onClear();
            }}
            style={[styles.chip, styles.clearChip]}
            hitSlop={6}
          >
            <Text variant="caption" weight="semibold" style={styles.clearText}>
              Clear · {selectedIds.size}
            </Text>
          </Pressable>
        )}

        {chips.map((chip) => {
          const active = selectedIds.has(chip.id);
          return (
            <Pressable
              key={chip.id}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                onToggle(chip.id);
              }}
              style={[styles.chip, active && styles.chipActive]}
              hitSlop={6}
            >
              {active ? (
                <Check size={14} color="#FFFFFF" weight="bold" />
              ) : chip.emoji ? (
                <Text variant="caption" style={styles.emoji}>{chip.emoji}</Text>
              ) : null}
              <Text
                variant="caption"
                weight="semibold"
                style={active ? styles.chipTextActive : styles.chipText}
              >
                {chip.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    paddingVertical: spacing.sm,
  },
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(17,17,17,0.08)',
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  chipActive: {
    backgroundColor: colors.light.textPrimary,
    borderColor: colors.light.textPrimary,
  },
  iconChip: {
    paddingHorizontal: 10,
  },
  clearChip: {
    backgroundColor: `${colors.light.primary}1A`,
    borderColor: `${colors.light.primary}40`,
  },
  clearText: {
    color: colors.light.primary,
  },
  chipText: {
    color: colors.light.textPrimary,
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  emoji: {
    fontSize: 13,
  },
});
