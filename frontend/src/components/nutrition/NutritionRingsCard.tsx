/**
 * NutritionRingsCard — Apple Fitness-style concentric activity rings.
 *
 * Inspired by the Apple Watch Activity / Apple Fitness app rings: three
 * concentric 360° rings rendered with rounded stroke caps, animated from
 * 12 o'clock clockwise, with a leading-edge drop shadow when a ring
 * "closes" (passes 100%) to give the iconic overlap effect.
 *
 * Implementation references:
 *   - notjust.dev "Animated Progress Ring in React Native using SVG and
 *     Reanimated" — strokeDashoffset technique on AnimatedCircle
 *   - reactiive.io "Circular Progress Bar Animation with React Native
 *     Reanimated" — useSharedValue + useAnimatedProps pattern
 *   - Apple Watch Activity ring shadow trick — render the over-100% slice
 *     as a second arc with an SVG drop-shadow filter
 */
import { BookOpen, ArrowSquareOut } from 'phosphor-react-native';
import React, { useEffect, useId, useMemo, useState } from 'react';
import { LayoutChangeEvent, Platform, Pressable, StyleSheet, Text as RNText, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Filter, FeDropShadow, G } from 'react-native-svg';

import { BENTO_CARD_STYLES, BENTO_CARD_WEB_STYLES, MOBILE_CARD_STYLES } from '@/components/common/BentoCard';
import { Text } from '@/components/Text';
import { NUTRITION_REFERENCES, openExternalUrl } from '@/utils';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// Apple Activity ring palette — Move (red/pink), Exercise (green), Stand (cyan/orange).
// We map nutrition macros to the Activity hues most users already associate with
// "primary metric / supporting metric / accent metric".
const RING = {
  pink:   '#FA114F', // Protein  — Apple "Move"     hue
  green:  '#34C759', // Fat      — Apple "Exercise" hue
  orange: '#FF9F0A', // Carbs    — Apple "Stand"-adjacent
};

// Geometry — three concentric rings, equal stroke, equal gap.
// STROKE 20 (not 22) keeps the rings bold while widening the inner hole to
// ~76px so the center calorie readout never collides with the innermost ring
// even at 4-5 digit values (see CENTER_TEXT_MAX below).
const SIZE = 220;
const CENTER = SIZE / 2;
const STROKE = 20;
const GAP = 6;
const ANIM_DURATION = 1100;
const ANIM_STAGGER = 140;

// Max width (DIP) for the center readout — clamps the calorie number to the
// inner-ring hole so adjustsFontSizeToFit shrinks long values to fit rather
// than overflowing onto the chart.
const CENTER_TEXT_MAX = 72;

// Card width (incl. padding) at/above which rings + legend sit side-by-side
// instead of stacking. Below this (phones, narrow tour cards) we stack.
const ROW_BREAKPOINT = 600;
// Rings render slightly larger in the roomier side-by-side layout.
const RINGS_ROW_SIZE = 240;

interface MacroData { current: number; target: number; }
export interface NutritionRingsData {
  calories: MacroData; protein: MacroData; carbs: MacroData;
  fat?: MacroData; bloodSugarRise?: number;
}
interface NutritionRingsCardProps {
  data: NutritionRingsData;
  showFat?: boolean;
  animated?: boolean;
  onMacroPress?: (macro: 'calories' | 'protein' | 'carbs' | 'fat') => void;
  onSourcesPress?: () => void;
}

interface RingDef {
  key: 'protein' | 'fat' | 'carbs';
  label: string;
  unit: string;
  color: string;
  trackColor: string;
}

const RINGS: RingDef[] = [
  { key: 'protein', label: 'Protein', unit: 'g', color: RING.pink,   trackColor: 'rgba(250,17,79,0.15)' },
  { key: 'fat',     label: 'Fat',     unit: 'g', color: RING.green,  trackColor: 'rgba(52,199,89,0.15)' },
  { key: 'carbs',   label: 'Carbs',   unit: 'g', color: RING.orange, trackColor: 'rgba(255,159,10,0.15)' },
];

/**
 * One full 360° ring. Animates strokeDashoffset from full circumference
 * (empty) to circumference * (1 - clampedProgress). When progress exceeds
 * 100%, an additional "overflow" arc is rendered with a drop-shadow filter
 * to mimic the Apple Watch leading-edge overlap effect.
 */
