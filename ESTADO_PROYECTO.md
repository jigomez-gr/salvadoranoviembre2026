# Estado del proyecto · Actividades del mes (Salvadora Conesa)
Actualizado: 25/11/2026

## Qué es
Minilanding independiente con las actividades de cada mes, un selector de meses y un histórico. Un panel `/admin` (con contraseña) permite crear y editar meses sin tocar código.
- Web pública: https://salvadoranov2026.jigretera.com (alias `/servicios`; un mes concreto: `/2026-11`)
- Panel: https://salvadoranov2026.jigretera.com/admin
- Código: https://github.com/jigomez-gr/salvadoranoviembre2026 (rama main) · despliegue en Dokploy (http://192.168.1.17:3000)
- Carpeta del proyecto en el PC: `D:\tmp\claudecode\entrevistasalvadora\salvadoranoviembre2026\`
- Datos: Postgres `crm_salvadora` (192.168.1.17:5433), esquema propio `actividades`. Medios: `/var/data/salvadora/media` (= `media_base`). No se guarda ninguna contraseña en el repositorio.

## Cómo se publica un cambio de código
1. En la carpeta del proyecto: `subir.bat "mensaje"` (sube a GitHub).
2. Dokploy → la app → **Deploy**.
3. Comprobar: `curl.exe https://salvadoranov2026.jigretera.com/api/estado` (debe decir `"actividades": "esquema \"actividades\" listo"`).
Los **vídeos nuevos** se copian con `transferir.bat` (no van a Git).
Los **datos de cada mes** (textos, fechas, flyers, vídeos) se cambian en `/admin`, sin Deploy.

## Hecho
- Noviembre 2026 completo (entrevista, capítulos, eventos, rutina) · mes actual con selector + histórico.
- Panel admin: crear/editar meses, subir flyers y vídeos, importar/exportar JSON, **Aviso destacado**, "Fecha por confirmar", **Traer del CRM**.
- Diciembre 2026 creado como borrador en el panel (clases habituales copiadas de noviembre).
- Responsive 320 px → 4K comprobado.
- Regla de medios al **Traer del CRM** (cambio de esta fecha, pendiente de subir): cada actividad lleva hasta **2 vídeos y 2 flyers** (los "particular" y los generales). Orden: columnas del servicio → tabla `public.media_assets` (por `serviceId`) → vídeo fijo del itinerario → si no hay nada, el de yoga.
  Vídeos fijos: yoga `itinerario-1` · meditaciones 2 · baño de gong 3 · puja gong 4 · gestalt 5 · constelaciones 6 · encuentros 7 · ayunos 8 · actos especiales 9.
- El servicio "Formación en Constelaciones Familiares" ya no aparece al traer del CRM.

- **Nueva paleta (23/11/2026)**: fondo verde casi negro `#0f1a17` / `#14231f`, acento rosa-magenta `#c24f9b`, rosa claro `#e8a3d3`, dorado `#c5a059` sin cambios. Aplicada en `public/index.html` y `public/admin.html` (variables CSS `--bg`, `--bg2`, `--lotus`, `--lotus-l`). Tonos estimados de una captura de `actividades-noviembre-2026`; ajustables ahí.
- Subido a GitHub (rama main): commits `9693c73` "Medios por actividad y sin Formación" y `e43454e` "Nuevo color rosa". Árbol git limpio.

- **Galería por mes y medios por mes (25/11/2026, pendiente de subir + Deploy)**: cada mes puede tener una galería de vídeos e imágenes extra (miniaturas que se amplían al pulsar). En `/admin` → sección «Galería de vídeos e imágenes». Lo que se sube ahí va a `/var/data/salvadora/media/meses/AAAA-MM/{videos,flyers}` y se sirve en `/m/AAAA-MM/videos|flyers/archivo`. Los medios antiguos (`/videos/…`, `/flyers/…`) siguen igual. Nueva columna `galeria` (jsonb) en `actividades.mes`, se crea sola al arrancar. Los MP4 nunca van a Git.
  Los vídeos (galería y botones de vídeo de eventos) también admiten URL: YouTube y Vimeo se reproducen con su reproductor oficial incrustado (youtube-nocookie); un enlace directo a .mp4 se reproduce como archivo; cualquier otra web se abre en pestaña nueva.
- Baño de gong 21/11: botones «Vídeo de la actividad» (`itinerario-3`) y «Vídeo particular» (`Bano-de-Gong_particular.mp4` + `-poster.jpg`) en `noviembre-2026-actualizado.json` y `seed/2026-11.json`. Falta el flyer particular (nombre por confirmar). Para verlo: `/admin` → Importar JSON.

- **Formulario de evento en `/admin` (25/11/2026, pendiente de subir + Deploy)**: cada evento tiene selector «Actividad» (CRM + las 9 base que rellena título, etiqueta y vídeo), Inicio/Fin, Horario, Lugar, Precio y 4 medios fijos: vídeo de la actividad, vídeo particular, cartel de la actividad y cartel particular (ruta, URL de YouTube u otra web, o «Subir archivo…», con portada opcional en los vídeos). Se guardan en `botones` con `slot` = vAct/vPart/fAct/fPart; los vacíos no salen en la web. Ya no hace falta importar JSON para editar.

## Pendiente
0. `subir.bat "Galeria por mes"` + Deploy en Dokploy (cambian `server.js`, `db.js`, `public/index.html`, `public/admin.html`), luego importar el JSON de noviembre en `/admin`.
1. En Dokploy: **Deploy** de la app (si no se ha hecho tras `e43454e`) y comprobar `/api/estado` y el color con Ctrl+F5.
2. Opcional: en `/admin` → **Importar JSON…** → `noviembre-2026-actualizado.json` (quita "Formación" de noviembre y añade 2 carteles y 2 vídeos a Constelaciones). Sustituye el contenido de noviembre por esa versión.
3. Botón "Actividades del mes" en la landing: pasar `PROMPT_AGENTE_LANDING.md` al agente de la landing; después en Dokploy de la **landing** añadir `NEXT_PUBLIC_ACTIVIDADES_URL=https://salvadoranov2026.jigretera.com` y pulsar **Deploy** (esa variable se aplica al construir, no basta con reiniciar).
4. Constelaciones del 14 nov: falta horario y lugar reales.
5. El vídeo de la entrevista aún muestra "María Conesa" quemado en el rótulo (opcional rehacerlo).
6. Cambiar la contraseña de Postgres (apareció en un fichero adjunto de una conversación).

## En diciembre
- Entrar en `/admin` → Diciembre 2026: rellenar **Aviso destacado** y marcar **Publicado** (el lunes 1 pasa a ser el mes actual). Cuando haya fechas: **+ Añadir evento** o **Traer del CRM**.
- Cada mes: **+ Nuevo mes** → copiar clases habituales → rellenar → Guardar. El mes anterior pasa solo al histórico.
- Tras 1/12 el título de la URL (`salvadoranov2026`) queda anticuado: si quieres un dominio neutro (p. ej. `actividades.…`), añadirlo en Dokploy → Domains y cambiar la variable de la landing.
