/**
 * @jest-environment jsdom
 *
 * Unit tests for the GA4 analytics service. jsdom provides window/document so
 * the web code paths run; the react-native Platform is mocked per test to
 * exercise both the web and the native (no-op) branches.
 */

type AnalyticsModule = typeof import('../analytics');

interface GtagWindow extends Window {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
}

const win = window as unknown as GtagWindow;

/** Fresh module instance with Platform.OS mocked, so module state never leaks between tests. */
const loadAnalytics = (platformOS: string): AnalyticsModule => {
  let mod: AnalyticsModule | undefined;
  jest.isolateModules(() => {
    jest.doMock('react-native', () => ({ Platform: { OS: platformOS } }));
    mod = require('../analytics');
  });
  return mod as AnalyticsModule;
};

/** dataLayer entries are `arguments` objects — normalize to plain arrays for asserts. */
const flatDataLayer = (): unknown[][] =>
  (win.dataLayer ?? []).map((entry) => Array.from(entry as ArrayLike<unknown>));

beforeEach(() => {
  delete win.dataLayer;
  delete win.gtag;
  document.getElementById('metriful-gtag')?.remove();
});

describe('analytics', () => {
  it('stays fully off on native platforms', () => {
    const analytics = loadAnalytics('ios');
    analytics.initAnalytics({ measurementId: 'G-TEST123' });
    analytics.trackEvent('login', { method: 'password' });
    analytics.trackScreenView('Dashboard');

    expect(win.dataLayer).toBeUndefined();
    expect(win.gtag).toBeUndefined();
    expect(document.getElementById('metriful-gtag')).toBeNull();
  });

  it('stays fully off on web when no measurement ID is configured', () => {
    const analytics = loadAnalytics('web');
    analytics.initAnalytics();
    analytics.trackEvent('login');
    analytics.trackScreenView('Dashboard');

    expect(win.dataLayer).toBeUndefined();
    expect(document.getElementById('metriful-gtag')).toBeNull();
  });

  it('bootstraps gtag, config and the loader script once on web', () => {
    // OAuth redirects land with the id_token in the hash — it must never reach GA.
    window.location.hash = '#id_token=SECRET-JWT&state=abc';

    const analytics = loadAnalytics('web');
    analytics.initAnalytics({ measurementId: 'G-TEST123' });
    analytics.initAnalytics(); // second call must not re-config

    expect(typeof win.gtag).toBe('function');
    const script = document.getElementById('metriful-gtag') as HTMLScriptElement;
    expect(script).not.toBeNull();
    expect(script.src).toBe('https://www.googletagmanager.com/gtag/js?id=G-TEST123');

    const calls = flatDataLayer();
    expect(calls).toHaveLength(2);
    expect(calls[0][0]).toBe('js');
    expect(calls[1]).toEqual([
      'config',
      'G-TEST123',
      { page_location: window.location.origin + window.location.pathname + window.location.search },
    ]);
    expect(JSON.stringify(calls[1])).not.toContain('SECRET-JWT');
  });

  it('reuses an existing head-snippet gtag without re-config or a second script', () => {
    const pushed: unknown[][] = [];
    win.dataLayer = [];
    win.gtag = (...args: unknown[]) => {
      pushed.push(args);
    };

    const analytics = loadAnalytics('web');
    analytics.initAnalytics({ measurementId: 'G-TEST123' });
    expect(document.getElementById('metriful-gtag')).toBeNull();
    expect(pushed).toHaveLength(0); // no duplicate js/config → no double page_view

    analytics.trackEvent('meal_logged', { source: 'scan', item_count: 3 });
    expect(pushed).toEqual([['event', 'meal_logged', { source: 'scan', item_count: 3 }]]);

    analytics.trackEvent('');
    expect(pushed).toHaveLength(1); // empty names are rejected
  });

  it('sends one page_view per screen change, deduping repeats and the initial screen', () => {
    window.location.hash = '#id_token=SECRET-JWT';

    const analytics = loadAnalytics('web');
    analytics.initAnalytics({ measurementId: 'G-TEST123' });
    analytics.recordInitialScreen('Splash');

    analytics.trackScreenView('Splash'); // same as initial — already counted by config
    analytics.trackScreenView('Landing');
    analytics.trackScreenView('Landing'); // param-only state change — deduped
    analytics.trackScreenView('Login');
    analytics.trackScreenView(undefined); // never sent

    const pageViews = flatDataLayer().filter((c) => c[0] === 'event' && c[1] === 'page_view');
    expect(pageViews.map((c) => (c[2] as { page_title: string }).page_title)).toEqual([
      'Landing',
      'Login',
    ]);
    const location = (pageViews[0][2] as { page_location: string }).page_location;
    expect(location).toBe(
      window.location.origin + window.location.pathname + window.location.search,
    );
    expect(location).not.toContain('SECRET-JWT');
  });
});
