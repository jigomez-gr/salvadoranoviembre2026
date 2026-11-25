/* Cambios de contenido de noviembre 2026 (idempotente):
 * 1) Día 13 (Bienestar Experience): quita el botón «Ver el vídeo promo».
 * 2) Quita los vídeos de flamenco (Yeye de Cádiz) de las galerías.
 * 3) Añade la entrevista a la galería del día 13 y a la galería del mes.
 * Variables: PGPASSWORD (obligatoria), PGUSER, PGPORT, DB_HOSTS, PGDATABASE. */
const { Pool } = require('pg');
const ENTREVISTA = {
  tipo: 'video',
  titulo: 'Entrevista de Salvadora Conesa · Santiago Ángel García · Madridmarket.es',
  url: '/videos/entrevista_madridmarket_final.mp4',
  poster: '/videos/entrevista_madridmarket_final-poster.jpg',
  mostrar: 'ambas',
};
const esFlamenco = (g) => /Q8UETtyKUZA|gRJIDO8YWuI/.test(g.url || '') || /yeye de c[aá]diz/i.test(g.titulo || '');
(async () => {
  const anio = 2026, mes = 11;
  if (!process.env.PGPASSWORD) { console.error('Falta PGPASSWORD'); process.exit(2); }
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

  const e13 = (d.eventos || []).find((e) => (e.titulo || '').toLowerCase().includes('bienestar'));
  if (!e13) { console.error('No encuentro el evento del día 13 (Bienestar Experience)'); process.exit(1); }

  // 1) quitar botón vídeo promo
  const antes = (e13.botones || []).length;
  e13.botones = (e13.botones || []).filter((b) => !(b.tipo === 'video' && /v[ií]deo promo/i.test(b.texto || '')));
  console.log('Botón vídeo promo quitado: ' + (antes - e13.botones.length));

  // 2) quitar flamenco de todas las galerías
  let q = 0;
  for (const e of d.eventos) { const n = (e.galeria || []).length; e.galeria = (e.galeria || []).filter((g) => !esFlamenco(g)); q += n - e.galeria.length; }
  { const n = (d.galeria || []).length; d.galeria = (d.galeria || []).filter((g) => !esFlamenco(g)); q += n - d.galeria.length; }
  console.log('Vídeos de flamenco quitados: ' + q);

  // 3) entrevista en la galería del día 13 (y, con mostrar=ambas, también en la del mes)
  e13.galeria = Array.isArray(e13.galeria) ? e13.galeria : [];
  const ya = e13.galeria.find((g) => g.url === ENTREVISTA.url);
  if (ya) Object.assign(ya, ENTREVISTA); else e13.galeria.unshift(ENTREVISTA);

  await db.guardarMes(d);
  const v = await db.getMes(anio, mes, { admin: true });
  for (const e of v.eventos) console.log('Evento "' + e.titulo + '": botones ' + (e.botones || []).length + ' · galería ' + (e.galeria || []).length);
  console.log('Galería propia del mes: ' + (v.galeria || []).length);
  const w = v.eventos.find((e) => e.titulo === e13.titulo);
  w.galeria.forEach((g, i) => console.log('  ' + (i + 1) + '. [' + (g.mostrar || 'evento') + '] ' + g.titulo + '  ' + g.url));
  await pool.end();
})().catch((e) => { console.error('ERROR: ' + e.message); process.exit(1); });
