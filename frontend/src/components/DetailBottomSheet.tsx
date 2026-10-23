import { Text } from '@/components';
import { colors, radii, spacing } from '@/utils';
import { X } from 'phosphor-react-native';
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';

interface DetailBottomSheetProps {
  visible: boolean;
  onClose?: () => void;
  title?: string;
  /** Tap on backdrop dismisses (default true) */
  dismissOnBackdrop?: boolean;
  /** Maximum sheet height as fraction of window height. Default 0.85. */
  maxHeightRatio?: number;
  children: React.ReactNode;
}

/**
 * DetailBottomSheet — Uber Eats restaurant-detail style.
 * Slides up from bottom, backdrop fades in, drag handle, scroll content.
 * Pattern source: Uber Eats restaurant detail sheet (and iOS sheet presentation).
 */
export const DetailBottomSheet: React.FC<DetailBottomSheetProps> = ({
  visible,
  onClose,
  title,
  dismissOnBackdrop = true,
  maxHeightRatio = 0.85,
  children,
}) => {
  const { height } = useWindowDimensions();
  const translateY = useRef(new Animated.Value(height)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          damping: 18,
          stiffness: 180,
          mass: 0.9,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: height,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, height, translateY, backdropOpacity]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={dismissOnBackdrop ? onClose : undefined}
        />
      </Animated.View>

      {/* Sheet */}
      <View pointerEvents="box-none" style={styles.sheetContainer}>
        <Animated.View
          style={[
            styles.sheet,
            {
              maxHeight: height * maxHeightRatio,
              transform: [{ translateY }],
            },
          ]}
        >
          {/* Drag handle */}
          <View style={styles.handleContainer}>
            <View style={styles.handle} />
          </View>

          {/* Header */}
          {(title || onClose) && (
            <View style={styles.header}>
              <Text variant="heading4" weight="bold" numberOfLines={1} style={styles.title}>
                {title || ''}
              </Text>
              <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
                <X size={20} color={colors.light.textPrimary} weight="bold" />
              </Pressable>
            </View>
          )}

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            bounces
          >
            {children}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheetContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: radii.xl ?? 24,
    borderTopRightRadius: radii.xl ?? 24,
    paddingBottom: spacing.lg,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 24, shadowOffset: { width: 0, height: -4 } },
      android: { elevation: 16 },
      default: { boxShadow: '0 -8px 32px rgba(0,0,0,0.18)' } as any,
    }),
  },
  handleContainer: {
    alignItems: 'center',
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(17,17,17,0.18)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  title: {
    flex: 1,
    color: colors.light.textPrimary,
    marginRight: spacing.md,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(17,17,17,0.06)',
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
});
