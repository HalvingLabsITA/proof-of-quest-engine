// Proof of Quest: backend della classifica condivisa.
// Il Worker serve i file del gioco (cartella public/) e risponde agli indirizzi /api/*.
// Dati in Cloudflare D1 (tabella players, vedi schema.sql).
import { checkName } from './names.js';

// Limiti di plausibilità del punteggio: i sats massimi realistici crescono con i piani completati.
// Massimo per piano ≈ 2.400 + 400 × profondità sats (vedi README, sezione Classifica); qui c'è ampio margine.
const satsCap = (floors, legends) => 5000 + 3000 * floors + 250 * floors * floors + 8000 * legends;
const MIN_INTERVAL_MS = 3000;   // un invio ogni 3 secondi al massimo per giocatore
// Piani plausibili: ogni piano live è un blocco vero. Dal primo invio di un giocatore non possono passare più blocchi
// di uno ogni 3 minuti (la media è 10), più i 6 blocchi di partenza e un margine.
const FLOOR_MIN_MS = 180e3, FLOOR_SLACK = 12;
// Minatori Solitari: blocchi minati in solo sono rari (molto meno di uno ogni 20 blocchi).
const legendsMax = floors => 1 + Math.floor(floors / 20);
const IP_MAX_PER_HOUR = 300;    // invii massimi all'ora dallo stesso indirizzo IP
const ID_RE = /^[a-f0-9]{32}$/;

const HEADERS = {'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff'};
// Le intestazioni di sicurezza delle pagine (CSP ecc.) sono in public/_headers: i file statici non passano dal Worker.
const json = (body, status = 200) => new Response(JSON.stringify(body), {status, headers: HEADERS});
const isInt = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;

async function sha256(text) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function leaderboard(url, env) {
  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit'), 10) || 10, 1), 100);
  const { results } = await env.DB.prepare(
    `SELECT id, name, best_sats AS sats, best_height AS height, best_floors AS floors, legends, best_lvl AS lvl, updated_at AS updated
       FROM players WHERE best_sats > 0 ORDER BY best_sats DESC, updated_at ASC LIMIT ?`).bind(limit).all();
  const meId = url.searchParams.get('me') || '';
  let me = null;
  if (ID_RE.test(meId)) {
    const row = await env.DB.prepare('SELECT name, best_sats AS sats, best_height AS height, best_floors AS floors, legends, best_lvl AS lvl, updated_at AS updated FROM players WHERE id = ?').bind(meId).first();
    if (row && row.sats > 0) {
      const r = await env.DB.prepare('SELECT COUNT(*) AS n FROM players WHERE best_sats > ? OR (best_sats = ? AND updated_at < ?)').bind(row.sats, row.sats, row.updated).first();
      me = {...row, rank: r.n + 1};
    }
  }
  const rows = results.map((r, i) => ({rank: i + 1, name: r.name, sats: r.sats, height: r.height, floors: r.floors, legends: r.legends, lvl: r.lvl || null, me: r.id === meId}));
  return json({rows, me});
}

// Nomi liberi, come in sala giochi: lo stesso nome può usarlo chiunque. Qui si controlla solo il filtro.
async function nameAvailable(url) {
  const check = checkName(url.searchParams.get('name'));
  if (!check.ok) return json({ok: false, reason: check.reason});
  return json({ok: true, name: check.name});
}

// IP del giocatore. Dietro un proxy (es. nginx su una VPS) Cloudflare vede solo l'IP del proxy: allora vale X-Real-IP,
// ma solo se la richiesta porta la chiave segreta PROXY_KEY (wrangler secret), che conosce solo la VPS.
function clientIp(req, env) {
  const key = req.headers.get('x-poq-proxy'), real = req.headers.get('x-real-ip');
  if (env.PROXY_KEY && key && key === env.PROXY_KEY && real) return real.trim().slice(0, 64);
  return req.headers.get('cf-connecting-ip') || 'sconosciuto';
}

