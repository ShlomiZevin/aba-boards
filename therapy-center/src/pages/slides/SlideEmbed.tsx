import { useContext, useEffect, useState } from 'react';
import { SlidesAuthContext } from './auth';

const URL_PREFIX = 'doing-slide-embed-';

interface Props {
  slideId: number;
  defaultPath?: string;
}

export default function SlideEmbed({ slideId, defaultPath = '/therapy/' }: Props) {
  const urlKey = `${URL_PREFIX}${slideId}`;
  const { auth, setEmbedUrl } = useContext(SlidesAuthContext);
  const [path, setPath] = useState<string>(defaultPath);
  const [reloadKey, setReloadKey] = useState(0);
  const [loading, setLoading] = useState(true);

  // Optional saved URL override (set externally via localStorage; no in-UI editor)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(urlKey);
      if (stored) setPath(stored);
    } catch {}
  }, [urlKey]);

  // Publish current URL up to the SlideLayout footer (for the open-in-new-tab link)
  useEffect(() => {
    setEmbedUrl(path);
    return () => setEmbedUrl(null);
  }, [path, setEmbedUrl]);

  // When auth changes (toggled in the footer), reload the iframe so it picks up
  // the new admin_key that SlideLayout has already written to localStorage.
  useEffect(() => {
    setLoading(true);
    setReloadKey(k => k + 1);
  }, [auth]);

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
