'use client';

import { useEffect, useState } from 'react';
import Player from './Player';

// Resolusi stream SISI KLIEN dari katalog putar utama.
//
// Jalur server terbukti tidak andal menjangkau API katalog itu
// (egress pusat data ditantang pemeriksaan bot), sedangkan
// peramban ponsel pengguna adalah klien yang memang dilayani
// katalog tersebut. Pencarian POST diteruskan lewat worker tepi
// pengguna (CORS), panggilan GET langsung ke API katalog
// (CORS terbuka), dan video diputar lewat proksi HLS worker
// (CDN mewajibkan Referer situs asal). Gagal -> embed cadangan.
const KAA = 'https://kaa.lt';
const EDGE = 'https://kumo-hls.adiyth-arpansa.workers.dev';
const HLS_HOST = 'https://hls.krussdomi.com/manifest';

const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

function bigrams(s) {
  const m = new Map();
  for (let i = 0; i < s.length - 1; i++) {
    const b = s.slice(i, i + 2);
    m.set(b, (m.get(b) || 0) + 1);
  }
  return m;
}

function dice(a, b) {
  a = norm(a);
  b = norm(b);
  if (!a || !b) return 0;
  if (a === b) return 1;
  const A = bigrams(a);
  const B = bigrams(b);
  let inter = 0;
  for (const [g, n] of A) inter += Math.min(n, B.get(g) || 0);
  return (2 * inter) / (a.length - 1 + (b.length - 1));
}

async function jget(url, ms = 9000) {
  const r = await fetch(url, { signal: AbortSignal.timeout(ms) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

async function search(query) {
  const r = await fetch(`${EDGE}/fsearch`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ page: 1, query }),
    signal: AbortSignal.timeout(9000),
  });
  if (!r.ok) throw new Error('search HTTP ' + r.status);
  const j = await r.json();
  return Array.isArray(j && j.result) ? j.result : [];
}

async function findEpisode(slug, epNumber, lang) {
  const first = await jget(`${KAA}/api/show/${slug}/episodes?ep=1&lang=${lang}`);
  const scan = (arr) => {
    for (const e of arr || []) {
      if (Number(e.episode_number) === Number(epNumber)) {
        return `ep-${e.episode_number}-${e.slug}`;
      }
    }
    return null;
  };
  let hit = scan(first && first.result);
  if (hit) return hit;
  const pages = Array.isArray(first && first.pages) ? first.pages : [];
  for (const pg of pages.slice(1, 40)) {
    const eps = (pg && pg.eps) || [];
    if (!eps.length) continue;
    if (Number(epNumber) < Number(eps[0]) || Number(epNumber) > Number(eps[eps.length - 1]))
      continue;
    try {
      const d = await jget(`${KAA}/api/show/${slug}/episodes?ep=${eps[0]}&lang=${lang}`);
      hit = scan(d && d.result);
      if (hit) return hit;
    } catch (e) {}
  }
  return null;
}

async function resolveOnClient(title, epNumber) {
  const q = String(title || '').replace(/\s+/g, ' ').trim();
  if (!q || q.length < 3 || !Number.isFinite(Number(epNumber))) return null;
  const queries = [q];
  const words = q.split(' ');
  if (words.length > 3) queries.push(words.slice(0, 3).join(' '));
  const seen = new Map();
  await Promise.all(
    queries.map(async (query) => {
      try {
        const res = await search(query);
        for (const c of res) if (c && c.slug && !seen.has(c.slug)) seen.set(c.slug, c);
      } catch (e) {}
    })
  );
  const scored = [];
  for (const c of seen.values()) {
    if (!(c.episode_count > 0) && !(c.locales || []).length) continue;
    let s = Math.max(dice(q, c.title_en || ''), dice(q, c.title || ''));
    if ((c.locales || []).includes('ja-JP')) s *= 1.05;
    if (s >= 0.5) scored.push({ slug: c.slug, score: s });
  }
  scored.sort((a, b) => b.score - a.score);

  for (const show of scored.slice(0, 3)) {
    for (const lang of ['ja-JP', 'en-US']) {
      try {
        const fullSlug = await findEpisode(show.slug, epNumber, lang);
        if (!fullSlug) continue;
        const data = await jget(`${KAA}/api/show/${show.slug}/episode/${fullSlug}`);
        const servers = (Array.isArray(data && data.servers) ? data.servers : []).filter(
          (s) => s && s.src && /[?&]id=/.test(s.src)
        );
        servers.sort((a, b) => {
          const rank = (s) =>
            (/type=dash/i.test(s.src) ? 0 : 2) + (/vid/i.test(s.name || '') ? 1 : 0);
          return rank(b) - rank(a);
        });
        const pick = servers[0];
        if (!pick) continue;
        const idm = pick.src.match(/[?&]id=([^&]+)/);
        if (!idm) continue;
        const master = `${HLS_HOST}/${idm[1]}/master.m3u8`;
        let subtitle = null;
        try {
          const sj = await jget(`${EDGE}/subs?u=${encodeURIComponent(pick.src)}`, 7000);
          const subs = (sj && sj.subtitles) || [];
          const en =
            subs.find((s) => s && /^en/i.test(s.lang || '')) || subs[0];
          if (en) subtitle = en.url;
        } catch (e) {}
        return {
          m3u8: `${EDGE}/hls?u=${encodeURIComponent(master)}`,
          subtitle,
        };
      } catch (e) {}
    }
  }
  return null;
}

export default function KaaResolver({ title, ep, iframeUrl, serverM3u8, serverSubtitle }) {
  const [hit, setHit] = useState(
    serverM3u8 ? { m3u8: serverM3u8, subtitle: serverSubtitle || null } : null
  );
  const [gaveUp, setGaveUp] = useState(false);

  useEffect(() => {
    if (serverM3u8) return;
    let stop = false;
    const soft = setTimeout(() => {
      if (!stop) setGaveUp(true);
    }, iframeUrl ? 7000 : 25000);
    (async () => {
      const found = await resolveOnClient(title, ep).catch(() => null);
      if (stop) return;
      clearTimeout(soft);
      if (found) setHit(found);
      else setGaveUp(true);
    })();
    return () => {
      stop = true;
      clearTimeout(soft);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, ep]);

  if (hit)
    return (
      <Player
        m3u8={hit.m3u8}
        subtitle={hit.subtitle}
        iframeUrl={iframeUrl}
        title={title}
        episodeLabel={ep !== null && ep !== undefined && ep !== '' ? `Episode ${ep}` : ''}
      />
    );

  if (!gaveUp) {
    return (
      <div className="aspect-video w-full overflow-hidden bg-black flex items-center justify-center">
        <span style={{ color: 'var(--mu)', fontSize: 13 }}>Memuat pemutar…</span>
      </div>
    );
  }

  if (iframeUrl) return <Player m3u8={null} iframeUrl={iframeUrl} />;

  return (
    <div className="aspect-video w-full overflow-hidden bg-black flex items-center justify-center">
      <span style={{ color: 'var(--mu)', fontSize: 13 }}>
        Stream tidak tersedia untuk episode ini.
      </span>
    </div>
  );
}
