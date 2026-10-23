/**
 * HeroSection — thesis of the landing page.
 *
 * Left: eyebrow + display headline + lede + copper CTAs.
 * Right: the ScanReceipt signature card (the product's actual artifact —
 * an itemized, editable meal scan), mirroring the prerendered static landing.
 */
import { ArrowRight } from 'phosphor-react-native';
import React from 'react';
import { Pressable, StyleSheet, Text as RNText, useWindowDimensions, View } from 'react-native';

import { Text } from '@/components';
import { ScanReceipt } from '@/components/landing/ScanReceipt';
import { APP_NAME, LANDING_COLORS, LANDING_TYPE, spacing } from '@/utils';

interface HeroSectionProps {
  body?: string;
  primaryCtaLabel?: string;
  secondaryCtaLabel?: string;
  onGetStarted: () => void;
  onLogin: () => void;
}

export function HeroSection({
  body = `Depth-aware portions, itemized macros, and a clear next step. ${APP_NAME} shows every food it found — grams, calories, confidence — so you can fix anything in one tap.`,
  primaryCtaLabel = 'Scan your first meal',
  secondaryCtaLabel = 'Log in to see your recent activity',
  onGetStarted,
  onLogin,
}: HeroSectionProps) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const isCompact = width < 420;

  return (
    <View style={[styles.container, !isDesktop && styles.containerMobile, isDesktop && styles.containerDesktop]}>
      {/* ── LEFT: Copy ── */}
      <View style={[styles.copyColumn, isDesktop && styles.copyColumnDesktop]}>
        <View style={styles.eyebrowRow}>
          <View style={styles.eyebrowTick} />
          <Text style={styles.eyebrow}>PHOTO → EDITABLE ESTIMATE</Text>
        </View>

        <Text
          accessibilityRole="header"
          style={isDesktop ? styles.headline : isCompact ? [styles.headline, styles.headlineMobile, styles.headlineCompact] : [styles.headline, styles.headlineMobile]}
        >
          Snap a meal.{'\n'}Get an{' '}
          {/* raw RN Text so the mark inherits the headline's size instead of the
              custom Text component's default variant */}
          <RNText style={styles.headlineMark}>editable</RNText> nutrition estimate.
        </Text>

        <Text style={isCompact ? [styles.body, styles.bodyCompact] : styles.body}>
          {body}
        </Text>

        <View style={styles.ctaRow}>
          <Pressable onPress={onGetStarted} style={({ pressed }) => [styles.primaryCta, pressed && styles.primaryCtaPressed]}>
            <Text style={styles.primaryCtaText}>{primaryCtaLabel}</Text>
            <ArrowRight size={16} weight="bold" color={LANDING_COLORS.ctaText} />
          </Pressable>
        </View>

        <Pressable onPress={onLogin} style={({ pressed }) => pressed && { opacity: 0.6 }}>
          <Text style={styles.loginLink}>{secondaryCtaLabel}</Text>
        </Pressable>

        <Text style={styles.micro}>Works on any iPhone — LiDAR just makes the portions sharper.</Text>
      </View>

      {/* ── RIGHT: the scan receipt (signature) ── */}
      <View style={[styles.visualColumn, isDesktop && styles.visualColumnDesktop]}>
        <ScanReceipt compact={isCompact} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: 40,
    paddingTop: 64,
    paddingBottom: 88,
    flexDirection: 'column',
  },
  containerMobile: {
    gap: 36,
    paddingTop: 40,
    paddingBottom: 56,
  },
  containerDesktop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 56,
  },

  // ── Copy Column ──
  copyColumn: {
    flex: 1,
    gap: 20,
    justifyContent: 'center',
  },
  copyColumnDesktop: {
    maxWidth: 560,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  eyebrowTick: {
    width: 22,
    height: 2,
    backgroundColor: LANDING_COLORS.copper,
  },
  eyebrow: {
    fontFamily: LANDING_TYPE.mono,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    color: LANDING_COLORS.copper,
  },
  headline: {
    color: LANDING_COLORS.text,
    fontFamily: LANDING_TYPE.display,
    fontSize: 56,
    fontWeight: '800',
    lineHeight: 60,
    letterSpacing: -2.2,
  },
  headlineMobile: {
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: -1.5,
  },
  headlineCompact: {
    fontSize: 34,
    lineHeight: 38,
    letterSpacing: -1.1,
  },
  headlineMark: {
    textDecorationLine: 'underline',
    textDecorationColor: 'rgba(201,106,52,0.55)',
  },
  body: {
    color: LANDING_COLORS.textMuted,
    fontFamily: LANDING_TYPE.body,
    fontSize: 17.5,
    lineHeight: 28,
    maxWidth: 480,
  },
  bodyCompact: {
    fontSize: 16.5,
    lineHeight: 26,
  },
  ctaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: 8,
  },
  primaryCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: LANDING_COLORS.ctaBg,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
  },
  primaryCtaPressed: {
    backgroundColor: LANDING_COLORS.copperPress,
  },
  primaryCtaText: {
    color: LANDING_COLORS.ctaText,
    fontFamily: LANDING_TYPE.body,
    fontSize: 16,
    fontWeight: '700',
  },
  loginLink: {
    color: LANDING_COLORS.text,
    fontFamily: LANDING_TYPE.body,
    fontSize: 15,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  micro: {
    fontFamily: LANDING_TYPE.mono,
    fontSize: 11.5,
    lineHeight: 20,
    letterSpacing: 0.2,
    color: LANDING_COLORS.textFaint,
  },

  // ── Visual Column ──
  visualColumn: {
    flex: 1,
    alignItems: 'center',
  },
  visualColumnDesktop: {
    flex: 1,
    maxWidth: 560,
    alignItems: 'flex-end',
  },
});

export default HeroSection;
