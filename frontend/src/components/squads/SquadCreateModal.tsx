/**
 * SquadCreateModal — emoji picker + name input. Returns the created Squad
 * via {@code onCreated} so the parent can refresh and reveal the invite code.
 */
import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { Text } from '@/components/Text';
import { squadsApi } from '@/services/squadsApi';
import type { Squad } from '@/types/squads';
import { BRAND_COLORS, spacing } from '@/utils';

const EMOJI_PALETTE = [
  '🌅', '🔥', '🥗', '🥑', '🍳', '🥦', '💪', '🏃',
  '🌿', '⚡', '🌊', '🍎', '🍇', '🥕', '🌱', '🦄',
];

interface SquadCreateModalProps {
  visible: boolean;
  onClose: () => void;
  onCreated: (squad: Squad) => void;
}

export function SquadCreateModal({ visible, onClose, onCreated }: SquadCreateModalProps) {
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState(EMOJI_PALETTE[0]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setName('');
    setEmoji(EMOJI_PALETTE[0]);
    setError(null);
  };

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      setError('Squad name is required');
      return;
    }
    if (trimmed.length > 30) {
      setError('Squad name must be 30 characters or fewer');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      const squad = await squadsApi.create({ name: trimmed, emoji, timezone });
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      onCreated(squad);
      reset();
    } catch (err: any) {
      setError(err?.message || 'Could not create squad');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />
          <Text variant="heading2" weight="bold" style={styles.title}>Create a Squad</Text>
          <Text variant="caption" style={styles.subtitle}>
            3–10 friends, one shared streak. Anyone logging keeps the streak alive.
          </Text>

          <Text variant="caption" weight="medium" style={styles.label}>EMOJI</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.emojiRow}>
            {EMOJI_PALETTE.map((e) => (
              <Pressable
                key={e}
                onPress={() => setEmoji(e)}
                style={[styles.emojiChip, e === emoji && styles.emojiChipActive]}
                accessibilityRole="button"
                accessibilityLabel={`Choose emoji ${e}`}
              >
                <Text style={styles.emojiText}>{e}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <Text variant="caption" weight="medium" style={styles.label}>NAME</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Sunrise Eaters"
            placeholderTextColor={BRAND_COLORS.textMuted}
            style={styles.input}
            maxLength={30}
            autoFocus
            editable={!submitting}
          />
          <Text variant="caption" style={styles.helper}>{name.length}/30</Text>

          {error && <Text variant="caption" style={styles.error}>{error}</Text>}

          <Pressable
            onPress={handleSubmit}
            disabled={submitting}
            style={[styles.cta, submitting && styles.ctaDisabled]}
            accessibilityRole="button"
            accessibilityState={{ disabled: submitting }}
          >
            {submitting
              ? <ActivityIndicator color="#fff" />
              : <Text variant="body" weight="bold" style={styles.ctaText}>Create squad</Text>}
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.18)',
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  title: { textAlign: 'center' },
  subtitle: { textAlign: 'center', color: BRAND_COLORS.textMuted, marginBottom: spacing.md },
  label: {
    marginTop: spacing.sm,
    color: BRAND_COLORS.textMuted,
    letterSpacing: 1.2,
    fontSize: 10,
  },
  emojiRow: { flexGrow: 0, marginVertical: spacing.xs },
  emojiChip: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.xs,
    backgroundColor: 'rgba(0,0,0,0.04)',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  emojiChipActive: {
    backgroundColor: 'rgba(249,115,22,0.10)',
    borderColor: BRAND_COLORS.primary,
  },
  emojiText: { fontSize: 22 },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.10)',
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 16,
    color: BRAND_COLORS.textPrimary,
  },
  helper: { color: BRAND_COLORS.textMuted, alignSelf: 'flex-end', fontSize: 10 },
  error: {
    color: BRAND_COLORS.danger,
    backgroundColor: 'rgba(208,92,65,0.08)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: 8,
  },
  cta: {
    marginTop: spacing.md,
    backgroundColor: BRAND_COLORS.primary,
    paddingVertical: spacing.md,
    borderRadius: 14,
    alignItems: 'center',
  },
  ctaDisabled: { opacity: 0.6 },
  ctaText: { color: '#FFFFFF' },
});

export default SquadCreateModal;
