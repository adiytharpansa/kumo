// Proksi HLS untuk CDN yang mewajibkan Referer situs asal.
//
// Pemutar di browser tidak bisa memasang header Referer khusus,
// jadi playlist + segmen diambil dari sisi Cloudflare dengan
// Referer yang benar, dan semua URI di dalam playlist ditulis
// ulang agar kembali lewat proksi ini.
//
// Pakai: GET /hls?u=<url target ter-encode>
// Hanya host dalam daftar izin yang dilayani (bukan proksi terbuka).

// krussdomi.com = playlist; advancedairesearchlab.xyz = CDN segmen
// (segmen .ts yang disamarkan sebagai .jpg di subdomain st1/st2/...).
const ALLOWED_SUFFIX = ['krussdomi.com', 'advancedairesearchlab.xyz'];
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function allowed(u) {
  try {
    const h = new URL(u).hostname.toLowerCase();
    return ALLOWED_SUFFIX.some((s) => h === s || h.endsWith('.' + s));
  } catch (e) {
    return false;
  }
}

function proxied(abs, base) {
  return `${base}/hls?u=${encodeURIComponent(abs)}`;
}

function rewritePlaylist(text, targetUrl, base) {
  const resolve = (ref) => {
    try {
      return new URL(ref, targetUrl).toString();
    } catch (e) {
      return null;
    }
  };
  return text
    .split('\n')
    .map((line) => {
      const t = line.trim();
      if (!t) return line;
      if (t.startsWith('#')) {
        // Atribut URI="..." pada EXT-X-KEY / EXT-X-MEDIA / EXT-X-MAP dll.
        return line.replace(/URI="([^"]+)"/g, (m, ref) => {
          const abs = resolve(ref);
          return abs ? `URI="${proxied(abs, base)}"` : m;
        });
      }
      const abs = resolve(t);
      return abs ? proxied(abs, base) : line;
    })
    .join('\n');
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname !== '/hls') {
      return new Response('not found', { status: 404 });
    }
    const target = url.searchParams.get('u') || '';
    if (!target || !/^https:\/\//i.test(target) || !allowed(target)) {
      return new Response('forbidden target', { status: 403 });
    }
    let resp;
    try {
      resp = await fetch(target, {
        headers: {
          'user-agent': UA,
          referer: 'https://krussdomi.com/',
          origin: 'https://krussdomi.com',
          accept: '*/*',
          'accept-language': 'id-ID,id;q=0.9,en;q=0.8',
          'sec-ch-ua':
            '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"Windows"',
          'sec-fetch-dest': 'empty',
          'sec-fetch-mode': 'cors',
          'sec-fetch-site': 'cross-site',
        },
        cf: { cacheTtl: 60, cacheEverything: false },
      });
    } catch (e) {
      return new Response('upstream error', { status: 502 });
    }
    if (!resp.ok) {
      return new Response('upstream HTTP ' + resp.status, { status: 502 });
    }
    const ct = resp.headers.get('content-type') || '';
    const isPlaylist =
      /mpegurl/i.test(ct) || /\.m3u8($|\?)/i.test(new URL(target).pathname);
    const cors = { 'access-control-allow-origin': '*' };
    if (isPlaylist) {
      const text = await resp.text();
      return new Response(rewritePlaylist(text, target, url.origin), {
        headers: {
          ...cors,
          'content-type': 'application/vnd.apple.mpegurl',
          'cache-control': 'public, max-age=30',
        },
      });
    }
    return new Response(resp.body, {
      headers: {
        ...cors,
        'content-type': ct || 'application/octet-stream',
        'cache-control': 'public, max-age=300',
      },
    });
  },
}
