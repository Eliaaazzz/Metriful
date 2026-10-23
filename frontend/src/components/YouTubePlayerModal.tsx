import { colors, spacing } from '@/utils';
import { X } from 'phosphor-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Linking,
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    View,
    useWindowDimensions,
} from 'react-native';
import YoutubePlayer from 'react-native-youtube-iframe';
import { Button } from './Button';
import { Text } from './Text';

interface YouTubePlayerModalProps {
  visible: boolean;
  youtubeId: string;
  title?: string;
  onClose: () => void;
}

const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const READY_TIMEOUT_MS = 6000;

const openInYouTube = async (id: string) => {
  const appUrl = `vnd.youtube://${id}`;
  const webUrl = `https://www.youtube.com/watch?v=${id}`;
  try {
    const supported = await Linking.canOpenURL(appUrl);
    await Linking.openURL(supported ? appUrl : webUrl);
  } catch {
    Linking.openURL(webUrl).catch(() => {});
  }
};

export const YouTubePlayerModal: React.FC<YouTubePlayerModalProps> = ({
  visible,
  youtubeId,
  title,
  onClose,
}) => {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const isValidId = YOUTUBE_ID_PATTERN.test(youtubeId);

  // For shorts, use vertical aspect ratio; for regular videos use 16:9
  const isShort = true; // All our videos are shorts
  const videoWidth = isLandscape ? Math.min(height * 0.9, 400) : width * 0.95;
  const videoHeight = isShort
    ? Math.min(videoWidth * 1.77, height * 0.75) // 9:16 ratio for shorts
    : videoWidth * 0.5625; // 16:9 ratio

  const [hasError, setHasError] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset state whenever modal opens / id changes
  useEffect(() => {
    if (!visible) return;
    setHasError(!isValidId);
    setIsReady(false);
    if (!isValidId) return;

    watchdogRef.current = setTimeout(() => {
      setIsReady((ready) => {
        if (!ready) setHasError(true);
        return ready;
      });
    }, READY_TIMEOUT_MS);

    return () => {
      if (watchdogRef.current) clearTimeout(watchdogRef.current);
      watchdogRef.current = null;
    };
  }, [visible, youtubeId, isValidId]);

  const handleReady = useCallback(() => {
    setIsReady(true);
    if (watchdogRef.current) {
      clearTimeout(watchdogRef.current);
      watchdogRef.current = null;
    }
  }, []);

  const handleError = useCallback(() => {
    setHasError(true);
  }, []);

  const renderErrorState = () => (
    <View style={[styles.errorContainer, { width: videoWidth, height: videoHeight }]}>
      <Text variant="body" weight="semibold" style={styles.errorTitle}>
        This video can&apos;t play here
      </Text>
      <Text variant="caption" style={styles.errorSubtitle}>
        Some videos block in-app playback. Open it in YouTube to watch.
      </Text>
      {isValidId && (
        <Button
          title="Open in YouTube"
          variant="primary"
          size="medium"
          onPress={() => openInYouTube(youtubeId)}
        />
      )}
    </View>
  );

  const renderPlayer = () => {
    if (hasError) return renderErrorState();

    if (Platform.OS === 'web') {
      const embedUrl = `https://www.youtube.com/embed/${youtubeId}?autoplay=1&playsinline=1&rel=0&modestbranding=1&controls=1`;
      return (
        <iframe
          src={embedUrl}
          width={videoWidth}
          height={videoHeight}
          style={{ border: 'none', borderRadius: 16 }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      );
    }

    return (
      <View style={{ width: videoWidth, height: videoHeight, borderRadius: 16, overflow: 'hidden' }}>
        <YoutubePlayer
          videoId={youtubeId}
          height={videoHeight}
          width={videoWidth}
          play={visible}
          onReady={handleReady}
          onError={handleError}
          webViewProps={{
            allowsInlineMediaPlayback: true,
            mediaPlaybackRequiresUserAction: false,
            androidLayerType: 'hardware',
          }}
          initialPlayerParams={{
            modestbranding: true,
            rel: false,
            controls: true,
            preventFullScreen: false,
          }}
        />
        {!isReady && (
          <View style={[styles.loadingContainer, { width: videoWidth, height: videoHeight }]}>
            <ActivityIndicator size="large" color={colors.light.primary} />
          </View>
        )}
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.content} onPress={(e) => e.stopPropagation()}>
          {/* Header */}
          <View style={styles.header}>
            <Text variant="body" weight="semibold" numberOfLines={1} style={styles.title}>
              {title || 'Workout Video'}
            </Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <X size={24} color="#FFF" weight="bold" />
            </Pressable>
          </View>

          {/* Video Player */}
          <View style={styles.playerContainer}>
            {renderPlayer()}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    backgroundColor: colors.dark.surface,
    borderRadius: 20,
    overflow: 'hidden',
    maxWidth: '95%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.dark.surfaceVariant,
  },
  title: {
    flex: 1,
    color: colors.dark.textPrimary,
    marginRight: spacing.sm,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
    paddingHorizontal: spacing.lg,
  },
  errorTitle: {
    color: colors.dark.textPrimary,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  errorSubtitle: {
    color: colors.dark.textSecondary,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
});
