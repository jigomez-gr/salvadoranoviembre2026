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

---

## Meses, histórico y panel de administración (v2)

La página ya no tiene el contenido escrito a mano: **cada mes vive en Postgres** (esquema propio `actividades`
dentro de `crm_salvadora`; 4 tablas: `mes`, `evento`, `entrevista`, `capitulo`; no toca ninguna tabla de la
landing ni del CRM). Los vídeos y carteles siguen en el sistema de ficheros compartido; en la base solo se guarda su nombre.

### Variable nueva en Dokploy (Environment)

| Variable | Valor |
|---|---|
| `ADMIN_PASSWORD` | una contraseña larga (sin ella, `/admin` queda desactivado) |
| `MAX_UPLOAD_MB` | opcional, 800 por defecto |

Después: **Deploy**. Al arrancar crea las tablas y, si están vacías, carga noviembre 2026 desde `seed/2026-11.json`.
Comprobación: `https://salvadoranov2026.jigretera.com/api/estado` → `"actividades": "esquema \"actividades\" listo"`.

### Cómo se usa cada mes

1. Entra en `https://salvadoranov2026.jigretera.com/admin`.
2. **+ Nuevo mes** (p. ej. `2026-12`): puede copiar las clases habituales del mes anterior. Nace como *borrador*.
3. Añade eventos, sube flyers/vídeos con **Subir archivo…** (van a `/var/data/salvadora/media/flyers|videos`) y escribe los capítulos.
4. Marca **Publicado** y **Guardar**. La web (`/`) muestra siempre el mes en curso; el selector y el **Histórico** dan acceso a los demás (`/AAAA-MM`).

Notas de seguridad:
- La subida **nunca pisa** un archivo existente (la carpeta de medios es la misma que usa la landing).
- Solo acepta mp4, webm, jpg, png, webp y pdf. Sesión de 12 h, bloqueo tras varios intentos fallidos.
- El contenedor corre como root para poder escribir en el volumen compartido.
- Borrar un mes en el panel **no** borra sus archivos del disco.

### Importar/exportar

En el panel: **Descargar JSON** (un mes entero) e **Importar JSON…**. Sirve para que un agente prepare el mes siguiente:
basta con copiar `seed/2026-11.json`, cambiar el contenido y cargarlo en `/admin`.
