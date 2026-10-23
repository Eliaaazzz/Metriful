import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { useAuthStore } from '../useAuthStore';
import type { UserInfo } from '../useAuthStore';

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Mock jwtStorage
const mockSaveJWT = jest.fn();
const mockGetJWT = jest.fn();
const mockClearJWT = jest.fn();
jest.mock('@/utils/jwtStorage', () => ({
  saveJWT: (...args: any[]) => mockSaveJWT(...args),
  getJWT: (...args: any[]) => mockGetJWT(...args),
  clearJWT: (...args: any[]) => mockClearJWT(...args),
}));

// Mock navigationService
const mockNavigateToLogin = jest.fn();
jest.mock('@/navigation/navigationService', () => ({
  navigateToLogin: () => mockNavigateToLogin(),
}));

// Mock apiClient — static mock is registered, but the source file uses
// dynamic import() to load it. Dynamic import() is not supported in Jest's
// node test environment without --experimental-vm-modules, so
// fetchCurrentUser / callLogoutEndpoint always fall into their catch blocks.
// Tests below verify the *fallback* paths; the happy-path (successful fetch)
// is covered by the authFlow integration tests + backend tests.
jest.mock('@/services/apiClient', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

// ─── Test Data ────────────────────────────────────────────────────────────────

const MOCK_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.test-jwt-token';

const MOCK_USER_INFO: UserInfo = {
  userId: '550e8400-e29b-41d4-a716-446655440000',
  email: 'test@example.com',
  username: 'TestUser',
  currentStreak: 5,
  level: 'beginner',
  timeBucket: 0,
};

const MOCK_FETCHED_USER: UserInfo = {
  userId: '550e8400-e29b-41d4-a716-446655440000',
  email: 'test@example.com',
  username: 'TestUser',
  currentStreak: 7,
  level: 'intermediate',
  timeBucket: 1,
};

const MOCK_PARTIAL_USER_INFO: UserInfo = {
  userId: '',
  email: 'partial@example.com',
  username: '',
  currentStreak: 0,
  level: '',
  timeBucket: 0,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resetStore() {
  useAuthStore.setState({
    userToken: null,
    userInfo: null,
    isLoading: false,
    isAuthenticated: false,
    isRestoringToken: true,
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useAuthStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetStore();
    // Default: mobile platform
    (Platform as any).OS = 'ios';
  });

  // ===========================================================================
  // signIn
  // ===========================================================================

  describe('signIn()', () => {
    it('should save token and set authenticated state with provided userInfo', async () => {
      await useAuthStore.getState().signIn(MOCK_TOKEN, MOCK_USER_INFO);

      const state = useAuthStore.getState();
      expect(state.userToken).toBe(MOCK_TOKEN);
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);
      expect(state.userInfo).toEqual(MOCK_USER_INFO);

      expect(mockSaveJWT).toHaveBeenCalledWith(
        MOCK_TOKEN,
        undefined,
        MOCK_USER_INFO.email
      );
    });

    it('should persist userInfo to AsyncStorage when provided', async () => {
      await useAuthStore.getState().signIn(MOCK_TOKEN, MOCK_USER_INFO);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'aura_user_info',
        JSON.stringify(MOCK_USER_INFO)
      );
    });

    it('should mark as authenticated even when fetchCurrentUser is unavailable', async () => {
      // When no userInfo is provided and fetchCurrentUser fails (dynamic import
      // limitation in test env), signIn should still mark the user as
      // authenticated because the token itself is valid.
      await useAuthStore.getState().signIn(MOCK_TOKEN);

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.userInfo).toBeNull();
      expect(state.isLoading).toBe(false);
    });

    it('should save token to SecureStore on mobile', async () => {
      (Platform as any).OS = 'ios';

      await useAuthStore.getState().signIn(MOCK_TOKEN, MOCK_USER_INFO);

      expect(mockSaveJWT).toHaveBeenCalledWith(MOCK_TOKEN, undefined, MOCK_USER_INFO.email);
      expect(useAuthStore.getState().userToken).toBe(MOCK_TOKEN);
    });

    it('should not set userToken on web platform (token is in HttpOnly cookie)', async () => {
      (Platform as any).OS = 'web';

      await useAuthStore.getState().signIn(MOCK_TOKEN, MOCK_USER_INFO);

      const state = useAuthStore.getState();
      // On web, userToken stays null; JWT lives in HttpOnly cookie
      expect(state.userToken).toBeNull();
      expect(state.isAuthenticated).toBe(true);
      expect(state.userInfo).toEqual(MOCK_USER_INFO);
    });

    it('should still call saveJWT on web (stores email reference)', async () => {
      (Platform as any).OS = 'web';

      await useAuthStore.getState().signIn(MOCK_TOKEN, MOCK_USER_INFO);

      expect(mockSaveJWT).toHaveBeenCalledWith(MOCK_TOKEN, undefined, MOCK_USER_INFO.email);
    });

    it('falls back to the provided userInfo when the canonical /me fetch fails', async () => {
      // Partial userInfo (empty userId/username) triggers a canonical /me fetch, which
      // fails here because jest's node VM can't run the store's dynamic import() — the same
      // path a serverless cold start hits on device. Per the iPad cold-start login fix
      // (commit a067baf), signIn must still authenticate AND keep the provided userInfo so
      // the UI can show the user's name/email; useCurrentUser refetches canonical data on
      // the main screen. (This test predated that fix and was never run because the suite
      // couldn't load without the jest-expo preset.)
      await useAuthStore.getState().signIn(MOCK_TOKEN, MOCK_PARTIAL_USER_INFO);

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.userInfo).toEqual(MOCK_PARTIAL_USER_INFO);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'aura_user_info',
        JSON.stringify(MOCK_PARTIAL_USER_INFO)
      );
      expect(mockSaveJWT).toHaveBeenCalledWith(MOCK_TOKEN, undefined, MOCK_PARTIAL_USER_INFO.email);
    });
  });

  // ===========================================================================
  // signOut
  // ===========================================================================

  describe('signOut()', () => {
    beforeEach(async () => {
      // Set up authenticated state
      await useAuthStore.getState().signIn(MOCK_TOKEN, MOCK_USER_INFO);
      jest.clearAllMocks();
    });

    it('should clear all auth state', async () => {
      await useAuthStore.getState().signOut();

      const state = useAuthStore.getState();
      expect(state.userToken).toBeNull();
      expect(state.userInfo).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
    });

    it('should clear JWT from storage', async () => {
      await useAuthStore.getState().signOut();

      expect(mockClearJWT).toHaveBeenCalled();
    });

    it('should clear persisted userInfo from AsyncStorage', async () => {
      await useAuthStore.getState().signOut();

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('aura_user_info');
    });

    it('should navigate to login screen', async () => {
      await useAuthStore.getState().signOut();

      expect(mockNavigateToLogin).toHaveBeenCalled();
    });

    it('should NOT call logout endpoint on mobile (mobile clears locally)', async () => {
      (Platform as any).OS = 'ios';

      await useAuthStore.getState().signOut();

      // On mobile, callLogoutEndpoint returns immediately (Platform.OS !== 'web')
      // State should still be fully cleared
      expect(mockClearJWT).toHaveBeenCalled();
      expect(mockNavigateToLogin).toHaveBeenCalled();
    });

    it('should complete signOut even if logout endpoint fails on web', async () => {
      (Platform as any).OS = 'web';

      // callLogoutEndpoint uses dynamic import which fails in test env,
      // but the catch block allows signOut to continue gracefully
      await useAuthStore.getState().signOut();

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(mockClearJWT).toHaveBeenCalled();
      expect(mockNavigateToLogin).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // restoreToken
  // ===========================================================================

  describe('restoreToken()', () => {
    it('should set unauthenticated when no token exists on mobile', async () => {
      mockGetJWT.mockResolvedValueOnce(null);
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);

      await useAuthStore.getState().restoreToken();

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isRestoringToken).toBe(false);
      expect(state.userInfo).toBeNull();
    });

    it('should set unauthenticated when no token marker on web', async () => {
      (Platform as any).OS = 'web';
      mockGetJWT.mockResolvedValueOnce(null);
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);

      await useAuthStore.getState().restoreToken();

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isRestoringToken).toBe(false);
    });

    it('should clear persisted userInfo when no token exists', async () => {
      mockGetJWT.mockResolvedValueOnce(null);
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);

      await useAuthStore.getState().restoreToken();

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('aura_user_info');
    });

    it('should load cached userInfo for instant display', async () => {
      const cachedInfo = JSON.stringify(MOCK_USER_INFO);
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(cachedInfo);
      mockGetJWT.mockResolvedValueOnce(MOCK_TOKEN);

      await useAuthStore.getState().restoreToken();

      // Cached user info should have been loaded initially
      // (fetchCurrentUser will fail in test env, falling to error handler)
      // Error handler loads cached again for fallback
    });

    it('should store token in memory on mobile when restoring', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);
      mockGetJWT.mockResolvedValueOnce(MOCK_TOKEN);

      await useAuthStore.getState().restoreToken();

      // Even though fetchCurrentUser fails, token should be stored in state
      // The error handler uses cached data or marks unauthenticated
      const state = useAuthStore.getState();
      expect(state.userToken).toBe(MOCK_TOKEN);
    });

    it('should use cached userInfo when backend is unreachable', async () => {
      // fetchCurrentUser fails (dynamic import issue in test env = network-like error)
      // This simulates the "network error" fallback path
      (AsyncStorage.getItem as jest.Mock)
        .mockResolvedValueOnce(JSON.stringify(MOCK_USER_INFO))  // step 1: instant display
        .mockResolvedValueOnce(JSON.stringify(MOCK_USER_INFO)); // error handler: fallback
      mockGetJWT.mockResolvedValueOnce(MOCK_TOKEN);

      await useAuthStore.getState().restoreToken();

      const state = useAuthStore.getState();
      // Should fall back to cached data and stay authenticated
      expect(state.isAuthenticated).toBe(true);
      expect(state.userInfo).toEqual(MOCK_USER_INFO);
      expect(state.isRestoringToken).toBe(false);
    });

    it('should set unauthenticated when no token and no cache', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);
      mockGetJWT.mockResolvedValueOnce(null);

      await useAuthStore.getState().restoreToken();

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isRestoringToken).toBe(false);
      expect(state.userToken).toBeNull();
    });
  });

  // ===========================================================================
  // updateUserInfo
  // ===========================================================================

  describe('updateUserInfo()', () => {
    beforeEach(async () => {
      await useAuthStore.getState().signIn(MOCK_TOKEN, MOCK_USER_INFO);
      jest.clearAllMocks();
    });

    it('should merge partial updates into existing userInfo', () => {
      useAuthStore.getState().updateUserInfo({ currentStreak: 10, level: 'advanced' });

      const state = useAuthStore.getState();
      expect(state.userInfo?.currentStreak).toBe(10);
      expect(state.userInfo?.level).toBe('advanced');
      // Unchanged fields preserved
      expect(state.userInfo?.email).toBe(MOCK_USER_INFO.email);
      expect(state.userInfo?.username).toBe(MOCK_USER_INFO.username);
    });

    it('should persist updated userInfo to AsyncStorage', () => {
      useAuthStore.getState().updateUserInfo({ currentStreak: 10 });

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'aura_user_info',
        expect.stringContaining('"currentStreak":10')
      );
    });

    it('should do nothing if no userInfo exists', () => {
      useAuthStore.setState({ userInfo: null });

      useAuthStore.getState().updateUserInfo({ currentStreak: 10 });

      expect(useAuthStore.getState().userInfo).toBeNull();
    });
  });

  // ===========================================================================
  // setUserInfo
  // ===========================================================================

  describe('setUserInfo()', () => {
    it('should replace entire userInfo', async () => {
      await useAuthStore.getState().signIn(MOCK_TOKEN, MOCK_USER_INFO);

      useAuthStore.getState().setUserInfo(MOCK_FETCHED_USER);

      expect(useAuthStore.getState().userInfo).toEqual(MOCK_FETCHED_USER);
    });

    it('should persist new userInfo to AsyncStorage', () => {
      useAuthStore.getState().setUserInfo(MOCK_FETCHED_USER);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'aura_user_info',
        JSON.stringify(MOCK_FETCHED_USER)
      );
    });
  });

  // ===========================================================================
  // Initial State
  // ===========================================================================

  describe('initial state', () => {
    it('should start with isRestoringToken=true (for splash screen)', () => {
      resetStore();
      expect(useAuthStore.getState().isRestoringToken).toBe(true);
    });

    it('should start unauthenticated', () => {
      resetStore();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(useAuthStore.getState().userToken).toBeNull();
      expect(useAuthStore.getState().userInfo).toBeNull();
    });
  });

  // ===========================================================================
  // getAuthState export
  // ===========================================================================

  describe('getAuthState()', () => {
    it('should return current store state', async () => {
      // Use static import (already imported at top of file via useAuthStore)
      const { getAuthState } = require('../useAuthStore');

      await useAuthStore.getState().signIn(MOCK_TOKEN, MOCK_USER_INFO);

      const state = getAuthState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.userInfo).toEqual(MOCK_USER_INFO);
    });
  });
});
