# Prompt para el agente de la landing (copia y pega todo lo de abajo)

---

Trabajas en la landing actual del Centro de Yoga Salvadora Conesa: proyecto **Next.js 16 + Prisma + Postgres** en `D:\tmp\antigraviti\salvadora\caso1`. Antes de escribir código lee `AGENTS.md` y la guía correspondiente en `node_modules/next/dist/docs/`: esta versión de Next tiene cambios que rompen lo que sabes.

## Objetivo
Hemos creado una **minilanding aparte**, "Actividades del mes de noviembre 2026": una aplicación independiente (repositorio `https://github.com/jigomez-gr/salvadoranoviembre2026`, desplegada en `https://salvadoranov2026.jigretera.com`). Tu trabajo es **enlazarla desde la landing**, no copiarla ni reescribirla.

**Dónde y con qué botón lo integras te lo indicará el usuario en su siguiente mensaje** (pantalla y botón concretos). No elijas tú la ubicación ni toques ningún otro sitio. Hasta que te lo diga, limítate a leer el proyecto y a confirmar que has entendido.

Cuando te lo indique:
1. El botón **abre la minilanding en una pestaña nueva** (`target="_blank"` y `rel="noopener noreferrer"`).
2. La URL sale de una variable de entorno pública `NEXT_PUBLIC_NOVIEMBRE_URL` (valor por defecto: `https://salvadoranov2026.jigretera.com`). Si la variable está vacía, **no se muestra el botón**. Mira `src/lib/featureFlags.ts` y sigue el patrón de `NEXT_PUBLIC_PORVAPI` y compañía. Añade la variable a `.env.example` (sin tocar `.env` ni imprimir secretos).
3. Estilo coherente con la web: granate `#800020`, dorado `#C5A059`, crema `#FAF9F6`, `font-serif` (Cormorant Garamond) y `font-sans` (Outfit), sin romper el diseño en ningún ancho.
4. Añade `data-testid="btn-noviembre"` al botón.

## Medios y base de datos: se comparten, no se copian
- **No añadas a Git ningún `.mp4`, imagen pesada ni PDF.** Los medios viven en `media_base` (en el servidor, `/var/data/salvadora/media`, con subcarpetas `videos/`, `flyers/`, `documentos/`) y la landing los sirve por `/videos/[...filename]`.
- La minilanding usa **la misma carpeta de medios** y **la misma base de datos Postgres `salvadora`**. No crees otra copia de nada.
- La minilanding necesita estos ficheros nuevos en `media_base/videos/` (están en `D:\tmp\claudecode\entrevistasalvadora\salvadoranoviembre2026\media-nuevos\videos\`):
  - `entrevista_madridmarket_completa.mp4` (87 MB)
  - `entrevista_madridmarket_resumen.mp4` (10 MB)
  - `entrevista_madridmarket_poster.jpg`
  Cópialos a `media_base\videos` y sincronízalos con el servidor con el mecanismo que ya existe (`transferir.bat` / variables `MEDIA_SYNC_*`). No muevas ni borres nada existente.
- Los demás medios que usa la minilanding ya existen en `media_base`: `videos/Promo_Bienestar-Experience-2026_1920x1080.mp4` (y su `-poster.jpg`), `flyers/flyer13nov2026vivemasparticular.jpeg`, `flyers/constalaciones.jpeg`. Comprueba que están también en el servidor.
- (Opcional) registra los tres ficheros nuevos en la tabla de medios con `sql/registrar_media.sql` del repositorio de la minilanding. **Antes comprueba el esquema real**: `src/app/videos/[...filename]/route.ts` consulta `ccmfalla.media_assets`, pero el volcado `database_dump/backup_crm_salvadora_20260920.sql` define `public.media_assets`. Averigua cuál es la correcta en la base viva y, si hay una incoherencia, **cuéntamela en vez de cambiarla por tu cuenta**.

## Reglas
- Cambios mínimos y localizados. No toques Stripe, Vapi, el CRM, `prisma/` ni `.env`.
- Ejecuta `npm run build` y arregla lo que rompa tu cambio.
- Comprueba en local que el botón aparece donde el usuario te indicó, en escritorio y móvil, que abre una pestaña nueva y que desaparece si `NEXT_PUBLIC_NOVIEMBRE_URL` está vacía.
- Haz commit solo si te lo pido. Al terminar dime: archivos tocados, variable nueva que debo añadir en Dokploy a la landing, y qué comprobaste.
