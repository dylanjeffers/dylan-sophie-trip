import { list, put, del } from '@vercel/blob';

const BLOB = /^https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\//;
const ID = /^[a-z0-9]{6,24}$/;
const num = v => (v === null || v === undefined || v === '' || !isFinite(+v) ? null : +v);

async function readMeta(b) {
  try {
    const r = await fetch(`${b.url}?v=${new Date(b.uploadedAt).getTime()}`);
    return r.ok ? await r.json() : null;
  } catch { return null; }
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const blobs = [];
    let cursor;
    do {
      const r = await list({ prefix: 'meta/', cursor, limit: 1000 });
      blobs.push(...r.blobs);
      cursor = r.hasMore ? r.cursor : undefined;
    } while (cursor);
    const items = (await Promise.all(blobs.map(readMeta))).filter(Boolean);
    res.setHeader('Cache-Control', 'public, s-maxage=15, stale-while-revalidate=60');
    return res.json(items);
  }
  if (!process.env.UPLOAD_PASSCODE || req.headers['x-passcode'] !== process.env.UPLOAD_PASSCODE) return res.status(401).json({ error: 'passcode' });
  if (req.method === 'POST') {
    const m = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    if (!ID.test(m.id || '') || !BLOB.test(m.full || '') || !BLOB.test(m.thumb || '')) return res.status(400).json({ error: 'bad meta' });
    const clean = {
      id: m.id, full: m.full, thumb: m.thumb, w: +m.w || 0, h: +m.h || 0,
      taken: String(m.taken || '').slice(0, 19), lat: num(m.lat), lng: num(m.lng), approx: !!m.approx,
      caption: String(m.caption || '').slice(0, 300), by: String(m.by || '').slice(0, 40),
      added: String(m.added || new Date().toISOString()).slice(0, 30),
    };
    await put(`meta/${m.id}.json`, JSON.stringify(clean), { access: 'public', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true, cacheControlMaxAge: 60 });
    return res.json({ ok: true });
  }
  if (req.method === 'DELETE') {
    const id = String(req.query.id || '');
    if (!ID.test(id)) return res.status(400).json({ error: 'bad id' });
    const r = await list({ prefix: `meta/${id}.json` });
    const b = r.blobs[0];
    if (!b) return res.status(404).json({ error: 'not found' });
    const m = (await readMeta({ url: b.url, uploadedAt: Date.now() })) || {};
    await del([b.url, m.full, m.thumb].filter(u => u && BLOB.test(u)));
    return res.json({ ok: true });
  }
  return res.status(405).json({ error: 'method' });
}
