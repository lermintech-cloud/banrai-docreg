// Cloudflare Pages Function + D1 (binding ชื่อ DB)
let ready = false;
const J = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'content-type': 'application/json' } });
async function init(db) {
  if (ready) return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS docs(id INTEGER PRIMARY KEY AUTOINCREMENT,type TEXT NOT NULL,year INTEGER NOT NULL,seq INTEGER NOT NULL,doc_no TEXT,doc_date TEXT,subject TEXT,party TEXT,owner TEXT,note TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_docs ON docs(type,year,seq)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS settings(k TEXT PRIMARY KEY,v TEXT)`)
  ]);
  await db.prepare('INSERT OR IGNORE INTO settings(k,v) VALUES("pin",?)').bind(await sha('123456')).run(); // รหัสเริ่มต้น 123456 (เก็บเป็น hash)
  ready = true;
}
async function sha(s) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('banrai-docreg:' + s));
  return 'h:' + [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}
async function checkPin(db, pin) {
  const row = await db.prepare('SELECT v FROM settings WHERE k="pin"').first();
  const st = row?.v;
  if (!st) return pin === '123456';
  if (st.startsWith('h:')) return st === await sha(pin);
  if (st !== pin) return false; // รหัสแบบเก่า (ข้อความธรรมดา) -> อัปเกรดเป็น hash
  await db.prepare('UPDATE settings SET v=? WHERE k="pin"').bind(await sha(pin)).run();
  return true;
}
export async function onRequest({ request, env }) {
  const db = env.DB;
  if (!db) return J({ error: 'ยังไม่ได้ผูก D1 binding ชื่อ DB' }, 500);
  await init(db);
  const url = new URL(request.url);
  const [res, id] = url.pathname.replace(/^\/api\/?/, '').split('/');
  const m = request.method;
  try {
    const needPin = async () => (await checkPin(db, request.headers.get('x-pin') || '')) ? null : J({ error: 'รหัสผ่านไม่ถูกต้อง' }, 401);
    if (res === 'verify') return (await needPin()) || J({ ok: 1 });
    if (res === 'pin' && m === 'PUT') {
      const bad = await needPin(); if (bad) return bad;
      const { pin } = await request.json();
      if (!pin || String(pin).length < 4) return J({ error: 'รหัสต้องมีอย่างน้อย 4 ตัว' }, 400);
      await db.prepare('INSERT INTO settings(k,v) VALUES("pin",?) ON CONFLICT(k) DO UPDATE SET v=excluded.v').bind(await sha(String(pin))).run();
      return J({ ok: 1 });
    }
    if (res === 'settings') {
      if (m === 'PUT') {
        const bad = await needPin(); if (bad) return bad;
        await db.prepare('INSERT INTO settings(k,v) VALUES("cfg",?) ON CONFLICT(k) DO UPDATE SET v=excluded.v').bind(JSON.stringify(await request.json())).run();
        return J({ ok: 1 });
      }
      const r = await db.prepare('SELECT v FROM settings WHERE k="cfg"').first();
      return J(r ? JSON.parse(r.v) : {});
    }
    if (res === 'docs') {
      if (m === 'GET') {
        const t = url.searchParams.get('type'), y = url.searchParams.get('year');
        let q = 'SELECT * FROM docs WHERE 1=1', b = [];
        if (t) { q += ' AND type=?'; b.push(t); }
        if (y) { q += ' AND year=?'; b.push(+y); }
        q += ' ORDER BY type,year,seq';
        return J((await db.prepare(q).bind(...b).all()).results);
      }
      if (m === 'DELETE' || m === 'PUT') { const bad = await needPin(); if (bad) return bad; }
      if (m === 'DELETE') { await db.prepare('DELETE FROM docs WHERE id=?').bind(+id).run(); return J({ ok: 1 }); }
      const d = await request.json();
      const v = [d.type, +d.year, +d.seq, d.doc_no || '', d.doc_date || '', d.subject || '', d.party || '', d.owner || '', d.note || ''];
      if (m === 'POST') { // เพิ่มรายการใหม่ ไม่ต้องใช้รหัส
        const r = await db.prepare('INSERT INTO docs(type,year,seq,doc_no,doc_date,subject,party,owner,note) VALUES(?,?,?,?,?,?,?,?,?)').bind(...v).run();
        return J({ id: r.meta.last_row_id });
      }
      if (m === 'PUT') {
        await db.prepare('UPDATE docs SET type=?,year=?,seq=?,doc_no=?,doc_date=?,subject=?,party=?,owner=?,note=? WHERE id=?').bind(...v, +id).run();
        return J({ ok: 1 });
      }
    }
    return J({ error: 'not found' }, 404);
  } catch (e) { return J({ error: String(e) }, 500); }
}
