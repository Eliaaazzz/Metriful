import { Ionicons } from '@expo/vector-icons';
import { EnvelopeSimple, Eye, EyeSlash, Lock, ShieldCheck } from 'phosphor-react-native';
import { useNavigation } from '@react-navigation/native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as AuthSession from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
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
import { api } from '@/services/apiClient';
import { startBackendWarmup } from '@/services/backendWarmup';
import { queryClient } from '@/services/queryClient';
import { storeGoogleOAuthState } from '@/services/webGoogleRedirect';
import { useAuthStore } from '@/stores';
import { BRAND_COLORS, EXPERIENCE_COLORS, radii, spacing } from '@/utils';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_IOS_CLIENT_ID = EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
const GOOGLE_ANDROID_CLIENT_ID = EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;
const GOOGLE_WEB_CLIENT_ID = EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const APPLE_SERVICE_ID = EXPO_PUBLIC_APPLE_SERVICE_ID || process.env.EXPO_PUBLIC_APPLE_SERVICE_ID;
const APPLE_API_BASE_URL = API_BASE_URL || process.env.EXPO_PUBLIC_API_BASE_URL || 'https://aurafitness.org';

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

const APPLE_STATE_KEY = 'apple_signup_state';
const APPLE_NONCE_KEY = 'apple_signup_nonce';
const brandMotionIllustration = require('@/../assets/illustrations/brand-motion-coach.svg');

type AppleWebSignInPayload = {
  authorization?: { code?: string; id_token?: string; state?: string };
  user?: { email?: string; name?: { firstName?: string; lastName?: string } };
};

const getAppleFullName = (payload?: AppleWebSignInPayload['user']): string | undefined => {
  const firstName = payload?.name?.firstName?.trim();
  const lastName = payload?.name?.lastName?.trim();
  if (!firstName && !lastName) return undefined;
  return `${firstName || ''} ${lastName || ''}`.trim() || undefined;
};

const generateRandomString = (length = 32): string => {
  const array = new Uint8Array(length);
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(array);
  } else {
    for (let i = 0; i < length; i++) array[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
};

const sha256 = async (input: string): Promise<string> => {
  try {
    return await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      input,
      { encoding: Crypto.CryptoEncoding.HEX },
    );
  } catch {
    // fallback
  }
  if (typeof globalThis.crypto?.subtle?.digest === 'function') {
    const buffer = new TextEncoder().encode(input);
    const hash = await globalThis.crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, '0')).join('');
  }
  return input;
};

// ── Icons ──────────────────────────────────────────────
const GoogleIcon = () => (
  <Svg width={20} height={20} viewBox="0 0 24 24">
    <Path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <Path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <Path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
    <Path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </Svg>
);

// ── Input Field ────────────────────────────────────────
interface InputFieldProps {
  icon: React.ReactNode;
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  secureTextEntry?: boolean;
  showToggle?: boolean;
  onToggleSecure?: () => void;
  isSecureVisible?: boolean;
  keyboardType?: 'default' | 'email-address';
}

function InputField({
  icon, placeholder, value, onChangeText,
  secureTextEntry = false, showToggle = false, onToggleSecure,
  isSecureVisible = false, keyboardType = 'default',
}: InputFieldProps) {
  const [isFocused, setIsFocused] = useState(false);
  return (
    <View style={[styles.inputContainer, isFocused && styles.inputContainerFocused]}>
      {icon}
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={BRAND_COLORS.textMuted}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        secureTextEntry={secureTextEntry && !isSecureVisible}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType={keyboardType}
        inputMode={keyboardType === 'email-address' ? 'email' : 'text'}
      />
      {showToggle ? (
        <Pressable onPress={onToggleSecure} hitSlop={8}>
          {isSecureVisible ? <EyeSlash size={18} color={BRAND_COLORS.textMuted} /> : <Eye size={18} color={BRAND_COLORS.textMuted} />}
        </Pressable>
      ) : null}
    </View>
  );
}

