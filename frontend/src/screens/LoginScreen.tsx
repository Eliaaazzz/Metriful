import { Ionicons } from '@expo/vector-icons';
import { Envelope, Lightning, Lock, ShieldCheck } from 'phosphor-react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as AuthSession from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeInDown, FadeInUp, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import {
  API_BASE_URL,
  EXPO_PUBLIC_APPLE_SERVICE_ID,
  EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
} from '@env';
import { Image } from 'expo-image';
import { Text } from '@/components';
import { trackEvent } from '@/services/analytics';
import { startBackendWarmup } from '@/services/backendWarmup';
import { storeGoogleOAuthState } from '@/services/webGoogleRedirect';
import { api } from '../services/apiClient';
import { queryClient } from '../services/queryClient';
import { useAuthStore } from '../stores';
import { BRAND_COLORS, EXPERIENCE_COLORS, radii, spacing } from '@/utils';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_IOS_CLIENT_ID = EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
const GOOGLE_ANDROID_CLIENT_ID = EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;
const GOOGLE_WEB_CLIENT_ID = EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const APPLE_SERVICE_ID = EXPO_PUBLIC_APPLE_SERVICE_ID || process.env.EXPO_PUBLIC_APPLE_SERVICE_ID;
const APPLE_API_BASE_URL = API_BASE_URL || process.env.EXPO_PUBLIC_API_BASE_URL || 'https://aurafitness.org';
// Debug: Log OAuth config status (not values) in development
if (__DEV__) {
  console.log('[OAuth] Config loaded:', {
    hasWebClientId: !!GOOGLE_WEB_CLIENT_ID,
    hasIosClientId: !!GOOGLE_IOS_CLIENT_ID,
    hasAndroidClientId: !!GOOGLE_ANDROID_CLIENT_ID,
    hasAppleServiceId: !!APPLE_SERVICE_ID,
    webClientIdPrefix: GOOGLE_WEB_CLIENT_ID?.substring(0, 12) + '...',
  });
}

// Declare AppleID type for Sign in with Apple JS
declare global {
  interface Window {
    AppleID?: {
      auth: {
        init: (config: {
          clientId: string;
          scope: string;
          redirectURI: string;
          usePopup: boolean;
          state?: string;
          nonce?: string;
          responseType?: string;
          responseMode?: string;
        }) => void;
        signIn: () => Promise<{
          authorization: {
            code: string;
            id_token: string;
            state?: string;
          };
          user?: {
            email?: string;
            name?: {
              firstName?: string;
              lastName?: string;
            };
          };
        }>;
      };
    };
  }
}

const APPLE_STATE_KEY = 'apple_signin_state';
const APPLE_NONCE_KEY = 'apple_signin_nonce';

type AppleWebSignInPayload = {
  authorization?: {
    code?: string;
    id_token?: string;
    state?: string;
  };
  user?: {
    email?: string;
    name?: {
      firstName?: string;
      lastName?: string;
    };
  };
};

const getAppleFullName = (payload?: AppleWebSignInPayload['user']): string | undefined => {
  const firstName = payload?.name?.firstName?.trim();
  const lastName = payload?.name?.lastName?.trim();
  if (!firstName && !lastName) {
    return undefined;
  }
  return `${firstName || ''} ${lastName || ''}`.trim() || undefined;
};

/**
 * Generate a cryptographically random string for state/nonce parameters.
 * Uses Web Crypto API (available in all modern browsers and React Native).
 */
const generateRandomString = (length = 32): string => {
  const array = new Uint8Array(length);
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(array);
  } else {
    // Fallback for environments without crypto API
    for (let i = 0; i < length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
};

/**
 * SHA-256 hash a string. Apple requires the nonce to be hashed before
 * passing it to the JS SDK; the raw nonce is sent to our backend for
 * verification against the hashed value in the id_token.
 */
const sha256 = async (input: string): Promise<string> => {
  try {
    return await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      input,
      { encoding: Crypto.CryptoEncoding.HEX }
    );
  } catch (error) {
    console.warn('[OAuth] Failed to hash nonce with expo-crypto, falling back to Web Crypto', error);
  }

  if (typeof globalThis.crypto?.subtle?.digest === 'function') {
    const buffer = new TextEncoder().encode(input);
    const hash = await globalThis.crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback: return raw nonce (server-side hash check will be skipped)
  return input;
};

const COLORS = {
  brand50: BRAND_COLORS.background,
  brand100: BRAND_COLORS.primaryContainer,
  brand500: BRAND_COLORS.primary,
  brand600: BRAND_COLORS.primaryDark,
  brand700: BRAND_COLORS.primaryDark,
  white: BRAND_COLORS.surfaceElevated,
  background: BRAND_COLORS.background,
  gray50: BRAND_COLORS.surface,
  gray100: BRAND_COLORS.surfaceVariant,
  gray200: BRAND_COLORS.border,
  gray400: BRAND_COLORS.textDisabled,
  gray500: BRAND_COLORS.textMuted,
  gray700: BRAND_COLORS.textSecondary,
  gray800: BRAND_COLORS.textSecondary,
  gray900: BRAND_COLORS.textPrimary,
  error: BRAND_COLORS.error,
  errorBg: 'rgba(208, 92, 65, 0.10)',
};

const SPACING = spacing;
const RADII = radii;
const brandMotionIllustration = require('@/../assets/illustrations/brand-motion-coach.svg');

// ============================================================================
// Google Icon Component
// ============================================================================
const GoogleIcon = () => (
  <Svg width={20} height={20} viewBox="0 0 24 24">
    <Path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <Path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <Path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
      fill="#FBBC05"
    />
    <Path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#EA4335"
    />
  </Svg>
);

// ============================================================================
// Social Button Component
// ============================================================================
interface SocialButtonProps {
  onPress: () => void;
  disabled?: boolean;
}

const SocialButton: React.FC<SocialButtonProps> = ({ onPress, disabled }) => {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.socialButton,
        styles.googleButton,
        pressed && styles.socialButtonPressed,
        disabled && styles.buttonDisabled,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <GoogleIcon />
      <Text style={styles.socialButtonText}>
        Continue with Google
      </Text>
    </Pressable>
  );
};

