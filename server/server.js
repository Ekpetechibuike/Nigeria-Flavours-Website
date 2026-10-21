'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const IS_PROD = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT) || 5000;

// ---------------------------------------------------------------------------
// Storage locations
// Set DATA_DIR to a persistent disk (e.g. /var/data on Render) so users,
// orders, reservations and avatars survive redeploys.
// ---------------------------------------------------------------------------
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, 'data'));
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || path.join(DATA_DIR, 'user-images'));
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const USERS_FILE = path.join(DATA_DIR, 'users.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const RESERVATIONS_FILE = path.join(DATA_DIR, 'reservations.json');

// One-time migration from the old file locations (before DATA_DIR existed).
[
  [path.join(__dirname, 'users.json'), USERS_FILE],
  [path.join(ROOT, 'users.json'), USERS_FILE],
  [path.join(ROOT, 'orders.json'), ORDERS_FILE],
  [path.join(__dirname, 'reservations.json'), RESERVATIONS_FILE]
].forEach(([from, to]) => {
  try {
    if (!fs.existsSync(to) && fs.existsSync(from)) fs.copyFileSync(from, to);
  } catch (e) { /* ignore */ }
});

function readJson(file) {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8') || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

// Write to a temp file then rename, so a crash can't leave half-written JSON.
function writeJson(file, data) {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, file);
}

const readUsers = () => readJson(USERS_FILE);
const writeUsers = (u) => writeJson(USERS_FILE, u);
const readOrders = () => readJson(ORDERS_FILE);
const writeOrders = (o) => writeJson(ORDERS_FILE, o);
const readReservations = () => readJson(RESERVATIONS_FILE);
const writeReservations = (r) => writeJson(RESERVATIONS_FILE, r);

// ---------------------------------------------------------------------------
// Passwords: scrypt with a per-user salt. Old SHA-256 / plaintext records are
// still accepted once and are upgraded to scrypt on the next successful login.
// ---------------------------------------------------------------------------
function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(password), salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

function safeEqualHex(a, b) {
  const ba = Buffer.from(String(a), 'hex');
  const bb = Buffer.from(String(b), 'hex');
  return ba.length > 0 && ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

function verifyPassword(user, password) {
  const pw = String(password);
  const stored = String(user.passwordHash || '');

  if (stored.startsWith('scrypt$')) {
    const [, saltHex, hashHex] = stored.split('$');
    if (!saltHex || !hashHex) return { ok: false };
    const candidate = crypto.scryptSync(pw, Buffer.from(saltHex, 'hex'), 64).toString('hex');
    return { ok: safeEqualHex(candidate, hashHex) };
  }

  if (stored) {
    // legacy: unsalted SHA-256 hex
    const legacy = crypto.createHash('sha256').update(pw).digest('hex');
    if (safeEqualHex(legacy, stored)) return { ok: true, upgrade: true };
    return { ok: false };
  }

  if (user.password && String(user.password) === pw) {
    // legacy: plaintext
    return { ok: true, upgrade: true };
  }
  return { ok: false };
}

// Dummy work so "unknown user" takes about as long as "wrong password".
const DUMMY_RECORD = { passwordHash: hashPassword('not-a-real-password') };

// ---------------------------------------------------------------------------
// Session tokens: stateless, HMAC-signed, expire after 7 days.
// Set SESSION_SECRET in production. Without it a secret is generated and saved
// in DATA_DIR so restarts don't log everyone out.
// ---------------------------------------------------------------------------
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function loadSessionSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  const file = path.join(DATA_DIR, '.session-secret');
  try {
    const existing = fs.readFileSync(file, 'utf8').trim();
    if (existing) return existing;
  } catch (e) { /* create below */ }
  const created = crypto.randomBytes(48).toString('hex');
  try { fs.writeFileSync(file, created, { mode: 0o600 }); } catch (e) { /* ignore */ }
  if (IS_PROD) console.warn('SESSION_SECRET is not set; using a generated secret. Set SESSION_SECRET in your environment.');
  return created;
}
const SESSION_SECRET = loadSessionSecret();

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function signToken(userId) {
  const payload = b64url(JSON.stringify({ id: userId, exp: Date.now() + TOKEN_TTL_MS }));
  const sig = b64url(crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest());
  return `v1.${payload}.${sig}`;
}

function verifyToken(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') return null;
  const expected = b64url(crypto.createHmac('sha256', SESSION_SECRET).update(parts[1]).digest());
  const a = Buffer.from(parts[2]);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
    if (!payload || typeof payload.exp !== 'number' || payload.exp < Date.now()) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ error: 'Please sign in again.' });
  const user = readUsers().find((u) => String(u.id) === String(payload.id));
  if (!user) return res.status(401).json({ error: 'Please sign in again.' });
  req.user = user;
  next();
}

