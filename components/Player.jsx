'use client';

import { useState } from 'react';
import ProPlayer from './ProPlayer';

// Pemutar media sisi klien:
// - .m3u8 langsung -> ProPlayer kustom (hls.js; kontrol, kualitas
//   asli, subtitle .vtt) — komponen kiriman pengguna.
// - Gagal fatal/tidak ada -> fallback iframe server embed.
export default function Player({ m3u8, subtitle, iframeUrl, title, episodeLabel, onProgress, resumeAt }) {
  const [useIframe, setUseIframe] = useState(!m3u8);

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
    <ProPlayer
      src={m3u8}
      subtitleUrl={subtitle || null}
      title={title || ''}
      episodeLabel={episodeLabel || ''}
      onFatal={() => setUseIframe(true)}
      onProgress={onProgress}
      resumeAt={resumeAt || 0}
    />
  );
}
