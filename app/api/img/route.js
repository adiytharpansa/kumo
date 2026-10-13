// Pengganti rute /img pada Worker lama: proksi gambar satu-origin, cache 7 hari.
export async function GET(request) {
  const u = new URL(request.url).searchParams.get('u');
  if (!u || !/^https?:\/\//i.test(u)) {
    return new Response('parameter u tidak valid', { status: 400 });
  }
  try {
    const r = await fetch(u, {
      headers: {
        'user-agent':
          'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36',
      },
      redirect: 'follow',
    });
    const ct = r.headers.get('content-type') || '';
    if (!r.ok || !ct.startsWith('image/')) {
      return new Response('bukan gambar', { status: 404 });
    }
    const body = await r.arrayBuffer();
    return new Response(body, {
      status: 200,
      headers: {
        'content-type': ct,
        'access-control-allow-origin': '*',
        'cache-control': 'public, max-age=604800, s-maxage=604800, immutable',
      },
    });
  } catch (e) {
    return new Response('gagal mengambil gambar', { status: 502 });
  }
}
