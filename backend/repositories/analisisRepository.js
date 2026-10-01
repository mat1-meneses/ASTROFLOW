// Patrón Repository: todo el SQL de análisis vive aquí.
// Todas las lecturas filtran por usuario_id: un usuario nunca puede abrir
// el análisis de otro aunque adivine su id.
const { pool } = require('../db');

async function crear({ usuarioId, nombre, configuracion, serie, resultado, reporte }) {
  const { rows } = await pool.query(
    `INSERT INTO analisis (usuario_id, nombre, configuracion, serie, resultado, reporte)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [
      usuarioId,
      nombre,
      JSON.stringify(configuracion),
      JSON.stringify(serie),
      JSON.stringify(resultado),
      reporte ? JSON.stringify(reporte) : null,
    ]
  );
  return rows[0];
}

async function listarPorUsuario(usuarioId) {
  const { rows } = await pool.query(
    `SELECT id,
            nombre,
            creado_en                                                   AS "creadoEn",
            (resultado->>'n_puntos_usados')::int                        AS "nPuntos",
            (resultado->'derivados'->>'periodo_principal_dias')::float  AS periodo,
            (resultado->'derivados'->>'amplitud_fats')::float           AS amplitud,
            (resultado->'derivados'->>'R21')::float                     AS "R21"
       FROM analisis
      WHERE usuario_id = $1
      ORDER BY creado_en DESC`,
    [usuarioId]
  );
  return rows;
}

async function obtenerDeUsuario(id, usuarioId) {
  const { rows } = await pool.query(
    `SELECT id, nombre, configuracion, serie, resultado, reporte, creado_en AS "creadoEn"
       FROM analisis
      WHERE id = $1 AND usuario_id = $2`,
    [id, usuarioId]
  );
  return rows[0] || null;
}

module.exports = { crear, listarPorUsuario, obtenerDeUsuario };