// Admin routes (orders / reservations lists) need the ADMIN_KEY env var,
// sent as the "x-admin-key" header. If ADMIN_KEY is unset they stay disabled.
function adminMiddleware(req, res, next) {
  const key = process.env.ADMIN_KEY;
  const provided = String(req.headers['x-admin-key'] || '');
  if (!key || provided.length !== key.length ||
      !crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(key))) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

// ---------------------------------------------------------------------------
// Small in-memory rate limiter (no extra dependency)
// ---------------------------------------------------------------------------
function rateLimit({ windowMs, max, message }) {
  const hits = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) if (entry.reset <= now) hits.delete(key);
  }, windowMs).unref();

  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip;
    let entry = hits.get(key);
    if (!entry || entry.reset <= now) {
      entry = { count: 0, reset: now + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;
    if (entry.count > max) {
      res.set('Retry-After', String(Math.ceil((entry.reset - now) / 1000)));
      return res.status(429).json({ error: message || 'Too many requests. Please try again later.' });
    }
    next();
  };
}

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: 'Too many attempts. Please wait a few minutes and try again.' });
const writeLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 30 });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const clean = (value, max = 200) => String(value == null ? '' : value).trim().slice(0, max);
const validEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && v.length <= 254;
const validPhone = (v) => /^[0-9+()\-\s]{7,20}$/.test(v);

function publicUser(u) {
  return {
    id: u.id,
    username: u.username,
    email: u.email,
    firstName: u.firstName || '',
    surname: u.surname || '',
    phone: u.phone || '',
    loginDate: u.loginDate,
    image: u.image || 'assets/images/default-avatar.svg'
  };
}

function newId(existing) {
  let id = Date.now();
  const used = new Set(existing.map((x) => String(x.id)));
  while (used.has(String(id))) id += 1;
  return id;
}

// ---------------------------------------------------------------------------
// App + middleware
// ---------------------------------------------------------------------------
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1); // one proxy hop (Render); stops clients spoofing X-Forwarded-For

const baseOrigins = [
  'https://nigeria-flavours-website.onrender.com',
  'https://restaurant-website-trkn.onrender.com', // legacy
  'http://localhost', 'http://127.0.0.1',
  'http://localhost:3000', 'http://127.0.0.1:3000',
  'http://localhost:5000', 'http://127.0.0.1:5000',
  'http://localhost:5500', 'http://127.0.0.1:5500',
  'capacitor://localhost', 'ionic://localhost'
];
const extraOrigins = [process.env.RENDER_EXTERNAL_URL]
  .concat((process.env.ALLOWED_ORIGINS || '').split(','))
  .map((s) => (s || '').trim().replace(/\/$/, ''))
  .filter(Boolean);
const allowedOrigins = new Set(baseOrigins.concat(extraOrigins));

// Same-origin requests are always allowed; other origins must be listed above.
app.use(cors((req, callback) => {
  const origin = req.headers.origin;
  const sameOrigin = origin && origin === `${req.protocol}://${req.get('host')}`;
  if (!origin || sameOrigin || allowedOrigins.has(origin)) {
    return callback(null, { origin: true, credentials: true });
  }
  return callback(null, { origin: false });
}));

app.use(express.json({ limit: '50kb' }));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  if (IS_PROD) res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');

  const connectExtra = Array.from(allowedOrigins).filter((o) => o.startsWith('https://')).join(' ');
  const devExtra = IS_PROD ? '' : ' http://localhost:5000 http://127.0.0.1:5000';
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; " +
    `connect-src 'self' ${connectExtra}${devExtra}; ` +
    "img-src 'self' data: https: blob:; " +
    "style-src 'self' 'unsafe-inline'; " +
    "script-src 'self' 'unsafe-inline'; " +
    "font-src 'self' data:; " +
    "frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
  );
  next();
});

app.get('/ping', (req, res) => res.json({ status: 'ok' }));

// ---------------------------------------------------------------------------
// Static files: ONLY the website itself. Data files, server code, package
// files and generated mobile folders are never served.
// ---------------------------------------------------------------------------
const PUBLIC_FILES = new Set([
  'index.html', 'login.html', 'register.html', 'profile.html', 'reservations-board.html',
  'styles.css', 'script.js', 'auth.js', 'auth-handlers.js', 'app-config.js', 'pwa.js',
  'service-worker.js', 'manifest.webmanifest', 'favicon.ico', 'favicon.png'
]);

app.get('/', (req, res) => res.sendFile(path.join(ROOT, 'login.html')));

// Avatars (stored in UPLOAD_DIR, possibly outside the repo)
app.use('/assets/user-images', express.static(UPLOAD_DIR, { index: false, dotfiles: 'deny' }));

