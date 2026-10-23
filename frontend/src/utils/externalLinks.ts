import { API_BASE_URL } from '@env';
import { Alert, Linking, Platform } from 'react-native';

const FALLBACK_WEB_ORIGIN = 'https://aurafitness.org';

const getConfiguredOrigin = (): string => {
  const configuredBaseUrl = API_BASE_URL || process.env.EXPO_PUBLIC_API_BASE_URL || FALLBACK_WEB_ORIGIN;

  try {
    return new URL(configuredBaseUrl).origin;
  } catch {
    return FALLBACK_WEB_ORIGIN;
  }
};

export const getAppWebOrigin = (): string => {
  if (Platform.OS === 'web' && typeof globalThis.window !== 'undefined') {
    const currentOrigin = globalThis.window.location?.origin;
    if (currentOrigin) {
      return currentOrigin;
    }
  }

  return getConfiguredOrigin();
};

export const APP_PAGE_PATHS = {
  about: '/about.html',
  support: '/support.html',
  privacy: '/privacy-policy.html',
  terms: '/terms-of-service.html',
  releaseNotes: '/release-notes.html',
  accessibility: '/accessibility.html',
  dataDeletion: '/data-deletion.html',
} as const;

export const SUPPORT_EMAIL_URL = 'mailto:support@aurafitness.org';

export const buildAppPageUrl = (path: string): string => {
  if (/^(mailto:|https?:)/i.test(path)) {
    return path;
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${getAppWebOrigin()}${normalizedPath}`;
};

export async function openExternalUrl(
  url: string,
  failureTitle = 'Unable to open link',
  failureMessage = 'Please try again in your browser.',
): Promise<boolean> {
  try {
    await Linking.openURL(url);
    return true;
  } catch (error) {
    if (__DEV__) {
      console.warn('Failed to open external URL', { url, error });
    }
    Alert.alert(failureTitle, failureMessage);
    return false;
  }
}

export async function openAppPage(
  path: string,
  failureTitle?: string,
  failureMessage?: string,
): Promise<boolean> {
  return openExternalUrl(buildAppPageUrl(path), failureTitle, failureMessage);
}
