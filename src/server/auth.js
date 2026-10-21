// Logowanie (#145): uzytkownicy Operator / Serwis / Admin jak w HMI. Hasla tylko jako skrot scrypt (sol + hash)
// w lokalnym pliku users.json obok config.json - plik nie trafia do repo (.gitignore; repo Visu3D jest publiczne).
// Plik tworzy / zmienia: node scripts/users.mjs set <uzytkownik> (haslo z wejscia).
//
// POST /api/login   {user, password} -> {user, level, token}  (zle haslo - 401 po 0,5 s)
// POST /api/logout  naglowek Authorization: Bearer <token>
// GET  /api/session naglowek Authorization: Bearer <token> -> {user, level} albo 401 (wylogowanie po bezczynnosci)

import crypto from 'node:crypto';
import fs from 'node:fs';

// Poziomy dostepu: 0 - niezalogowany, 1 - Operator, 2 - Serwis, 3 - Admin
export const LEVELS = { Operator: 1, Serwis: 2, Admin: 3 };
export const USERS_FILE = 'users.json';

const KEYLEN = 32;

export function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  return { salt, hash: crypto.scryptSync(String(password), salt, KEYLEN).toString('hex') };
}

export function checkPassword(entry, password) {
  if (!entry?.salt || !entry?.hash) return false;
  const want = Buffer.from(entry.hash, 'hex');
  const got = crypto.scryptSync(String(password), entry.salt, KEYLEN);
  return want.length === got.length && crypto.timingSafeEqual(want, got);
}

// users.json: {"users": {"Operator": {"level": 1, "salt": "...", "hash": "..."}, ...}}
export function loadUsers(file) {
  if (!file || !fs.existsSync(file)) return {};
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const out = {};
  for (const [name, u] of Object.entries(data.users || {})) {
    const level = Number(u.level ?? LEVELS[name]);
    if (level >= 1 && level <= 3 && u.salt && u.hash) out[name] = { level, salt: u.salt, hash: u.hash };
  }
  return out;
}

export function saveUsers(file, users) {
  fs.writeFileSync(file, `${JSON.stringify({ users }, null, 2)}\n`);
}

// Sesje w pamieci serwera; timeoutMin - wylogowanie po bezczynnosci (0 - bez limitu)
export class Auth {
  constructor(users, { timeoutMin = 30 } = {}) {
    this.users = users;
    this.timeoutMs = timeoutMin > 0 ? timeoutMin * 60000 : Infinity;
    this.sessions = new Map();
  }

  get enabled() { return Object.keys(this.users).length > 0; }

  // nazwy uzytkownikow (bez skrotow) do listy na stronie, od najnizszego poziomu
  names() { return Object.entries(this.users).sort((a, b) => a[1].level - b[1].level).map(([n]) => n); }

  login(user, password) {
    const u = this.users[user];
    if (!u || !checkPassword(u, password)) return null;
    const token = crypto.randomBytes(24).toString('hex');
    this.sessions.set(token, { user, level: u.level, last: Date.now() });
    return { user, level: u.level, token };
  }

  // sesja z tokena (odswieza czas bezczynnosci) albo null
  session(token, now = Date.now()) {
    const s = token && this.sessions.get(token);
    if (!s) return null;
    if (now - s.last > this.timeoutMs) { this.sessions.delete(token); return null; }
    s.last = now;
    return { user: s.user, level: s.level };
  }

  logout(token) { this.sessions.delete(token); }
}

export const bearer = (req) => (req.headers.authorization || '').replace(/^Bearer\s+/i, '') || null;
