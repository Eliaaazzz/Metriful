/**
 * JoinSquadModal — Apple-style 6-character segmented invite-code input.
 */
import * as Haptics from 'expo-haptics';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { Text } from '@/components/Text';
import { squadsApi } from '@/services/squadsApi';
import type { Squad } from '@/types/squads';
import { BRAND_COLORS, spacing } from '@/utils';

const CODE_LENGTH = 6;
const CODE_REGEX = /^[A-HJ-NP-Z2-9]+$/i;

interface JoinSquadModalProps {
  visible: boolean;
  onClose: () => void;
  onJoined: (squad: Squad) => void;
}

export function JoinSquadModal({ visible, onClose, onJoined }: JoinSquadModalProps) {
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<TextInput | null>(null);

  useEffect(() => {
    if (!visible) {
      setCode('');
      setError(null);
      setSubmitting(false);
    }
  }, [visible]);

  const handleChange = (next: string) => {
    const cleaned = next.toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g, '').slice(0, CODE_LENGTH);
    setCode(cleaned);
    if (error) setError(null);
  };

  const handleSubmit = async () => {
    if (code.length !== CODE_LENGTH) {
      setError(`Invite code must be ${CODE_LENGTH} characters`);
      return;
    }
    setSubmitting(true);
    try {
      const squad = await squadsApi.join({ inviteCode: code });
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      onJoined(squad);
    } catch (err: any) {
      setError(err?.message || 'Could not join squad');
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (submitting) return;
    onClose();
  };

  const cells = Array.from({ length: CODE_LENGTH }, (_, i) => code[i] ?? '');

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />
          <Text variant="heading2" weight="bold" style={styles.title}>Join with code</Text>
          <Text variant="caption" style={styles.subtitle}>
            Ask a squad mate for the 6-character invite code.
          </Text>

          <Pressable onPress={() => inputRef.current?.focus()} style={styles.cellsRow}>
            {cells.map((c, i) => (
              <View key={i} style={[styles.cell, code.length === i && styles.cellActive]}>
                <Text variant="heading2" weight="bold" style={styles.cellChar}>{c}</Text>
              </View>
            ))}
          </Pressable>

          <TextInput
            ref={inputRef}
            value={code}
            onChangeText={handleChange}
            autoCapitalize="characters"
            autoCorrect={false}
            autoFocus
            maxLength={CODE_LENGTH}
            keyboardType={Platform.OS === 'ios' ? 'ascii-capable' : 'default'}
            style={styles.hiddenInput}
            editable={!submitting}
          />

          {error && <Text variant="caption" style={styles.error}>{error}</Text>}

          <Pressable
            onPress={handleSubmit}
            disabled={submitting || code.length !== CODE_LENGTH}
            style={[styles.cta, (submitting || code.length !== CODE_LENGTH) && styles.ctaDisabled]}
            accessibilityRole="button"
          >
            {submitting
              ? <ActivityIndicator color="#fff" />
              : <Text variant="body" weight="bold" style={styles.ctaText}>Join squad</Text>}
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.18)',
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  title: { textAlign: 'center' },
  subtitle: { textAlign: 'center', color: BRAND_COLORS.textMuted, marginBottom: spacing.lg },
  cellsRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xs },
  cell: {
    width: 44, height: 56, borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.08)',
    backgroundColor: 'rgba(0,0,0,0.02)',
    alignItems: 'center', justifyContent: 'center',
  },
  cellActive: { borderColor: BRAND_COLORS.primary, backgroundColor: 'rgba(249,115,22,0.06)' },
  cellChar: { fontSize: 22, fontVariant: ['tabular-nums'] },
  hiddenInput: { position: 'absolute', opacity: 0, height: 1, width: 1 },
  error: {
    marginTop: spacing.sm,
    color: BRAND_COLORS.danger,
    backgroundColor: 'rgba(208,92,65,0.08)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: 8,
    textAlign: 'center',
  },
  cta: {
    marginTop: spacing.lg,
    backgroundColor: BRAND_COLORS.primary,
    paddingVertical: spacing.md,
    borderRadius: 14,
    alignItems: 'center',
  },
  ctaDisabled: { opacity: 0.5 },
  ctaText: { color: '#FFFFFF' },
});

export default JoinSquadModal;
