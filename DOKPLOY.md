# Publicar la minilanding en Dokploy

Repositorio (vacío, ya creado): `https://github.com/jigomez-gr/salvadoranoviembre2026`

La app es un contenedor Node muy ligero (≈ 60 MB). **No lleva vídeos ni imágenes**: los lee de la carpeta compartida `/var/data/salvadora/media` (la misma de la landing) y puede consultar la base de datos Postgres compartida.

## 1. Subir el código a GitHub
En una terminal, dentro de la carpeta `salvadoranoviembre2026`:

```bash
git init
git add .
git status          # comprueba que NO aparece ningún .mp4, .jpg ni la carpeta media-nuevos
git commit -m "Minilanding actividades noviembre 2026"
git branch -M main
git remote add origin https://github.com/jigomez-gr/salvadoranoviembre2026.git
git push -u origin main
```

El `.gitignore` ya excluye vídeos, imágenes y `media-nuevos/`.

## 2. Llevar los 3 medios nuevos al servidor
Copia `media-nuevos/videos/*` a `/var/data/salvadora/media/videos/` del **mismo servidor donde corre la landing**. Con los datos de `MEDIA_SYNC_*` de tu `.env` de la landing:

```bash
scp media-nuevos/videos/* USUARIO@HOST:/var/data/salvadora/media/videos/
```

(o con tu `transferir.bat` de siempre). Los otros medios que usa la página (vídeo promo del Bienestar Experience y flyers) ya están en `media_base`.

## 3. Crear la aplicación en Dokploy
1. Entra en el **mismo proyecto** de la landing → **Create Service → Application**. Nombre: `salvadoranoviembre2026`.
2. **Provider**: GitHub (o "Git" con la URL pública `https://github.com/jigomez-gr/salvadoranoviembre2026.git`), rama `main`.
3. **Build Type**: `Dockerfile`; ruta `Dockerfile`; contexto `.`.
4. Pestaña **Environment**:
   ```
   PORT=3000
   MEDIA_STORAGE_ROOT=/var/data/salvadora/media
   LANDING_URL=https://salvadoraconesa.es
   DATABASE_URL=<la MISMA cadena que usa la landing/CRM>
   ```
   `DATABASE_URL` es opcional: si falta, la app funciona igual, solo sin la búsqueda de respaldo en `media_assets`.
5. Pestaña **Advanced → Volumes / Mounts → Add Mount → Bind Mount**:
   - Host path: `/var/data/salvadora/media`
   - Mount path: `/var/data/salvadora/media`
   Es la carpeta de ficheros compartida con la landing (debe existir en el mismo servidor).
6. **Base de datos compartida**: si Postgres es otro servicio de Dokploy, usa en `DATABASE_URL` el host de su *Internal Connection URL* (las aplicaciones del mismo servidor comparten red). Si está fuera de Dokploy, usa su IP/puerto y permite la conexión desde este servidor.
7. Pestaña **Domains → Add Domain**: `salvadoranov2026.jigretera.com`, puerto `3000`, HTTPS con Let's Encrypt. El dominio es `salvadoranov2026.jigretera.com` (zona `jigretera.com`): crea antes el registro **A** de ese subdominio hacia la IP del servidor, si aún no existe. La página responde en `/` y también en `/servicios`.
8. **Deploy**.

## 4. Comprobar
- `https://salvadoranov2026.jigretera.com/` (y `/servicios`) → la minilanding
- `https://salvadoranov2026.jigretera.com/healthz` → `ok`
- `https://salvadoranov2026.jigretera.com/api/estado` → todos los medios en `true` y `baseDeDatos: "ok"`. Cualquier `false` es un fichero que falta en `/var/data/salvadora/media`.
- La página carga, el vídeo avanza y retrocede, y los capítulos saltan al minuto.

## 5. Actualizar después
`git push` a `main` y, en Dokploy, **Deploy** (o activa *Auto Deploy*/webhook de GitHub). Los eventos que ya han pasado se marcan solos como "Celebrado" según la fecha.

## Si algo falla
- **El vídeo no carga / 404**: mira `/api/estado`; el fichero no está en `/var/data/salvadora/media/videos/` o el bind mount no está bien.
- **`baseDeDatos: error…`**: revisa `DATABASE_URL` y la red entre contenedores. La web sigue funcionando sin BD.
- **Dominio sin HTTPS**: el DNS aún no apunta al servidor.

## Probar en local antes
Doble clic en `iniciar-local.bat` (necesita Node 20 o superior) → http://localhost:3100. Usa los medios reales de `D:\tmp\antigraviti\salvadora\media_base` y los nuevos de `media-nuevos\`.