app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  if (req.path.startsWith('/api/')) return next();
  const rel = decodeURIComponent(req.path).replace(/^\/+/, '');
  if (PUBLIC_FILES.has(rel) || rel.startsWith('assets/images/')) return next();
  return res.status(404).send('Not found');
});
app.use(express.static(ROOT, { index: false, dotfiles: 'deny' }));

// ---------------------------------------------------------------------------
// Avatar uploads: images only, 5 MB max, server-generated filenames.
// ---------------------------------------------------------------------------
const MIME_EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif', 'image/avif': '.avif' };

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => {
      cb(null, `user-${req.user.id}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${MIME_EXT[file.mimetype]}`);
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (MIME_EXT[file.mimetype]) return cb(null, true);
    const err = new Error('Please upload a JPG, PNG, WebP, GIF or AVIF image.');
    err.status = 400;
    cb(err);
  }
});

// The declared MIME type comes from the client, so also check the file's real header.
function looksLikeImage(file) {
  try {
    const fd = fs.openSync(file, 'r');
    const buf = Buffer.alloc(16);
    fs.readSync(fd, buf, 0, 16, 0);
    fs.closeSync(fd);
    const isJpeg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
    const isPng = buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const isGif = buf.slice(0, 4).toString('ascii') === 'GIF8';
    const isWebp = buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP';
    const isAvif = buf.slice(4, 8).toString('ascii') === 'ftyp';
    return isJpeg || isPng || isGif || isWebp || isAvif;
  } catch (e) {
    return false;
  }
}

function removeOldAvatar(imagePath) {
  if (typeof imagePath !== 'string' || !imagePath.startsWith('/assets/user-images/')) return;
  const target = path.join(UPLOAD_DIR, path.basename(imagePath));
  if (target.startsWith(UPLOAD_DIR)) fs.unlink(target, () => {});
}

function saveAvatar(req, res, fields) {
  const users = readUsers();
  const idx = users.findIndex((u) => String(u.id) === String(req.user.id));
  if (idx === -1) return res.status(404).json({ error: 'User not found' });

  if (fields) {
    if (fields.firstName !== undefined) users[idx].firstName = clean(fields.firstName, 60);
    if (fields.surname !== undefined) users[idx].surname = clean(fields.surname, 60);
    if (fields.phone !== undefined) {
      const phone = clean(fields.phone, 20);
      if (phone && !validPhone(phone)) return res.status(400).json({ error: 'Please provide a valid phone number' });
      users[idx].phone = phone;
    }
  }

  if (req.file) {
    const filePath = path.join(UPLOAD_DIR, req.file.filename);
    if (!looksLikeImage(filePath)) {
      fs.unlink(filePath, () => {});
      return res.status(400).json({ error: 'That file is not a valid image.' });
    }
    removeOldAvatar(users[idx].image);
    users[idx].image = `/assets/user-images/${req.file.filename}`;
  }

  writeUsers(users);
  return res.json({ user: publicUser(users[idx]), imageUrl: users[idx].image });
}

// ---------------------------------------------------------------------------
// Auth routes
// ---------------------------------------------------------------------------
app.post('/api/auth/register', authLimiter, (req, res) => {
  const email = clean(req.body.email, 254);
  const username = clean(req.body.username, 40);
  const phone = clean(req.body.phone, 20);
  const firstName = clean(req.body.firstName, 60);
  const surname = clean(req.body.surname, 60);
  const password = String(req.body.password || '');

  if (!email || !username || !password) return res.status(400).json({ error: 'Please fill in all required fields' });
  if (!validEmail(email)) return res.status(400).json({ error: 'Please provide a valid email address' });
  if (phone && !validPhone(phone)) return res.status(400).json({ error: 'Please provide a valid phone number' });
  if (username.length < 3) return res.status(400).json({ error: 'Username must be at least 3 characters long' });
  if (password.length < 6 || password.length > 200) return res.status(400).json({ error: 'Password must be at least 6 characters long' });

  const users = readUsers();
  if (users.some((u) => String(u.username || '').toLowerCase() === username.toLowerCase())) {
    return res.status(400).json({ error: 'Username already exists' });
  }
  if (users.some((u) => String(u.email || '').toLowerCase() === email.toLowerCase())) {
    return res.status(400).json({ error: 'Email already exists' });
  }

  const user = {
    id: newId(users),
    email, username, phone, firstName, surname,
    passwordHash: hashPassword(password),
    loginDate: new Date().toISOString(),
    image: 'assets/images/default-avatar.svg'
  };
  users.push(user);
  writeUsers(users);

  res.status(201).json({ token: signToken(user.id), user: publicUser(user) });
});

