import { Image } from 'expo-image';
import React from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { Text } from '@/components';
import { LANDING_COLORS, LANDING_TYPE, spacing } from '@/utils';

/* A wall of photos — your past logs. (Storyset, recolored to the brand copper.) */
const accountIllustration = require('@/../assets/illustrations/log-history.svg');

interface AccountSplitSectionProps {
  onLogin: () => void;
  onSignup: () => void;
}

export function AccountSplitSection({ onLogin, onSignup }: AccountSplitSectionProps) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const isCompact = width < 420;

  return (
    <View style={[styles.section, isDesktop && styles.sectionDesktop]}>
      <View style={styles.copyColumn}>
        <Text
          variant="heading1"
          weight="bold"
          style={isDesktop ? [styles.title] : isCompact ? [styles.title, styles.titleMobile, styles.titleCompact] : [styles.title, styles.titleMobile]}
        >
          Log in to see your account details
        </Text>
        <Text variant="heading4" style={isDesktop ? [styles.body] : [styles.body, styles.bodyMobile]}>
          Review past logs, saved plans, targets, and weekly reports from one account view.
        </Text>

        <View style={styles.ctaRow}>
          <Pressable onPress={onLogin} style={({ pressed }) => [styles.primaryCta, pressed && styles.pressed]}>
            <Text variant="body" weight="bold" style={styles.primaryCtaText}>
              Log in to your account
            </Text>
          </Pressable>

          <Pressable onPress={onSignup} style={({ pressed }) => [styles.linkCta, pressed && styles.linkPressed]}>
            <Text variant="body" weight="medium" style={styles.linkText}>
              Create an account
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={[styles.visualPanel, !isDesktop && styles.visualPanelMobile, isCompact && styles.visualPanelCompact]}>
        <Image
          source={accountIllustration}
          style={[styles.illustration, !isDesktop && styles.illustrationMobile, isCompact && styles.illustrationCompact]}
          contentFit="contain"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing['2xl'],
    paddingTop: spacing['4xl'],
    paddingBottom: spacing['2xl'],
  },
  sectionDesktop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  copyColumn: {
    flex: 1,
    gap: spacing.lg,
  },
  title: {
    color: LANDING_COLORS.text,
    fontFamily: LANDING_TYPE.display,
    fontSize: 48,
    lineHeight: 52,
    letterSpacing: -1.8,
    maxWidth: 580,
  },
  titleMobile: {
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: -1.4,
  },
  titleCompact: {
    fontSize: 34,
    lineHeight: 38,
    letterSpacing: -1.1,
  },
  body: {
    color: LANDING_COLORS.textMuted,
    fontFamily: LANDING_TYPE.body,
    fontSize: 17.5,
    lineHeight: 28,
    maxWidth: 520,
  },
  bodyMobile: {
    fontSize: 18,
    lineHeight: 30,
  },
  ctaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.lg,
    marginTop: spacing.md,
  },
  primaryCta: {
    backgroundColor: LANDING_COLORS.text,
    borderRadius: 12,
    paddingHorizontal: 28,
    paddingVertical: 17,
  },
  primaryCtaText: {
    color: LANDING_COLORS.textOnDark,
    fontSize: 16,
  },
  linkCta: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: LANDING_COLORS.borderLink,
  },
  linkText: {
    color: LANDING_COLORS.text,
  },
  visualPanel: {
    flex: 1,
    backgroundColor: LANDING_COLORS.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: LANDING_COLORS.borderSoft,
    minHeight: 420,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing['2xl'],
  },
  visualPanelMobile: {
    minHeight: 300,
    padding: spacing.xl,
  },
  visualPanelCompact: {
    minHeight: 260,
    padding: spacing.lg,
  },
  illustration: {
    width: '100%',
    height: 320,
  },
  illustrationMobile: {
    height: 240,
  },
  illustrationCompact: {
    height: 210,
  },
  pressed: {
    opacity: 0.88,
  },
  linkPressed: {
    opacity: 0.7,
  },
});

export default AccountSplitSection;