// ============================================================================
// Register Screen
// ============================================================================
export default function RegisterScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const webGoogleHandoffStarted = React.useRef(false);

  // ── State ──────────────────────────────────────────
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isAppleNativeAvailable, setIsAppleNativeAvailable] = useState(Platform.OS !== 'ios');

  const isEmailValid = useMemo(() => email.trim().length > 0 && email.includes('@'), [email]);
  const isPasswordValid = useMemo(() => password.length >= 8, [password]);
  const doPasswordsMatch = useMemo(() => password === confirmPassword, [password, confirmPassword]);
  const isFormValid = isEmailValid && isPasswordValid && doPasswordsMatch;
  const shouldShowAppleButton = Platform.OS === 'web' || (Platform.OS === 'ios' && isAppleNativeAvailable);

  // ── OAuth config ───────────────────────────────────
  const canonicalWebOrigin = useMemo(() => {
    if (Platform.OS === 'web' && typeof globalThis.window !== 'undefined') {
      return globalThis.window.location.origin;
    }
    return 'https://aurafitness.org';
  }, []);

  const currentWebOrigin = useMemo(() => {
    if (Platform.OS === 'web' && typeof globalThis.window !== 'undefined') {
      return globalThis.window.location.origin;
    }
    return canonicalWebOrigin;
  }, [canonicalWebOrigin]);

  const redirectUri = useMemo(() => {
    if (Platform.OS === 'web') {
      const pathname = typeof globalThis.window !== 'undefined' && globalThis.window.location?.pathname
        ? globalThis.window.location.pathname : '/';
      return `${canonicalWebOrigin}${pathname}`;
    }
    if (Platform.OS === 'ios' && GOOGLE_IOS_CLIENT_ID) {
      const reversedClientId = GOOGLE_IOS_CLIENT_ID.split('.').reverse().join('.');
      return `${reversedClientId}:/oauthredirect`;
    }
    if (Platform.OS === 'android' && GOOGLE_ANDROID_CLIENT_ID) {
      const reversedClientId = GOOGLE_ANDROID_CLIENT_ID.split('.').reverse().join('.');
      return `${reversedClientId}:/oauthredirect`;
    }
    return AuthSession.makeRedirectUri({ scheme: 'com.elia.aurafit' });
  }, [canonicalWebOrigin]);

  const [googleRequest, googleResponse, promptGoogleAsync] = Google.useIdTokenAuthRequest({
    iosClientId: GOOGLE_IOS_CLIENT_ID,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID,
    webClientId: GOOGLE_WEB_CLIENT_ID,
    redirectUri,
    scopes: ['profile', 'email'],
    prompt: AuthSession.Prompt.Login,
  });

  // ── Pre-warm backend ───────────────────────────────
  useEffect(() => {
    void startBackendWarmup();
  }, []);

  // ── Apple availability check ───────────────────────
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    let cancelled = false;
    AppleAuthentication.isAvailableAsync()
      .then((available) => { if (!cancelled) setIsAppleNativeAvailable(available); })
      .catch(() => { if (!cancelled) setIsAppleNativeAvailable(false); });
    return () => { cancelled = true; };
  }, []);

  // ── Login success handler ──────────────────────────
  const handleLoginSuccess = useCallback(async (data: {
    token: string; email: string; isNewUser?: boolean;
    user?: { userId: string; username: string; currentStreak: number; level: string; timeBucket: number };
  }, method: 'google' | 'apple') => {
    try {
      queryClient.clear();
      const inlineUserInfo = data.user ? {
        userId: data.user.userId, email: data.email, username: data.user.username,
        currentStreak: data.user.currentStreak, level: data.user.level, timeBucket: data.user.timeBucket,
      } : { userId: '', email: data.email, username: '', currentStreak: 0, level: '', timeBucket: 0 };

      await useAuthStore.getState().signIn(data.token, inlineUserInfo);
      const authState = useAuthStore.getState();
      if (!authState.isAuthenticated) throw new Error('Login succeeded but authentication state was not set.');

      trackEvent(data.isNewUser ? 'sign_up' : 'login', { method });

      setIsLoading(false);
      const destination = data.isNewUser ? 'Onboarding' : (Platform.OS === 'web' ? 'Splash' : 'Main');
      navigation.reset({
        index: 0,
        routes: [{ name: destination } as any],
      });
    } catch (err) {
      setIsLoading(false);
      setError(err instanceof Error ? err.message : 'Sign-in completed but navigation failed.');
    }
  }, [navigation]);

  // ── Google token → backend ─────────────────────────
  const sendGoogleTokenToBackend = useCallback(async (idToken: string) => {
    setIsLoading(true);
    setError(null);
    const MAX_ATTEMPTS = 2;
    let lastError: any;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const data = await api.post<{ token: string; email: string; isNewUser?: boolean; user?: any }>('/api/v1/auth/login', {
          loginType: 'GOOGLE', idToken,
        }, { timeout: 60000 });
        await handleLoginSuccess(data, 'google');
        return;
      } catch (err: any) {
        lastError = err;
        const isRetryable = err?.status === 408 || err?.status === 503 || err?.status === 502 || !err?.status;
        if (attempt < MAX_ATTEMPTS && isRetryable) { await new Promise(r => setTimeout(r, 2000)); continue; }
      }
    }
    setIsLoading(false);
    const msg = lastError instanceof Error ? lastError.message : 'Google sign-in failed.';
    setError(`${msg} Please check your internet connection and try again.`);
  }, [handleLoginSuccess]);

  // ── Apple token → backend ──────────────────────────
  const sendAppleTokenToBackend = useCallback(async (idToken: string, fullName?: string, nonce?: string, authorizationCode?: string) => {
    setIsLoading(true);
    setError(null);
    const MAX_ATTEMPTS = 2;
    let lastError: any;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const data = await api.post<{ token: string; email: string; isNewUser?: boolean; user?: any }>('/api/v1/auth/login', {
          loginType: 'APPLE', idToken, fullName,
          ...(nonce ? { nonce } : {}),
          ...(authorizationCode ? { authorizationCode } : {}),
        }, { timeout: 60000 });
        await handleLoginSuccess(data, 'apple');
        return;
      } catch (err: any) {
        lastError = err;
        const isRetryable = err?.status === 408 || err?.status === 503 || err?.status === 502 || !err?.status;
        if (attempt < MAX_ATTEMPTS && isRetryable) { await new Promise(r => setTimeout(r, 2000)); continue; }
      }
    }
    setIsLoading(false);
    const msg = lastError instanceof Error ? lastError.message : 'Apple sign-in failed.';
    setError(`${msg} Please check your internet connection and try again.`);
  }, [handleLoginSuccess]);

  // ── Handle Apple web success ───────────────────────
  const handleAppleWebSuccess = useCallback(async (payload?: AppleWebSignInPayload) => {
    const identityToken = payload?.authorization?.id_token;
    if (!identityToken) { setIsLoading(false); setError('No identity token received from Apple.'); return; }
    if (Platform.OS === 'web') {
      const expectedState = sessionStorage.getItem(APPLE_STATE_KEY);
      const receivedState = payload?.authorization?.state;
      if (expectedState && receivedState && expectedState !== receivedState) {
        setIsLoading(false); setError('Sign-in verification failed.'); return;
      }
      const rawNonce = sessionStorage.getItem(APPLE_NONCE_KEY) ?? undefined;
      sessionStorage.removeItem(APPLE_STATE_KEY);
      sessionStorage.removeItem(APPLE_NONCE_KEY);
      await sendAppleTokenToBackend(identityToken, getAppleFullName(payload?.user), rawNonce, payload?.authorization?.code ?? undefined);
      return;
    }
    await sendAppleTokenToBackend(identityToken, getAppleFullName(payload?.user), undefined, payload?.authorization?.code ?? undefined);
  }, [sendAppleTokenToBackend]);

  // ── Google response handler ────────────────────────
  useEffect(() => {
    if (googleResponse?.type === 'success') {
      const idToken = googleResponse.params?.id_token || googleResponse.authentication?.idToken;
      if (idToken) sendGoogleTokenToBackend(idToken);
      else setError('Google sign-in did not return an ID token.');
    } else if (googleResponse?.type === 'error') {
      setError(googleResponse.error?.message || 'Google sign-in failed.');
    } else if (googleResponse?.type === 'dismiss') {
      setIsLoading(false);
    }
  }, [googleResponse, sendGoogleTokenToBackend]);

  // ── Google redirect handler (Safari) ───────────────
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const hash = window.location.hash;
    if (!hash || hash.length < 2) return;
    const params = new URLSearchParams(hash.substring(1));
    const idToken = params.get('id_token');
    if (!idToken) return;
    const expectedState = sessionStorage.getItem('google_oauth_state');
    const receivedState = params.get('state');
    if (expectedState && receivedState && expectedState !== receivedState) {
      setError('Google sign-in verification failed.');
      window.history.replaceState(null, '', window.location.pathname);
      sessionStorage.removeItem('google_oauth_state');
      return;
    }
    sessionStorage.removeItem('google_oauth_state');
    window.history.replaceState(null, '', window.location.pathname);
    sendGoogleTokenToBackend(idToken);
  }, [sendGoogleTokenToBackend]);

  // ── Google web handoff ─────────────────────────────
  useEffect(() => {
    if (Platform.OS !== 'web' || !googleRequest?.url || typeof window === 'undefined') return;
    const search = new URLSearchParams(window.location.search);
    if (search.get('auth') !== 'google' || webGoogleHandoffStarted.current) return;
    webGoogleHandoffStarted.current = true;
    storeGoogleOAuthState(googleRequest.state);
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.hash || ''}`);
    window.location.href = googleRequest.url;
  }, [googleRequest]);

  // ── Apple web SDK init ─────────────────────────────
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const initAppleAuth = async () => {
      if (!globalThis.window?.AppleID || !APPLE_SERVICE_ID) return false;
      const state = generateRandomString(32);
      const rawNonce = generateRandomString(32);
      const hashedNonce = await sha256(rawNonce);
      sessionStorage.setItem(APPLE_STATE_KEY, state);
      sessionStorage.setItem(APPLE_NONCE_KEY, rawNonce);
      const apiBase = APPLE_API_BASE_URL.replace(/\/+$/, '');
      globalThis.window.AppleID.auth.init({
        clientId: APPLE_SERVICE_ID, scope: 'email name',
        redirectURI: `${apiBase}/api/v1/auth/apple/callback`,
        usePopup: true, state, nonce: hashedNonce, responseType: 'code id_token',
      });
      return true;
    };
    void initAppleAuth().then((ok) => {
      if (ok || typeof document === 'undefined') return;
      const existing = document.getElementById('apple-signin-script') as HTMLScriptElement | null;
      if (existing) { existing.addEventListener('load', () => void initAppleAuth(), { once: true }); return; }
      const script = document.createElement('script');
      script.id = 'apple-signin-script';
      script.src = 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js';
      script.async = true;
      script.onload = () => void initAppleAuth();
      document.head.appendChild(script);
    });
  }, []);

  // ── Button handlers ────────────────────────────────
  const handleGoogleSignup = useCallback(async () => {
    if (!googleRequest?.url) return;
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && canonicalWebOrigin && currentWebOrigin && currentWebOrigin !== canonicalWebOrigin) {
        window.location.href = `${canonicalWebOrigin}${window.location.pathname || '/'}?auth=google`;
        return;
      }
      storeGoogleOAuthState(googleRequest.state);
      window.location.href = googleRequest.url;
      return;
    }
    try {
      await promptGoogleAsync({ preferEphemeralSession: true });
    } catch (err: any) {
      if (err?.code === 'ERR_REQUEST_CANCELED' || err?.code === 'ERR_CANCELED') return;
      setError(err instanceof Error ? err.message : 'Google sign-in failed.');
    }
  }, [canonicalWebOrigin, currentWebOrigin, googleRequest, promptGoogleAsync]);

  const handleAppleSignup = async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (Platform.OS === 'web') {
        if (!APPLE_SERVICE_ID) { setIsLoading(false); setError('Apple sign-in is not configured for web.'); return; }
        if (!globalThis.window?.AppleID?.auth) { setIsLoading(false); setError('Apple sign-in is still loading.'); return; }
        const webResult = await globalThis.window.AppleID.auth.signIn();
        await handleAppleWebSuccess(webResult);
        return;
      }
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
      if (!identityToken) throw new Error('No identity token received from Apple');
      const fullName = credential.fullName
        ? `${credential.fullName.givenName || ''} ${credential.fullName.familyName || ''}`.trim()
        : undefined;
      await sendAppleTokenToBackend(identityToken, fullName, rawNonce, credential.authorizationCode ?? undefined);
    } catch (err: any) {
      setIsLoading(false);
      if (err?.code === 'ERR_REQUEST_CANCELED' || err?.code === 'ERR_CANCELED' ||
          err?.error === 'popup_closed_by_user' || String(err?.code) === '1001') return;
      if (Platform.OS === 'ios' && (String(err?.code) === '1000' || String(err?.message).includes('1000'))) {
        setError('Apple Sign In encountered an error. Please ensure you are signed in to your Apple ID in Settings.');
        return;
      }
      setError(err instanceof Error ? err.message : 'Apple sign-in failed.');
    }
  };

  // ── Email register ─────────────────────────────────
  const handleRegister = async () => {
    if (!isFormValid) return;
    setIsLoading(true);
    setError(null);
    try {
      const authResult = await api.post<{ token: string; email: string }>('/api/v1/auth/register', {
        email: email.trim().toLowerCase(), password,
      });
      queryClient.clear();
      await useAuthStore.getState().signIn(authResult.token, {
        userId: '', email: authResult.email, username: '', currentStreak: 0, level: 'beginner', timeBucket: 0,
      });
      trackEvent('sign_up', { method: 'password' });
      navigation.reset({ index: 0, routes: [{ name: 'Onboarding' }] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Render ─────────────────────────────────────────
  return (
    <View style={styles.screen}>
      <KeyboardAvoidingView style={styles.keyboardView} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.authStack}>
            <View style={styles.card}>
            {/* Logo */}
            <View style={styles.logoSection}>
              <View style={styles.logoOrb}>
                <View style={styles.logoOrbRing} />
                <Image source={require('@/../assets/app-icon-1024.png')} style={styles.appLogo} contentFit="contain" />
              </View>
              <Text variant="label" weight="bold" style={styles.logoKicker}>START YOUR PLAN</Text>
              <Text variant="heading1" weight="bold" style={styles.title}>Create your account</Text>
              <Text variant="body" color={EXPERIENCE_COLORS.inkSoft} style={styles.subtitle}>
                Start with a brighter mobile flow for food, workouts, and progress.
              </Text>
            </View>

            {/* Error */}
            {error ? (
              <View style={styles.errorContainer}>
                <Text variant="caption" weight="medium" style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Social OAuth */}
            <View style={styles.socialSection}>
              {shouldShowAppleButton && Platform.OS === 'ios' && (
                <AppleAuthentication.AppleAuthenticationButton
                  buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                  buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                  cornerRadius={radii.lg}
                  style={styles.appleNativeButton}
                  onPress={handleAppleSignup}
                />
              )}
              {shouldShowAppleButton && Platform.OS === 'web' && (
                <Pressable
                  onPress={handleAppleSignup}
                  disabled={isLoading}
                  style={({ pressed }) => [styles.appleWebButton, pressed && styles.socialButtonPressed, isLoading && styles.buttonDisabled]}
                >
                  <Ionicons name="logo-apple" size={20} color="#FFFFFF" />
                  <Text variant="body" weight="semibold" style={styles.whiteButtonText}>Continue with Apple</Text>
                </Pressable>
              )}

              <Pressable
                onPress={handleGoogleSignup}
                disabled={!googleRequest || isLoading}
                style={({ pressed }) => [
                  styles.googleButton,
                  pressed && styles.socialButtonPressed,
                  (!googleRequest || isLoading) && styles.buttonDisabled,
                ]}
              >
                <GoogleIcon />
                <Text variant="body" weight="semibold" style={styles.googleButtonText}>Continue with Google</Text>
              </Pressable>
            </View>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text variant="caption" style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Email toggle */}
            <Pressable onPress={() => setShowEmailForm(!showEmailForm)}>
              <Text variant="caption" weight="semibold" style={styles.emailToggle}>
                {showEmailForm ? 'Hide email sign up' : 'Sign up with email'}
              </Text>
            </Pressable>

            {/* Email form */}
            {showEmailForm && (
              <View style={styles.formSection}>
                <InputField
                  icon={<EnvelopeSimple size={18} color={BRAND_COLORS.textMuted} />}
                  placeholder="Email address"
                  value={email}
                  onChangeText={(t) => { setEmail(t); setError(null); }}
                  keyboardType="email-address"
                />
                <InputField
                  icon={<Lock size={18} color={BRAND_COLORS.textMuted} />}
                  placeholder="Password (min 8 characters)"
                  value={password}
                  onChangeText={(t) => { setPassword(t); setError(null); }}
                  secureTextEntry
                  showToggle
                  isSecureVisible={showPassword}
                  onToggleSecure={() => setShowPassword((v) => !v)}
                />
                <InputField
                  icon={<ShieldCheck size={18} color={BRAND_COLORS.textMuted} />}
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChangeText={(t) => { setConfirmPassword(t); setError(null); }}
                  secureTextEntry
                  showToggle
                  isSecureVisible={showConfirmPassword}
                  onToggleSecure={() => setShowConfirmPassword((v) => !v)}
                />
                <Pressable
                  onPress={handleRegister}
                  disabled={!isFormValid || isLoading}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    (!isFormValid || isLoading) && styles.primaryButtonDisabled,
                    pressed && isFormValid && !isLoading && styles.primaryButtonPressed,
                  ]}
                >
                  <View style={styles.primaryButtonFill}>
                    <Text variant="body" weight="bold" style={styles.whiteButtonText}>
                      {isLoading ? 'Creating account...' : 'Create account'}
                    </Text>
                  </View>
                </Pressable>
              </View>
            )}

            {/* Footer */}
            <View style={styles.footer}>
              <Text variant="caption" color={BRAND_COLORS.textSecondary}>Already have an account?</Text>
              <Pressable onPress={() => navigation.goBack()}>
                <Text variant="caption" weight="semibold" style={styles.footerLink}>Sign in</Text>
              </Pressable>
            </View>
            </View>
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
  screen: { flex: 1, backgroundColor: '#F8F7F3' },
  keyboardView: { flex: 1 },
  scrollContent: {
    flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.lg,
  },
  authStack: {
    width: '100%',
    maxWidth: 460,
    gap: spacing.lg,
  },
  brandShowcase: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.md,
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
  card: {
    width: '100%', maxWidth: 420, backgroundColor: EXPERIENCE_COLORS.glassStrong,
    borderRadius: 30, borderWidth: 1, borderColor: EXPERIENCE_COLORS.stroke,
    padding: spacing.xl, gap: spacing.lg,
    shadowColor: EXPERIENCE_COLORS.shadow,
    shadowOffset: { width: 0, height: 22 },
    shadowOpacity: 0.16,
    shadowRadius: 36,
    elevation: 12,
  },
  logoSection: { alignItems: 'center', gap: spacing.sm },
  logoOrb: {
    width: 112,
    height: 112,
    borderRadius: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
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
  appLogo: { width: 82, height: 82 },
  logoKicker: { color: EXPERIENCE_COLORS.inkSoft, letterSpacing: 1.4 },
  title: { textAlign: 'center', color: EXPERIENCE_COLORS.ink },
  subtitle: { textAlign: 'center', maxWidth: 280 },
  errorContainer: {
    backgroundColor: 'rgba(208, 92, 65, 0.10)', borderRadius: radii.md, padding: spacing.md,
    borderWidth: 1, borderColor: 'rgba(208,92,65,0.14)',
  },
  errorText: { color: BRAND_COLORS.error, textAlign: 'center' },

  // Social buttons
  socialSection: { gap: spacing.sm },
  appleNativeButton: { width: '100%', height: 52 },
  appleWebButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.md, height: 52, borderRadius: 20, backgroundColor: EXPERIENCE_COLORS.ink,
  },
  googleButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.md, height: 52, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderWidth: 1, borderColor: EXPERIENCE_COLORS.stroke,
  },
  googleButtonText: { color: EXPERIENCE_COLORS.ink },
  whiteButtonText: { color: '#FFFFFF' },
  socialButtonPressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  buttonDisabled: { opacity: 0.5 },

  // Divider
  divider: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  dividerLine: { flex: 1, height: 1, backgroundColor: EXPERIENCE_COLORS.stroke },
  dividerText: { color: EXPERIENCE_COLORS.inkSoft },

  emailToggle: { color: EXPERIENCE_COLORS.inkSoft, textAlign: 'center' },

  // Email form
  formSection: { gap: spacing.md },
  inputContainer: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.88)', borderRadius: 20,
    borderWidth: 1, borderColor: EXPERIENCE_COLORS.stroke, minHeight: 52, paddingHorizontal: spacing.md,
  },
  inputContainerFocused: { borderColor: EXPERIENCE_COLORS.coral },
  input: { flex: 1, fontSize: 15, color: EXPERIENCE_COLORS.ink, minHeight: 52 },
  primaryButton: {
    minHeight: 52, borderRadius: 20, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#111111',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 8,
  },
  primaryButtonFill: {
    minHeight: 52,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111111',
  },
  primaryButtonDisabled: { opacity: 0.48 },
  primaryButtonPressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },

  // Footer
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.xs },
  footerLink: { color: EXPERIENCE_COLORS.ink },
});
