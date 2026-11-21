# Prompt para el agente de la landing (copia y pega todo lo de abajo)

---

Trabajas en la landing del Centro de Yoga Salvadora Conesa: proyecto **Next.js 16 + Prisma + Postgres** en `D:\tmp\antigraviti\salvadora\caso1`. Antes de escribir código lee `AGENTS.md` y la guía correspondiente en `node_modules/next/dist/docs/` (esta versión de Next tiene cambios que rompen lo que sabes).

## Tarea (pequeña y localizada)
Añadir **un botón "Actividades del mes"** que abre en **pestaña nueva** la minilanding `https://salvadoranov2026.jigretera.com`. Esa web es una aplicación aparte que muestra siempre el mes en curso (y tiene selector de meses e histórico), así que **el enlace no cambia nunca**: no lo toques cada mes.

### Dónde
En la sección **ACTIVIDADES** de la página de inicio (la que se alcanza con el menú "ACTIVIDADES", ancla `#itinerario`; componente `src/components/ItineraryTimeline.tsx` / `src/app/page.tsx`): un botón bien visible justo encima o al lado del título de la sección. No toques el menú superior ni ninguna otra pantalla.

### Cómo
1. `<a href={url} target="_blank" rel="noopener noreferrer" data-testid="btn-actividades-mes">Actividades del mes</a>`.
2. La URL sale de la variable pública `NEXT_PUBLIC_ACTIVIDADES_URL` (valor por defecto en `.env.example`: `https://salvadoranov2026.jigretera.com`). Si la variable está vacía **no se muestra el botón**. Sigue el patrón de `src/lib/featureFlags.ts` (`NEXT_PUBLIC_PORVAPI` y compañía).
3. Estilo coherente con la web: granate `#800020`, dorado `#C5A059`, crema `#FAF9F6`, `font-serif` (Cormorant Garamond) y `font-sans` (Outfit). Debe verse bien en móvil, tableta, portátil, PC y pantallas grandes (sin desbordar ni cortarse).

## Reglas
- No añadas a Git ningún `.mp4`, imagen pesada ni PDF. No toques Stripe, Vapi, el CRM, `prisma/` ni `.env`. No incluyas VAPI en nada nuevo.
- La minilanding comparte la carpeta de medios (`media_base`) y la base de datos Postgres; **no copies nada de ella** a esta landing.
- Ejecuta `npm run build` y arregla lo que rompa tu cambio.
- Comprueba en local: el botón sale donde se indica, en escritorio y móvil, abre pestaña nueva y desaparece si la variable está vacía.
- Haz commit solo si te lo pido. Al terminar dime: archivos tocados y qué comprobaste. (La variable nueva la añado yo en Dokploy.)
