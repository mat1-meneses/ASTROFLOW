// Borra papers subidos dos veces ("0402424v2 (1)") SOLO si existe el original sin "(n)".
// Uso:
//   node borrar_duplicados.js              -> solo muestra qué borraría (no cambia nada)
//   node borrar_duplicados.js --confirmar  -> borra, en una transacción
// Usa DATABASE_URL: la base local por defecto, o Neon si antes hiciste  set "DATABASE_URL=..."
require('dotenv').config({ quiet: true });
const { Pool } = require('pg');

const confirmar = process.argv.includes('--confirmar');

(async () => {
  const url = new URL(process.env.DATABASE_URL);
  console.log(`Base: ${url.hostname} / ${url.pathname.slice(1)}${confirmar ? '' : '   (modo prueba: no se borra nada)'}`);
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const cliente = await pool.connect();
  try {
    const { rows } = await cliente.query(`
      SELECT d.id, d.titulo,
             regexp_replace(d.titulo, '\\s*\\(\\d+\\)$', '') AS original,
             (SELECT count(*) FROM chunks c WHERE c.documento_id = d.id) AS chunks,
             EXISTS (SELECT 1 FROM documentos o
                     WHERE o.titulo = regexp_replace(d.titulo, '\\s*\\(\\d+\\)$', '')) AS tiene_original
      FROM documentos d
      WHERE d.titulo ~ '\\(\\d+\\)$'
      ORDER BY d.titulo`);

    if (rows.length === 0) { console.log('No hay duplicados.'); return; }
    const borrables = rows.filter((r) => r.tiene_original);
    for (const r of rows) {
      console.log(`  ${r.titulo}  (${r.chunks} chunks)  ->  ${r.tiene_original ? `se borra; queda "${r.original}"` : 'NO se borra: no existe el original'}`);
    }
    if (!confirmar) {
      console.log(`\n${borrables.length} duplicado(s) se borrarían. Para hacerlo: node borrar_duplicados.js --confirmar`);
      return;
    }
    const ids = borrables.map((r) => r.id);
    await cliente.query('BEGIN');
    const c = await cliente.query('DELETE FROM chunks WHERE documento_id = ANY($1)', [ids]);
    const d = await cliente.query('DELETE FROM documentos WHERE id = ANY($1)', [ids]);
    await cliente.query('COMMIT');
    console.log(`\nBorrados: ${d.rowCount} documento(s) y ${c.rowCount} chunk(s).`);
  } catch (e) {
    await cliente.query('ROLLBACK').catch(() => {});
    console.error('Error (no se borró nada):', e.message);
  } finally {
    cliente.release();
    await pool.end();
  }
})();
