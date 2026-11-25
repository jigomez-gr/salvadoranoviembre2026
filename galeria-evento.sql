-- Galería propia de cada evento (el servidor también lo hace solo al arrancar)
ALTER TABLE actividades.evento ADD COLUMN IF NOT EXISTS galeria jsonb;
