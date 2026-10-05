export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const { query, variables } = req.body || {};
  if (typeof query !== 'string' || query.length > 20000) {
    return res.status(400).json({ error: 'Query tidak valid' });
  }
  const upstream = await fetch('https://graphql.anilist.co', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': 'Kumo/1.1 (https://github.com/adiytharpansa/kumo)',
    },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(15000),
  });
  const text = await upstream.text();
  res.setHeader('Cache-Control', 'public, max-age=300');
  return res.status(upstream.status).send(text);
}
