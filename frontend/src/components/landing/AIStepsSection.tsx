/**
 * AIStepsSection — the pipeline as a numbered process rail (numbers are honest
 * here: it really is a sequence). Copper index notches sit on a shared hairline,
 * mirroring the static landing's "From photo to logged meal" section.
 */
import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { Text } from '@/components';
import { LANDING_COLORS, LANDING_TYPE, spacing } from '@/utils';

const cameraSpot = require('@/../assets/illustrations/snap-camera.svg');

const STEPS = [
  {
    step: '01',
    title: 'Snap a photo of your meal',
    body: 'Start with the camera when you want the fastest way to log breakfast, lunch, or dinner.',
  },
  {
    step: '02',
    title: 'AI identifies the food and logs nutrition',
    body: 'Review the result, confirm the serving, and save calories and macros in a few taps.',
  },
  {
    step: '03',
    title: 'Track progress with daily scores and weekly reports',
    body: 'See adherence, streaks, and weight trends without exporting your data into another tool.',
  },
] as const;

export function AIStepsSection() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const showSpot = width >= 640;

  return (
    <View style={styles.section}>
      <View style={[styles.head, showSpot && styles.headWithSpot]}>
        <View style={styles.headCopy}>
          <View style={styles.eyebrowRow}>
            <View style={styles.eyebrowTick} />
            <Text style={styles.eyebrow}>THE FLOW</Text>
          </View>
          <Text
            accessibilityRole="header"
            style={isDesktop ? styles.title : [styles.title, styles.titleMobile]}
          >
            How it works
          </Text>
          <Text style={styles.subtitle}>
            From one photo to weekly review, Metriful keeps logging and reporting inside one workflow.
          </Text>
        </View>
        {showSpot && (
          <Image source={cameraSpot} style={styles.spot} contentFit="contain" />
        )}
      </View>

      <View style={[styles.rail, isDesktop && styles.railDesktop]}>
        {STEPS.map((item) => (
          <View key={item.step} style={[styles.step, isDesktop && styles.stepDesktop]}>
            <View style={styles.notch} />
            <Text style={styles.stepLabel}>{item.step}</Text>
            <Text style={styles.stepTitle}>{item.title}</Text>
            <Text style={styles.stepBody}>{item.body}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingTop: spacing['4xl'],
    paddingBottom: spacing['2xl'],
  },
  head: {
    marginBottom: 36,
  },
  headWithSpot: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 28,
  },
  headCopy: {
    flexShrink: 1,
    minWidth: 0,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
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
  title: {
    color: LANDING_COLORS.text,
    fontFamily: LANDING_TYPE.display,
    fontSize: 44,
    fontWeight: '800',
    lineHeight: 48,
    letterSpacing: -1.6,
    marginBottom: spacing.sm,
  },
  titleMobile: {
    fontSize: 34,
    lineHeight: 38,
    letterSpacing: -1.1,
  },
  subtitle: {
    color: LANDING_COLORS.textMuted,
    fontFamily: LANDING_TYPE.body,
    maxWidth: 640,
    fontSize: 16.5,
    lineHeight: 26,
  },
  spot: {
    width: 190,
    height: 190,
    flexShrink: 0,
  },
  rail: {
    borderTopWidth: 1,
    borderTopColor: LANDING_COLORS.border,
    gap: 24,
  },
  railDesktop: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 30,
  },
  step: {
    position: 'relative',
    paddingTop: 24,
    flex: 1,
    minWidth: 0,
  },
  stepDesktop: {
    minWidth: 0,
  },
  notch: {
    position: 'absolute',
    top: -2,
    left: 0,
    width: 30,
    height: 3,
    backgroundColor: LANDING_COLORS.copper,
  },
  stepLabel: {
    fontFamily: LANDING_TYPE.mono,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: LANDING_COLORS.copper,
    marginBottom: 10,
  },
  stepTitle: {
    color: LANDING_COLORS.text,
    fontFamily: LANDING_TYPE.body,
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 23,
    marginBottom: 8,
  },
  stepBody: {
    color: LANDING_COLORS.textMuted,
    fontFamily: LANDING_TYPE.body,
    fontSize: 14.5,
    lineHeight: 23,
  },
});

export default AIStepsSection;
