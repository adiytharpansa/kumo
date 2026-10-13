// Pengganti rute /px pada Worker lama: ambil halaman dari sisi server
// dengan UA browser + referer asal target, teruskan status & tipe konten.
export async function GET(request) {
  const u = new URL(request.url).searchParams.get('u');
  if (!u || !/^https?:\/\//i.test(u)) {
    return new Response('parameter u tidak valid', { status: 400 });
  }
  try {
    const origin = new URL(u).origin + '/';
    const r = await fetch(u, {
      headers: {
        'user-agent':
          'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36',
        referer: origin,
        'accept-language': 'id-ID,id;q=0.9,en;q=0.8',
      },
      redirect: 'follow',
    });
    const body = await r.arrayBuffer();
    return new Response(body, {
      status: r.status,
      headers: {
        'content-type': r.headers.get('content-type') || 'text/html; charset=utf-8',
        'access-control-allow-origin': '*',
        'cache-control': 'public, s-maxage=120, stale-while-revalidate=60',
      },
    });
  } catch (e) {
    return new Response('gagal mengambil halaman', { status: 502 });
  }
}