function Ring({ color, trackColor, radius, percentage, animated, delay, filterId }: {
  color: string;
  trackColor: string;
  radius: number;
  percentage: number;
  animated: boolean;
  delay: number;
  filterId: string;
}) {
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(percentage, 100)) / 100;
  const overflow = Math.max(0, Math.min(percentage - 100, 100)) / 100;

  const baseProgress = useSharedValue(0);
  const overflowProgress = useSharedValue(0);

  useEffect(() => {
    if (animated) {
      baseProgress.value = withDelay(delay, withTiming(clamped, {
        duration: ANIM_DURATION,
        easing: Easing.out(Easing.cubic),
      }));
      overflowProgress.value = withDelay(delay + ANIM_DURATION * 0.6, withTiming(overflow, {
        duration: ANIM_DURATION,
        easing: Easing.out(Easing.cubic),
      }));
    } else {
      baseProgress.value = clamped;
      overflowProgress.value = overflow;
    }
  }, [animated, clamped, delay, overflow, baseProgress, overflowProgress]);

  const baseProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - baseProgress.value),
  }));
  const overflowProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - overflowProgress.value),
  }));

  return (
    <>
      {/* Track — full faint ring */}
      <Circle
        cx={CENTER}
        cy={CENTER}
        r={radius}
        stroke={trackColor}
        strokeWidth={STROKE}
        fill="none"
      />
      {/* Animated foreground arc, 0 → clamped */}
      <AnimatedCircle
        cx={CENTER}
        cy={CENTER}
        r={radius}
        stroke={color}
        strokeWidth={STROKE}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={circumference}
        animatedProps={baseProps}
      />
      {/* Overflow arc — only meaningful when percentage > 100; rides on top
          with a drop-shadow filter so the leading edge appears to lift off
          the underlying ring (the Apple Watch "closing the ring" cue). */}
      {overflow > 0 && (
        <AnimatedCircle
          cx={CENTER}
          cy={CENTER}
          r={radius}
          stroke={color}
          strokeWidth={STROKE}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          animatedProps={overflowProps}
          filter={`url(#${filterId})`}
        />
      )}
    </>
  );
}

export function NutritionRingsCard({ data, showFat = true, animated = true, onMacroPress }: NutritionRingsCardProps) {
  // Per-instance prefix prevents SVG <filter> id collisions when the card
  // is mounted more than once on a single screen (Dashboard renders two).
  const filterPrefix = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const rings = useMemo(() => (showFat ? RINGS : RINGS.filter(r => r.key !== 'fat')), [showFat]);

  // Responsive layout: measure the card's own width (works on web + native)
  // and switch rings/legend from stacked → side-by-side once there's room.
  const [cardWidth, setCardWidth] = useState(0);
  const onCardLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w && Math.abs(w - cardWidth) > 1) setCardWidth(w);
  };
  const isRow = cardWidth >= ROW_BREAKPOINT;

  // Outer → inner radii so the largest ring sits on the outside.
  const radii = useMemo(() => {
    const outerRadius = (SIZE - STROKE) / 2;
    return rings.map((_, i) => outerRadius - i * (STROKE + GAP));
  }, [rings]);

  const pcts: Record<string, number> = {
    protein: data.protein.target > 0 ? (data.protein.current / data.protein.target) * 100 : 0,
    fat: data.fat && data.fat.target > 0 ? (data.fat.current / data.fat.target) * 100 : 0,
    carbs: data.carbs.target > 0 ? (data.carbs.current / data.carbs.target) * 100 : 0,
  };

  const calorieText = Math.round(data.calories.current).toLocaleString();
  const calorieTarget = data.calories.target.toLocaleString();

  return (
    <View style={styles.card} onLayout={onCardLayout}>
      <View style={[styles.body, isRow && styles.bodyRow]}>
      <View
        style={[styles.ringsContainer, isRow && styles.ringsContainerRow]}
        accessible
        accessibilityRole="summary"
        accessibilityLabel={`${calorieText} of ${calorieTarget} calories. ${rings.map(r => `${r.label} ${Math.round(pcts[r.key])} percent`).join('. ')}.`}
      >
        <Svg width="100%" height="100%" viewBox={`0 0 ${SIZE} ${SIZE}`} preserveAspectRatio="xMidYMid meet">
          {/* Per-ring drop-shadow filters for the over-100% leading edge */}
          <Defs>
            {rings.map((r, i) => (
              <Filter
                key={`shadow-${r.key}`}
                id={`ring-shadow-${filterPrefix}-${i}`}
                x="-25%" y="-25%" width="150%" height="150%"
              >
                <FeDropShadow dx="0" dy="0" stdDeviation="2.5" floodColor="#000000" floodOpacity="0.45" />
              </Filter>
            ))}
          </Defs>
          {/* Rotate -90° so 0 starts at 12 o'clock and progress fills clockwise */}
          <G transform={`rotate(-90 ${CENTER} ${CENTER})`}>
            {rings.map((r, i) => (
              <Ring
                key={r.key}
                color={r.color}
                trackColor={r.trackColor}
                radius={radii[i]}
                percentage={pcts[r.key]}
                animated={animated}
                delay={i * ANIM_STAGGER}
                filterId={`ring-shadow-${filterPrefix}-${i}`}
              />
            ))}
          </G>
        </Svg>

        {/* Center calorie readout — sits inside the innermost ring */}
        <View
          style={styles.centerOverlay}
          pointerEvents="none"
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
        >
          <RNText style={styles.calorieValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
            {calorieText}
          </RNText>
          <RNText style={styles.calorieTarget} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
            / {calorieTarget} kcal
          </RNText>
        </View>
      </View>

      {/* Macro legend — coloured dot + label/value, replaces the old vertical bars */}
      <View style={[styles.legend, isRow && styles.legendRow]}>
        {rings.map(r => {
          const d = r.key === 'fat' ? data.fat : data[r.key];
          const pct = Math.round(pcts[r.key]);
          return (
            <Pressable
              key={r.key}
              onPress={() => onMacroPress?.(r.key)}
              style={({ pressed }) => [styles.legendItem, pressed && { opacity: 0.7 }]}
              accessibilityRole="button"
              accessibilityLabel={`${r.label}: ${Math.round(d?.current ?? 0)} of ${d?.target ?? 0} ${r.unit}, ${pct}%`}
            >
              <View style={[styles.legendDot, { backgroundColor: r.color }]} />
              <View style={styles.legendText}>
                <Text style={[styles.legendLabel, { color: r.color }]}>{r.label}</Text>
                <Text style={styles.legendValue}>
                  {Math.round(d?.current ?? 0)}<Text style={styles.legendValueDim}>/{d?.target ?? 0}{r.unit}</Text>
                </Text>
              </View>
              <Text style={[styles.legendPct, { color: r.color }]}>{pct}%</Text>
            </Pressable>
          );
        })}
      </View>
      </View>

      <View style={styles.citationArea}>
        <Pressable
          style={styles.citationRow}
          onPress={() => openExternalUrl(NUTRITION_REFERENCES.fdaDailyValues.url, 'Unable to open', 'Open FDA reference.')}
          accessibilityRole="link"
          accessibilityLabel={NUTRITION_REFERENCES.fdaDailyValues.title}
        >
          <BookOpen size={11} color="#9CA3AF" />
          <Text style={styles.citationText}>Defaults: FDA Daily Values (2,000 kcal · 50g P · 275g C · 78g F)</Text>
          <ArrowSquareOut size={10} color="#9CA3AF" />
        </Pressable>
        <Pressable
          style={styles.citationRow}
          onPress={() => openExternalUrl(NUTRITION_REFERENCES.mifflinStJeor.url, 'Unable to open', 'Open Mifflin-St Jeor reference.')}
          accessibilityRole="link"
          accessibilityLabel={NUTRITION_REFERENCES.mifflinStJeor.title}
        >
          <BookOpen size={11} color="#9CA3AF" />
          <Text style={styles.citationText}>Custom goals: Mifflin-St Jeor equation · USDA DRI</Text>
          <ArrowSquareOut size={10} color="#9CA3AF" />
        </Pressable>
        <Text style={styles.citationNote}>AI-generated data is approximate — verify with a healthcare professional.</Text>
      </View>
    </View>
  );
}

