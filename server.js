/**
 * Minilanding "Actividades de noviembre 2026" · Centro de Yoga Salvadora Conesa
 *
 * Servidor Node sin framework. Sirve:
 *   - / y /servicios         → public/index.html (y el resto de public/)
 *   - /videos/*, /flyers/*,
 *     /documentos/*          → ficheros pesados desde la carpeta COMPARTIDA de medios
 *                              (la misma que usa la landing: media_base / /var/data/salvadora/media)
 *                              con soporte de Range (206) para que el vídeo se pueda adelantar.
 *   - /healthz               → comprobación de salud para Dokploy
 *   - /api/estado            → diagnóstico: ¿encuentra los medios? ¿conecta con Postgres?
 *   - /api/meses, /api/mes/actual, /api/mes/AAAA/MM   → contenido de cada mes (desde Postgres)
 *   - /AAAA-MM               → la misma página, abierta en ese mes (histórico)
 *   - /admin  + /api/admin/* → panel con contraseña: crear/editar meses, subir flyers y vídeos
 *
 * Nada pesado vive en Git. Los medios salen de disco compartido y, si no están,
 * se busca su ruta en la tabla media_assets de la base de datos Postgres compartida.
 *
 * Variables de entorno (todas opcionales salvo lo que diga cada caso):
 *   PORT                  puerto (3000)
 *   MEDIA_STORAGE_ROOT    raíz de medios (/var/data/salvadora/media)
 *   MEDIA_EXTRA_DIR       carpeta extra con subcarpetas videos/ flyers/ (solo pruebas locales)
 *   DATABASE_URL          postgres://… de la base compartida "salvadora" (si falta, se omite la BD)
 *   MEDIA_TABLE           tabla de medios ("public"."media_assets" por defecto)
 *   LANDING_URL           web principal (https://salvadoraconesa.es)
 *   ADMIN_PASSWORD        contraseña del panel /admin (si falta, el panel queda desactivado)
 *   ADMIN_SECRET          (opcional) secreto para firmar la sesión; por defecto se deriva de la contraseña
 *   ACTIVIDADES_SCHEMA    esquema Postgres donde viven las tablas (actividades)
 *   MAX_UPLOAD_MB         tamaño máximo por archivo subido desde el panel (800)
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = parseInt(process.env.PORT || '3000', 10);
const ROOT = process.env.MEDIA_STORAGE_ROOT || '/var/data/salvadora/media';
const EXTRA = process.env.MEDIA_EXTRA_DIR || '';
const LANDING_URL = (process.env.LANDING_URL || 'https://salvadoraconesa.es').replace(/\/$/, '');
const PUBLIC = path.join(__dirname, 'public');
const MEDIA_TABLE = process.env.MEDIA_TABLE || '"public"."media_assets"';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.webp': 'image/webp', '.pdf': 'application/pdf', '.ico': 'image/x-icon', '.vtt': 'text/vtt; charset=utf-8',
};
const MEDIA_DIRS = { videos: 'videos', flyers: 'flyers', documentos: 'documentos' };

/* ---------- Postgres opcional (base compartida) ---------- */
let pool = null, dbState = 'desactivada (sin DATABASE_URL)';
if (process.env.DATABASE_URL) {
  try {
    const { Pool } = require('pg');
    pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 3, connectionTimeoutMillis: 3000 });
    pool.on('error', (e) => { dbState = 'error: ' + e.message; });
    dbState = 'configurada';
  } catch (e) { dbState = 'módulo pg no instalado'; }
}
const db = require('./db').create(pool);
const crypto = require('crypto');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const ADMIN_SECRET = process.env.ADMIN_SECRET || (ADMIN_PASSWORD ? 'adm:' + ADMIN_PASSWORD : '');
const MAX_UPLOAD = (parseInt(process.env.MAX_UPLOAD_MB || '800', 10) || 800) * 1024 * 1024;
let dbIniciada = db.dbActiva ? 'pendiente' : 'modo archivo (solo lectura)';
async function dbLookup(baseName) {
  if (!pool) return null;
  try {
    const key = baseName.replace(/\.[^/.]+$/, '');
    const r = await pool.query(
      `SELECT "physicalPath", "mimeType" FROM ${MEDIA_TABLE}
       WHERE "isActive" = true AND (key = $1 OR "publicUrl" LIKE $2 OR "physicalPath" LIKE $2) LIMIT 1`,
      [key, '%' + baseName]);
    dbState = 'ok';
    return r.rows[0] || null;
  } catch (e) { dbState = 'error: ' + e.message; return null; }
}

