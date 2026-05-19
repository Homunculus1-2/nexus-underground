require('dotenv').config();
const express = require('express');
const path = require('path');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const { pool, initDb } = require('./db');
 
const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const NODE_ENV = process.env.NODE_ENV || 'development';
 
// ============================ XAVFSIZLIK TEKSHIRUVI ============================
if (!JWT_SECRET || JWT_SECRET.length < 16) {
  console.error('❌ JWT_SECRET o\'rnatilmagan yoki juda qisqa (kamida 16 belgi). Railway Variables\'da qo\'shing.');
  process.exit(1);
}
if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
  console.error('❌ ADMIN_USERNAME va ADMIN_PASSWORD o\'rnatilmagan. Railway Variables\'da qo\'shing.');
  process.exit(1);
}
if (ADMIN_PASSWORD.length < 8) {
  console.error('❌ ADMIN_PASSWORD juda qisqa (kamida 8 belgi).');
  process.exit(1);
}
 
app.use(cors());
app.use(express.json({ limit: '2mb' }));
 
// ============================ STATIC FAYLLAR ============================
// Avval `public/` papkani sinab ko'radi, bo'lmasa root'ni ishlatadi.
// Bu sizga ikkala holatda ham ishlash imkonini beradi.
const fs = require('fs');
let PUBLIC_DIR = path.join(__dirname, 'public');
if (!fs.existsSync(path.join(PUBLIC_DIR, 'index.html'))) {
  PUBLIC_DIR = __dirname;
}
console.log('📂 Public directory:', PUBLIC_DIR);
app.use(express.static(PUBLIC_DIR));
 
// ============================ AUTH MIDDLEWARE ============================
function requireAdmin(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token kerak' });
  }
  const token = auth.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded.admin) return res.status(403).json({ error: 'Ruxsat yo\'q' });
    req.user = decoded;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Token noto\'g\'ri' });
  }
}
 
// ============================ LOGIN RATE LIMIT (oddiy) ============================
const loginAttempts = new Map(); // ip -> { count, firstAt }
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 daqiqa
 
function checkRateLimit(ip) {
  const now = Date.now();
  const rec = loginAttempts.get(ip);
  if (!rec || now - rec.firstAt > WINDOW_MS) {
    loginAttempts.set(ip, { count: 1, firstAt: now });
    return true;
  }
  rec.count++;
  if (rec.count > MAX_ATTEMPTS) return false;
  return true;
}
 
function resetRateLimit(ip) {
  loginAttempts.delete(ip);
}
 
// Eski yozuvlarni har 30 daqiqada tozalash
setInterval(() => {
  const now = Date.now();
  for (const [ip, rec] of loginAttempts) {
    if (now - rec.firstAt > WINDOW_MS) loginAttempts.delete(ip);
  }
}, 30 * 60 * 1000);
 
// ============================ XATOLARNI SAFE QAYTARISH ============================
function safeError(res, err, label = 'Server xatosi') {
  console.error(`[${label}]`, err);
  // Production'da batafsil xatoni yashirish
  const msg = NODE_ENV === 'production' ? label : (err.message || label);
  res.status(500).json({ error: msg });
}
 
// ============================ AUTH ============================
app.post('/api/admin/login', async (req, res) => {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
 
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Juda ko\'p urinish. 15 daqiqadan keyin qayta urining.' });
  }
 
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Login va parol kerak' });
  }
 
  if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Login yoki parol noto\'g\'ri' });
  }
 
  resetRateLimit(ip);
  const token = jwt.sign({ admin: true, username }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token });
});
 
app.get('/api/admin/verify', requireAdmin, (req, res) => {
  res.json({ ok: true, user: req.user });
});
 
// ============================ HELPER ============================
function parseJson(field) {
  if (!field) return null;
  if (typeof field === 'object') return field;
  try { return JSON.parse(field); } catch { return null; }
}
 
function rowToAccount(r) {
  return {
    id: r.id,
    code: r.code,
    title: r.title,
    tag: r.tag,
    region: r.region,
    kd: r.kd,
    level: r.level,
    mythics: r.mythics,
    tier: r.tier,
    price: r.price,
    color1: r.color1,
    color2: r.color2,
    tags: parseJson(r.tags) || [],
    video: r.video,
    description: r.description,
    skins: parseJson(r.skins) || [],
    stats: parseJson(r.stats) || {},
    sold: r.sold
  };
}
 
