/**
 * @jest-environment jsdom
 *
 * Tests for the web Google OAuth redirect completer — specifically the
 * contract with the GA head snippet (scripts/prerender-landing.mjs), which
 * stashes the `#id_token=…` fragment into sessionStorage and strips it from
 * the URL before any analytics script can observe it. Login must complete
 * from the stash exactly as it does from a live URL hash.
 */

jest.mock('react-native', () => ({ Platform: { OS: 'web' } }));

jest.mock('../apiClient', () => ({
  api: { post: jest.fn() },
}));

jest.mock('../queryClient', () => ({
  queryClient: { clear: jest.fn() },
}));

let mockAuthenticated = false;
const mockSignIn = jest.fn(async () => {
  mockAuthenticated = true;
});
jest.mock('@/stores/useAuthStore', () => ({
  useAuthStore: {
    getState: () => ({ signIn: mockSignIn, isAuthenticated: mockAuthenticated }),
  },
}));

import { api } from '../apiClient';
import { resolveWebGoogleRedirect, storeGoogleOAuthState } from '../webGoogleRedirect';

const mockApi = api as jest.Mocked<typeof api>;

const RETURN_HASH_KEY = 'google_oauth_return_hash'; // must match the GA head snippet
const AUTH_RESPONSE = { token: 'jwt-1', email: 'u@example.com', isNewUser: false };

beforeEach(() => {
  jest.clearAllMocks();
  mockAuthenticated = false;
  sessionStorage.clear();
  window.history.replaceState(null, '', '/');
});

describe('resolveWebGoogleRedirect', () => {
  it('completes login from the stash left by the GA head snippet (URL already stripped)', async () => {
    storeGoogleOAuthState('state-1');
    sessionStorage.setItem(RETURN_HASH_KEY, '#id_token=tok-1&state=state-1');
    mockApi.post.mockResolvedValueOnce(AUTH_RESPONSE);

    const outcome = await resolveWebGoogleRedirect();

    expect(outcome).toEqual({ kind: 'authenticated', isNewUser: false });
    expect(mockApi.post).toHaveBeenCalledWith(
      '/api/v1/auth/login',
      { loginType: 'GOOGLE', idToken: 'tok-1' },
      { timeout: 60000 },
    );
    expect(sessionStorage.getItem(RETURN_HASH_KEY)).toBeNull(); // single-use
  });

  it('still completes login from a live URL hash (no GA snippet, e.g. dev server)', async () => {
    storeGoogleOAuthState('state-2');
    window.history.replaceState(null, '', '/#id_token=tok-2&state=state-2');
    mockApi.post.mockResolvedValueOnce({ ...AUTH_RESPONSE, isNewUser: true });

    const outcome = await resolveWebGoogleRedirect();

    expect(outcome).toEqual({ kind: 'authenticated', isNewUser: true });
    expect(mockApi.post).toHaveBeenCalledWith(
      '/api/v1/auth/login',
      { loginType: 'GOOGLE', idToken: 'tok-2' },
      { timeout: 60000 },
    );
    expect(window.location.hash).toBe(''); // artifacts stripped
  });

  it('ignores a stashed token whose state this tab never issued (forged link)', async () => {
    sessionStorage.setItem(RETURN_HASH_KEY, '#id_token=evil&state=attacker');

    const outcome = await resolveWebGoogleRedirect();

    expect(outcome).toEqual({ kind: 'unsolicited' });
    expect(mockApi.post).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(RETURN_HASH_KEY)).toBeNull();
  });

  it('returns none when there is neither a hash nor a stash', async () => {
    const outcome = await resolveWebGoogleRedirect();

    expect(outcome).toEqual({ kind: 'none' });
    expect(mockApi.post).not.toHaveBeenCalled();
  });
});