// ============================================================================
// Main Login Screen
// ============================================================================
export default function LoginScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const webGoogleHandoffStarted = React.useRef(false);

  // Pre-warm the backend on mount so serverless cold start is absorbed
  // before the user finishes tapping a login button.
  useEffect(() => {
    void startBackendWarmup();
  }, []);

  // Auth state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Surface a Google sign-in failure routed here from the Splash boot handler
  // (the web redirect is completed on Splash, so the error can't be set inline).
  useEffect(() => {
    if ((route.params as { authError?: string } | undefined)?.authError === 'google') {
      setError('Google sign-in could not be completed. Please try again.');
      navigation.setParams({ authError: undefined } as never);
    }
  }, [route.params, navigation]);
  const [showEmailLogin, setShowEmailLogin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isAppleNativeAvailable, setIsAppleNativeAvailable] = useState(Platform.OS !== 'ios');
  const shouldShowAppleButton = Platform.OS === 'web' || (Platform.OS === 'ios' && isAppleNativeAvailable);
  const legalBaseUrl = useMemo(() => {
    if (Platform.OS === 'web' && typeof globalThis.window !== 'undefined') {
      return globalThis.window.location.origin;
    }
    return 'https://aurafitness.org';
  }, []);

  const configuredWebOrigin = useMemo(() => {
    try {
      return new URL(APPLE_API_BASE_URL).origin;
    } catch {
      return 'https://aurafitness.org';
    }
  }, []);

  const currentWebOrigin = useMemo(() => {
    if (Platform.OS === 'web' && typeof globalThis.window !== 'undefined') {
      return globalThis.window.location.origin;
    }
    return '';
  }, []);

  const canonicalWebOrigin = useMemo(() => {
    if (Platform.OS !== 'web') return '';
    if (!currentWebOrigin) return configuredWebOrigin;

    const isLocal =
      currentWebOrigin.includes('localhost') ||
      currentWebOrigin.includes('127.0.0.1');

    return isLocal ? currentWebOrigin : configuredWebOrigin;
  }, [configuredWebOrigin, currentWebOrigin]);

  // Google OAuth setup
  // expo-auth-session defaults to using applicationId (bundle ID) as redirect
  // scheme, but Google iOS OAuth clients require the reversed client ID scheme.
  // We explicitly construct the correct redirect URI for each platform.
  const redirectUri = useMemo(() => {
    if (Platform.OS === 'web') {
      const pathname =
        typeof globalThis.window !== 'undefined' && globalThis.window.location?.pathname
          ? globalThis.window.location.pathname
          : '/';
      return `${canonicalWebOrigin}${pathname}`;
    }
    if (Platform.OS === 'ios' && GOOGLE_IOS_CLIENT_ID) {
      // Google requires reversed client ID as redirect scheme for iOS
      // e.g., com.googleusercontent.apps.113023901864-xxx:/oauthredirect
      const reversedClientId = GOOGLE_IOS_CLIENT_ID.split('.').reverse().join('.');
      return `${reversedClientId}:/oauthredirect`;
    }
    if (Platform.OS === 'android' && GOOGLE_ANDROID_CLIENT_ID) {
      const reversedClientId = GOOGLE_ANDROID_CLIENT_ID.split('.').reverse().join('.');
      return `${reversedClientId}:/oauthredirect`;
    }
    return AuthSession.makeRedirectUri({ scheme: 'com.elia.aurafit' });
  }, [canonicalWebOrigin]);

  // Debug: Log the calculated redirectUri in development
  if (__DEV__) {
    console.log('[OAuth] redirectUri:', redirectUri);
    console.log('[OAuth] Platform:', Platform.OS);
  }

  const [googleRequest, googleResponse, promptGoogleAsync] = Google.useIdTokenAuthRequest({
    iosClientId: GOOGLE_IOS_CLIENT_ID,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID,
    webClientId: GOOGLE_WEB_CLIENT_ID,
    redirectUri,
    scopes: ['profile', 'email'],
    prompt: AuthSession.Prompt.Login,
  });

  // Handle successful login - use Zustand store signIn
  const handleLoginSuccess = useCallback(async (data: {
    token: string;
    email: string;
    isNewUser?: boolean;
    user?: { userId: string; username: string; currentStreak: number; level: string; timeBucket: number };
  }, method: 'google' | 'apple' | 'password') => {
    try {
      // Clear React Query cache
      queryClient.clear();

      // Build userInfo from inline user snapshot (returned by login endpoint).
      // This eliminates the need for a separate /me fetch and the cold-start race.
      const inlineUserInfo = data.user ? {
        userId: data.user.userId,
        email: data.email,
        username: data.user.username,
        currentStreak: data.user.currentStreak,
        level: data.user.level,
        timeBucket: data.user.timeBucket,
      } : {
        // Fallback for older backend that doesn't return user snapshot
        userId: '',
        email: data.email,
        username: '',
        currentStreak: 0,
        level: '',
        timeBucket: 0,
      };

      await useAuthStore.getState().signIn(data.token, inlineUserInfo);

      // Verify authentication state was set before navigating.
      // We only require isAuthenticated — userInfo may still be loading
      // from /me endpoint (cold start), but the user should proceed to
      // the main screen where it will resolve via useCurrentUser hook.
      const authState = useAuthStore.getState();
      if (!authState.isAuthenticated) {
        throw new Error('Login succeeded but authentication state was not set. Please try again.');
      }

      trackEvent(data.isNewUser ? 'sign_up' : 'login', { method });

      setIsLoading(false);
      // Show splash screen briefly on web for a polished login transition,
      // then splash will navigate to Main once auth state is confirmed.
      if (Platform.OS === 'web') {
        navigation.reset({
          index: 0,
          routes: [{ name: 'Splash' } as any],
        });
      } else {
        navigation.reset({
          index: 0,
          routes: [{ name: 'Main' } as any],
        });
      }
    } catch (err) {
      setIsLoading(false);
      console.error('[LoginScreen] handleLoginSuccess failed:', err);
      setError(err instanceof Error ? err.message : 'Sign-in completed but navigation failed. Please try again.');
    }
  }, [navigation]);

  // Send Google token to backend with retry for cold-start / transient errors
  const sendGoogleTokenToBackend = useCallback(async (idToken: string) => {
    setIsLoading(true);
    setError(null);

    const MAX_ATTEMPTS = 2;
    let lastError: any;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const data = await api.post<{ token: string; email: string; isNewUser?: boolean; user?: any }>('/api/v1/auth/login', {
          loginType: 'GOOGLE',
          idToken,
        }, { timeout: 60000 }); // 60s for GCP cold start
        await handleLoginSuccess(data, 'google');
        return;
      } catch (err: any) {
        lastError = err;
        const isRetryable = err?.status === 408 || err?.status === 503 || err?.status === 502 || !err?.status;
        if (attempt < MAX_ATTEMPTS && isRetryable) {
          console.warn(`[LoginScreen] Google login attempt ${attempt} failed (retryable), retrying...`, err?.message);
          await new Promise(r => setTimeout(r, 2000));
          continue;
        }
      }
    }

    setIsLoading(false);
    const msg = lastError instanceof Error ? lastError.message : 'Google sign-in failed. Please try again.';
    // Don't append retry hint for auth errors (401/403) — they need a different fix
    const isAuthError = lastError?.status === 401 || lastError?.status === 403;
    setError(isAuthError ? msg : `${msg} Please check your internet connection and try again.`);
  }, [handleLoginSuccess]);

  const sendAppleTokenToBackend = useCallback(async (idToken: string, fullName?: string, nonce?: string, authorizationCode?: string) => {
    setIsLoading(true);
    setError(null);

    const MAX_ATTEMPTS = 2;
    let lastError: any;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const data = await api.post<{ token: string; email: string; isNewUser?: boolean; user?: any }>('/api/v1/auth/login', {
          loginType: 'APPLE',
          idToken,
          fullName,
          ...(nonce ? { nonce } : {}),
          ...(authorizationCode ? { authorizationCode } : {}),
        }, { timeout: 60000 }); // 60s for GCP cold start
        await handleLoginSuccess(data, 'apple');
        return;
      } catch (err: any) {
        lastError = err;
        const isRetryable = err?.status === 408 || err?.status === 503 || err?.status === 502 || !err?.status;
        if (attempt < MAX_ATTEMPTS && isRetryable) {
          console.warn(`[LoginScreen] Apple login attempt ${attempt} failed (retryable), retrying...`, err?.message);
          await new Promise(r => setTimeout(r, 2000));
          continue;
        }
      }
    }

    setIsLoading(false);
    const msg = lastError instanceof Error ? lastError.message : 'Apple sign-in failed. Please try again.';
    const isAuthError = lastError?.status === 401 || lastError?.status === 403;
    setError(isAuthError ? msg : `${msg} Please check your internet connection and try again.`);
  }, [handleLoginSuccess]);

  useEffect(() => {
    if (Platform.OS !== 'ios') {
      return;
    }

    let cancelled = false;

    AppleAuthentication.isAvailableAsync()
      .then((isAvailable) => {
        if (!cancelled) {
          setIsAppleNativeAvailable(isAvailable);
        }
      })
      .catch((availabilityError) => {
        console.warn('[AppleAuth] Failed to detect native Apple Sign In availability', availabilityError);
        if (!cancelled) {
          setIsAppleNativeAvailable(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Handle Google OAuth response (popup flow — works on non-Safari browsers)
  useEffect(() => {
    if (googleResponse?.type === 'success') {
      const idToken = googleResponse.params?.id_token || googleResponse.authentication?.idToken;
      if (__DEV__) {
        console.log('[OAuth DEBUG] Google response keys:', {
          paramKeys: Object.keys(googleResponse.params ?? {}),
          hasAuthentication: !!googleResponse.authentication,
          hasIdTokenInParams: !!googleResponse.params?.id_token,
          hasIdTokenInAuthentication: !!googleResponse.authentication?.idToken,
        });
      }
      if (idToken) {
        sendGoogleTokenToBackend(idToken);
      } else {
        setError('Google sign-in did not return an ID token. Please try again.');
      }
    } else if (googleResponse?.type === 'error') {
      console.error('[OAuth] Google auth error:', googleResponse.error);
      setError(googleResponse.error?.message || 'Google sign-in failed.');
    } else if (googleResponse?.type === 'dismiss') {
      // On iPad, auth sessions can be dismissed by tapping outside the sheet.
      // Reset loading state so the user can retry.
      console.log('[OAuth] Google auth dismissed (common on iPad sheet presentation)');
      setIsLoading(false);
    } else if (__DEV__ && googleResponse) {
      console.log('[OAuth DEBUG] Google response type:', googleResponse.type);
    }
  }, [googleResponse, sendGoogleTokenToBackend]);

  // Handle Google OAuth redirect response (full-page redirect flow for Safari).
  // After window.location.href redirect, the page reloads with id_token in the
  // URL hash. expo-auth-session's popup flow can't process this, so we handle
  // it manually.
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const hash = window.location.hash;
    if (!hash || hash.length < 2) return;

    const params = new URLSearchParams(hash.substring(1));
    const idToken = params.get('id_token');

    if (!idToken) return;

    // Verify state to prevent CSRF
    const expectedState = sessionStorage.getItem('google_oauth_state');
    const receivedState = params.get('state');
    if (expectedState && receivedState && expectedState !== receivedState) {
      setError('Google sign-in verification failed. Please try again.');
      window.history.replaceState(null, '', window.location.pathname);
      sessionStorage.removeItem('google_oauth_state');
      return;
    }
    sessionStorage.removeItem('google_oauth_state');

    // Clean up URL to prevent re-processing on subsequent renders
    window.history.replaceState(null, '', window.location.pathname);

    sendGoogleTokenToBackend(idToken);
  }, [sendGoogleTokenToBackend]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (!googleRequest?.url) return;
    if (typeof window === 'undefined') return;

    const search = new URLSearchParams(window.location.search);
    const shouldStartGoogle = search.get('auth') === 'google';

    if (!shouldStartGoogle || webGoogleHandoffStarted.current) return;

    webGoogleHandoffStarted.current = true;
    storeGoogleOAuthState(googleRequest.state);

    const cleanUrl = `${window.location.pathname}${window.location.hash || ''}`;
    window.history.replaceState(null, '', cleanUrl);
    window.location.href = googleRequest.url;
  }, [googleRequest]);

  const handleGoogleLogin = useCallback(async () => {
    if (!googleRequest?.url) return;

    // DEBUG: Log full Google auth URL
    if (__DEV__) {
      console.log('[OAuth DEBUG] Full Google Auth URL:', googleRequest.url);
      console.log('[OAuth DEBUG] clientId:', googleRequest.clientId);
      console.log('[OAuth DEBUG] redirectUri:', googleRequest.redirectUri);
      console.log('[OAuth DEBUG] responseType:', googleRequest.responseType);
      console.log('[OAuth DEBUG] codeVerifier:', googleRequest.codeVerifier ? 'present' : 'missing');
    }

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && canonicalWebOrigin && currentWebOrigin && currentWebOrigin !== canonicalWebOrigin) {
        const pathname = window.location.pathname || '/';
        const handoffUrl = `${canonicalWebOrigin}${pathname}?auth=google`;
        window.location.href = handoffUrl;
        return;
      }

      // Safari blocks window.open() called from async functions.
      // Use a full-page redirect instead; the response is completed on the Splash
      // boot screen after Google redirects back (see services/webGoogleRedirect).
      storeGoogleOAuthState(googleRequest.state);
      window.location.href = googleRequest.url;
      return;
    }

    try {
      const result = await promptGoogleAsync({
        preferEphemeralSession: true,
        // Let iOS choose the presentation style (PAGE_SHEET on iPad, FULL_SCREEN on iPhone).
        // Explicitly setting FULL_SCREEN can cause dismissal issues on iPad.
      });
      if (__DEV__) {
        console.log('[OAuth DEBUG] promptGoogleAsync result:', result?.type, 'params' in (result ?? {}) ? Object.keys((result as any)?.params ?? {}) : 'no params');
      }
    } catch (err: any) {
      // User cancelled — ignore silently
      if (err?.code === 'ERR_REQUEST_CANCELED' || err?.code === 'ERR_CANCELED') {
        return;
      }
      console.error('[OAuth] Google auth session error:', err);
      setError(err instanceof Error ? err.message : 'Google sign-in failed. Please try again.');
    }
  }, [canonicalWebOrigin, currentWebOrigin, googleRequest, promptGoogleAsync]);

  const handleAppleWebSuccess = useCallback(async (payload?: AppleWebSignInPayload) => {
    const identityToken = payload?.authorization?.id_token;
    if (!identityToken) {
      setIsLoading(false);
      setError('No identity token received from Apple.');
      return;
    }

    // Verify state parameter to prevent CSRF attacks
    if (Platform.OS === 'web') {
      const expectedState = sessionStorage.getItem(APPLE_STATE_KEY);
      const receivedState = payload?.authorization?.state;
      if (expectedState && receivedState && expectedState !== receivedState) {
        setIsLoading(false);
        setError('Sign-in verification failed. Please try again.');
        return;
      }
      // Retrieve raw nonce to send to backend for verification
      const rawNonce = sessionStorage.getItem(APPLE_NONCE_KEY) ?? undefined;
      sessionStorage.removeItem(APPLE_STATE_KEY);
      sessionStorage.removeItem(APPLE_NONCE_KEY);
      const authCode = payload?.authorization?.code ?? undefined;
      await sendAppleTokenToBackend(identityToken, getAppleFullName(payload?.user), rawNonce, authCode);
      return;
    }

    const authCode = payload?.authorization?.code ?? undefined;
    await sendAppleTokenToBackend(identityToken, getAppleFullName(payload?.user), undefined, authCode);
  }, [sendAppleTokenToBackend]);

  // Web Apple Sign-In: load JS SDK and init auth for popup flow.
  // We use our own custom button (not Apple's renderButton) to avoid DOM timing issues.
  // The signIn() Promise handles the response directly.
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const initAppleAuth = async () => {
      if (!globalThis.window?.AppleID) return false;

      if (!APPLE_SERVICE_ID) {
        console.warn('[AppleAuth] EXPO_PUBLIC_APPLE_SERVICE_ID is missing on web');
        return false;
      }

      // Generate CSRF state and nonce for replay-attack prevention per Apple's guidelines
      const state = generateRandomString(32);
      const rawNonce = generateRandomString(32);
      const hashedNonce = await sha256(rawNonce);

      // Store raw values for verification when response arrives
      sessionStorage.setItem(APPLE_STATE_KEY, state);
      sessionStorage.setItem(APPLE_NONCE_KEY, rawNonce);

      // redirectURI must be registered in Apple Developer Console.
      // With usePopup: true, Apple communicates via postMessage (no actual redirect).
      const apiBase = APPLE_API_BASE_URL.replace(/\/+$/, '');
      const redirectURI = `${apiBase}/api/v1/auth/apple/callback`;
      globalThis.window.AppleID.auth.init({
        clientId: APPLE_SERVICE_ID,
        scope: 'email name',
        redirectURI,
        usePopup: true,
        state,
        nonce: hashedNonce,
        responseType: 'code id_token',
      });

      return true;
    };

    // Try to initialise immediately (SDK may already be loaded)
    void initAppleAuth().then((ok) => {
      if (ok) return;

      if (typeof document === 'undefined') return;

      const existingScript = document.getElementById('apple-signin-script') as HTMLScriptElement | null;
      if (existingScript) {
        existingScript.addEventListener('load', () => void initAppleAuth(), { once: true });
        return;
      }

      const script = document.createElement('script');
      script.id = 'apple-signin-script';
      script.src = 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js';
      script.async = true;
      script.onload = () => void initAppleAuth();
      document.head.appendChild(script);
    });
  }, []);

  // Handle Apple login (iOS native only)
  const handleAppleLogin = async () => {
    setIsLoading(true);
    setError(null);

    try {
      if (Platform.OS === 'web') {
        if (!APPLE_SERVICE_ID) {
          setIsLoading(false);
          setError('Apple sign-in is not configured for web yet.');
          return;
        }

        if (!globalThis.window?.AppleID?.auth) {
          setIsLoading(false);
          setError('Apple sign-in is still loading. Please try again.');
          return;
        }

        const webResult = await globalThis.window.AppleID.auth.signIn();
        await handleAppleWebSuccess(webResult);
        return;
      }

      // iOS: Use native Apple Authentication with nonce for replay-attack prevention
      const rawNonce = generateRandomString(32);
      const hashedNonce = await sha256(rawNonce);

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });

      const identityToken = credential.identityToken;
      if (!identityToken) {
        throw new Error('No identity token received from Apple');
      }
      const fullName = credential.fullName
        ? `${credential.fullName.givenName || ''} ${credential.fullName.familyName || ''}`.trim()
        : undefined;
      const authCode = credential.authorizationCode ?? undefined;
      await sendAppleTokenToBackend(identityToken, fullName, rawNonce, authCode);
    } catch (err: any) {
      setIsLoading(false);
      // User cancelled — ignore silently (ERR_CANCELED covers iPad sheet dismiss)
      if (
        err?.code === 'ERR_REQUEST_CANCELED' ||
        err?.code === 'ERR_CANCELED' ||
        err?.error === 'popup_closed_by_user' ||
        String(err?.code) === '1001' // Apple: user canceled
      ) {
        return;
      }
      const message = err instanceof Error ? err.message : 'Apple sign-in failed.';
      const errorCode = String(err?.code);
      // Error 1000 = unknown error — can occur on both simulator and real devices
      // when Apple ID is not signed in, or the entitlement is misconfigured.
      if (Platform.OS === 'ios' && (errorCode === '1000' || message.includes('AuthorizationError error 1000'))) {
        setError('Apple Sign In encountered an error. Please ensure you are signed in to your Apple ID in Settings, then try again. You can also try Google Sign In.');
        return;
      }
      console.error('[AppleAuth] Sign-in error:', err?.code, message);
      setError(`${message} Please try again or use Google Sign In.`);
    }
  };

  // Handle tap outside inputs to dismiss keyboard (only on native)
  const handleOutsideTap = useCallback(() => {
    if (Platform.OS !== 'web') {
      Keyboard.dismiss();
    }
  }, []);

  const openLegalPage = useCallback(async (path: 'terms-of-service.html' | 'privacy-policy.html') => {
    try {
      setError(null);
      await Linking.openURL(`${legalBaseUrl}/${path}`);
    } catch {
      setError('Unable to open legal page. Please try again later.');
    }
  }, [legalBaseUrl]);

  const handleOpenTerms = useCallback(() => {
    openLegalPage('terms-of-service.html');
  }, [openLegalPage]);

  const handleOpenPrivacy = useCallback(() => {
    openLegalPage('privacy-policy.html');
  }, [openLegalPage]);

  const handleEmailLogin = useCallback(async () => {
    if (!email.trim() || !password.trim()) {
      setError('Please enter your email and password.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.post<{ token: string; email: string; isNewUser?: boolean; user?: any }>('/api/v1/auth/login', {
        loginType: 'LOCAL',
        email: email.trim(),
        password: password.trim(),
      }, { timeout: 60000 });
      await handleLoginSuccess(data, 'password');
    } catch (err: any) {
      setIsLoading(false);
      setError(err instanceof Error ? err.message : 'Sign-in failed. Please check your credentials.');
    }
  }, [email, password, handleLoginSuccess]);

  return (
    <View style={styles.gradient}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top + SPACING.xl, paddingBottom: insets.bottom + SPACING.xl },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          onScrollBeginDrag={handleOutsideTap}
        >
          <View style={styles.authStack}>
            <Animated.View entering={FadeInUp.duration(500).delay(100)} style={styles.card}>
              {/* Logo Section */}
              <View style={styles.logoSection}>
                <Animated.View entering={ZoomIn.duration(420).delay(220)} style={styles.logoOrb}>
                  <View style={styles.logoOrbRing} />
                  <Image
                    source={require('@/../assets/app-icon-1024.png')}
                    style={styles.appLogo}
                    contentFit="contain"
                  />
                </Animated.View>
                <Text variant="label" weight="bold" style={styles.logoKicker}>MEMBER ACCESS</Text>
                <Text variant="heading1" weight="bold" style={styles.title}>Metriful</Text>
                <Text variant="body" style={styles.subtitle}>
                  Sign in to continue with a brighter mobile dashboard for nutrition, training, and weekly progress.
                </Text>
              </View>

              {/* Error Message */}
              {error && (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              {/* Social Login */}
              <View style={styles.socialSection}>
                <View style={styles.authSectionHeader}>
                  <Text variant="heading4" weight="semibold" style={styles.authSectionTitle}>Continue securely</Text>
                  <Text variant="caption" style={styles.authSectionSubtitle}>Use Apple or Google for the fastest setup</Text>
                </View>
                <View style={styles.socialButtonsStack}>
                  {shouldShowAppleButton && Platform.OS === 'ios' && (
                    <AppleAuthentication.AppleAuthenticationButton
                      buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                      buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                      cornerRadius={RADII.md}
                      style={styles.appleNativeButton}
                      onPress={handleAppleLogin}
                    />
                  )}
                  {shouldShowAppleButton && Platform.OS === 'web' && (
                    <Pressable
                      onPress={handleAppleLogin}
                      disabled={isLoading}
                      style={({ pressed }) => [
                        styles.appleWebFallbackButton,
                        pressed && styles.socialButtonPressed,
                        isLoading && styles.buttonDisabled,
                      ]}
                    >
                      <Ionicons name="logo-apple" size={20} color={COLORS.white} />
                      <Text style={[styles.socialButtonText, styles.whiteSocialButtonText]}>Continue with Apple</Text>
                    </Pressable>
                  )}
                  <View style={styles.divider}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>or</Text>
                    <View style={styles.dividerLine} />
                  </View>
                  <SocialButton
                    onPress={handleGoogleLogin}
                    disabled={!googleRequest || isLoading}
                  />

                  {/* Email/Password Login (for App Store reviewers and fallback) */}
                  <Pressable onPress={() => setShowEmailLogin(!showEmailLogin)}>
                    <Text variant="caption" weight="semibold" style={styles.emailToggleText}>
                      {showEmailLogin ? 'Hide email sign in' : 'Sign in with email'}
                    </Text>
                  </Pressable>

                  {showEmailLogin && (
                    <View style={styles.emailLoginSection}>
                      <View style={styles.inputContainer}>
                        <View style={styles.inputIconContainer}>
                          <Envelope size={18} color={COLORS.gray400} />
                        </View>
                        <TextInput
                          style={styles.input}
                        placeholder="Email"
                        placeholderTextColor={COLORS.gray400}
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        inputMode="email"
                        autoCapitalize="none"
                        autoCorrect={false}
                        editable={!isLoading}
                        />
                      </View>
                      <View style={styles.inputContainer}>
                        <View style={styles.inputIconContainer}>
                          <Lock size={18} color={COLORS.gray400} />
                        </View>
                        <TextInput
                          style={styles.input}
                          placeholder="Password"
                          placeholderTextColor={COLORS.gray400}
                          value={password}
                          onChangeText={setPassword}
                          secureTextEntry
                          editable={!isLoading}
                          onSubmitEditing={handleEmailLogin}
                        />
                      </View>
                      <Pressable
                        style={({ pressed }) => [
                          styles.signInButton,
                          pressed && styles.signInButtonPressed,
                          isLoading && styles.signInButtonDisabled,
                        ]}
                        onPress={handleEmailLogin}
                        disabled={isLoading}
                      >
                        <View style={styles.signInButtonFill}>
                          <Text style={styles.signInButtonText}>
                            {isLoading ? 'Signing in...' : 'Sign In'}
                          </Text>
                        </View>
                      </Pressable>
                    </View>
                  )}
                </View>
              </View>

              <View style={styles.supportPanel}>
                <View style={styles.supportRow}>
                  <ShieldCheck size={14} color={COLORS.brand600} />
                  <Text variant="caption" style={styles.supportText}>
                    Private by default
                  </Text>
                </View>
                <View style={styles.supportRow}>
                  <Lightning size={14} color={COLORS.brand600} />
                  <Text variant="caption" style={styles.supportText}>
                    Smart logging, clear targets, better weekly insight
                  </Text>
                </View>
              </View>

              {/* Footer */}
              <View style={styles.footer}>
                <Text variant="caption" style={styles.legalText}>
                  By continuing, you agree to our{' '}
                  <Text variant="caption" weight="semibold" style={styles.legalLink} onPress={handleOpenTerms}>Terms of Service</Text> and{' '}
                  <Text variant="caption" weight="semibold" style={styles.legalLink} onPress={handleOpenPrivacy}>Privacy Policy</Text>.
                </Text>
              </View>
            </Animated.View>
          </View>
          </ScrollView>
        </KeyboardAvoidingView>
    </View>
  );
}