// ============================ ACCOUNTS ============================
app.get('/api/accounts', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM accounts WHERE sold = FALSE ORDER BY created_at DESC');
    res.json(rows.map(rowToAccount));
  } catch (e) { safeError(res, e, 'Akkauntlarni olishda xato'); }
});
 
app.get('/api/admin/accounts', requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM accounts ORDER BY created_at DESC');
    res.json(rows.map(rowToAccount));
  } catch (e) { safeError(res, e, 'Akkauntlarni olishda xato'); }
});
 
app.post('/api/admin/accounts', requireAdmin, async (req, res) => {
  try {
    const a = req.body;
    const { rows } = await pool.query(
      `INSERT INTO accounts (code, title, tag, region, kd, level, mythics, tier, price, color1, color2, tags, video, description, skins, stats)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
      [
        a.code || 'A1', a.title, a.tag || 'mythic', a.region, a.kd, a.level || 1,
        a.mythics || 0, a.tier, a.price, a.color1 || '#2B1055', a.color2 || '#7597DE',
        JSON.stringify(a.tags || []), a.video, a.description,
        JSON.stringify(a.skins || []), JSON.stringify(a.stats || {})
      ]
    );
    res.json(rowToAccount(rows[0]));
  } catch (e) { safeError(res, e, 'Akkaunt qo\'shishda xato'); }
});
 
app.put('/api/admin/accounts/:id', requireAdmin, async (req, res) => {
  try {
    const a = req.body;
    const { rows } = await pool.query(
      `UPDATE accounts SET code=$1, title=$2, tag=$3, region=$4, kd=$5, level=$6, mythics=$7, tier=$8, price=$9,
       color1=$10, color2=$11, tags=$12, video=$13, description=$14, skins=$15, stats=$16, sold=$17
       WHERE id=$18 RETURNING *`,
      [
        a.code, a.title, a.tag, a.region, a.kd, a.level, a.mythics, a.tier, a.price,
        a.color1, a.color2, JSON.stringify(a.tags || []), a.video, a.description,
        JSON.stringify(a.skins || []), JSON.stringify(a.stats || {}), a.sold || false,
        req.params.id
      ]
    );
    if (!rows.length) return res.status(404).json({ error: 'Topilmadi' });
    res.json(rowToAccount(rows[0]));
  } catch (e) { safeError(res, e, 'Akkauntni yangilashda xato'); }
});
 
app.delete('/api/admin/accounts/:id', requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM accounts WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { safeError(res, e, 'Akkauntni o\'chirishda xato'); }
});
 
// ============================ UC PACKAGES ============================
app.get('/api/uc', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM uc_packages ORDER BY sort_order ASC, uc ASC');
    res.json(rows);
  } catch (e) { safeError(res, e, 'UC paketlarini olishda xato'); }
});
 
app.post('/api/admin/uc', requireAdmin, async (req, res) => {
  try {
    const { uc, usd, tag, glow, sort_order } = req.body;
    const { rows } = await pool.query(
      'INSERT INTO uc_packages (uc, usd, tag, glow, sort_order) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [uc, usd, tag, glow || '#00E5FF', sort_order || 0]
    );
    res.json(rows[0]);
  } catch (e) { safeError(res, e, 'UC paket qo\'shishda xato'); }
});
 
app.put('/api/admin/uc/:id', requireAdmin, async (req, res) => {
  try {
    const { uc, usd, tag, glow, sort_order } = req.body;
    const { rows } = await pool.query(
      'UPDATE uc_packages SET uc=$1, usd=$2, tag=$3, glow=$4, sort_order=$5 WHERE id=$6 RETURNING *',
      [uc, usd, tag, glow, sort_order || 0, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Topilmadi' });
    res.json(rows[0]);
  } catch (e) { safeError(res, e, 'UC paketni yangilashda xato'); }
});
 
app.delete('/api/admin/uc/:id', requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM uc_packages WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { safeError(res, e, 'UC paketni o\'chirishda xato'); }
});
 
// ============================ TOURNAMENTS ============================
app.get('/api/tournaments', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM tournaments ORDER BY ends_at ASC');
    res.json(rows);
  } catch (e) { safeError(res, e, 'Turnirlarni olishda xato'); }
});
 
app.post('/api/admin/tournaments', requireAdmin, async (req, res) => {
  try {
    const t = req.body;
    const { rows } = await pool.query(
      `INSERT INTO tournaments (title, mode, prize, prize_uzs, slots, filled, entry, color, tag, ends_at, map)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [t.title, t.mode, t.prize, t.prize_uzs, t.slots, t.filled || 0, t.entry, t.color, t.tag, t.ends_at, t.map]
    );
    res.json(rows[0]);
  } catch (e) { safeError(res, e, 'Turnir qo\'shishda xato'); }
});
 
