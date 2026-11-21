-- OPCIONAL. Registra los medios nuevos en la tabla compartida media_assets
-- (la usa la landing para localizar ficheros por clave). Ejecutar sobre la BD compartida.
-- Antes comprueba el esquema real: la ruta /videos de la landing consulta "ccmfalla.media_assets",
-- mientras que el volcado database_dump/backup_crm_salvadora_20260920.sql la define como public.media_assets.
-- Ajusta el nombre de esquema si hace falta.
INSERT INTO public.media_assets (key, title, "mediaType", "mimeType", "physicalPath", "publicUrl", "isActive", "displayOrder")
VALUES
 ('entrevista_madridmarket_completa','Entrevista Madridmarket.es (completa, 18 min)','video','video/mp4','/var/data/salvadora/media/videos/entrevista_madridmarket_completa.mp4','/videos/entrevista_madridmarket_completa.mp4',true,50),
 ('entrevista_madridmarket_resumen','Entrevista Madridmarket.es (resumen, 4 min)','video','video/mp4','/var/data/salvadora/media/videos/entrevista_madridmarket_resumen.mp4','/videos/entrevista_madridmarket_resumen.mp4',true,51),
 ('entrevista_madridmarket_poster','Entrevista Madridmarket.es (portada)','image','image/jpeg','/var/data/salvadora/media/videos/entrevista_madridmarket_poster.jpg','/videos/entrevista_madridmarket_poster.jpg',true,52)
ON CONFLICT (key) DO NOTHING;
