/* Añade elementos a la galería de un mes, directamente en la base de datos.
 * Uso: node alta-galeria.js AAAA MM archivo-galeria.json
 * Variables: PGPASSWORD (obligatoria), PGUSER (postgres), PGPORT (5433), DB_HOSTS (192.168.1.17,72.60.89.227), PGDATABASE (crm_salvadora)
 * Usa el mismo código que el panel /admin (db.js): lee el mes, añade lo que falte (por URL) y lo guarda en una transacción.
 * No borra nada de la galería que ya exista y se puede ejecutar varias veces sin duplicar. */
const fs = require('fs');
const { Pool } = require('pg');
(async () => {
  const [anio, mes, fichero] = [+process.argv[2], +process.argv[3], process.argv[4]];
  if (!anio || !mes || !fichero) { console.error('Uso: node alta-galeria.js AAAA MM archivo.json'); process.exit(2); }
  if (!process.env.PGPASSWORD) { console.error('Falta PGPASSWORD'); process.exit(2); }
  const nuevos = JSON.parse(fs.readFileSync(fichero, 'utf8'));
  let pool = null;
  for (const host of (process.env.DB_HOSTS || '192.168.1.17,72.60.89.227').split(',')) {
    const p = new Pool({ host: host.trim(), port: +(process.env.PGPORT || 5433), user: process.env.PGUSER || 'postgres', password: process.env.PGPASSWORD,
      database: process.env.PGDATABASE || 'crm_salvadora', max: 1, connectionTimeoutMillis: 5000 });
    try { await p.query('select 1'); pool = p; console.log('Conectado a ' + host); break; }
    catch (e) { console.log('No conecta con ' + host + ': ' + e.message); await p.end().catch(() => {}); }
  }
  if (!pool) { console.error('No se pudo conectar a ningún servidor.'); process.exit(1); }
  const db = require('./db').create(pool);
  console.log(await db.iniciar());
  const d = await db.getMes(anio, mes, { admin: true });
  if (!d) { console.error('No existe el mes ' + anio + '-' + mes); process.exit(1); }
  d.galeria = Array.isArray(d.galeria) ? d.galeria : [];
  console.log('Galería actual: ' + d.galeria.length + ' elemento(s)');
  let n = 0;
  for (const x of nuevos) if (!d.galeria.some((g) => g.url === x.url)) { d.galeria.push(x); n++; }
  if (!n) { console.log('Nada que añadir: ya estaban todos.'); await pool.end(); return; }
  await db.guardarMes(d);
  const v = await db.getMes(anio, mes, { admin: true });
  console.log('Añadidos ' + n + '. Galería ahora: ' + v.galeria.length + ' elemento(s):');
  v.galeria.forEach((g, i) => console.log('  ' + (i + 1) + '. ' + (g.titulo || '(sin título)') + '  ' + g.url));
  await pool.end();
})().catch((e) => { console.error('ERROR: ' + e.message); process.exit(1); });
