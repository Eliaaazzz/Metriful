import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Image } from 'expo-image';
import { Text } from '@/components';
import { useAppleCredentialCheck } from '@/hooks/useAppleCredentialCheck';
import { startBackendWarmup } from '@/services/backendWarmup';
import {
  hasPendingGoogleHandoff,
  resolveWebGoogleRedirect,
} from '@/services/webGoogleRedirect';
import { useAuthStore } from '@/stores';
import { BRAND_COLORS } from '@/utils';

export default function SplashScreen() {
  const navigation = useNavigation();
  const { isRestoringToken, isAuthenticated, restoreToken } = useAuthStore();
  const hasStartedRestoreRef = useRef(false);

  const logoOpacity = useSharedValue(0);
  const logoScale = useSharedValue(0.9);
  const textOpacity = useSharedValue(0);
  const dotScale1 = useSharedValue(0.6);
  const dotScale2 = useSharedValue(0.6);
  const dotScale3 = useSharedValue(0.6);

  useAppleCredentialCheck();

  useEffect(() => {
    void startBackendWarmup();

    logoOpacity.value = withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) });
    logoScale.value = withTiming(1, { duration: 620, easing: Easing.out(Easing.back(1.05)) });
    textOpacity.value = withDelay(220, withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) }));

    const dotPulse = (delay: number) =>
      withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 360, easing: Easing.inOut(Easing.ease) }),
            withTiming(0.6, { duration: 360, easing: Easing.inOut(Easing.ease) })
          ),
          -1,
          true
        )
      );
    dotScale1.value = dotPulse(480);
    dotScale2.value = dotPulse(600);
    dotScale3.value = dotPulse(720);
  }, [dotScale1, dotScale2, dotScale3, logoOpacity, logoScale, textOpacity]);

  useEffect(() => {
    // Web: restore token first, then route based on auth state.
    // Show splash animation briefly for a polished transition.
    if (Platform.OS === 'web') {
      (async () => {
        // Google web sign-in is a full-page redirect (Safari blocks popups from
        // async handlers), so it re-boots the app here at Splash with the id_token
        // in the URL hash. Finish the login on this loading screen — otherwise the
        // hash handler (which lives only in LoginScreen) never runs and the user is
        // bounced to the marketing Landing page despite a successful Google login.
        const googleRedirect = await resolveWebGoogleRedirect();
        if (googleRedirect.kind === 'authenticated') {
          useAuthStore.setState({ isRestoringToken: false });
          // New Google accounts must onboard (goals / body composition) before Main,
          // matching the email + RegisterScreen sign-up flow.
          navigation.reset({
            index: 0,
            routes: [{ name: googleRedirect.isNewUser ? 'Onboarding' : 'Main' } as any],
          });
          return;
        }
        if (googleRedirect.kind === 'failed') {
          useAuthStore.setState({ isRestoringToken: false });
          navigation.reset({
            index: 0,
            routes: [{ name: 'Login', params: { authError: 'google' } } as any],
          });
          return;
        }
        // 'none' | 'unsolicited' → fall through to the normal restore flow below.

        // A cross-origin handoff (?auth=google) needs LoginScreen, which owns the
        // Google auth request and starts the redirect on mount.
        if (hasPendingGoogleHandoff()) {
          useAuthStore.setState({ isRestoringToken: false });
          navigation.reset({ index: 0, routes: [{ name: 'Login' } as any] });
          return;
        }

        const alreadyAuthenticated = useAuthStore.getState().isAuthenticated;
        if (!alreadyAuthenticated) {
          await restoreToken();
        }
        const authenticated = useAuthStore.getState().isAuthenticated;
        // Show splash for at least 1.2s so the user sees the branded transition
        await new Promise(r => setTimeout(r, authenticated ? 1200 : 300));
        navigation.reset({
          index: 0,
          routes: [{ name: authenticated ? 'Main' : 'Landing' } as any],
        });
      })();
      return;
    }

    // Mobile: keep the splash animation + delayed auth check
    if (hasStartedRestoreRef.current) {
      return;
    }
    hasStartedRestoreRef.current = true;

    const initAuth = async () => {
      await restoreToken();
    };

    const timer = setTimeout(initAuth, 300);
    return () => clearTimeout(timer);
  }, [navigation, restoreToken]);

  useEffect(() => {
    // Skip on web — handled above
    if (Platform.OS === 'web') {
      return;
    }

    if (isRestoringToken) {
      return;
    }

    navigation.reset({
      index: 0,
      routes: [{ name: isAuthenticated ? 'Main' : 'Landing' } as any],
    });
  }, [isAuthenticated, isRestoringToken, navigation]);

  const logoAnimatedStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  const textAnimatedStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
  }));

  const dot1Style = useAnimatedStyle(() => ({
    transform: [{ scale: dotScale1.value }],
    opacity: dotScale1.value,
  }));
  const dot2Style = useAnimatedStyle(() => ({
    transform: [{ scale: dotScale2.value }],
    opacity: dotScale2.value,
  }));
  const dot3Style = useAnimatedStyle(() => ({
    transform: [{ scale: dotScale3.value }],
    opacity: dotScale3.value,
  }));

  return (
    <View style={styles.root}>
      <View style={styles.backgroundHalo} />

      <Animated.View style={[styles.logoContainer, logoAnimatedStyle]}>
        <Image
          source={require('@/../assets/app-icon-1024.png')}
          style={styles.appLogo}
          contentFit="contain"
        />
        <Text variant="heading1" weight="bold" style={styles.wordmark}>
          Metriful
        </Text>
      </Animated.View>

      <Animated.View style={[styles.textContainer, textAnimatedStyle]}>
        <Text variant="caption" style={styles.tagline}>
          Smart logging. Clear routines.
        </Text>
      </Animated.View>

      <View style={styles.dotsContainer}>
        <Animated.View style={[styles.dot, { backgroundColor: BRAND_COLORS.primary }, dot1Style]} />
        <Animated.View style={[styles.dot, { backgroundColor: BRAND_COLORS.secondary }, dot2Style]} />
        <Animated.View style={[styles.dot, { backgroundColor: BRAND_COLORS.primaryDark }, dot3Style]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: BRAND_COLORS.background,
  },
  backgroundHalo: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(201, 106, 52, 0.08)',
    ...(Platform.OS === 'web' && ({
      filter: 'blur(80px)',
    } as any)),
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 8,
  },
  appLogo: {
    width: 104,
    height: 104,
    marginBottom: 12,
  },
  wordmark: {
    color: BRAND_COLORS.textPrimary,
    fontSize: 32,
    letterSpacing: -0.8,
  },
  textContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  tagline: {
    color: BRAND_COLORS.textMuted,
    marginTop: 4,
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 8,
    position: 'absolute',
    bottom: Platform.OS === 'web' ? 80 : 100,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
