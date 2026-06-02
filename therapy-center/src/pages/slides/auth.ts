import { createContext } from 'react';

export const AUTH_PREFIX = 'doing-slide-auth-';
export const ADMIN_KEY = 'admin_key';

// Two preset accounts the user toggles between per slide.
//   Michal = super-admin (key '6724' / adminId 'michal-super-admin')
//   Demo   = מרכז טיפולי לדוגמה (key 'demo3' / adminId 'demo3-admin')
export const AUTHS = {
  michal: { key: '6724',  label: 'מיכל' },
  demo:   { key: 'demo3', label: 'מרכז לדוגמה' },
} as const;

export type AuthKey = keyof typeof AUTHS;

export function getStoredAuth(slideId: number, fallback: AuthKey): AuthKey {
  try {
    const v = localStorage.getItem(`${AUTH_PREFIX}${slideId}`) as AuthKey | null;
    if (v && v in AUTHS) return v;
  } catch {}
  return fallback;
}

export const SlidesAuthContext = createContext<{
  auth: AuthKey;
  setAuth: (k: AuthKey) => void;
  embedUrl: string | null;
  setEmbedUrl: (url: string | null) => void;
  reloadVersion: number;  // bumped to force SlideEmbed to re-read its URL
  editMode: boolean;
  setEditMode: (v: boolean) => void;
  contentVersion: number; // bumped when content overrides change
  bumpContentVersion: () => void;
  bumpReloadVersion: () => void;  // call after URL changes to force iframe reload
  slidesVersion: number;  // bumped when custom/hidden slides change
  bumpSlidesVersion: () => void;
  forceReloadCount: number;  // bumped to force iframe remount even if URL hasn't changed
  forceReload: () => void;
  iframeNavCount: number;     // bumped to request iframe-only navigation
  iframeNavTarget: string | null;
  navigateIframe: (url: string) => void;
}>({
  auth: 'michal',
  setAuth: () => {},
  embedUrl: null,
  setEmbedUrl: () => {},
  reloadVersion: 0,
  editMode: false,
  setEditMode: () => {},
  contentVersion: 0,
  bumpContentVersion: () => {},
  bumpReloadVersion: () => {},
  slidesVersion: 0,
  bumpSlidesVersion: () => {},
  forceReloadCount: 0,
  forceReload: () => {},
  iframeNavCount: 0,
  iframeNavTarget: null,
  navigateIframe: () => {},
});

export const URL_PREFIX = 'doing-slide-embed-';
export const CONTENT_PREFIX = 'doing-slide-content-';

export function getStoredUrl(slideId: number): string | null {
  try { return localStorage.getItem(`${URL_PREFIX}${slideId}`); } catch { return null; }
}

export function saveStoredUrl(slideId: number, url: string | null) {
  try {
    if (url) localStorage.setItem(`${URL_PREFIX}${slideId}`, url);
    else     localStorage.removeItem(`${URL_PREFIX}${slideId}`);
  } catch {}
}

// ── Slide content overrides (per-slide title/lead/notes/sub/section edits) ──
export interface ContentOverride {
  title?: string;
  sub?: string;
  lead?: string;
  notes?: string[];
  section?: string;  // override the topbar section label per-slide
}

export function getStoredContent(slideId: number): ContentOverride | null {
  try {
    const raw = localStorage.getItem(`${CONTENT_PREFIX}${slideId}`);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function saveStoredContent(slideId: number, override: ContentOverride | null) {
  try {
    if (override && Object.keys(override).length > 0) {
      localStorage.setItem(`${CONTENT_PREFIX}${slideId}`, JSON.stringify(override));
    } else {
      localStorage.removeItem(`${CONTENT_PREFIX}${slideId}`);
    }
  } catch {}
}

// ── Custom slides + hidden defaults (used by add/remove UI) ──
export const CUSTOM_SLIDES_KEY = 'doing-slides-custom';
export const HIDDEN_SLIDES_KEY = 'doing-slides-hidden';

export function readJsonArray<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}
export function writeJsonArray<T>(key: string, arr: T[]) {
  try { localStorage.setItem(key, JSON.stringify(arr)); } catch {}
}

// ── One-time migration: wipe stale per-slide overrides when slide IDs change ──
// Bump CURRENT_SLIDES_VERSION whenever slide IDs are remapped in index.ts so
// users don't end up with URL/auth/content overrides pointing to the wrong slide.
const SLIDES_VERSION_KEY = 'doing-slides-data-version';
const CURRENT_SLIDES_VERSION = 'v3-2026-06-02';

export function runSlidesMigrationsIfNeeded() {
  try {
    const v = localStorage.getItem(SLIDES_VERSION_KEY);
    if (v === CURRENT_SLIDES_VERSION) return;
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (
        key.startsWith(URL_PREFIX) ||
        key.startsWith(AUTH_PREFIX) ||
        key.startsWith(CONTENT_PREFIX)
      ) {
        toRemove.push(key);
      }
    }
    toRemove.forEach(k => localStorage.removeItem(k));
    localStorage.setItem(SLIDES_VERSION_KEY, CURRENT_SLIDES_VERSION);
  } catch {}
}