export function getCalorieSubtitle(current: number, target: number): string {
  return `${Math.round(current)} / ${target} kcal`;
}

const styles = StyleSheet.create({
  card: {
    ...(Platform.OS === 'web' ? { ...BENTO_CARD_STYLES, ...(BENTO_CARD_WEB_STYLES as object) } : MOBILE_CARD_STYLES),
    alignItems: 'center',
  },

  // Rings + legend wrapper. Stacks by default; becomes a centered two-column
  // row on wide cards (see bodyRow) so the chart and macros sit side-by-side.
  body: {
    width: '100%',
    alignItems: 'center',
  },
  bodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 52,
  },

  ringsContainer: {
    width: '100%',
    maxWidth: SIZE,
    aspectRatio: 1,
    position: 'relative',
  },
  ringsContainerRow: {
    width: RINGS_ROW_SIZE,
    maxWidth: RINGS_ROW_SIZE,
  },
  centerOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  calorieValue: {
    color: '#111111',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -1,
    lineHeight: 30,
    maxWidth: CENTER_TEXT_MAX,
    textAlign: 'center',
  },
  calorieTarget: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '500',
    maxWidth: CENTER_TEXT_MAX,
    textAlign: 'center',
  },

  legend: {
    width: '100%',
    maxWidth: 300,
    marginTop: 18,
    gap: 8,
  },
  legendRow: {
    width: 250,
    maxWidth: 250,
    marginTop: 0,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    flex: 1,
  },
  legendLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  legendValue: {
    color: '#111111',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 1,
  },
  legendValueDim: {
    color: '#9CA3AF',
    fontWeight: '500',
  },
  legendPct: {
    fontSize: 14,
    fontWeight: '800',
    minWidth: 44,
    textAlign: 'right',
  },

  citationArea: {
    width: '100%',
    marginTop: 20,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.04)',
    gap: 8,
  },
  citationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    ...(Platform.OS === 'web' && { cursor: 'pointer' as any }),
  },
  citationText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '400',
    color: '#9CA3AF',
  },
  citationNote: {
    fontSize: 11,
    fontWeight: '400',
    color: '#9CA3AF',
    fontStyle: 'italic',
    marginTop: 2,
  },
});

export default NutritionRingsCard;
