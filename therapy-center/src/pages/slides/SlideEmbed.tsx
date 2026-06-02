import { useContext, useEffect, useRef, useState } from 'react';
import { SlidesAuthContext, URL_PREFIX } from './auth';

interface Props {
  slideId: number;
  defaultPath?: string;
}

export default function SlideEmbed({ slideId, defaultPath = '/therapy/' }: Props) {
  const urlKey = `${URL_PREFIX}${slideId}`;
  const { auth, setEmbedUrl, reloadVersion, forceReloadCount, iframeNavCount, iframeNavTarget } = useContext(SlidesAuthContext);
  const [path, setPath] = useState<string>(() => {
    try { return localStorage.getItem(urlKey) || defaultPath; } catch { return defaultPath; }
  });
  const [reloadKey, setReloadKey] = useState(0);
  const [loading, setLoading] = useState(true);

  // Re-read URL override from localStorage when slide changes or after URL editor saves.
  // Only show the loader if the URL actually changed.
  useEffect(() => {
    let next: string;
    try { next = localStorage.getItem(urlKey) || defaultPath; } catch { next = defaultPath; }
    setPath(prev => {
      if (prev !== next) setLoading(true);
      return next;
    });
  }, [urlKey, defaultPath, reloadVersion]);

  // Publish current URL up to the SlideLayout footer (for open-in-new-tab + URL editor)
  useEffect(() => {
    setEmbedUrl(path);
  }, [path, setEmbedUrl]);

  // Clear footer URL only on real unmount (e.g. navigating to a text-only slide)
  useEffect(() => {
    return () => setEmbedUrl(null);
  }, [setEmbedUrl]);

  // When the auth toggle changes, force-reload the iframe so it picks up
  // the new admin_key SlideLayout has just written to localStorage.
  useEffect(() => {
    setLoading(true);
    setReloadKey(k => k + 1);
  }, [auth]);

  // "↩ חזרה למסך ילד" — force the iframe to remount and reload its src
  // even if the URL hasn't changed (user may have navigated within the iframe).
  const firstForceMount = useRef(true);
  useEffect(() => {
    if (firstForceMount.current) {
      firstForceMount.current = false;
      return;
    }
    setLoading(true);
    setReloadKey(k => k + 1);
  }, [forceReloadCount]);

  // Iframe-only navigation triggered by "↩ למסך הילד" button in the footer.
  // Updates the iframe URL but DOES NOT change the current slide.
  const firstNavMount = useRef(true);
  useEffect(() => {
    if (firstNavMount.current) {
      firstNavMount.current = false;
      return;
    }
    if (!iframeNavTarget) return;
    setPath(iframeNavTarget);
    setReloadKey(k => k + 1);  // force iframe remount in case the URL is the same string
    setLoading(true);
  }, [iframeNavCount, iframeNavTarget]);

  return (
    <div className="sl-shot">
      <div className="sl-shot-frame">
        <iframe
          key={reloadKey}
          src={path}
          title={`slide-${slideId}-embed`}
          className="sl-shot-iframe"
          onLoad={() => setLoading(false)}
        />
      </div>

      {loading && (
        <div className="sl-shot-loader" aria-hidden>
          <div className="sl-shot-spinner" />
          <span>טוען…</span>
        </div>
      )}
    </div>
  );
}
