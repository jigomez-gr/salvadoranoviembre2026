/**
 * Minilanding "Actividades de noviembre 2026" · Centro de Yoga Salvadora Conesa
 *
 * Servidor Node sin framework. Sirve:
 *   - /                      → public/index.html (y el resto de public/)
 *   - /videos/*, /flyers/*,
 *     /documentos/*          → ficheros pesados desde la carpeta COMPARTIDA de medios
 *                              (la misma que usa la landing: media_base / /var/data/salvadora/media)
 *                              con soporte de Range (206) para que el vídeo se pueda adelantar.
 *   - /healthz               → comprobación de salud para Dokploy
 *   - /api/estado            → diagnóstico: ¿encuentra los medios? ¿conecta con Postgres?
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
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
    const u = new URL(req.url, 'http://x');
    let p;
    try { p = decodeURIComponent(u.pathname); } catch { res.writeHead(400); return res.end(); }

    if (p === '/healthz') { res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end('ok'); }

    if (p === '/api/estado') {
      const media = {};
      for (const [k, f] of CHECK) media[`${k}/${f}`] = !!(await resolveMedia(k, f));
      if (pool) { try { await pool.query('SELECT 1'); dbState = 'ok'; } catch (e) { dbState = 'error: ' + e.message; } }
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end(JSON.stringify({ ok: true, mediaRoot: ROOT, extra: EXTRA || null, baseDeDatos: dbState, medios: media }, null, 2));
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

    const rel = p === '/' ? 'index.html' : p.replace(/^\/+/, '');
    const f = safeJoin(PUBLIC, rel);
    if (f && exists(f)) return sendFile(req, res, f, null, rel.endsWith('.html') ? 'no-cache' : 'public, max-age=3600');
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('No encontrado');
  } catch (e) {
    console.error('[error]', e);
    if (!res.headersSent) res.writeHead(500); res.end('Error interno');
  }
});
server.listen(PORT, () => {
  console.log(`Actividades noviembre 2026 en http://localhost:${PORT}`);
  console.log(`Medios: ${ROOT}${EXTRA ? '  (+ extra: ' + EXTRA + ')' : ''} · BD: ${dbState}`);
});
