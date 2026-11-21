# Minilanding · Actividades de noviembre 2026
Centro de Yoga Salvadora Conesa (Fuenlabrada).

- `public/index.html` — la página (calendario, eventos que se marcan solos como "Celebrado", entrevista con 13 capítulos sincronizados).
- `server.js` — servidor Node: página + medios desde la carpeta compartida (con Range) + Postgres compartido opcional.
- `media-nuevos/` — los 3 ficheros nuevos para copiar a `media_base/videos` (**no van a Git**).
- `DOKPLOY.md` — publicar. `PROMPT_AGENTE_LANDING.md` — prompt para integrar el botón en la landing.
- Probar en local: `iniciar-local.bat` → http://localhost:3100
- Diagnóstico: `/healthz` y `/api/estado`.

Para cambiar un evento, edita su `<article class="ev">` en `public/index.html` (`data-start` / `data-end` controlan el estado automático).