app.post('/api/auth/login', authLimiter, (req, res) => {
  const identifier = clean(req.body.username, 254).toLowerCase();
  const password = String(req.body.password || '');
  if (!identifier || !password) return res.status(400).json({ error: 'Missing credentials' });

  const users = readUsers();
  const idx = users.findIndex((u) =>
    String(u.username || '').toLowerCase() === identifier || String(u.email || '').toLowerCase() === identifier);

  const result = verifyPassword(idx === -1 ? DUMMY_RECORD : users[idx], password);
  if (idx === -1 || !result.ok) return res.status(401).json({ error: 'Invalid username or password' });

  if (result.upgrade) {
    users[idx].passwordHash = hashPassword(password);
    delete users[idx].password;
  }
  users[idx].loginDate = new Date().toISOString();
  writeUsers(users);

  res.json({ token: signToken(users[idx].id), user: publicUser(users[idx]) });
});

app.get('/api/auth/me', authMiddleware, (req, res) => res.json({ user: publicUser(req.user) }));

// Update profile details and/or avatar for the signed-in user.
// The user id always comes from the token, never from the request body.
app.post('/api/auth/profile-upload', authMiddleware, upload.single('avatar'), (req, res) => saveAvatar(req, res, req.body));

app.post('/api/auth/upload-avatar', authMiddleware, upload.single('avatar'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  return saveAvatar(req, res, null);
});

// ---------------------------------------------------------------------------
// Reservations & orders
// ---------------------------------------------------------------------------
app.post('/api/reservations', writeLimiter, (req, res) => {
  const name = clean(req.body.name, 100);
  const email = clean(req.body.email, 254);
  const phone = clean(req.body.phone, 20);
  const date = clean(req.body.date, 20);
  const time = clean(req.body.time, 20);
  const guests = clean(req.body.guests, 10);

  if (!name || !email || !phone || !date || !time || !guests) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }
  if (!validEmail(email)) return res.status(400).json({ error: 'Please provide a valid email address.' });
  if (!validPhone(phone)) return res.status(400).json({ error: 'Please provide a valid phone number.' });

  const reservations = readReservations();
  const ipAddress = req.ip;

  const duplicate = reservations.find((r) =>
    (r.ipAddress && r.ipAddress === ipAddress) ||
    (r.email && r.email.toLowerCase() === email.toLowerCase()) ||
    (r.phone && r.phone === phone));
  if (duplicate) return res.status(403).json({ error: 'You have already reserved.' });

  const foods = Array.isArray(req.body.foods)
    ? req.body.foods.slice(0, 50).map((f) => ({ name: clean(f && f.name, 100), price: Number(f && f.price) || 0 }))
    : [];

  const reservation = {
    id: newId(reservations),
    name, email, phone, date, time, guests,
    message: clean(req.body.message, 500),
    foods,
    ipAddress,
    createdAt: new Date().toISOString()
  };
  reservations.push(reservation);

  try {
    writeReservations(reservations);
  } catch (err) {
    return res.status(500).json({ error: 'Could not save reservation.' });
  }
  const { ipAddress: _ip, ...safe } = reservation;
  res.status(201).json({ ok: true, reservation: safe });
});

// Customer details: staff only (x-admin-key header).
app.get('/api/reservations', adminMiddleware, (req, res) => {
  res.json(readReservations().map(({ ipAddress, ...r }) => r));
});

app.post('/api/orders', authMiddleware, writeLimiter, (req, res) => {
  const name = clean(req.body.name, 100);
  const phone = clean(req.body.phone, 20);
  const dish = clean(req.body.dish, 200);
  const address = clean(req.body.address, 300);
  const quantity = parseInt(req.body.quantity, 10);
  const total = parseFloat(req.body.total);

  if (!name || !phone || !dish || !address || !(quantity > 0 && quantity <= 100)) {
    return res.status(400).json({ error: 'Missing or invalid fields' });
  }
  if (!validPhone(phone)) return res.status(400).json({ error: 'Please provide a valid phone number.' });

  const orders = readOrders();
  const order = {
    id: newId(orders),
    userId: req.user.id,
    name, phone, dish, quantity, address,
    total: Number.isFinite(total) ? total : 0,
    createdAt: new Date().toISOString()
  };
  orders.push(order);
  writeOrders(orders);
  res.status(201).json({ ok: true, order });
});

app.get('/api/orders', adminMiddleware, (req, res) => res.json(readOrders()));

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const msg = err.code === 'LIMIT_FILE_SIZE' ? 'File too large. Max 5MB.' : 'Upload failed.';
    return res.status(400).json({ error: msg });
  }
  if (err && err.status === 400) return res.status(400).json({ error: err.message });
  if (err && err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid request.' });
  console.error('Server error:', err && err.message ? err.message : err);
  res.status(500).json({ error: 'Something went wrong.' });
});

if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => console.log(`Server listening on port ${PORT} (data in ${DATA_DIR})`));
}

module.exports = app;
