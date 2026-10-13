'use client';

import { useEffect, useRef, useState } from 'react';

// Pemutar media sisi klien:
// - .m3u8 langsung -> ArtPlayer + Hls.js (+ subtitle .vtt bila ada).
// - Gagal/tidak ada -> fallback iframe server embed.
export default function Player({ m3u8, subtitle, iframeUrl }) {
  const boxRef = useRef(null);
  const [useIframe, setUseIframe] = useState(!m3u8);

  useEffect(() => {
    if (useIframe || !m3u8 || !boxRef.current) return;
    let art = null;
    let hls = null;
    let disposed = false;
    (async () => {
      const Artplayer = (await import('artplayer')).default;
      const Hls = (await import('hls.js')).default;
      if (disposed || !boxRef.current) return;
      art = new Artplayer({
        container: boxRef.current,
        url: m3u8,
        type: 'm3u8',
        playsInline: true,
        fullscreen: true,
        playbackRate: true,
        setting: true,
        pip: true,
        subtitleOffset: true,
        ...(subtitle
          ? {
              subtitle: {
                url: subtitle,
                type: 'vtt',
                encoding: 'utf-8',
                default: true,
                style: { color: '#fff', 'font-size': '16px' },
              },
            }
          : {}),
        customType: {
          m3u8: (video, url) => {
            if (Hls.isSupported()) {
              hls = new Hls();
              hls.loadSource(url);
              hls.attachMedia(video);
              hls.on(Hls.Events.ERROR, (_e, data) => {
                if (data && data.fatal) setUseIframe(true);
              });
            } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
              video.src = url;
            } else {
              setUseIframe(true);
            }
          },
        },
      });
    })();
    return () => {
      disposed = true;
      try {
        if (hls) hls.destroy();
      } catch (e) {}
      try {
        if (art) art.destroy(false);
      } catch (e) {}
    };
  }, [m3u8, useIframe]);

  if (useIframe) {
    if (!iframeUrl) {
      return (
        <div className="flex aspect-video w-full items-center justify-center bg-black text-sm text-zinc-400">
          Stream unavailable for this episode.
        </div>
      );
    }
    return (
      <div className="aspect-video w-full overflow-hidden bg-black">
        <iframe
          src={iframeUrl}
          title="Media player"
          className="h-full w-full"
          allowFullScreen
          allow="autoplay; fullscreen; picture-in-picture"
          referrerPolicy="origin"
        />
      </div>
    );
  }

  return (
    <div className="aspect-video w-full overflow-hidden bg-black">
      <div ref={boxRef} className="h-full w-full" />
    </div>
  );
}
