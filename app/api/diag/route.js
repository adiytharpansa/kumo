// Rute diagnosis SEMENTARA — dihapus setelah selesai dipakai.
export const dynamic = 'force-dynamic';

export async function GET() {
  const out = {};
  const t = async (name, fn) => {
    const s = Date.now();
    try {
      const v = await fn();
      out[name] = { ms: Date.now() - s, ...v };
    } catch (e) {
      out[name] = {
        ms: Date.now() - s,
        error: String((e && e.message) || e),
        cause: String((e && e.cause) || ''),
      };
    }
  };

  await t('workerEps', async () => {
    const r = await fetch(
      'https://kumo-hls.adiyth-arpansa.workers.dev/eps?title=Sousou%20no%20Frieren&year=2023'
    );
    return { status: r.status, body: (await r.text()).slice(0, 140) };
  });

  await t('workerResolve', async () => {
    const r = await fetch(
      'https://kumo-hls.adiyth-arpansa.workers.dev/resolve?title=sousou%20no%20frieren&ep=1'
    );
    return { status: r.status, body: (await r.text()).slice(0, 140) };
  });

  await t('kaaDirectGet', async () => {
    const r = await fetch('https://kaa.lt/api/show/sousou-no-frieren-2d15', {
      headers: { accept: 'application/json' },
    });
    return { status: r.status, body: (await r.text()).slice(0, 80) };
  });

  await t('pxFetch', async () => {
    const r = await fetch(
      'https://kumo.adiyth-arpansa.workers.dev/px?u=' +
        encodeURIComponent('https://gogoanime.by/series/sousou-no-frieren/')
    );
    const txt = await r.text();
    return { status: r.status, len: txt.length };
  });

  return Response.json(out);
}
