import { put } from '@vercel/blob';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  if (!process.env.UPLOAD_PASSCODE || req.headers['x-passcode'] !== process.env.UPLOAD_PASSCODE) return res.status(401).json({ error: 'passcode' });
  const { id, kind } = req.query;
  if (!/^[a-z0-9]{6,24}$/.test(id || '') || !['full', 'thumb'].includes(kind)) return res.status(400).json({ error: 'bad id' });
  let buf = req.body;
  if (!Buffer.isBuffer(buf)) {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    buf = Buffer.concat(chunks);
  }
  if (!buf.length || buf.length > 4.4e6) return res.status(413).json({ error: 'size' });
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return res.status(415).json({ error: 'jpeg only' });
  const b = await put(`p/${id}-${kind}.jpg`, buf, { access: 'public', contentType: 'image/jpeg', addRandomSuffix: true, cacheControlMaxAge: 31536000 });
  return res.json({ url: b.url });
}
