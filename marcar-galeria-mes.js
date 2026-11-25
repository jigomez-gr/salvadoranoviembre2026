/* Marca los elementos de la galería de un evento para que salgan TAMBIÉN en la galería general del mes.
 * Uso: node marcar-galeria-mes.js AAAA MM "gong" [ambas|mes|evento]
 *   ambas  = en el evento y en la galería del mes (por defecto)
 *   mes    = solo en la galería del mes
 *   evento = solo en el evento (deshacer)
 * Variables: PGPASSWORD (obligatoria), PGUSER, PGPORT, DB_HOSTS, PGDATABASE. Idempotente. */
const { Pool } = require('pg');
(async () => {
  const anio = +process.argv[2], mes = +process.argv[3], txt = (process.argv[4] || '').toLowerCase();
  const modo = process.argv[5] || 'ambas';
  if (!anio || !mes || !txt || !process.env.PGPASSWORD || !['ambas', 'mes', 'evento'].includes(modo)) {
    console.error('Uso: PGPASSWORD=… node marcar-galeria-mes.js AAAA MM "texto del titulo" [ambas|mes|evento]'); process.exit(2); }
  let pool = null;
  for (const host of (process.env.DB_HOSTS || '192.168.1.17,72.60.89.227').split(',')) {
    const p = new Pool({ host: host.trim(), port: +(process.env.PGPORT || 5433), user: process.env.PGUSER || 'postgres', password: process.env.PGPASSWORD,
      database: process.env.PGDATABASE || 'crm_salvadora', max: 1, connectionTimeoutMillis: 5000 });
    try { await p.query('select 1'); pool = p; console.log('Conectado a ' + host); break; }
    catch (e) { console.log('No conecta con ' + host + ': ' + e.message); await p.end().catch(() => {}); }
  }
  if (!pool) { console.error('No se pudo conectar.'); process.exit(1); }
  const db = require('./db').create(pool);
  await db.iniciar();
  const d = await db.getMes(anio, mes, { admin: true });
  if (!d) { console.error('No existe el mes'); process.exit(1); }
  const ev = (d.eventos || []).find((e) => (e.titulo || '').toLowerCase().includes(txt));
  if (!ev) { console.error('No encuentro evento con "' + txt + '" en el título'); process.exit(1); }
  if (!Array.isArray(ev.galeria) || !ev.galeria.length) { console.error('El evento "' + ev.titulo + '" no tiene galería'); process.exit(1); }
  ev.galeria.forEach((g) => { if (modo === 'evento') delete g.mostrar; else g.mostrar = modo; });
  await db.guardarMes(d);
  const v = await db.getMes(anio, mes, { admin: true });
  const e2 = v.eventos.find((e) => e.titulo === ev.titulo);
  console.log('Evento "' + ev.titulo + '": ' + e2.galeria.length + ' elemento(s) en modo "' + modo + '"');
  e2.galeria.forEach((g, i) => console.log('  ' + (i + 1) + '. [' + (g.mostrar || 'evento') + '] ' + g.titulo + '  ' + g.url));
  await pool.end();
})().catch((e) => { console.error('ERROR: ' + e.message); process.exit(1); });