/* ---------- utilidades ---------- */
const exists = (p) => { try { return fs.statSync(p).isFile(); } catch { return false; } };
function safeJoin(base, rel) {
  const full = path.resolve(base, rel);
  return full.startsWith(path.resolve(base) + path.sep) ? full : null;
}
async function resolveMedia(kind, rel) {
  const dir = MEDIA_DIRS[kind];
  const bases = [];
  if (EXTRA) bases.push(path.join(EXTRA, dir));
  bases.push(path.join(ROOT, dir), ROOT);
  for (const b of bases) { const f = safeJoin(b, rel); if (f && exists(f)) return { file: f }; }
  // respaldo: buscar por nombre en la base de datos compartida
  const row = await dbLookup(path.basename(rel));
  if (row) {
    const cands = [row.physicalPath, path.join(ROOT, dir, path.basename(row.physicalPath))];
    for (const c of cands) if (c && exists(c)) return { file: c, mime: row.mimeType };
  }
  return null;
}

function sendFile(req, res, file, mime, cache) {
  const st = fs.statSync(file);
  const type = mime || MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
  const headers = { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Cache-Control': cache };
  const range = req.headers.range;
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    let start = m && m[1] !== '' ? parseInt(m[1], 10) : 0;
    let end = m && m[2] !== '' ? parseInt(m[2], 10) : st.size - 1;
    if (m && m[1] === '' && m[2] !== '') { start = Math.max(0, st.size - parseInt(m[2], 10)); end = st.size - 1; }
    if (isNaN(start) || isNaN(end) || start > end || start >= st.size) {
      res.writeHead(416, { 'Content-Range': `bytes */${st.size}` }); return res.end();
    }
    end = Math.min(end, st.size - 1);
    res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Content-Length': end - start + 1 });
    if (req.method === 'HEAD') return res.end();
    const s = fs.createReadStream(file, { start, end });
    s.on('error', () => res.destroy()); res.on('close', () => s.destroy()); return s.pipe(res);
  }
  res.writeHead(200, { ...headers, 'Content-Length': st.size });
  if (req.method === 'HEAD') return res.end();
  const s = fs.createReadStream(file);
  s.on('error', () => res.destroy()); res.on('close', () => s.destroy()); s.pipe(res);
}

