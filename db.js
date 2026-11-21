/**
 * Capa de datos de "Actividades del mes".
 *
 * Guarda cada mes (eventos, entrevista y capítulos) en Postgres, en un esquema PROPIO
 * ("actividades") dentro de la base compartida crm_salvadora. No toca ninguna tabla de la
 * landing ni del CRM: crea sus 4 tablas y nada más.
 *
 *   actividades.mes         un registro por mes/año (título, intro, rutina, publicado…)
 *   actividades.evento      eventos del mes
 *   actividades.entrevista  la entrevista del mes (opcional) + datos extra en JSON
 *   actividades.capitulo    capítulos de la entrevista
 *
 * Si no hay base de datos, funciona en SOLO LECTURA con los JSON de la carpeta seed/.
 * Los ficheros pesados NO se guardan aquí: solo su nombre; viven en el sistema de ficheros compartido.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const SCHEMA = process.env.ACTIVIDADES_SCHEMA || 'actividades';
if (!/^[a-z_][a-z0-9_]*$/i.test(SCHEMA)) throw new Error('ACTIVIDADES_SCHEMA no válido');
const S = '"' + SCHEMA + '"';
const SEED_DIR = path.join(__dirname, 'seed');

const DDL = `
CREATE SCHEMA IF NOT EXISTS ${S};
CREATE TABLE IF NOT EXISTS ${S}.mes (
  id serial PRIMARY KEY,
  anio int NOT NULL,
  mes int NOT NULL CHECK (mes BETWEEN 1 AND 12),
  titulo text,
  lead text,
  subtitulo_calendario text,
  dias_clase int[] NOT NULL DEFAULT '{2,3,4}',
  rutina jsonb,
  publicado boolean NOT NULL DEFAULT true,
  creado timestamptz NOT NULL DEFAULT now(),
  actualizado timestamptz NOT NULL DEFAULT now(),
  UNIQUE (anio, mes)
);
CREATE TABLE IF NOT EXISTS ${S}.evento (
  id serial PRIMARY KEY,
  mes_id int NOT NULL REFERENCES ${S}.mes(id) ON DELETE CASCADE,
  orden int NOT NULL DEFAULT 0,
  fecha_inicio timestamp NOT NULL,
  fecha_fin timestamp NOT NULL,
  etiqueta text,
  titulo text NOT NULL,
  descripcion text,
  detalles jsonb NOT NULL DEFAULT '[]',
  botones jsonb NOT NULL DEFAULT '[]',
  nota_pasado text
);
CREATE TABLE IF NOT EXISTS ${S}.entrevista (
  id serial PRIMARY KEY,
  mes_id int NOT NULL UNIQUE REFERENCES ${S}.mes(id) ON DELETE CASCADE,
  kicker text, titulo text, subtitulo text,
  entrevistador text, medio text, invitada text, invitada_detalle text,
  duracion text, duracion_resumen text,
  video_completo text, video_resumen text, poster text,
  extra jsonb NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS ${S}.capitulo (
  id serial PRIMARY KEY,
  entrevista_id int NOT NULL REFERENCES ${S}.entrevista(id) ON DELETE CASCADE,
  t_seg int NOT NULL,
  titulo text NOT NULL,
  descripcion text
);
ALTER TABLE ${S}.mes ADD COLUMN IF NOT EXISTS mensaje text;
ALTER TABLE ${S}.evento ADD COLUMN IF NOT EXISTS sin_fecha boolean NOT NULL DEFAULT false;
ALTER TABLE ${S}.evento ADD COLUMN IF NOT EXISTS texto_fecha text;
ALTER TABLE ${S}.evento ADD COLUMN IF NOT EXISTS crm_id text;
CREATE INDEX IF NOT EXISTS evento_mes_idx ON ${S}.evento(mes_id);
CREATE INDEX IF NOT EXISTS capitulo_ent_idx ON ${S}.capitulo(entrevista_id);
`;

/* ---------- validación / normalización del documento de un mes ---------- */
const RE_FECHA = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const TIPOS = ['link', 'video', 'imagen', 'capitulo'];
const CUANDO = ['vivo', 'pasado', 'siempre'];
const str = (v, max = 8000) => (v === undefined || v === null ? null : String(v).trim().slice(0, max)) || null;
const num = (v, def = 0) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : def; };
/** Los textos con formato (<b>, <br>…) los escribe el administrador: se quita lo que ejecutaría código. */
function html(v, max) {
  const t = str(v, max);
  if (!t) return t;
  return t
    .replace(/<\s*(script|style|iframe|object|embed|link|meta|base|form)\b[\s\S]*?(<\s*\/\s*\1\s*>|$)/gi, '')
    .replace(/<\s*\/?\s*(script|style|iframe|object|embed|link|meta|base|form)\b[^>]*>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src|xlink:href)\s*=\s*("|')?\s*(javascript|data|vbscript):/gi, '$1=$2#');
}
function urlOk(u) { return typeof u === 'string' && /^(\/(?!\/)|https?:\/\/|tel:|mailto:)/i.test(u.trim()); }

function normalizarBoton(b) {
  if (!b || typeof b !== 'object') return null;
  const tipo = TIPOS.includes(b.tipo) ? b.tipo : 'link';
  const o = { tipo, texto: str(b.texto, 200) || 'Ver', estilo: b.estilo === 'p' ? 'p' : 'g', cuando: CUANDO.includes(b.cuando) ? b.cuando : 'siempre' };
  if (tipo === 'capitulo') { o.t = Math.max(0, num(b.t)); return o; }
  if (!urlOk(b.url)) return null;
  o.url = b.url.trim().slice(0, 1000);
  if (tipo === 'video' && b.poster && urlOk(b.poster)) o.poster = b.poster.trim().slice(0, 1000);
  if (tipo === 'imagen') o.alt = str(b.alt, 300) || '';
  return o;
}

function normalizarMes(doc) {
  if (!doc || typeof doc !== 'object') throw new Error('Documento vacío');
  const anio = num(doc.anio), mes = num(doc.mes);
  if (anio < 2000 || anio > 2100) throw new Error('Año no válido');
  if (mes < 1 || mes > 12) throw new Error('Mes no válido (1-12)');
  const out = {
    anio, mes,
    titulo: str(doc.titulo, 200),
    lead: str(doc.lead, 2000),
    subtituloCalendario: str(doc.subtituloCalendario, 1000),
    mensaje: html(doc.mensaje, 1500),
    diasClase: Array.isArray(doc.diasClase) ? doc.diasClase.map((d) => num(d, -1)).filter((d) => d >= 0 && d <= 6) : [2, 3, 4],
    rutina: doc.rutina && typeof doc.rutina === 'object' ? doc.rutina : null,
    publicado: doc.publicado !== false,
    eventos: [],
    entrevista: null,
  };
  const evs = Array.isArray(doc.eventos) ? doc.eventos : [];
  if (evs.length > 60) throw new Error('Demasiados eventos');
  evs.forEach((e, i) => {
    if (!e || typeof e !== 'object') return;
    const sinFecha = e.sinFecha === true;
    let inicio = e.inicio, fin = e.fin;
    if (!RE_FECHA.test(inicio || '')) {
      if (!sinFecha) throw new Error(`Evento ${i + 1}: fecha de inicio no válida (AAAA-MM-DDThh:mm)`);
      // sin fecha: se guarda al final del mes como marcador; la web no muestra esa fecha
      const ult = new Date(anio, mes, 0).getDate();
      inicio = `${anio}-${String(mes).padStart(2, '0')}-${String(ult).padStart(2, '0')}T00:00`;
      fin = inicio.replace('T00:00', 'T23:59');
    }
    if (!RE_FECHA.test(fin || '')) fin = inicio;
    if (!str(e.titulo, 300)) throw new Error(`Evento ${i + 1}: falta el título`);
    out.eventos.push({
      orden: num(e.orden, i),
      inicio, fin, sinFecha, textoFecha: str(e.textoFecha, 300), crmId: str(e.crmId, 80),
      etiqueta: str(e.etiqueta, 80),
      titulo: str(e.titulo, 300),
      descripcion: html(e.descripcion, 6000),
      detalles: (Array.isArray(e.detalles) ? e.detalles : []).map((d) => html(d, 600)).filter(Boolean).slice(0, 12),
      botones: (Array.isArray(e.botones) ? e.botones : []).map(normalizarBoton).filter(Boolean).slice(0, 8),
      notaPasado: str(e.notaPasado, 600),
    });
  });
  const en = doc.entrevista;
  if (en && typeof en === 'object' && (str(en.titulo) || (Array.isArray(en.capitulos) && en.capitulos.length))) {
    out.entrevista = {
      kicker: str(en.kicker, 200), titulo: str(en.titulo, 300), subtitulo: str(en.subtitulo, 1000),
      entrevistador: str(en.entrevistador, 200), medio: str(en.medio, 200),
      invitada: str(en.invitada, 200), invitadaDetalle: str(en.invitadaDetalle, 300),
      duracion: str(en.duracion, 60), duracionResumen: str(en.duracionResumen, 60),
      videoCompleto: str(en.videoCompleto, 300), videoResumen: str(en.videoResumen, 300), poster: str(en.poster, 300),
      extra: en.extra && typeof en.extra === 'object' ? en.extra : {},
      capitulos: (Array.isArray(en.capitulos) ? en.capitulos : []).map((c) => ({
        t: Math.max(0, num(c && c.t)), titulo: str(c && c.titulo, 300) || '(sin título)', descripcion: str(c && c.descripcion, 1500),
      })).sort((a, b) => a.t - b.t).slice(0, 80),
    };
  }
  return out;
}

/* ---------- utilidades ---------- */
function hoyMadrid() {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit' }).formatToParts(new Date());
  return { anio: +p.find((x) => x.type === 'year').value, mes: +p.find((x) => x.type === 'month').value };
}
const ord = (m) => m.anio * 12 + (m.mes - 1);

/** Mes que se muestra en "/": el actual; si no existe, el publicado más reciente anterior; si no, el más próximo posterior. */
function elegirActual(lista) {
  const h = hoyMadrid();
  const pub = lista.filter((m) => m.publicado);
  if (!pub.length) return null;
  const hoy = ord(h);
  const exacto = pub.find((m) => ord(m) === hoy);
  if (exacto) return exacto;
  const antes = pub.filter((m) => ord(m) < hoy).sort((a, b) => ord(b) - ord(a))[0];
  if (antes) return antes;
  return pub.sort((a, b) => ord(a) - ord(b))[0];
}

function create(pool) {
  const dbActiva = !!pool;

  /* ----- modo archivo (sin BD): solo lectura ----- */
  function leerSeeds() {
    try {
      return fs.readdirSync(SEED_DIR).filter((f) => /^\d{4}-\d{2}\.json$/.test(f)).map((f) => {
        const d = JSON.parse(fs.readFileSync(path.join(SEED_DIR, f), 'utf8'));
        return normalizarMes(d);
      });
    } catch { return []; }
  }
  const resumen = (d) => ({
    anio: d.anio, mes: d.mes, titulo: d.titulo || null, publicado: d.publicado !== false,
    eventos: (d.eventos || []).length, entrevista: !!d.entrevista,
  });

  async function iniciar() {
    if (!dbActiva) return 'modo archivo (solo lectura, sin base de datos)';
    await pool.query(DDL);
    const { rows } = await pool.query(`SELECT count(*)::int AS n FROM ${S}.mes`);
    let sembrados = 0;
    if (rows[0].n === 0) { for (const d of leerSeeds()) { await guardarMes(d); sembrados++; } }
    return `esquema "${SCHEMA}" listo` + (sembrados ? ` · ${sembrados} mes(es) inicial(es) cargado(s) desde seed/` : '');
  }

  async function listarMeses({ admin = false } = {}) {
    if (!dbActiva) return leerSeeds().map(resumen).sort((a, b) => ord(b) - ord(a));
    const { rows } = await pool.query(
      `SELECT m.anio, m.mes, m.titulo, m.publicado,
              (SELECT count(*)::int FROM ${S}.evento e WHERE e.mes_id = m.id) AS eventos,
              EXISTS (SELECT 1 FROM ${S}.entrevista n WHERE n.mes_id = m.id) AS entrevista
         FROM ${S}.mes m ${admin ? '' : 'WHERE m.publicado'} ORDER BY m.anio DESC, m.mes DESC`);
    return rows;
  }

  async function getMes(anio, mes, { admin = false } = {}) {
    anio = num(anio); mes = num(mes);
    if (!dbActiva) {
      const d = leerSeeds().find((x) => x.anio === anio && x.mes === mes);
      return d && (admin || d.publicado) ? d : null;
    }
    const m = (await pool.query(`SELECT * FROM ${S}.mes WHERE anio = $1 AND mes = $2`, [anio, mes])).rows[0];
    if (!m || (!m.publicado && !admin)) return null;
    const evs = (await pool.query(
      `SELECT orden, to_char(fecha_inicio,'YYYY-MM-DD"T"HH24:MI') AS inicio, to_char(fecha_fin,'YYYY-MM-DD"T"HH24:MI') AS fin,
              etiqueta, titulo, descripcion, detalles, botones, nota_pasado, sin_fecha, texto_fecha, crm_id
         FROM ${S}.evento WHERE mes_id = $1 ORDER BY sin_fecha, fecha_inicio, orden, id`, [m.id])).rows;
    const en = (await pool.query(`SELECT * FROM ${S}.entrevista WHERE mes_id = $1`, [m.id])).rows[0];
    let entrevista = null;
    if (en) {
      const caps = (await pool.query(`SELECT t_seg, titulo, descripcion FROM ${S}.capitulo WHERE entrevista_id = $1 ORDER BY t_seg, id`, [en.id])).rows;
      entrevista = {
        kicker: en.kicker, titulo: en.titulo, subtitulo: en.subtitulo, entrevistador: en.entrevistador, medio: en.medio,
        invitada: en.invitada, invitadaDetalle: en.invitada_detalle, duracion: en.duracion, duracionResumen: en.duracion_resumen,
        videoCompleto: en.video_completo, videoResumen: en.video_resumen, poster: en.poster, extra: en.extra || {},
        capitulos: caps.map((c) => ({ t: c.t_seg, titulo: c.titulo, descripcion: c.descripcion })),
      };
    }
    return {
      anio: m.anio, mes: m.mes, titulo: m.titulo, lead: m.lead, subtituloCalendario: m.subtitulo_calendario,
      diasClase: m.dias_clase, rutina: m.rutina, publicado: m.publicado, mensaje: m.mensaje,
      eventos: evs.map((e) => ({
        orden: e.orden, inicio: e.inicio, fin: e.fin, etiqueta: e.etiqueta, titulo: e.titulo, descripcion: e.descripcion,
        detalles: e.detalles, botones: e.botones, notaPasado: e.nota_pasado,
        sinFecha: e.sin_fecha, textoFecha: e.texto_fecha, crmId: e.crm_id,
      })),
      entrevista,
    };
  }

  async function guardarMes(docEntrada) {
    if (!dbActiva) throw new Error('No hay base de datos configurada (DATABASE_URL): modo solo lectura');
    const d = normalizarMes(docEntrada);
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      const m = (await c.query(
        `INSERT INTO ${S}.mes (anio, mes, titulo, lead, subtitulo_calendario, dias_clase, rutina, publicado, mensaje)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (anio, mes) DO UPDATE SET titulo = EXCLUDED.titulo, lead = EXCLUDED.lead,
           subtitulo_calendario = EXCLUDED.subtitulo_calendario, dias_clase = EXCLUDED.dias_clase,
           rutina = EXCLUDED.rutina, publicado = EXCLUDED.publicado, mensaje = EXCLUDED.mensaje, actualizado = now()
         RETURNING id`,
        [d.anio, d.mes, d.titulo, d.lead, d.subtituloCalendario, d.diasClase, d.rutina ? JSON.stringify(d.rutina) : null, d.publicado, d.mensaje])).rows[0];
      await c.query(`DELETE FROM ${S}.evento WHERE mes_id = $1`, [m.id]);
      await c.query(`DELETE FROM ${S}.entrevista WHERE mes_id = $1`, [m.id]);
      for (const e of d.eventos) {
        await c.query(
          `INSERT INTO ${S}.evento (mes_id, orden, fecha_inicio, fecha_fin, etiqueta, titulo, descripcion, detalles, botones, nota_pasado, sin_fecha, texto_fecha, crm_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
          [m.id, e.orden, e.inicio.replace('T', ' '), e.fin.replace('T', ' '), e.etiqueta, e.titulo, e.descripcion,
            JSON.stringify(e.detalles), JSON.stringify(e.botones), e.notaPasado, e.sinFecha, e.textoFecha, e.crmId]);
      }
      if (d.entrevista) {
        const n = d.entrevista;
        const en = (await c.query(
          `INSERT INTO ${S}.entrevista (mes_id, kicker, titulo, subtitulo, entrevistador, medio, invitada, invitada_detalle,
             duracion, duracion_resumen, video_completo, video_resumen, poster, extra)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id`,
          [m.id, n.kicker, n.titulo, n.subtitulo, n.entrevistador, n.medio, n.invitada, n.invitadaDetalle, n.duracion,
            n.duracionResumen, n.videoCompleto, n.videoResumen, n.poster, JSON.stringify(n.extra)])).rows[0];
        for (const k of n.capitulos) {
          await c.query(`INSERT INTO ${S}.capitulo (entrevista_id, t_seg, titulo, descripcion) VALUES ($1,$2,$3,$4)`, [en.id, k.t, k.titulo, k.descripcion]);
        }
      }
      await c.query('COMMIT');
      return { anio: d.anio, mes: d.mes };
    } catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e; } finally { c.release(); }
  }

  async function borrarMes(anio, mes) {
    if (!dbActiva) throw new Error('No hay base de datos configurada: modo solo lectura');
    const r = await pool.query(`DELETE FROM ${S}.mes WHERE anio = $1 AND mes = $2`, [num(anio), num(mes)]);
    return r.rowCount > 0;
  }

  async function mesActual() {
    const lista = await listarMeses();
    return elegirActual(lista);
  }

  /* ----- CRM (solo lectura): eventos de public.services ----- */
  const fmtMadrid = (d) => {
    if (!d) return null;
    const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(d));
    const g = (t) => p.find((x) => x.type === t).value;
    return `${g('year')}-${g('month')}-${g('day')}T${g('hour')}:${g('minute')}`;
  };
  const escHtml = (t) => String(t || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const mediaUrl = (u) => {
    if (!u) return null;
    u = String(u).trim();
    const m = /^https?:\/\/[^/]+(\/(?:flyers|videos)\/.+)$/i.exec(u);
    if (m) return m[1];
    return u.startsWith('/') ? u : null;
  };
  const hhmm = (s) => s.slice(11);
  /** Convierte una fila de public.services en un borrador de evento. Tolera columnas que falten. */
  function servicioAEvento(r) {
    const flagCols = Object.keys(r).filter((k) => typeof r[k] === 'boolean' && /tbd|confirm|sinfecha|nodate|pendiente/i.test(k));
    const flag = flagCols.some((k) => r[k] === true);
    const ini = fmtMadrid(r.eventStartDate), fin = fmtMadrid(r.eventEndDate) || ini;
    const sinFecha = flag || (!ini && r.serviceType !== 'recurring');
    const detalles = [];
    if (!sinFecha && ini) detalles.push(`🕘 <b>${hhmm(ini)}${fin && fin !== ini ? ' – ' + hhmm(fin) : ''} h</b>`);
    if (r.address) detalles.push(`📍 ${escHtml(r.address)}`);
    const precio = r.price != null ? Number(r.price) : 0;
    if (precio > 0) detalles.push(`💶 <b>${String(precio).replace('.', ',').replace(/,00$/, '')} €</b>`);
    const botones = [{ tipo: 'link', texto: 'Reservar por WhatsApp', url: 'https://wa.me/34646034231?text=' + encodeURIComponent('Hola, quiero reservar: ' + r.name), estilo: 'p', cuando: 'vivo' }];
    const fly = mediaUrl(r.flyerParticularUrl) || mediaUrl(r.flyerUrl);
    if (fly) botones.push({ tipo: 'imagen', texto: 'Ver el cartel', url: fly, alt: 'Cartel ' + r.name, estilo: 'g', cuando: 'siempre' });
    const vid = mediaUrl(r.videoParticularUrl);
    if (vid) botones.push({ tipo: 'video', texto: '▶ Ver el vídeo', url: vid, estilo: 'g', cuando: 'siempre' });
    return {
      crmId: String(r.id),
      titulo: r.name, etiqueta: r.categoria || (r.serviceType === 'recurring' ? 'Clase' : 'Evento'),
      descripcion: escHtml(r.description).replace(/\n+/g, '<br>'),
      sinFecha, textoFecha: sinFecha ? (r.eventDatesText || null) : null,
      inicio: ini || undefined, fin: fin || undefined,
      detalles, botones,
      _recurrente: r.serviceType === 'recurring', _activo: r.isActive !== false,
    };
  }
  async function crmServicios() {
    if (!dbActiva) throw new Error('No hay base de datos configurada');
    let rows;
    try {
      rows = (await pool.query(`SELECT s.*, c.name AS categoria FROM public.services s LEFT JOIN public.service_categories c ON c.id = s."categoryId" ORDER BY s."displayOrder", s.name`)).rows;
    } catch (e) {
      rows = (await pool.query(`SELECT s.* FROM public.services s ORDER BY s.name`)).rows;
    }
    return rows.filter((r) => r.isActive !== false).map(servicioAEvento);
  }
  async function crmEsquema() {
    if (!dbActiva) throw new Error('No hay base de datos configurada');
    const { rows } = await pool.query(
      `SELECT table_name, column_name, data_type FROM information_schema.columns
        WHERE table_schema = 'public' AND (table_name IN ('services','service_categories') OR table_name ILIKE '%convoc%' OR table_name ILIKE '%edicion%')
        ORDER BY table_name, ordinal_position`);
    return rows;
  }

  return { crmServicios, crmEsquema, iniciar, listarMeses, getMes, guardarMes, borrarMes, mesActual, normalizarMes, dbActiva, schema: SCHEMA };
}

module.exports = { create, normalizarMes, elegirActual };