// ============================================================================
// Styles
// ============================================================================
const styles = StyleSheet.create({
  gradient: {
    flex: 1,
    backgroundColor: '#F8F7F3',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
  },
  authStack: {
    width: '100%',
    maxWidth: 460,
    gap: SPACING.lg,
  },
  brandShowcase: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: SPACING.md,
  },
  brandHaloSoft: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(17,17,17,0.03)',
  },
  brandHaloWarm: {
    position: 'absolute',
    top: 24,
    width: 164,
    height: 164,
    borderRadius: 82,
    backgroundColor: 'rgba(17,17,17,0.05)',
  },
  brandOrb: {
    width: 94,
    height: 94,
    borderRadius: 47,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: EXPERIENCE_COLORS.glassStrong,
    borderWidth: 1,
    borderColor: EXPERIENCE_COLORS.stroke,
    shadowColor: EXPERIENCE_COLORS.shadow,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.16,
    shadowRadius: 28,
    elevation: 10,
  },
  brandOrbLogo: {
    width: 72,
    height: 72,
  },
  brandPreviewCard: {
    width: '100%',
    marginTop: -12,
    borderRadius: 30,
    padding: 14,
    backgroundColor: EXPERIENCE_COLORS.glass,
    borderWidth: 1,
    borderColor: EXPERIENCE_COLORS.stroke,
  },
  brandPreviewImage: {
    width: '100%',
    height: 140,
  },
  brandBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  brandBadge: {
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderWidth: 1,
    borderColor: EXPERIENCE_COLORS.stroke,
  },
  brandBadgeText: {
    color: EXPERIENCE_COLORS.ink,
  },
  card: {
    backgroundColor: EXPERIENCE_COLORS.glassStrong,
    borderRadius: 30,
    paddingHorizontal: SPACING['2xl'],
    paddingVertical: SPACING['4xl'],
    shadowColor: EXPERIENCE_COLORS.shadow,
    shadowOffset: { width: 0, height: 22 },
    shadowOpacity: 0.16,
    shadowRadius: 36,
    elevation: 12,
    borderWidth: 1,
    borderColor: EXPERIENCE_COLORS.stroke,
    maxWidth: 410,
    minHeight: Platform.OS === 'web' ? 620 : undefined,
    width: '100%',
    justifyContent: 'space-between' as const,
  },

  // Logo Section
  logoSection: {
    alignItems: 'center',
    marginBottom: SPACING['2xl'],
    gap: SPACING.xs,
  },
  logoOrb: {
    width: 112,
    height: 112,
    borderRadius: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderWidth: 1,
    borderColor: EXPERIENCE_COLORS.stroke,
  },
  logoOrbRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 56,
    borderWidth: 8,
    borderColor: 'rgba(255,132,75,0.10)',
  },
  appLogo: {
    width: 82,
    height: 82,
  },
  logoKicker: {
    color: EXPERIENCE_COLORS.inkSoft,
    letterSpacing: 1.4,
    marginBottom: 2,
  },
  title: {
    color: EXPERIENCE_COLORS.ink,
    textAlign: 'center',
  },
  subtitle: {
    color: EXPERIENCE_COLORS.inkSoft,
    textAlign: 'center',
    maxWidth: 300,
  },

  // Error
  errorContainer: {
    backgroundColor: COLORS.errorBg,
    borderRadius: RADII.lg,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(208,92,65,0.14)',
  },
  errorText: {
    color: COLORS.error,
    textAlign: 'center',
  },

  // Form Section
  formSection: {
    gap: SPACING.lg,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: EXPERIENCE_COLORS.stroke,
    height: 52,
  },
  inputContainerFocused: {
    borderColor: EXPERIENCE_COLORS.coral,
    backgroundColor: 'rgba(255,255,255,0.96)',
  },
  inputIconContainer: {
    paddingLeft: SPACING.md,
    paddingRight: SPACING.sm,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 15,
    color: EXPERIENCE_COLORS.ink,
  },
  eyeButton: {
    padding: SPACING.md,
  },
  forgotPasswordContainer: {
    alignSelf: 'flex-end',
    marginTop: -SPACING.sm,
  },
  forgotPasswordText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.brand600,
  },
  signInButton: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#111111',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 8,
  },
  signInButtonFill: {
    minHeight: 52,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111111',
  },
  signInButtonDisabled: {
    opacity: 0.48,
    shadowOpacity: 0,
    elevation: 0,
  },
  signInButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  signInButtonText: {
    color: COLORS.white,
  },
  loadingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },

  // Divider
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: SPACING.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: EXPERIENCE_COLORS.stroke,
  },
  dividerText: {
    fontSize: 12,
    fontWeight: '500',
    color: EXPERIENCE_COLORS.inkSoft,
    marginHorizontal: SPACING.lg,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Social Section
  socialSection: {
    gap: SPACING.lg,
    minHeight: 220,
    justifyContent: 'center',
  },
  socialButtonsStack: {
    gap: SPACING.sm,
  },
  authSectionHeader: {
    alignItems: 'center',
    gap: SPACING.xs,
  },
  authSectionTitle: {
    color: EXPERIENCE_COLORS.ink,
  },
  authSectionSubtitle: {
    color: EXPERIENCE_COLORS.inkSoft,
    textAlign: 'center',
  },
  appleNativeButton: {
    width: '100%',
    height: 54,
  },
  appleWebFallbackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
    height: 54,
    borderRadius: 20,
    backgroundColor: EXPERIENCE_COLORS.ink,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 54,
    borderRadius: 20,
    gap: SPACING.md,
  },
  socialButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  googleButton: {
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderWidth: 1,
    borderColor: EXPERIENCE_COLORS.stroke,
  },
  socialButtonText: {
    color: EXPERIENCE_COLORS.ink,
  },
  whiteSocialButtonText: {
    color: COLORS.white,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  emailToggleText: {
    color: EXPERIENCE_COLORS.inkSoft,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
  emailLoginSection: {
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },

  supportPanel: {
    gap: SPACING.sm,
    marginTop: SPACING.lg,
    padding: SPACING.md,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderWidth: 1,
    borderColor: EXPERIENCE_COLORS.stroke,
  },
  supportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  supportText: {
    color: EXPERIENCE_COLORS.inkSoft,
  },

  // Footer
  footer: {
    marginTop: SPACING.xl,
    alignItems: 'center',
    gap: SPACING.md,
  },
  legalText: {
    color: EXPERIENCE_COLORS.inkSoft,
    textAlign: 'center',
    paddingHorizontal: SPACING.lg,
  },
  legalLink: {
    color: EXPERIENCE_COLORS.ink,
    textDecorationLine: 'underline',
  },
});
