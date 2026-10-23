import { CaretDown, GlobeHemisphereWest, Question } from 'phosphor-react-native';
import { Image } from 'expo-image';
import React from 'react';
import { Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components';
import { APP_NAME, LANDING_COLORS, LANDING_TYPE, motion, radii, spacing } from '@/utils';

interface LandingNavProps {
  onLogin: () => void;
  onSignup: () => void;
  onNavPress?: (item: string) => void;
  onHelp?: () => void;
  onLanguage?: () => void;
}

const NAV_ITEMS = ['Track', 'Programs', 'Reports', 'About'];
const brandIcon = require('@/../assets/app-icon-1024-transparent.png');

export function LandingNav({ onLogin, onSignup, onNavPress, onHelp, onLanguage }: LandingNavProps) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isCompact = width < 680;
  const isSmallPhone = width < 420;
  const maxWidth = Math.min(width - (isCompact ? 20 : 32), 1360);
  const showCenterNav = width >= 1080;
  const showLocaleAction = width >= 760;
  const showHelpAction = width >= 420;

  return (
    <View style={[styles.wrapper, Platform.OS !== 'web' && { paddingTop: insets.top }]}>
      <View style={[styles.bar, { maxWidth, minHeight: width >= 720 ? 88 : 76 }, isCompact && styles.barCompact]}>
        <View style={styles.brandSide}>
          <Image source={brandIcon} style={styles.brandIcon} contentFit="contain" />
          <Text variant="heading3" weight="bold" style={isSmallPhone ? [styles.brand, styles.brandCompact] : styles.brand}>
            {APP_NAME}
          </Text>
        </View>

        {showCenterNav && (
          <View style={styles.centerNav}>
            {NAV_ITEMS.map((item) => (
              <Pressable
                key={item}
                onPress={() => onNavPress?.(item)}
                style={({ pressed }) => [styles.navItem, pressed && styles.faded]}
                accessibilityRole="button"
                accessibilityLabel={`Navigate to ${item}`}
              >
                <Text variant="body" weight="semibold" style={styles.navText}>
                  {item}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        <View style={[styles.actions, isCompact && styles.actionsCompact]}>
          {showLocaleAction && (
            <Pressable
              onPress={onLanguage}
              style={({ pressed }) => [styles.utilityAction, pressed && styles.faded]}
              accessibilityRole="button"
              accessibilityLabel="Language and region details"
            >
              <GlobeHemisphereWest size={18} weight="regular" color={LANDING_COLORS.text} />
              <Text variant="body" weight="semibold" style={styles.utilityText}>
                EN
              </Text>
            </Pressable>
          )}

          {showHelpAction && (
            <Pressable
              onPress={onHelp}
              style={({ pressed }) => [styles.utilityAction, pressed && styles.faded]}
              accessibilityRole="button"
              accessibilityLabel="Open help"
            >
              <Question size={18} weight="regular" color={LANDING_COLORS.text} />
              {!isCompact && (
                <Text variant="body" weight="semibold" style={styles.utilityText}>
                  Help
                </Text>
              )}
            </Pressable>
          )}

          <Pressable
            onPress={onLogin}
            style={({ pressed }) => [styles.loginBtn, isCompact && styles.loginBtnCompact, pressed && styles.faded]}
            accessibilityRole="button"
            accessibilityLabel="Log in to your account"
          >
            <Text variant="body" weight="semibold" style={styles.utilityText}>
              Log in
            </Text>
          </Pressable>

          <Pressable
            onPress={onSignup}
            style={({ pressed }) => [styles.signupBtn, isCompact && styles.signupBtnCompact, pressed && styles.signupBtnPressed]}
            accessibilityRole="button"
            accessibilityLabel="Create a new account"
          >
            <Text variant="body" weight="bold" style={styles.signupText}>
              Start now
            </Text>
            {width >= 960 && <CaretDown size={16} weight="bold" color={LANDING_COLORS.textOnDark} />}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    alignItems: 'center',
    backgroundColor: 'transparent',
    zIndex: 100,
    ...(Platform.OS === 'web' ? ({ position: 'sticky', top: 0 } as any) : {}),
  },
  bar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    borderRadius: 28,
    backgroundColor: LANDING_COLORS.navBg,
    borderWidth: 1,
    borderColor: LANDING_COLORS.borderSoft,
    ...(typeof document !== 'undefined'
      ? ({ backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', boxShadow: '0 18px 40px rgba(23,21,17,0.10)' } as any)
      : {
          shadowColor: '#171511',
          shadowOffset: { width: 0, height: 16 },
          shadowRadius: 30,
          shadowOpacity: 0.1,
          elevation: 8,
        }),
  },
  barCompact: {
    paddingHorizontal: spacing.sm,
  },
  brandSide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 0,
  },
  brand: {
    color: LANDING_COLORS.text,
    fontFamily: LANDING_TYPE.display,
    letterSpacing: -0.5,
  },
  brandCompact: {
    fontSize: 20,
  },
  brandMeta: {
    color: LANDING_COLORS.textMuted,
  },
  brandIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
  },
  centerNav: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  navItem: {
    paddingVertical: spacing.sm,
  },
  navText: {
    color: LANDING_COLORS.textMuted,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 0,
  },
  actionsCompact: {
    gap: spacing.xs,
  },
  utilityAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 42,
    paddingHorizontal: 14,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.56)',
    borderWidth: 1,
    borderColor: LANDING_COLORS.borderSoft,
  },
  utilityText: {
    color: LANDING_COLORS.text,
  },
  loginBtn: {
    minHeight: 44,
    paddingHorizontal: 18,
    justifyContent: 'center',
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.58)',
    borderWidth: 1,
    borderColor: LANDING_COLORS.borderSoft,
  },
  loginBtnCompact: {
    paddingHorizontal: 14,
  },
  signupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: 18,
    minHeight: 46,
    borderRadius: radii.pill,
    justifyContent: 'center',
    backgroundColor: LANDING_COLORS.text,
    ...(Platform.OS === 'web' ? ({ transitionDuration: `${motion.fast}ms` } as any) : {}),
    ...(typeof document !== 'undefined'
      ? ({ boxShadow: '0 14px 26px rgba(23,21,17,0.12)' } as any)
      : {
          shadowColor: '#111111',
          shadowOffset: { width: 0, height: 10 },
          shadowRadius: 18,
          shadowOpacity: 0.12,
          elevation: 6,
        }),
  } as any,
  signupBtnCompact: {
    paddingHorizontal: 14,
  },
  signupBtnPressed: {
    opacity: 0.88,
  },
  signupText: {
    color: LANDING_COLORS.textOnDark,
  },
  faded: {
    opacity: 0.7,
  },
});

export default LandingNav;
