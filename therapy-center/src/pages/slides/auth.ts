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
}>({
  auth: 'michal',
  setAuth: () => {},
  embedUrl: null,
  setEmbedUrl: () => {},
  reloadVersion: 0,
});

export const URL_PREFIX = 'doing-slide-embed-';

export function getStoredUrl(slideId: number): string | null {
  try { return localStorage.getItem(`${URL_PREFIX}${slideId}`); } catch { return null; }
}

export function saveStoredUrl(slideId: number, url: string | null) {
  try {
    if (url) localStorage.setItem(`${URL_PREFIX}${slideId}`, url);
    else     localStorage.removeItem(`${URL_PREFIX}${slideId}`);
  } catch {}
}