app.put('/api/admin/tournaments/:id', requireAdmin, async (req, res) => {
  try {
    const t = req.body;
    const { rows } = await pool.query(
      `UPDATE tournaments SET title=$1, mode=$2, prize=$3, prize_uzs=$4, slots=$5, filled=$6, entry=$7, color=$8, tag=$9, ends_at=$10, map=$11
       WHERE id=$12 RETURNING *`,
      [t.title, t.mode, t.prize, t.prize_uzs, t.slots, t.filled, t.entry, t.color, t.tag, t.ends_at, t.map, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Topilmadi' });
    res.json(rows[0]);
  } catch (e) { safeError(res, e, 'Turnirni yangilashda xato'); }
});
 
app.delete('/api/admin/tournaments/:id', requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM tournaments WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { safeError(res, e, 'Turnirni o\'chirishda xato'); }
});
 
// ============================ GIVEAWAYS ============================
app.get('/api/giveaways', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM giveaways ORDER BY ends_at ASC');
    res.json(rows);
  } catch (e) { safeError(res, e, 'Giveaway\'larni olishda xato'); }
});
 
app.post('/api/admin/giveaways', requireAdmin, async (req, res) => {
  try {
    const g = req.body;
    const { rows } = await pool.query(
      'INSERT INTO giveaways (title, sub, prize, ends_at, color, tag) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [g.title, g.sub, g.prize, g.ends_at, g.color, g.tag]
    );
    res.json(rows[0]);
  } catch (e) { safeError(res, e, 'Giveaway qo\'shishda xato'); }
});
 
app.put('/api/admin/giveaways/:id', requireAdmin, async (req, res) => {
  try {
    const g = req.body;
    const { rows } = await pool.query(
      'UPDATE giveaways SET title=$1, sub=$2, prize=$3, ends_at=$4, color=$5, tag=$6 WHERE id=$7 RETURNING *',
      [g.title, g.sub, g.prize, g.ends_at, g.color, g.tag, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Topilmadi' });
    res.json(rows[0]);
  } catch (e) { safeError(res, e, 'Giveaway\'ni yangilashda xato'); }
});
 
app.delete('/api/admin/giveaways/:id', requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM giveaways WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { safeError(res, e, 'Giveaway\'ni o\'chirishda xato'); }
});
 
// ============================ WINNERS ============================
app.get('/api/winners', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM winners ORDER BY created_at DESC LIMIT 20');
    res.json(rows);
  } catch (e) { safeError(res, e, 'G\'oliblarni olishda xato'); }
});
 
app.post('/api/admin/winners', requireAdmin, async (req, res) => {
  try {
    const { name, prize, date } = req.body;
    const { rows } = await pool.query(
      'INSERT INTO winners (name, prize, date) VALUES ($1,$2,$3) RETURNING *',
      [name, prize, date]
    );
    res.json(rows[0]);
  } catch (e) { safeError(res, e, 'G\'olib qo\'shishda xato'); }
});
 
app.delete('/api/admin/winners/:id', requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM winners WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { safeError(res, e, 'G\'olibni o\'chirishda xato'); }
});
 
// ============================ LEADERBOARD ============================
app.get('/api/leaderboard', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM leaderboard ORDER BY rank ASC LIMIT 10');
    res.json(rows);
  } catch (e) { safeError(res, e, 'Leaderboard\'ni olishda xato'); }
});
 
app.post('/api/admin/leaderboard', requireAdmin, async (req, res) => {
  try {
    const { rank, name, team, points, kills, color } = req.body;
    const { rows } = await pool.query(
      'INSERT INTO leaderboard (rank, name, team, points, kills, color) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [rank, name, team, points, kills, color || '#9D4EDD']
    );
    res.json(rows[0]);
  } catch (e) { safeError(res, e, 'Leaderboard\'ga qo\'shishda xato'); }
});
 
