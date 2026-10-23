import { Text } from '@/components';
import type { PersonalRecord } from '@/hooks/usePersonalRecords';
import { colors, radii, spacing } from '@/utils';
import { Medal } from 'phosphor-react-native';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

interface PersonalRecordsCardProps {
  records: PersonalRecord[];
  onShare?: () => void;
}

/**
 * PersonalRecordsCard — Strava-style personal records grid.
 * Pattern source: Strava PR section on activity detail.
 */
export const PersonalRecordsCard: React.FC<PersonalRecordsCardProps> = ({ records, onShare }) => {
  if (records.length === 0) return null;
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleGroup}>
          <View style={styles.iconBubble}>
            <Medal size={16} color="#F97316" weight="fill" />
          </View>
          <View>
            <Text variant="body" weight="bold" style={styles.title}>
              Personal records
            </Text>
            <Text variant="caption" style={styles.subtitle}>
              Best numbers you’ve ever hit
            </Text>
          </View>
        </View>
        {onShare && (
          <Pressable onPress={onShare} hitSlop={6} style={styles.shareBtn}>
            <Text variant="caption" weight="semibold" style={styles.shareBtnText}>
              Share
            </Text>
          </Pressable>
        )}
      </View>

      <View style={styles.grid}>
        {records.map((r) => (
          <View key={r.id} style={styles.cell}>
            <Text style={styles.emoji}>{r.emoji}</Text>
            <Text variant="heading3" weight="bold" style={styles.value}>
              {r.value}
            </Text>
            <Text variant="caption" weight="semibold" style={styles.label} numberOfLines={1}>
              {r.label}
            </Text>
            {r.detail ? (
              <Text variant="caption" style={styles.detail} numberOfLines={2}>
                {r.detail}
              </Text>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginVertical: spacing.md },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  titleGroup: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconBubble: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(249,115,22,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: colors.light.textPrimary },
  subtitle: { color: colors.light.textSecondary, opacity: 0.8 },
  shareBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(17,17,17,0.06)',
  },
  shareBtnText: { color: colors.light.textPrimary },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  cell: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(17,17,17,0.06)',
    padding: spacing.md,
    gap: 4,
  },
  emoji: { fontSize: 22 },
  value: { color: colors.light.textPrimary },
  label: { color: colors.light.textPrimary },
  detail: { color: colors.light.textSecondary, opacity: 0.8 },
});

export default PersonalRecordsCard;
