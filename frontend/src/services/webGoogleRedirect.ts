/**
 * Web Google OAuth redirect completion (app-boot).
 *
 * Why this exists:
 * On web, Google sign-in uses a full-page redirect (Safari blocks popups opened
 * from async handlers — see LoginScreen.handleGoogleLogin). Google sends the user
 * back to our origin with the id_token in the URL hash (`#id_token=...`). That
 * full-page reload re-boots the React app at the Splash screen, so LoginScreen
 * never re-mounts and the hash handler that lived only inside LoginScreen never
 * ran — leaving the user stranded on the marketing Landing page.
 *
 * SplashScreen now calls resolveWebGoogleRedirect() on boot so the token is
 * exchanged while the branded loading screen is visible, then routes to Main
 * (or Onboarding for new accounts).
 *
 * Security: because Splash runs on EVERY web boot, this handler must not exchange
 * a drive-by `#id_token=...` URL that the user never initiated (that would be a
 * login-CSRF / session-fixation vector). We only accept a token whose `state`
 * matches one this browser tab issued via sessionStorage before redirecting.
 */
import { Platform } from 'react-native';

import { trackEvent } from './analytics';
import { api } from './apiClient';
import { queryClient } from './queryClient';
import { useAuthStore, type UserInfo } from '@/stores/useAuthStore';

const GOOGLE_OAUTH_STATE_KEY = 'google_oauth_state';

/**
 * Where the GA head snippet (scripts/prerender-landing.mjs) stashes the OAuth
 * return fragment after stripping it from the URL — synchronously, BEFORE
 * gtag.js or any other script can observe a location.href that carries the
 * decodable id_token JWT. Login still completes because readHashParams()
 * consumes this stash. Keep the string literal in that script in sync.
 */
const GOOGLE_OAUTH_RETURN_HASH_KEY = 'google_oauth_return_hash';

/**
 * Result of attempting to complete a Google redirect at boot.
 * - 'none'         — no id_token in the URL; caller continues the normal flow.
 * - 'unsolicited'  — an id_token was present but we never issued its state
 *                    (drive-by / forged link). Artifacts are stripped; caller
 *                    continues the normal flow so a genuinely logged-in user
 *                    keeps their real session.
 * - 'authenticated'— session established; route to Onboarding (new) or Main.
 * - 'failed'       — token rejected / network error; route to Login with an error.
 */
export type WebGoogleRedirectOutcome =
  | { kind: 'none' }
  | { kind: 'unsolicited' }
  | { kind: 'authenticated'; isNewUser: boolean }
  | { kind: 'failed' };

interface BackendLoginResponse {
  token: string;
  email: string;
  isNewUser?: boolean;
  user?: {
    userId: string;
    username: string;
    currentStreak: number;
    level: string;
    timeBucket: number;
  };
}

function isWebRuntime(): boolean {
  return Platform.OS === 'web' && typeof window !== 'undefined';
}

function readHashParams(): URLSearchParams | null {
  // Live URL hash first — dev servers and any build without the GA head
  // snippet still deliver the OAuth return directly on the URL.
  const hash = window.location.hash;
  if (hash && hash.length >= 2) return new URLSearchParams(hash.substring(1));

  // Otherwise consume the fragment the GA head snippet stashed before
  // stripping it from the URL. Single-use: removed on read so a re-render or
  // back-navigation can't replay the token (same contract as the URL strip).
  const stashed = sessionStorage.getItem(GOOGLE_OAUTH_RETURN_HASH_KEY);
  if (stashed && stashed.length >= 2) {
    sessionStorage.removeItem(GOOGLE_OAUTH_RETURN_HASH_KEY);
    return new URLSearchParams(stashed.substring(1));
  }
  return null;
}

