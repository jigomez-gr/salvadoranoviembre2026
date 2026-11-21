# Estado del proyecto · Actividades del mes (Salvadora Conesa)
Actualizado: 21/11/2026

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

## Pendiente
1. `subir.bat "Medios por actividad y sin Formación"` + Deploy (cambia `db.js`; también `PROMPT_AGENTE_LANDING.md`).
2. Opcional: en `/admin` → **Importar JSON…** → `noviembre-2026-actualizado.json` (quita "Formación" de noviembre y añade 2 carteles y 2 vídeos a Constelaciones). Sustituye el contenido de noviembre por esa versión.
3. Botón "Actividades del mes" en la landing: pasar `PROMPT_AGENTE_LANDING.md` al agente de la landing; después en Dokploy de la **landing** añadir `NEXT_PUBLIC_ACTIVIDADES_URL=https://salvadoranov2026.jigretera.com` y pulsar **Deploy** (esa variable se aplica al construir, no basta con reiniciar).
4. Constelaciones del 14 nov: falta horario y lugar reales.
5. El vídeo de la entrevista aún muestra "María Conesa" quemado en el rótulo (opcional rehacerlo).
6. Cambiar la contraseña de Postgres (apareció en un fichero adjunto de una conversación).

## En diciembre
- Entrar en `/admin` → Diciembre 2026: rellenar **Aviso destacado** y marcar **Publicado** (el lunes 1 pasa a ser el mes actual). Cuando haya fechas: **+ Añadir evento** o **Traer del CRM**.
- Cada mes: **+ Nuevo mes** → copiar clases habituales → rellenar → Guardar. El mes anterior pasa solo al histórico.
- Tras 1/12 el título de la URL (`salvadoranov2026`) queda anticuado: si quieres un dominio neutro (p. ej. `actividades.…`), añadirlo en Dokploy → Domains y cambiar la variable de la landing.
