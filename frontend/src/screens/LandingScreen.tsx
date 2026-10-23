/**
 * LandingScreen — responsive marketing landing page shared across web and mobile
 *
 * Sections (Uber order):
 * 1. Nav (black) — LandingNav
 * 2. CTA banner (black) — the very first section on purpose: the download entry
 *    (scan CTA + store badges) must be visible before any scrolling
 * 3. Hero — headline left + illustration right
 * 4. Feature grid — 6 capability cards (Discover)
 * 5. AI Steps — how the AI pipeline works
 * 6. Account split CTA
 * 7. Program hub
 * 8. Footer
 */

import React, { useCallback, useEffect, useRef } from 'react';
import { LayoutChangeEvent, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import { useNavigation } from '@react-navigation/native';

import AccountSplitSection from '@/components/landing/AccountSplitSection';
import AccuracySection from '@/components/landing/AccuracySection';
import AIStepsSection from '@/components/landing/AIStepsSection';
import { LandingNav } from '@/components/landing/LandingNav';
import { HeroSection } from '@/components/landing/HeroSection';
import { FeatureGrid } from '@/components/landing/FeatureGrid';
import ProgramHubSection from '@/components/landing/ProgramHubSection';
import { LandingFooter } from '@/components/landing/LandingFooter';
import { Corner } from '@/components/landing/ScanReceipt';
import { StoreBadges } from '@/components/landing/StoreBadges';
import { Text } from '@/components';
import { startBackendWarmup } from '@/services/backendWarmup';
import { useAuthStore } from '@/stores';
import { APP_PAGE_PATHS, LANDING_COLORS, LANDING_TYPE, SUPPORT_EMAIL_URL, openAppPage, openExternalUrl } from '@/utils';

const ctaIllustration = require('@/../assets/illustrations/hero-healthy-eating.svg');

const NAV_SECTION_MAP: Record<string, string> = {
  Track: 'featureGrid',
  Programs: 'programHub',
  Reports: 'aiSteps',
};

export default function LandingScreen() {
  const navigation = useNavigation<any>();
  const { isAuthenticated, isRestoringToken } = useAuthStore();

  useEffect(() => { void startBackendWarmup(); }, []);

  useEffect(() => {
    if (!isRestoringToken && isAuthenticated) {
      navigation.reset({ index: 0, routes: [{ name: 'Main' } as any] });
    }
  }, [isAuthenticated, isRestoringToken, navigation]);

  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const isCompact = width < 420;
  const maxWidth = 1200;
  const pagePadding = isCompact ? 16 : width < 720 ? 20 : 24;

  const navigateLogin = () => navigation.navigate('Login');
  const navigateSignup = () => navigation.navigate('Register');

  const scrollRef = useRef<ScrollView>(null);
  const sectionPositions = useRef<Record<string, number>>({});

  const handleSectionLayout = useCallback(
    (key: string) => (event: LayoutChangeEvent) => {
      sectionPositions.current[key] = event.nativeEvent.layout.y;
    }, [],
  );

  const scrollToSection = useCallback((sectionKey: string) => {
    const y = sectionPositions.current[sectionKey];
    if (y !== undefined) scrollRef.current?.scrollTo({ y, animated: true });
  }, []);

  const handleNavPress = useCallback((item: string) => {
    if (item === 'About') {
      void openAppPage(APP_PAGE_PATHS.about);
      return;
    }
    const sectionKey = NAV_SECTION_MAP[item];
    if (sectionKey) scrollToSection(sectionKey);
  }, [scrollToSection]);

  const handleHelpPress = useCallback(() => navigation.navigate('Help'), [navigation]);
  const handleLanguagePress = useCallback(() => void openAppPage(`${APP_PAGE_PATHS.support}#language`), []);

  const handleFooterLinkPress = useCallback((linkId: string) => {
    switch (linkId) {
      case 'meal-logging': case 'targets': case 'weekly-reports':
        scrollToSection('featureGrid'); return;
      case 'workout-planning':
        scrollToSection('programHub'); return;
      case 'help-centre': case 'export-data': navigation.navigate('Help'); return;
      case 'data-sources': navigation.navigate('AboutNutritionData'); return;
      case 'release-notes': void openAppPage(APP_PAGE_PATHS.releaseNotes); return;
      case 'about': void openAppPage(APP_PAGE_PATHS.about); return;
      case 'contact': void openExternalUrl(SUPPORT_EMAIL_URL, 'Unable to open email', 'Please email support@aurafitness.org.'); return;
      case 'privacy-policy': void openAppPage(APP_PAGE_PATHS.privacy); return;
      case 'terms-of-service': void openAppPage(APP_PAGE_PATHS.terms); return;
      case 'accessibility': void openAppPage(APP_PAGE_PATHS.accessibility); return;
    }
  }, [navigation, scrollToSection]);

  return (
    <View style={styles.root}>
      <LandingNav
        onLogin={navigateLogin}
        onSignup={navigateSignup}
        onNavPress={handleNavPress}
        onHelp={handleHelpPress}
        onLanguage={handleLanguagePress}
      />
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. CTA Banner — the very first section on purpose: the download entry
            (scan CTA + store badges) must be the first thing visitors see. */}
        <View style={[styles.sectionWrap, { maxWidth, paddingHorizontal: pagePadding }]}>
          <View style={[styles.ctaPanel, isCompact && styles.ctaPanelCompact, isDesktop && styles.ctaPanelDesktop]}>
            <Corner position="tl" color={LANDING_COLORS.copperOnDark} />
            <Corner position="tr" color={LANDING_COLORS.copperOnDark} />
            <Corner position="bl" color={LANDING_COLORS.copperOnDark} />
            <Corner position="br" color={LANDING_COLORS.copperOnDark} />

            <View style={styles.ctaCopy}>
              <Text
                style={
                  isDesktop
                    ? styles.ctaTitle
                    : isCompact
                      ? [styles.ctaTitle, styles.ctaTitleMobile, styles.ctaTitleCompact]
                      : [styles.ctaTitle, styles.ctaTitleMobile]
                }
              >
                Scan your first meal today.
              </Text>
              <Text style={isCompact ? [styles.ctaBody, styles.ctaBodyCompact] : styles.ctaBody}>
                See an itemized, editable estimate in seconds — and one concrete next step for the rest of the day.
              </Text>
              <Pressable
                onPress={navigateSignup}
                style={({ pressed }) => [styles.ctaButton, isCompact && styles.ctaButtonCompact, pressed && styles.ctaButtonPressed]}
              >
                <Text style={styles.ctaButtonText}>Scan your first meal</Text>
              </Pressable>
              <Text style={styles.ctaNote}>Free to start, no card needed.</Text>
              <StoreBadges style={styles.ctaBadges} align={isCompact ? 'center' : 'flex-start'} />
            </View>

            {!isCompact && (
              <View style={styles.polaroid}>
                <Image source={ctaIllustration} style={styles.polaroidImage} contentFit="contain" />
                <Text style={styles.polaroidCaption}>lunch, logged — back to eating</Text>
              </View>
            )}
          </View>
        </View>

        {/* 2. Hero */}
        <View style={[styles.sectionWrap, { maxWidth, paddingHorizontal: pagePadding }]}>
          <HeroSection onGetStarted={navigateSignup} onLogin={navigateLogin} />
        </View>

        {/* 3. Feature Grid (6 cards — Discover) */}
        <View style={[styles.sectionWrap, { maxWidth, paddingHorizontal: pagePadding }]} onLayout={handleSectionLayout('featureGrid')}>
          <FeatureGrid onExplore={navigateSignup} />
        </View>

        {/* 4. AI Steps */}
        <View style={[styles.sectionWrap, { maxWidth, paddingHorizontal: pagePadding }]} onLayout={handleSectionLayout('aiSteps')}>
          <AIStepsSection />
        </View>

        {/* 4b. How accuracy works — trust is a landing-page feature, not a FAQ */}
        <View style={[styles.sectionWrap, { maxWidth, paddingHorizontal: pagePadding }]} onLayout={handleSectionLayout('accuracy')}>
          <AccuracySection />
        </View>

        {/* 5. Account Split */}
        <View style={[styles.sectionWrap, { maxWidth, paddingHorizontal: pagePadding }]}>
          <AccountSplitSection onLogin={navigateLogin} onSignup={navigateSignup} />
        </View>

        {/* 6. Program Hub */}
        <View style={[styles.sectionWrap, { maxWidth, paddingHorizontal: pagePadding }]} onLayout={handleSectionLayout('programHub')}>
          <ProgramHubSection />
        </View>

        {/* 7. Footer */}
        <View style={[styles.sectionWrap, { maxWidth, paddingHorizontal: pagePadding }]} onLayout={handleSectionLayout('footer')}>
          <LandingFooter
            onGetStarted={navigateSignup}
            onLogin={navigateLogin}
            onLinkPress={handleFooterLinkPress}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: LANDING_COLORS.bg,
  },
  scroll: { flex: 1 },
  scrollContent: { alignItems: 'center' },
  sectionWrap: {
    width: '100%',
    paddingHorizontal: 24,
    alignSelf: 'center',
  },

  // CTA Banner — contained ink panel (mirrors the static landing's ctapanel)
  ctaPanel: {
    position: 'relative',
    overflow: 'hidden',
    width: '100%',
    backgroundColor: LANDING_COLORS.panel,
    borderRadius: 24,
    paddingHorizontal: 54,
    paddingVertical: 52,
    gap: 36,
    marginVertical: 40,
  },
  ctaPanelDesktop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 44,
  },
  ctaPanelCompact: {
    paddingHorizontal: 26,
    paddingVertical: 38,
    marginVertical: 24,
  },
  ctaCopy: {
    flex: 1,
    gap: 14,
    alignItems: 'flex-start',
  },
  ctaTitle: {
    color: LANDING_COLORS.textOnDark,
    fontFamily: LANDING_TYPE.display,
    fontSize: 44,
    fontWeight: '800',
    letterSpacing: -1.6,
    lineHeight: 48,
  },
  ctaTitleMobile: {
    fontSize: 34,
    lineHeight: 38,
    letterSpacing: -1.1,
  },
  ctaTitleCompact: {
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.8,
  },
  ctaBody: {
    color: LANDING_COLORS.textOnDarkMuted,
    fontFamily: LANDING_TYPE.body,
    fontSize: 16.5,
    lineHeight: 26,
    maxWidth: 520,
  },
  ctaBodyCompact: {
    fontSize: 15.5,
    lineHeight: 24,
  },
  ctaButton: {
    alignSelf: 'flex-start',
    backgroundColor: LANDING_COLORS.copperOnDark,
    paddingHorizontal: 24,
    paddingVertical: 15,
    borderRadius: 12,
    marginTop: 8,
  },
  ctaButtonPressed: {
    backgroundColor: LANDING_COLORS.copperOnDarkPress,
  },
  ctaButtonCompact: {
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  ctaButtonText: {
    color: '#171310',
    fontFamily: LANDING_TYPE.body,
    fontSize: 16,
    fontWeight: '700',
  },
  ctaNote: {
    color: LANDING_COLORS.textOnDarkFaint,
    fontFamily: LANDING_TYPE.mono,
    fontSize: 11.5,
    letterSpacing: 0.3,
  },
  ctaBadges: {
    marginTop: 10,
  },

  // Polaroid — the original hero illustration as a "snapshot" (paper card, slight tilt)
  polaroid: {
    width: 288,
    backgroundColor: LANDING_COLORS.bg,
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingTop: 13,
    paddingBottom: 10,
    transform: [{ rotate: '-2.2deg' }],
    alignSelf: 'center',
    ...(typeof document !== 'undefined'
      ? ({ boxShadow: '0 20px 48px rgba(0,0,0,0.3)' } as any)
      : {
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 14 },
          shadowRadius: 28,
          shadowOpacity: 0.3,
          elevation: 8,
        }),
  },
  polaroidImage: {
    width: '100%',
    height: 240,
    borderRadius: 7,
  },
  polaroidCaption: {
    paddingTop: 9,
    textAlign: 'center',
    fontFamily: LANDING_TYPE.mono,
    fontSize: 11.5,
    color: LANDING_COLORS.textMuted,
  },
});
