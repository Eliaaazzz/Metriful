import { colors, typography } from '@/utils';
import React, { PropsWithChildren } from 'react';
import { Platform, StyleProp, Text as RNText, TextProps as RNTextProps, TextStyle } from 'react-native';

type TextVariant =
  | 'hero'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'heading4'
  | 'body'
  | 'caption'
  | 'label'
  | 'metric'
  | 'metricSmall';
type TextWeight = 'regular' | 'medium' | 'semibold' | 'bold';

export interface TextProps
  extends Pick<
    RNTextProps,
    | 'accessibilityLabel'
    | 'accessibilityRole'
    | 'accessibilityHint'
    | 'accessibilityLiveRegion'
    | 'accessible'
    | 'testID'
    | 'adjustsFontSizeToFit'
    | 'minimumFontScale'
  > {
  variant?: TextVariant;
  color?: string;
  weight?: TextWeight;
  muted?: boolean;
  style?: StyleProp<TextStyle>;
  children?: React.ReactNode;
  numberOfLines?: number;
  selectable?: boolean;
  allowFontScaling?: boolean;
  onPress?: () => void;
}

const variantStyles: Record<
  TextVariant,
  { fontSize: number; lineHeight: number; defaultWeight: TextWeight; letterSpacing?: number; textTransform?: TextStyle['textTransform'] }
> = {
  hero: {
    fontSize: typography.size['4xl'],
    lineHeight: typography.lineHeight['4xl'],
    defaultWeight: 'bold',
    letterSpacing: typography.letterSpacing.tight,
  },
  heading1: {
    fontSize: typography.size['3xl'],
    lineHeight: typography.lineHeight['3xl'],
    defaultWeight: 'bold',
    letterSpacing: typography.letterSpacing.tight,
  },
  heading2: {
    fontSize: typography.size['2xl'],
    lineHeight: typography.lineHeight['2xl'],
    defaultWeight: 'semibold',
    letterSpacing: typography.letterSpacing.medium,
  },
  heading3: {
    fontSize: typography.size.xl,
    lineHeight: typography.lineHeight.xl,
    defaultWeight: 'semibold',
    letterSpacing: typography.letterSpacing.medium,
  },
  heading4: {
    fontSize: typography.size.lg,
    lineHeight: typography.lineHeight.lg,
    defaultWeight: 'semibold',
  },
  body: {
    fontSize: typography.size.md,
    lineHeight: typography.lineHeight.md,
    defaultWeight: 'regular',
  },
  caption: {
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
    defaultWeight: 'regular',
  },
  label: {
    fontSize: typography.size.xs,
    lineHeight: typography.lineHeight.xs,
    defaultWeight: 'medium',
    letterSpacing: typography.letterSpacing.caps,
    textTransform: 'uppercase',
  },
  metric: {
    fontSize: 36,
    lineHeight: 40,
    defaultWeight: 'bold',
    letterSpacing: typography.letterSpacing.tight,
  },
  metricSmall: {
    fontSize: 24,
    lineHeight: 28,
    defaultWeight: 'bold',
    letterSpacing: typography.letterSpacing.medium,
  },
};

const weightValues: Record<TextWeight, TextStyle['fontWeight']> = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
};

export const Text = ({
  variant = 'body',
  weight,
  color,
  muted,
  style,
  children,
  allowFontScaling = true,
  ...rest
}: PropsWithChildren<TextProps>) => {
  const config = variantStyles[variant];
  const finalWeight = weight || config.defaultWeight;
  const light = colors.light;

  return (
    <RNText
      {...rest}
      allowFontScaling={allowFontScaling}
      style={[
        {
          color: color || (muted ? light.textMuted : light.textPrimary),
          fontSize: config.fontSize,
          lineHeight: config.lineHeight,
          fontWeight: weightValues[finalWeight],
          letterSpacing: config.letterSpacing,
          textTransform: config.textTransform,
          fontFamily:
            finalWeight === 'bold' || finalWeight === 'semibold'
              ? typography.fontFamily.bold
              : finalWeight === 'medium'
                ? typography.fontFamily.medium
                : typography.fontFamily.regular,
          ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
        },
        style,
      ]}
    >
      {children}
    </RNText>
  );
};