async function submitScore(req, env) {
  const len = parseInt(req.headers.get('content-length') || '0', 10);
  if (len > 2000) return json({error: 'Request too large.'}, 413);
  let b;
  try { b = await req.json(); } catch (e) { return json({error: 'Invalid data.'}, 400); }
  const { id, run, sats, height, floors, legends } = b || {};
  const lvl = isInt(b && b.lvl, 1, 999) ? b.lvl : null; // livello dell'eroe (per il grado di Bitcointalk in classifica); i giochi vecchi non lo mandano
  if (!ID_RE.test(id || '') || !ID_RE.test(run || '')) return json({error: 'Invalid player.'}, 400);
  if (!isInt(sats, 0, 1e12) || !isInt(height, 0, 1e7) || !isInt(floors, 0, 1e5) || !isInt(legends, 0, 1e5)) return json({error: 'Invalid score.'}, 400);
  if (legends > legendsMax(floors) || sats > satsCap(floors, legends)) return json({error: 'Implausible score.'}, 422);
  const check = checkName(b.name);
  if (!check.ok) return json({error: check.reason}, 422);

  const now = Date.now();
  const ipHash = await sha256((env.RATE_SALT || '') + 'pq-rate:' + clientIp(req, env));
  await env.DB.prepare('DELETE FROM rate WHERE ts < ?').bind(now - 2 * 3600e3).run();
  const ipCount = await env.DB.prepare('SELECT COUNT(*) AS n FROM rate WHERE ip_hash = ? AND ts > ?').bind(ipHash, now - 3600e3).first();
  if (ipCount.n >= IP_MAX_PER_HOUR) return json({error: 'Too many submissions from this network. Try again later.'}, 429);

  const existing = await env.DB.prepare('SELECT * FROM players WHERE id = ?').bind(id).first();
  if (existing && now - existing.last_submit < MIN_INTERVAL_MS) return json({error: 'Submissions too close together.'}, 429);
  await env.DB.prepare('INSERT INTO rate (ip_hash, ts) VALUES (?, ?)').bind(ipHash, now).run();
  if (floors > FLOOR_SLACK + Math.floor((now - (existing ? existing.created_at : now)) / FLOOR_MIN_MS)) {
    // Troppi piani per il tempo passato. Un giocatore nuovo viene comunque registrato a 0 sats: se la sua partita è vera
    // (es. classifica irraggiungibile per un po'), gli invii successivi passano quando il tempo torna plausibile.
    if (!existing) await env.DB.prepare(`INSERT INTO players (id, name, name_key, best_sats, best_height, best_floors, legends, best_lvl, run_id, created_at, updated_at, last_submit)
      VALUES (?, ?, ?, 0, NULL, 0, 0, NULL, ?, ?, ?, ?)`).bind(id, check.name, check.key, run, now, now, now).run();
    return json({error: 'Implausible score.'}, 422);
  }

  let improved = false;
  if (!existing) {
    improved = sats > 0;
    await env.DB.prepare(`INSERT INTO players (id, name, name_key, best_sats, best_height, best_floors, legends, best_lvl, run_id, created_at, updated_at, last_submit)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(id, check.name, check.key, sats, height, floors, legends, lvl, run, now, now, now).run();
  } else if (sats > existing.best_sats) {
    improved = true;
    await env.DB.prepare(`UPDATE players SET name = ?, name_key = ?, best_sats = ?, best_height = ?, best_floors = ?, legends = ?, best_lvl = ?, run_id = ?, updated_at = ?, last_submit = ? WHERE id = ?`)
      .bind(check.name, check.key, sats, height, floors, legends, lvl, run, now, now, id).run();
  } else {
    await env.DB.prepare('UPDATE players SET name = ?, name_key = ?, last_submit = ? WHERE id = ?').bind(check.name, check.key, now, id).run();
  }
  const best = Math.max(sats, existing ? existing.best_sats : 0);
  const mine = await env.DB.prepare('SELECT best_sats, updated_at FROM players WHERE id = ?').bind(id).first();
  const r = await env.DB.prepare('SELECT COUNT(*) AS n FROM players WHERE best_sats > ? OR (best_sats = ? AND updated_at < ?)').bind(mine.best_sats, mine.best_sats, mine.updated_at).first();
  return json({ok: true, improved, best, rank: best > 0 ? r.n + 1 : null});
}

// ───────── PASSWORD (salvataggio stile NES) ─────────
// Il browser crea una password di 16 caratteri (alfabeto senza 0/O/1/I, circa 80 bit) e la manda insieme alla partita.
// Nel database c'è solo l'impronta SHA-256 della password, mai la password. Una password appartiene a un solo giocatore (id).
const PASS_RE = /^[A-HJ-NP-Z2-9]{16}$/;
const PASS_SAVE_MAX = 200;   // salvataggi all'ora dalla stessa rete
const PASS_LOAD_MAX = 20;    // tentativi di caricamento all'ora dalla stessa rete (contro chi prova password a caso)
const passHash = p => sha256('pq-pass:' + p);
async function underLimit(env, kind, req, max) {
  const now = Date.now(), h = await sha256((env.RATE_SALT || '') + `pq-${kind}:` + clientIp(req, env));
  await env.DB.prepare('DELETE FROM rate WHERE ts < ?').bind(now - 2 * 3600e3).run();
  const c = await env.DB.prepare('SELECT COUNT(*) AS n FROM rate WHERE ip_hash = ? AND ts > ?').bind(h, now - 3600e3).first();
  if (c.n >= max) return false;
  await env.DB.prepare('INSERT INTO rate (ip_hash, ts) VALUES (?, ?)').bind(h, now).run();
  return true;
}
async function readBody(req, max) {
  const len = parseInt(req.headers.get('content-length') || '0', 10);
  if (len > max) return null;
  const t = await req.text();
  if (t.length > max) return null;
  try { return JSON.parse(t); } catch (e) { return null; }
}
async function passwordSave(req, env) {
  const b = await readBody(req, 26000);
  if (!b) return json({error: 'Invalid data.'}, 400);
  const {password, id} = b, data = b.data || {};
  if (!PASS_RE.test(password || '') || !ID_RE.test(id || '')) return json({error: 'Invalid password.'}, 400);
  const str = (v, max) => v == null ? null : (typeof v === 'string' && v.length <= max ? v : undefined);
  const save = str(data.save, 16000), albo = str(data.albo, 8000), name = typeof b.name === 'string' ? b.name.slice(0, 12) : '';
  if (save === undefined || albo === undefined) return json({error: 'Save too large.'}, 413);
  if (!await underLimit(env, 'pwsave', req, PASS_SAVE_MAX)) return json({error: 'Too many saves from this network. Try again later.'}, 429);
  const h = await passHash(password), now = Date.now();
  const row = await env.DB.prepare('SELECT player_id FROM passwords WHERE pass_hash = ?').bind(h).first();
  if (row && row.player_id !== id) return json({error: 'This password belongs to another hero.'}, 409);
  const payload = JSON.stringify({save, albo});
  if (row) await env.DB.prepare('UPDATE passwords SET name = ?, data = ?, updated_at = ? WHERE pass_hash = ?').bind(name, payload, now, h).run();
  else await env.DB.prepare('INSERT INTO passwords (pass_hash, player_id, name, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').bind(h, id, name, payload, now, now).run();
  return json({ok: true, at: now});
}
async function passwordLoad(req, env) {
  const b = await readBody(req, 500);
  if (!b || !PASS_RE.test(b.password || '')) return json({error: 'That password is not valid.'}, 400);
  if (!await underLimit(env, 'pwload', req, PASS_LOAD_MAX)) return json({error: 'Too many attempts from this network. Try again in an hour.'}, 429);
  const row = await env.DB.prepare('SELECT player_id, name, data, updated_at FROM passwords WHERE pass_hash = ?').bind(await passHash(b.password)).first();
  if (!row) return json({error: 'Password not found. Check it letter by letter.'}, 404);
  let data = {}; try { data = JSON.parse(row.data); } catch (e) {}
  return json({ok: true, id: row.player_id, name: row.name || '', data, at: row.updated_at});
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req);
    try {
      if (url.pathname === '/api/leaderboard' && req.method === 'GET') return await leaderboard(url, env);
      if (url.pathname === '/api/name' && req.method === 'GET') return await nameAvailable(url);
      if (url.pathname === '/api/score' && req.method === 'POST') return await submitScore(req, env);
      if (url.pathname === '/api/password/save' && req.method === 'POST') return await passwordSave(req, env);
      if (url.pathname === '/api/password/load' && req.method === 'POST') return await passwordLoad(req, env);
      return json({error: 'Not found.'}, 404);
    } catch (e) {
      return json({error: 'Server error, try again soon.'}, 500);
    }
  },
};

