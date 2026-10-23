/**
 * Google Analytics 4 (gtag.js) — web only.
 *
 * Wiring overview:
 * - Production HTML gets the official gtag snippet injected at build time by
 *   scripts/prerender-landing.mjs (index.html + the static public/ pages), so
 *   the initial page_view fires even when the React bundle never hydrates.
 * - This module is the runtime side: it reuses the head snippet when present
 *   (dev servers skip the prerender step, so it can also bootstrap gtag
 *   itself), sends a manual `page_view` per screen change — this SPA never
 *   changes the URL, so GA's automatic history tracking cannot observe
 *   navigation — and exposes `trackEvent` for product events (login, sign_up,
 *   meal_logged, app_store_click, …).
 * - Native iOS/Android: every call is a silent no-op. GA4 web streams need a
 *   browser; an app stream would require Firebase Analytics instead.
 *
 * Configuration: EXPO_PUBLIC_GA_MEASUREMENT_ID in frontend/.env.production
 * (format "G-XXXXXXXXXX"). Empty or missing → analytics stays fully disabled.
 * Analytics must never break the app: every entry point is guarded and every
 * gtag call is wrapped, failing silently.
 */
import { EXPO_PUBLIC_GA_MEASUREMENT_ID } from '@env';
import { Platform } from 'react-native';

type Gtag = (...args: unknown[]) => void;

interface GtagWindow extends Window {
  dataLayer?: unknown[];
  gtag?: Gtag;
}

const GTAG_SCRIPT_ID = 'metriful-gtag';

let measurementId = (EXPO_PUBLIC_GA_MEASUREMENT_ID ?? '').trim();
let initialized = false;
let lastScreenName: string | null = null;

const getWebWindow = (): GtagWindow | null =>
  Platform.OS === 'web' && typeof window !== 'undefined' && typeof document !== 'undefined'
    ? (window as GtagWindow)
    : null;

/**
 * location.href WITHOUT the #fragment. OAuth redirects land on this app with
 * `#id_token=<JWT>` (email/name/sub inside) in the hash — that must never be
 * forwarded to GA, so every page_location we send is built from this instead
 * of location.href. The build-time head snippet applies the same rule.
 */
const sanitizedLocation = (win: GtagWindow): string =>
  win.location.origin + win.location.pathname + win.location.search;

/**
 * Returns a ready-to-use gtag function, bootstrapping it on first use.
 * Null on native, when no measurement ID is configured, or on any failure.
 */
const getGtag = (): Gtag | null => {
  const win = getWebWindow();
  if (!win || !measurementId) return null;
  if (initialized) return win.gtag ?? null;
  try {
    win.dataLayer = win.dataLayer ?? [];
    if (typeof win.gtag !== 'function') {
      // No build-time head snippet (e.g. `expo start --web`) — bootstrap gtag
      // here. gtag.js requires the raw `arguments` object on the dataLayer,
      // not a spread array.
      win.gtag = function gtag() {
        (win.dataLayer as unknown[]).push(arguments);
      };
      win.gtag('js', new Date());
      win.gtag('config', measurementId, { page_location: sanitizedLocation(win) });
      if (!document.getElementById(GTAG_SCRIPT_ID)) {
        const script = document.createElement('script');
        script.id = GTAG_SCRIPT_ID;
        script.async = true;
        script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
        document.head.appendChild(script);
      }
    }
    initialized = true;
    return win.gtag ?? null;
  } catch {
    return null;
  }
};

/**
 * Optional explicit initialization. `measurementId` overrides the env value
 * (tests, or a future remote-config source); production builds read the env
 * var and never need to call this. Overrides only take effect before the
 * first tracked call — the first gtag bootstrap wins.
 */
export function initAnalytics(options?: { measurementId?: string }): void {
  if (options?.measurementId !== undefined) {
    measurementId = options.measurementId.trim();
  }
  getGtag();
}

/**
 * Call from NavigationContainer.onReady. Seeds screen dedupe with the initial
 * route WITHOUT sending a page_view — the initial page load is already counted
 * by the automatic page_view of the gtag config call (head snippet or runtime
 * bootstrap), so sending another here would double-count every visit.
 */
export function recordInitialScreen(screenName?: string): void {
  if (screenName) {
    lastScreenName = screenName;
  }
  getGtag();
}

/**
 * Call from NavigationContainer.onStateChange with the focused route's name.
 * Sends one GA4 page_view per screen CHANGE; repeated calls with the same
 * screen (param-only navigation state changes) are deduped.
 */
export function trackScreenView(screenName?: string): void {
  if (!screenName || screenName === lastScreenName) return;
  lastScreenName = screenName;
  const win = getWebWindow();
  const gtag = getGtag();
  if (!win || !gtag) return;
  try {
    gtag('event', 'page_view', {
      page_title: screenName,
      page_location: sanitizedLocation(win),
    });
  } catch {
    // Analytics must never take the app down.
  }
}

/**
 * Send a GA4 event. Names must be snake_case and ≤40 chars (GA4 rules);
 * params must be scalar-valued. No-op on native or when analytics is disabled.
 */
export function trackEvent(
  eventName: string,
  params?: Record<string, string | number | boolean>,
): void {
  if (!eventName) return;
  const gtag = getGtag();
  if (!gtag) return;
  try {
    gtag('event', eventName, params ?? {});
  } catch {
    // Analytics must never take the app down.
  }
}