/* ---------- sesión del panel de administración ---------- */
const sign = (v) => crypto.createHmac('sha256', ADMIN_SECRET).update(v).digest('hex');
function tEq(a, b) { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); }
function makeToken() { const exp = String(Date.now() + 12 * 3600 * 1000); return exp + '.' + sign(exp); }
function isAdmin(req) {
  if (!ADMIN_PASSWORD) return false;
  const m = /(?:^|;\s*)adm=([^;]+)/.exec(req.headers.cookie || '');
  if (!m) return false;
  const [exp, sig] = decodeURIComponent(m[1]).split('.');
  return !!exp && !!sig && +exp > Date.now() && tEq(sig, sign(exp));
}
const loginFails = new Map();
function throttled(ip) {
  const f = loginFails.get(ip);
  return !!f && f.n >= 8 && Date.now() - f.t < 10 * 60 * 1000;
}
function jsonOut(res, code, obj, extra) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...(extra || {}) });
  res.end(JSON.stringify(obj));
}
function readBody(req, limit = 2 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let n = 0; const chunks = [];
    req.on('data', (c) => { n += c.length; if (n > limit) { reject(Object.assign(new Error('Cuerpo demasiado grande'), { status: 413 })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}
const UPLOAD_EXT = new Set(['.mp4', '.webm', '.jpg', '.jpeg', '.png', '.webp', '.pdf']);
function cleanName(n) {
  const base = path.basename(String(n || '')).normalize('NFC').replace(/[^\w.\-áéíóúñüÁÉÍÓÚÑÜ]+/g, '_').replace(/^\.+/, '');
  return base.slice(0, 120);
}
async function handleUpload(req, res, q) {
  const tipo = q.get('tipo');
  if (!['videos', 'flyers'].includes(tipo)) return jsonOut(res, 400, { error: 'tipo debe ser videos o flyers' });
  const nombre = cleanName(q.get('nombre'));
  const ext = path.extname(nombre).toLowerCase();
  if (!nombre || !UPLOAD_EXT.has(ext)) return jsonOut(res, 400, { error: 'Nombre o extensión no permitida (mp4, webm, jpg, png, webp, pdf)' });
  const len = parseInt(req.headers['content-length'] || '0', 10);
  if (len > MAX_UPLOAD) return jsonOut(res, 413, { error: `Archivo demasiado grande (máx. ${MAX_UPLOAD / 1048576} MB)` });
  const dir = path.join(ROOT, MEDIA_DIRS[tipo]);
  const dest = safeJoin(dir, nombre);
  if (!dest) return jsonOut(res, 400, { error: 'Nombre no válido' });
  // La carpeta de medios es COMPARTIDA con la landing: nunca se pisa un archivo existente.
  if (exists(dest) && q.get('sobrescribir') !== '1') return jsonOut(res, 409, { error: 'Ya existe un archivo con ese nombre. Cambia el nombre.', existe: true });
  try { fs.mkdirSync(dir, { recursive: true }); } catch (e) { return jsonOut(res, 500, { error: 'No se puede crear la carpeta de medios: ' + e.code }); }
  const tmp = dest + '.subiendo-' + process.pid;
  let n = 0, abortado = false;
  const out = fs.createWriteStream(tmp, { flags: 'wx' });
  out.on('error', (e) => { if (!abortado) { abortado = true; try { fs.unlinkSync(tmp); } catch {} jsonOut(res, 500, { error: 'No se pudo escribir en la carpeta de medios (' + (e.code || e.message) + '). Revisa permisos del volumen.' }); } });
  req.on('data', (c) => {
    n += c.length;
    if (n > MAX_UPLOAD && !abortado) { abortado = true; req.unpipe(out); out.destroy(); try { fs.unlinkSync(tmp); } catch {} jsonOut(res, 413, { error: 'Archivo demasiado grande' }); req.destroy(); }
  });
  req.on('aborted', () => { abortado = true; out.destroy(); try { fs.unlinkSync(tmp); } catch {} });
  out.on('finish', () => {
    if (abortado) return;
    try { fs.renameSync(tmp, dest); } catch (e) { try { fs.unlinkSync(tmp); } catch {} return jsonOut(res, 500, { error: 'No se pudo guardar: ' + e.code }); }
    jsonOut(res, 200, { ok: true, tipo, nombre, bytes: n, url: `/${tipo}/${nombre}` });
  });
  req.pipe(out);
}

const CHECK = [
  ['videos', 'Promo_Bienestar-Experience-2026_1920x1080.mp4'],
  ['videos', 'Promo_Bienestar-Experience-2026_1920x1080-poster.jpg'],
  ['videos', 'entrevista_madridmarket_completa.mp4'],
  ['videos', 'entrevista_madridmarket_resumen.mp4'],
  ['videos', 'entrevista_madridmarket_poster.jpg'],
  ['flyers', 'flyer13nov2026vivemasparticular.jpeg'],
  ['flyers', 'constalaciones.jpeg'],
];

/* ---------- servidor ---------- */
const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, 'http://x');
    const escribe = req.method === 'POST' || req.method === 'DELETE';
    if (req.method !== 'GET' && req.method !== 'HEAD' && !(escribe && u.pathname.startsWith('/api/admin/'))) { res.writeHead(405); return res.end(); }
    let p;
    try { p = decodeURIComponent(u.pathname); } catch { res.writeHead(400); return res.end(); }


    const mAnio = /^\/api\/mes\/(\d{4})\/(\d{1,2})$/.exec(p);

    const q = u.searchParams;
    /* ----- API pública ----- */
    if (p === '/api/meses') {
      return jsonOut(res, 200, { meses: await db.listarMeses(), actual: await db.mesActual() }, { 'Cache-Control': 'no-cache' });
    }
    if (p === '/api/mes/actual') {
      const a = await db.mesActual();
      if (!a) return jsonOut(res, 404, { error: 'Aún no hay ningún mes publicado' });
      return jsonOut(res, 200, await db.getMes(a.anio, a.mes), { 'Cache-Control': 'no-cache' });
    }
    if (mAnio) {
      const d = await db.getMes(mAnio[1], mAnio[2], { admin: isAdmin(req) });
      if (!d) return jsonOut(res, 404, { error: 'Mes no encontrado' });
      return jsonOut(res, 200, d, { 'Cache-Control': 'no-cache' });
    }

    /* ----- panel de administración ----- */
    if (p === '/admin' || p === '/admin/') {
      const f = safeJoin(PUBLIC, 'admin.html');
      return sendFile(req, res, f, null, 'no-store');
    }
    if (p.startsWith('/api/admin/')) {
      if (!ADMIN_PASSWORD) return jsonOut(res, 503, { error: 'Panel desactivado: falta la variable ADMIN_PASSWORD en Dokploy.' });
      if (p === '/api/admin/login' && req.method === 'POST') {
        const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
        if (throttled(ip)) return jsonOut(res, 429, { error: 'Demasiados intentos. Espera unos minutos.' });
        let b = {}; try { b = JSON.parse(await readBody(req, 10000)); } catch {}
        if (!tEq(String(b.password || ''), ADMIN_PASSWORD)) {
          const f = loginFails.get(ip) || { n: 0, t: 0 }; loginFails.set(ip, { n: f.n + 1, t: Date.now() });
          return jsonOut(res, 401, { error: 'Contraseña incorrecta' });
        }
        loginFails.delete(ip);
        const secure = (req.headers['x-forwarded-proto'] || '') === 'https' ? '; Secure' : '';
        return jsonOut(res, 200, { ok: true }, { 'Set-Cookie': `adm=${encodeURIComponent(makeToken())}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${secure}` });
      }
      if (p === '/api/admin/logout') return jsonOut(res, 200, { ok: true }, { 'Set-Cookie': 'adm=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0' });
      if (!isAdmin(req)) return jsonOut(res, 401, { error: 'No autorizado' });
      // protección CSRF extra: las escrituras deben venir del propio sitio
      if (req.method !== 'GET' && req.headers.origin) {
        let oh = ''; try { oh = new URL(req.headers.origin).host; } catch {}
        if (oh !== req.headers.host) return jsonOut(res, 403, { error: 'Origen no permitido' });
      }
      if (p === '/api/admin/estado') return jsonOut(res, 200, { ok: true, bd: db.dbActiva, escritura: db.dbActiva, mediaRoot: ROOT, maxUploadMB: MAX_UPLOAD / 1048576 });
      if (p === '/api/admin/meses') return jsonOut(res, 200, { meses: await db.listarMeses({ admin: true }) });
      if (p === '/api/admin/subir' && req.method === 'POST') return handleUpload(req, res, q);
      if (p === '/api/admin/medios') {
        const out = {};
        for (const k of ['videos', 'flyers']) {
          try { out[k] = fs.readdirSync(path.join(ROOT, k)).filter((n) => UPLOAD_EXT.has(path.extname(n).toLowerCase())).sort(); } catch { out[k] = []; }
        }
        return jsonOut(res, 200, out);
      }
      const mA = /^\/api\/admin\/mes\/(\d{4})\/(\d{1,2})$/.exec(p);
      if (mA) {
        if (req.method === 'GET') {
          const d = await db.getMes(mA[1], mA[2], { admin: true });
          return d ? jsonOut(res, 200, d) : jsonOut(res, 404, { error: 'Mes no encontrado' });
        }
        if (req.method === 'DELETE') {
          const ok = await db.borrarMes(mA[1], mA[2]);
          return jsonOut(res, ok ? 200 : 404, { ok });
        }
      }
      if (p === '/api/admin/mes' && req.method === 'POST') {
        let doc; try { doc = JSON.parse(await readBody(req)); } catch { return jsonOut(res, 400, { error: 'JSON no válido' }); }
        try { return jsonOut(res, 200, { ok: true, ...(await db.guardarMes(doc)) }); }
        catch (e) { return jsonOut(res, 400, { error: e.message }); }
      }
      return jsonOut(res, 404, { error: 'No encontrado' });
    }

    if (p === '/healthz') { res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end('ok'); }

    if (p === '/api/estado') {
      const media = {};
      for (const [k, f] of CHECK) media[`${k}/${f}`] = !!(await resolveMedia(k, f));
      if (pool) { try { await pool.query('SELECT 1'); dbState = 'ok'; } catch (e) { dbState = 'error: ' + e.message; } }
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end(JSON.stringify({ ok: true, mediaRoot: ROOT, extra: EXTRA || null, baseDeDatos: dbState, actividades: dbIniciada, panelAdmin: !!ADMIN_PASSWORD, medios: media }, null, 2));
    }

    if (p === '/config.js') {
      res.writeHead(200, { 'Content-Type': MIME['.js'], 'Cache-Control': 'no-store' });
      return res.end(`window.SALVADORA_LANDING=${JSON.stringify(LANDING_URL)};`);
    }

    const m = /^\/(videos|flyers|documentos)\/(.+)$/.exec(p);
    if (m) {
      const r = await resolveMedia(m[1], m[2]);
      if (!r) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Medio no encontrado: ' + m[2]); }
      return sendFile(req, res, r.file, r.mime, 'public, max-age=86400');
    }

    const esPagina = p === '/' || /^\/servicios\/?$/.test(p) || /^(\/servicios)?\/\d{4}-\d{2}\/?$/.test(p);
    const rel = esPagina ? 'index.html' : p.replace(/^\/+/, '');
    const f = safeJoin(PUBLIC, rel);
    if (f && exists(f)) return sendFile(req, res, f, null, rel.endsWith('.html') ? 'no-cache' : 'public, max-age=3600');
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('No encontrado');
  } catch (e) {
    console.error('[error]', e);
    if (!res.headersSent) res.writeHead(500); res.end('Error interno');
  }
});
async function arrancar() {
  try { dbIniciada = await db.iniciar(); }
  catch (e) { dbIniciada = 'error: ' + e.message; console.error('[db] ' + e.message); }
  server.listen(PORT, () => {
    console.log(`Actividades del mes en http://localhost:${PORT}`);
    console.log(`Medios: ${ROOT}${EXTRA ? '  (+ extra: ' + EXTRA + ')' : ''} · BD: ${dbState} · Actividades: ${dbIniciada} · Panel: ${ADMIN_PASSWORD ? 'activo' : 'desactivado'}`);
  });
}
arrancar();
