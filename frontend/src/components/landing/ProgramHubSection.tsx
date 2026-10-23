import { Image } from 'expo-image';
import React, { useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { Text } from '@/components';
import { LANDING_COLORS, LANDING_TYPE, radii, spacing } from '@/utils';

const programIllustration = require('@/../assets/illustrations/healthy-habit.svg');

const PROGRAMS = ['Build Muscle', 'Fat Loss', 'General Health'];

export function ProgramHubSection() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const isCompact = width < 420;
  const [activeProgram, setActiveProgram] = useState(PROGRAMS[0]);

  return (
    <View style={[styles.section, isDesktop && styles.sectionDesktop]}>
      <View style={styles.copyColumn}>
        <Text
          variant="heading1"
          weight="bold"
          style={isDesktop ? [styles.title] : isCompact ? [styles.title, styles.titleMobile, styles.titleCompact] : [styles.title, styles.titleMobile]}
        >
          Build one program for training, nutrition, and recovery
        </Text>
        <Text variant="heading4" style={isDesktop ? [styles.body] : [styles.body, styles.bodyMobile]}>
          Keep training, meals, and recovery connected so each week feels clear and practical to follow.
        </Text>

        <View style={styles.programSelector}>
          {PROGRAMS.map((program) => {
            const isActive = activeProgram === program;
            return (
              <Pressable
                key={program}
                onPress={() => setActiveProgram(program)}
                style={({ pressed }) => [
                  styles.programPill,
                  isActive && styles.programPillActive,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  variant="body"
                  weight={isActive ? 'bold' : 'medium'}
                  style={isActive ? styles.programPillTextActive : styles.programPillText}
                >
                  {program}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={[styles.visualPanel, !isDesktop && styles.visualPanelMobile, isCompact && styles.visualPanelCompact]}>
        <Image
          source={programIllustration}
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
    paddingBottom: spacing['3xl'],
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
    maxWidth: 600,
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
    maxWidth: 540,
  },
  bodyMobile: {
    fontSize: 18,
    lineHeight: 30,
  },
  programSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  programPill: {
    backgroundColor: LANDING_COLORS.surface,
    borderRadius: radii.pill,
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderWidth: 1,
    borderColor: LANDING_COLORS.borderStrong,
  },
  programPillActive: {
    backgroundColor: LANDING_COLORS.text,
    borderColor: LANDING_COLORS.text,
  },
  programPillText: {
    color: LANDING_COLORS.text,
  },
  programPillTextActive: {
    color: LANDING_COLORS.textOnDark,
  },
  visualPanel: {
    flex: 1,
    backgroundColor: LANDING_COLORS.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: LANDING_COLORS.borderSoft,
    minHeight: 420,
    overflow: 'hidden',
  },
  visualPanelMobile: {
    minHeight: 300,
  },
  visualPanelCompact: {
    minHeight: 260,
  },
  illustration: {
    width: '100%',
    height: '100%',
    minHeight: 420,
  },
  illustrationMobile: {
    minHeight: 300,
  },
  illustrationCompact: {
    minHeight: 260,
  },
  pressed: {
    opacity: 0.82,
  },
});

export default ProgramHubSection;
