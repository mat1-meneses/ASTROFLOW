CREATE TABLE IF NOT EXISTS usuarios (
  id            SERIAL PRIMARY KEY,
  nombre        TEXT        NOT NULL,
  email         TEXT        NOT NULL UNIQUE,
  password_hash TEXT        NOT NULL,
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Análisis guardados por usuarios con sesión.
-- configuracion: columnas elegidas, tipo de brillo, calibración y banda.
-- serie: tiempo, magnitud y error usados (para volver a graficar sin el archivo original).
-- resultado: respuesta completa del microservicio de descriptores.
-- reporte: texto del RAG, fuentes, advertencias y estado (borrador/editado/final).
CREATE TABLE IF NOT EXISTS analisis (
  id            SERIAL PRIMARY KEY,
  usuario_id    INTEGER     NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nombre        TEXT        NOT NULL,
  configuracion JSONB       NOT NULL,
  serie         JSONB       NOT NULL,
  resultado     JSONB       NOT NULL,
  reporte       JSONB,
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS analisis_usuario_idx ON analisis (usuario_id, creado_en DESC);
