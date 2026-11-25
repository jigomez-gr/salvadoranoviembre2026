/* 1) Crea la columna evento.galeria (SQL de galeria-evento.sql)
 * 2) Pasa la galería del mes a la de un evento (el que contenga el texto dado en el título)
 * Uso: node mover-galeria-evento.js AAAA MM "gong"
 * Variables: PGPASSWORD (obligatoria), PGUSER, PGPORT, DB_HOSTS, PGDATABASE. Idempotente. */
const fs = require('fs');
const { Pool } = require('pg');
(async () => {
  const anio = +process.argv[2], mes = +process.argv[3], txt = (process.argv[4] || '').toLowerCase();
  if (!anio || !mes || !txt || !process.env.PGPASSWORD) { console.error('Uso: PGPASSWORD=… node mover-galeria-evento.js AAAA MM "texto del titulo"'); process.exit(2); }
  let pool = null;
  for (const host of (process.env.DB_HOSTS || '192.168.1.17,72.60.89.227').split(',')) {
    const p = new Pool({ host: host.trim(), port: +(process.env.PGPORT || 5433), user: process.env.PGUSER || 'postgres', password: process.env.PGPASSWORD,
      database: process.env.PGDATABASE || 'crm_salvadora', max: 1, connectionTimeoutMillis: 5000 });
    try { await p.query('select 1'); pool = p; console.log('Conectado a ' + host); break; }
    catch (e) { console.log('No conecta con ' + host + ': ' + e.message); await p.end().catch(() => {}); }
  }
  if (!pool) { console.error('No se pudo conectar.'); process.exit(1); }
  await pool.query(fs.readFileSync(__dirname + '/galeria-evento.sql', 'utf8'));
  console.log('SQL aplicado: columna actividades.evento.galeria lista');
  const db = require('./db').create(pool);
  await db.iniciar();
  const d = await db.getMes(anio, mes, { admin: true });
  if (!d) { console.error('No existe el mes'); process.exit(1); }
  const ev = (d.eventos || []).find((e) => (e.titulo || '').toLowerCase().includes(txt));
  if (!ev) { console.error('No encuentro evento con "' + txt + '" en el título'); process.exit(1); }
  const mesG = Array.isArray(d.galeria) ? d.galeria : [];
  ev.galeria = Array.isArray(ev.galeria) ? ev.galeria : [];
  let n = 0;
  for (const x of mesG) if (!ev.galeria.some((g) => g.url === x.url)) { ev.galeria.push(x); n++; }
  d.galeria = [];
  await db.guardarMes(d);
  const v = await db.getMes(anio, mes, { admin: true });
  const e2 = v.eventos.find((e) => e.titulo === ev.titulo);
  console.log('Evento "' + ev.titulo + '": pasados ' + n + ' elemento(s). Su galería ahora: ' + e2.galeria.length + ' · galería del mes: ' + v.galeria.length);
  e2.galeria.forEach((g, i) => console.log('  ' + (i + 1) + '. ' + g.titulo + '  ' + g.url));
  await pool.end();
})().catch((e) => { console.error('ERROR: ' + e.message); process.exit(1); });
