/**
 * AccuracySection — "How accuracy works" (trust as a first-class landing section).
 *
 * Styled as a spec sheet: mono stage labels on hairline rows, then two lab-note
 * panels written as prose (not bullet lists). The same content is mirrored in
 * the prerendered static HTML (scripts/prerender-landing.mjs) so crawlers and
 * no-JS visitors see it too.
 */
import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { Text } from '@/components';
import { LANDING_COLORS, LANDING_TYPE } from '@/utils';

const trendsIllustration = require('@/../assets/illustrations/data-trends.svg');

const PIPELINE_STEPS = [
  {
    title: 'IDENTIFY',
    body: 'A vision model names each food it can see and lists likely ingredients.',
    tag: 'vision model',
  },
  {
    title: 'PORTION',
    body: 'On LiDAR iPhones, depth measures your plate so portions come from geometry — not a guess from a flat photo.',
    tag: 'LiDAR geometry',
  },
  {
    title: 'NUTRITION',
    body: 'Calories and macros are estimated per item and cross-referenced against USDA FoodData Central.',
    tag: 'USDA FDC',
  },
  {
    title: 'YOU CORRECT',
    body: 'Every item is editable in one tap. Low-confidence items are flagged for a quick check — never buried in a total.',
    tag: 'one tap',
  },
] as const;

export function AccuracySection() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const isCompact = width < 420;
  const showFigure = width >= 1024;

  return (
    <View style={[styles.container, isCompact && styles.containerCompact]}>
      <View style={styles.eyebrowRow}>
        <View style={styles.eyebrowTick} />
        <Text style={styles.eyebrow}>ACCURACY</Text>
      </View>
      <Text style={[styles.heading, !isDesktop && styles.headingMobile]} accessibilityRole="header">
        How accuracy works
      </Text>
      <Text style={styles.lede}>
        Nutrition from a photo is an estimate. We make it a good one — and we show our work.
      </Text>

      <View style={[styles.specWrap, showFigure && styles.specWrapDesktop]}>
        <View style={styles.spec}>
          {PIPELINE_STEPS.map((step, index) => (
            <View
              key={step.title}
              style={[styles.specRow, !isDesktop && styles.specRowMobile, index === 0 && styles.specRowFirst]}
            >
              <Text style={styles.specLabel}>{step.title}</Text>
              <View style={styles.specBodyCell}>
                <Text style={styles.specBody}>{step.body}</Text>
                <View style={styles.specTag}>
                  <Text style={styles.specTagText}>{step.tag}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
        {showFigure && (
          <Image source={trendsIllustration} style={styles.figure} contentFit="contain" />
        )}
      </View>

      <View style={[styles.detailRow, !isDesktop && styles.detailColumn]}>
        <View style={[styles.note, styles.noteCopper, !isDesktop && styles.noteMobile]}>
          <Text style={styles.noteTitle}>Where we&apos;re honest about limits</Text>
          <Text style={styles.noteBody}>
            A photo can&apos;t see butter melted into rice, oil already in the pan, or dressing
            tossed through a salad — those tend to run low. Stews and curries are harder to split
            apart than foods sitting separately on a plate. And when a dish is shared, only you
            know how much of it was yours.
          </Text>
          <Text style={styles.noteFootnote}>
            So when we&apos;re less sure, the line gets flagged for review — we&apos;d rather ask
            than pretend.
          </Text>
        </View>

        <View style={[styles.note, styles.noteSage, !isDesktop && styles.noteMobile]}>
          <Text style={styles.noteTitle}>Your photos, your data</Text>
          <Text style={styles.noteBody}>
            Meal photos upload securely, go into your log, and stay attached to your account —
            that&apos;s the whole trip. Delete a meal and its photo goes with it; delete the
            account and everything does. Every AI number is labeled as the estimate it is, with
            sources you can check.
          </Text>
          <Text style={styles.noteFootnote}>
            The fine print lives in the Privacy Policy and Data Deletion pages linked below.
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingVertical: 72,
    gap: 14,
  },
  containerCompact: {
    paddingVertical: 48,
    gap: 12,
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
  heading: {
    color: LANDING_COLORS.text,
    fontFamily: LANDING_TYPE.display,
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: -1.4,
    lineHeight: 44,
  },
  headingMobile: {
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -0.8,
  },
  lede: {
    color: LANDING_COLORS.textMuted,
    fontFamily: LANDING_TYPE.body,
    fontSize: 16.5,
    lineHeight: 26,
    maxWidth: 560,
  },
  specWrap: {
    marginTop: 22,
  },
  specWrapDesktop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 48,
  },
  spec: {
    flex: 1,
    minWidth: 0,
    borderTopWidth: 1,
    borderTopColor: LANDING_COLORS.border,
  },
  specRow: {
    flexDirection: 'row',
    gap: 26,
    paddingVertical: 21,
    borderBottomWidth: 1,
    borderBottomColor: LANDING_COLORS.borderSoft,
  },
  specRowMobile: {
    flexDirection: 'column',
    gap: 8,
    paddingVertical: 18,
  },
  specRowFirst: {},
  specLabel: {
    width: 130,
    fontFamily: LANDING_TYPE.mono,
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 1.8,
    color: LANDING_COLORS.copper,
    paddingTop: 3,
  },
  specBodyCell: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  specBody: {
    flexShrink: 1,
    minWidth: 200,
    fontFamily: LANDING_TYPE.body,
    fontSize: 15.5,
    lineHeight: 25,
    color: LANDING_COLORS.textSoft,
    maxWidth: 560,
  },
  specTag: {
    marginLeft: 'auto',
    borderWidth: 1,
    borderColor: LANDING_COLORS.borderSoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  specTagText: {
    fontFamily: LANDING_TYPE.mono,
    fontSize: 11,
    color: LANDING_COLORS.textFaint,
  },
  figure: {
    width: 296,
    height: 200,
  },
  detailRow: {
    flexDirection: 'row',
    gap: 20,
    marginTop: 26,
  },
  detailColumn: {
    flexDirection: 'column',
  },
  note: {
    flex: 1,
    borderLeftWidth: 3,
    borderTopLeftRadius: 6,
    borderBottomLeftRadius: 6,
    borderTopRightRadius: 14,
    borderBottomRightRadius: 14,
    paddingHorizontal: 24,
    paddingVertical: 22,
    gap: 10,
  },
  noteMobile: {
    flex: undefined,
    width: '100%',
  },
  noteCopper: {
    borderLeftColor: LANDING_COLORS.copper,
    backgroundColor: LANDING_COLORS.tintCopper,
  },
  noteSage: {
    borderLeftColor: LANDING_COLORS.sage,
    backgroundColor: LANDING_COLORS.tintSage,
  },
  noteTitle: {
    color: LANDING_COLORS.text,
    fontFamily: LANDING_TYPE.body,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  noteBody: {
    color: LANDING_COLORS.textSoft,
    fontFamily: LANDING_TYPE.body,
    fontSize: 14.5,
    lineHeight: 24,
  },
  noteFootnote: {
    color: LANDING_COLORS.textFaint,
    fontFamily: LANDING_TYPE.mono,
    fontSize: 11.5,
    lineHeight: 19,
    marginTop: 4,
  },
});

export default AccuracySection;
