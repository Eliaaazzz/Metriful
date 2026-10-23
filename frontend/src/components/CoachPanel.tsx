import React, { PropsWithChildren } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { BRAND_COLORS, spacing } from '@/utils';

// Apple Health summary cards: group one decision and its supporting measurements.
export function CoachPanel({ children }: PropsWithChildren) {
  return <View style={styles.panel}>
    {Platform.OS !== 'web' && <BlurView pointerEvents="none" intensity={24} tint="light"
      style={StyleSheet.absoluteFill} />}
    <View style={styles.content}>{children}</View>
  </View>;
}
const styles = StyleSheet.create({
  panel: {
    backgroundColor: BRAND_COLORS.glassFill, borderColor: BRAND_COLORS.glassStroke,
    borderWidth: 1, borderRadius: 24, overflow: 'hidden',
    ...Platform.select({ web: { backdropFilter: 'blur(24px)' } }),
  },
  content: { padding: spacing.lg, gap: spacing.md },
});
