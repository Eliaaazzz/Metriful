import { Platform } from 'react-native';

import { chartColors, colors } from './theme';

export const APP_NAME = 'Metriful';

export const BRAND_COLORS = {
  ...colors.light,
  accent: colors.light.secondary,
  danger: colors.light.error,

  tabActive: colors.light.primaryDark,
  tabInactive: colors.light.textMuted,

  glassFill: 'rgba(250, 249, 246, 0.76)',
  glassFillStrong: 'rgba(255, 255, 255, 0.9)',
  glassFillSubtle: 'rgba(248, 247, 244, 0.64)',
  glassStroke: 'rgba(17, 17, 17, 0.06)',
  glassStrokeOuter: 'rgba(17, 17, 17, 0.08)',
  glassEdge: 'rgba(17, 17, 17, 0.04)',
  glassSpecular: 'rgba(255,255,255,0.72)',
  glassSpecularFade: 'rgba(255,255,255,0)',

  charts: chartColors,
  macros: {
    calories: '#C96A34',
    protein: '#2F7A6A',
    carbs: '#8A9B4F',
    fat: '#B88428',
    sugar: '#8F5E7C',
  },

  semantic: {
    success: colors.light.success,
    successTint: 'rgba(47,133,90,0.12)',
    warning: colors.light.warning,
    warningTint: 'rgba(184,132,40,0.12)',
    error: colors.light.error,
    errorTint: 'rgba(208,92,65,0.12)',
    info: colors.light.info,
    infoTint: 'rgba(74,111,165,0.12)',
  },
  rings: {
    protein: colors.light.secondary,
    fat: colors.light.primary,
    carbs: '#8A9B4F',
    track: 'rgba(249,115,22,0.10)',
    bloodSugar: colors.light.error,
  },
  streak: {
    gray: colors.light.textMuted,
    orange: colors.light.primary,
    gold: colors.light.warning,
    red: colors.light.error,
  },
};

export const TAB_ICON_SIZE = {
  focused: 24,
  default: 22,
};

export const DEFAULT_MEAL_IMAGE_WIDTH_CM = 35;

/**
 * Landing page design system — "instrument-grade warmth".
 * Mirrors the static prerendered landing (scripts/prerender-landing.mjs) and the
 * app theme (utils/theme.ts): paper `#F8F7F3`, warm ink `#171511`, copper
 * `#C96A34`, sage `#2F7A6A`. Every value is an explicit design decision;
 * changing one of these tokens updates every landing component at once.
 */
export const LANDING_COLORS = {
  /* ── text ────────────────────────────────────────────── */
  text: '#171511',
  textSoft: '#3E3C38',
  textMuted: '#6D6860',
  textFaint: '#96907F',
  textOnDark: '#F7F2EC',
  textOnDarkMuted: 'rgba(247,242,236,0.8)',
  textOnDarkSubtle: 'rgba(247,242,236,0.68)',
  textOnDarkFaint: 'rgba(247,242,236,0.52)',
  textOnDarkLegal: 'rgba(247,242,236,0.5)',
  textOnAccent: '#FFFFFF',
  fieldLabel: 'rgba(23,21,17,0.62)',

  /* ── backgrounds & surfaces ─────────────────────────── */
  bg: '#F8F7F3',
  surface: '#FFFFFF',
  surfaceChip: '#F4F2ED',
  navBg: 'rgba(248,247,243,0.88)',
  footerBg: '#171511',
  panel: '#171511',

  /* ── brand accents ──────────────────────────────────── */
  copper: '#C96A34',
  copperDeep: '#A7552A',
  copperPress: '#8F4722',
  copperOnDark: '#E2A479',
  copperOnDarkPress: '#F3C6A7',
  sage: '#2F7A6A',
  tintCopper: 'rgba(201,106,52,0.07)',
  tintSage: 'rgba(47,122,106,0.07)',

  /* ── CTA / buttons ──────────────────────────────────── */
  ctaBg: '#A7552A',
  ctaText: '#FFFFFF',
  pillBg: '#FFFFFF',
  pillText: '#171511',

  /* ── borders ────────────────────────────────────────── */
  border: 'rgba(23,21,17,0.11)',
  borderSoft: 'rgba(23,21,17,0.065)',
  borderField: 'rgba(23,21,17,0.08)',
  borderLink: 'rgba(23,21,17,0.18)',
  borderStrong: 'rgba(23,21,17,0.17)',
  borderFooter: 'rgba(247,242,236,0.12)',
  borderStoreBadge: 'rgba(247,242,236,0.18)',

  /* ── accent cards ───────────────────────────────────── */
  accent: {
    teal: '#E7F0EC',
    warm: '#F6EDE4',
  },

  /* ── stars ───────────────────────────────────────────── */
  star: '#B88428',
} as const;

/**
 * Landing typography — web loads Bricolage Grotesque / Instrument Sans / Space
 * Mono via the <link> the prerender script injects into dist/index.html (it
 * survives hydration). Native falls back to system faces, so the app keeps its
 * platform feel.
 */
export const LANDING_TYPE = {
  display: Platform.select({
    web: "'Bricolage Grotesque', 'Instrument Sans', system-ui, -apple-system, sans-serif",
    default: undefined,
  }),
  body: Platform.select({
    web: "'Instrument Sans', system-ui, -apple-system, 'Segoe UI', sans-serif",
    default: undefined,
  }),
  mono: Platform.select({
    web: "'Space Mono', ui-monospace, Menlo, monospace",
    ios: 'Menlo',
    default: 'monospace',
  }),
} as const;

/**
 * Shared bright-experience palette used for the refreshed mobile landing,
 * auth, and dashboard surfaces. It keeps the product feeling energetic and
 * premium without rewriting the whole app theme.
 */
export const EXPERIENCE_COLORS = {
  ink: '#0F1C36',
  inkSoft: '#36507C',
  sky: '#E8F7FF',
  skyStrong: '#D7F0FF',
  cloud: '#F9FDFF',
  mint: '#DAF9D2',
  lime: '#D4FF72',
  coral: '#FF844B',
  coralStrong: '#FF6A3D',
  pink: '#FF5E8A',
  violet: '#7A7CFF',
  teal: '#2BBFCF',
  gold: '#FFC247',
  navy: '#091A38',
  glass: 'rgba(255,255,255,0.72)',
  glassStrong: 'rgba(255,255,255,0.90)',
  glassSoft: 'rgba(255,255,255,0.56)',
  stroke: 'rgba(15,28,54,0.08)',
  strokeStrong: 'rgba(15,28,54,0.14)',
  shadow: 'rgba(26,60,109,0.16)',
  shadowSoft: 'rgba(26,60,109,0.08)',
  glow: 'rgba(255,132,75,0.28)',
  gradientTop: '#F8FDFF',
  gradientMid: '#EDF7FF',
  gradientBottom: '#FFF5EB',
} as const;