/** Strip OAuth artifacts from the URL + sessionStorage so a token can't be replayed. */
function clearGoogleRedirectArtifacts(): void {
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
  sessionStorage.removeItem(GOOGLE_OAUTH_STATE_KEY);
  sessionStorage.removeItem(GOOGLE_OAUTH_RETURN_HASH_KEY);
}

/** True when the current URL requests starting Google login (post origin handoff). */
export function hasPendingGoogleHandoff(): boolean {
  if (!isWebRuntime()) return false;
  return new URLSearchParams(window.location.search).get('auth') === 'google';
}

/**
 * Persist the CSRF state issued for a Google redirect. Stores only a non-empty
 * value so the boot-time completer can safely require a matching state (an empty
 * string would weaken the check to "no protection"). Returns false if no usable
 * state was provided.
 */
export function storeGoogleOAuthState(state: string | undefined | null): boolean {
  if (!isWebRuntime() || !state) return false;
  sessionStorage.setItem(GOOGLE_OAUTH_STATE_KEY, state);
  return true;
}

/**
 * Build the inline userInfo snapshot returned by the login endpoint. Mirrors
 * LoginScreen.handleLoginSuccess so the auth store is populated identically
 * regardless of which entrypoint completes the login.
 */
function buildUserInfo(data: BackendLoginResponse): UserInfo {
  if (data.user) {
    return {
      userId: data.user.userId,
      email: data.email,
      username: data.user.username,
      currentStreak: data.user.currentStreak,
      level: data.user.level,
      timeBucket: data.user.timeBucket,
    };
  }
  // Fallback for older backends that don't return a user snapshot.
  return {
    userId: '',
    email: data.email,
    username: '',
    currentStreak: 0,
    level: '',
    timeBucket: 0,
  };
}

/**
 * Resolve a pending Google OAuth redirect, if any, at app boot.
 *
 * Exchanges the id_token for a session and updates the auth store. The URL hash
 * and CSRF state are always stripped before any network call so the token can't
 * be replayed by a re-render or back-navigation.
 */
export async function resolveWebGoogleRedirect(): Promise<WebGoogleRedirectOutcome> {
  if (!isWebRuntime()) return { kind: 'none' };

  const params = readHashParams();
  const idToken = params?.get('id_token');
  if (!idToken) return { kind: 'none' };

  const expectedState = sessionStorage.getItem(GOOGLE_OAUTH_STATE_KEY);
  const receivedState = params?.get('state') ?? null;

  // Always strip artifacts up-front — even on the reject paths below.
  clearGoogleRedirectArtifacts();

  // Login-CSRF / session-fixation defense: only accept a token whose state matches
  // one THIS browser tab issued. A forged `#id_token=...` link has no stored state,
  // so it is ignored rather than exchanged.
  if (!expectedState || !receivedState || expectedState !== receivedState) {
    console.warn('[webGoogleRedirect] id_token present without a matching issued state; ignoring');
    return { kind: 'unsolicited' };
  }

  const MAX_ATTEMPTS = 2;
  let lastError: any;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const data = await api.post<BackendLoginResponse>(
        '/api/v1/auth/login',
        { loginType: 'GOOGLE', idToken },
        { timeout: 60000 }, // 60s for GCP cold start
      );
      queryClient.clear();
      await useAuthStore.getState().signIn(data.token, buildUserInfo(data));
      if (useAuthStore.getState().isAuthenticated) {
        trackEvent(data.isNewUser ? 'sign_up' : 'login', { method: 'google' });
        return { kind: 'authenticated', isNewUser: Boolean(data.isNewUser) };
      }
      return { kind: 'failed' };
    } catch (err: any) {
      lastError = err;
      const isRetryable =
        err?.status === 408 || err?.status === 503 || err?.status === 502 || !err?.status;
      if (attempt < MAX_ATTEMPTS && isRetryable) {
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }
      break;
    }
  }

  console.error(
    '[webGoogleRedirect] Google redirect login failed:',
    lastError?.message || lastError,
  );
  return { kind: 'failed' };
}
