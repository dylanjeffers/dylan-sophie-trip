import { list, put, del } from '@vercel/blob';

const num = v => (v === null || v === undefined || v === '' || !isFinite(parseFloat(v)) ? null : parseFloat(v));
const who = v => String(v || '').trim().replace(/[^A-Za-z ]/g, '').slice(0, 20) || 'Us';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const r = await list({ prefix: 'loc/', limit: 20 });
    const items = (await Promise.all(r.blobs.map(async b => {
      try { const x = await fetch(`${b.url}?v=${new Date(b.uploadedAt).getTime()}`); return x.ok ? await x.json() : null; } catch { return null; }
    }))).filter(Boolean);
    res.setHeader('Cache-Control', 'public, s-maxage=15, stale-while-revalidate=30');
    return res.json(items);
  }
  if (req.method !== 'POST' && req.method !== 'DELETE') return res.status(405).json({ error: 'method' });
  const q = req.query || {};
  const b = (typeof req.body === 'string' ? (() => { try { return JSON.parse(req.body); } catch { return {}; } })() : req.body) || {};
  const pass = req.headers['x-passcode'] || b.passcode || q.passcode;
  if (!process.env.UPLOAD_PASSCODE || pass !== process.env.UPLOAD_PASSCODE) return res.status(401).json({ error: 'passcode' });
  if (req.method === 'DELETE') {
    const key = `loc/${who(q.by).toLowerCase().replace(/ /g, '-')}.json`;
    const r = await list({ prefix: key });
    if (r.blobs[0]) await del(r.blobs[0].url);
    return res.json({ ok: true, removed: !!r.blobs[0] });
  }
  const lat = num(b.lat ?? q.lat), lng = num(b.lng ?? q.lng);
  if (lat === null || lng === null || Math.abs(lat) > 90 || Math.abs(lng) > 180) return res.status(400).json({ error: 'lat/lng' });
  const by = who(b.by ?? q.by);
  // Rounded to ~100 m: enough for family to see the neighborhood.
  const rec = { by, lat: +lat.toFixed(3), lng: +lng.toFixed(3), at: new Date().toISOString(), src: String(b.src ?? q.src ?? 'web').slice(0, 12) };
  await put(`loc/${by.toLowerCase().replace(/ /g, '-')}.json`, JSON.stringify(rec), { access: 'public', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true, cacheControlMaxAge: 60 });
  return res.json({ ok: true, ...rec });
}