app.put('/api/admin/leaderboard/:id', requireAdmin, async (req, res) => {
  try {
    const { rank, name, team, points, kills, color } = req.body;
    const { rows } = await pool.query(
      'UPDATE leaderboard SET rank=$1, name=$2, team=$3, points=$4, kills=$5, color=$6 WHERE id=$7 RETURNING *',
      [rank, name, team, points, kills, color, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Topilmadi' });
    res.json(rows[0]);
  } catch (e) { safeError(res, e, 'Leaderboard\'ni yangilashda xato'); }
});
 
app.delete('/api/admin/leaderboard/:id', requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM leaderboard WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { safeError(res, e, 'Leaderboard yozuvini o\'chirishda xato'); }
});
 
// ============================ MATCHES ============================
app.get('/api/matches', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM matches ORDER BY sort_order ASC, id ASC');
    res.json(rows);
  } catch (e) { safeError(res, e, 'Jadvalni olishda xato'); }
});
 
app.post('/api/admin/matches', requireAdmin, async (req, res) => {
  try {
    const { date_label, time_label, team1, team2, live, sort_order } = req.body;
    const { rows } = await pool.query(
      'INSERT INTO matches (date_label, time_label, team1, team2, live, sort_order) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [date_label, time_label, team1, team2, live || false, sort_order || 0]
    );
    res.json(rows[0]);
  } catch (e) { safeError(res, e, 'O\'yin qo\'shishda xato'); }
});
 
app.put('/api/admin/matches/:id', requireAdmin, async (req, res) => {
  try {
    const { date_label, time_label, team1, team2, live, sort_order } = req.body;
    const { rows } = await pool.query(
      'UPDATE matches SET date_label=$1, time_label=$2, team1=$3, team2=$4, live=$5, sort_order=$6 WHERE id=$7 RETURNING *',
      [date_label, time_label, team1, team2, live, sort_order, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Topilmadi' });
    res.json(rows[0]);
  } catch (e) { safeError(res, e, 'O\'yinni yangilashda xato'); }
});
 
app.delete('/api/admin/matches/:id', requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM matches WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { safeError(res, e, 'O\'yinni o\'chirishda xato'); }
});
 
// ============================ STATS ============================
app.get('/api/stats', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT key, value FROM stats');
    const obj = {};
    rows.forEach(r => { obj[r.key] = r.value; });
    res.json(obj);
  } catch (e) { safeError(res, e, 'Statistikani olishda xato'); }
});
 
app.put('/api/admin/stats', requireAdmin, async (req, res) => {
  try {
    const updates = req.body;
    for (const [key, value] of Object.entries(updates)) {
      await pool.query(
        `INSERT INTO stats (key, value, updated_at) VALUES ($1, $2, NOW())
         ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=NOW()`,
        [key, String(value)]
      );
    }
    res.json({ ok: true });
  } catch (e) { safeError(res, e, 'Statistikani yangilashda xato'); }
});
 
// ============================ HEALTH CHECK ============================
app.get('/api/health', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});
 
// ============================ HTML ROUTES ============================
app.get('/admin', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'admin.html'), err => {
    if (err) {
      console.error('admin.html xato:', err.message);
      res.status(500).send('admin.html topilmadi');
    }
  });
});
 
app.get('/', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'), err => {
    if (err) {
      console.error('index.html xato:', err.message);
      res.status(500).send('index.html topilmadi');
    }
  });
});
 
// ============================ 404 — FAQAT NOMA'LUM ROUTE'LAR UCHUN ============================
// API uchun JSON xato qaytaradi, qolganlari uchun index.html (SPA fallback)
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint topilmadi' });
  }
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'), err => {
    if (err) res.status(404).send('Sahifa topilmadi');
  });
});
 
// ============================ GLOBAL XATO HANDLER ============================
app.use((err, req, res, next) => {
  console.error('Global xato:', err);
  res.status(500).json({ error: 'Server xatosi' });
});
 
// ============================ START ============================
initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`✓ Nexus server: http://localhost:${PORT}`);
      console.log(`✓ Admin panel: http://localhost:${PORT}/admin`);
      console.log(`✓ Muhit: ${NODE_ENV}`);
    });
  })
  .catch(err => {
    console.error('Database init xato:', err);
    process.exit(1);
  });
 
// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM qabul qilindi, server to\'xtatilmoqda...');
  await pool.end();
  process.exit(0);
});
  console.log('SIGTERM qabul qilindi, server to\'xtatilmoqda...');
  await pool.end();
  process.exit(0);
