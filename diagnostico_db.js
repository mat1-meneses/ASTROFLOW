// Muestra a qué base se conecta DATABASE_URL y qué tablas tiene. No imprime la contraseña.
// Uso:  node diagnostico_db.js
require('dotenv').config({ quiet: true });
const { Pool } = require('pg');

(async () => {
  const url = new URL(process.env.DATABASE_URL);
  console.log('Host :', url.hostname);
  console.log('Base :', url.pathname.slice(1));
  console.log('Pooler:', url.hostname.includes('-pooler') ? 'sí' : 'no (conexión directa)');

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const info = await pool.query('select current_database() db, current_user usr, current_schemas(true) esquemas');
    console.log('Conectado a:', info.rows[0]);
    const tablas = await pool.query(
      `select table_schema, table_name from information_schema.tables
       where table_schema not in ('pg_catalog','information_schema') order by 1, 2`
    );
    console.log(tablas.rows.length ? 'Tablas:' : 'La base no tiene tablas.');
    for (const t of tablas.rows) console.log(`  ${t.table_schema}.${t.table_name}`);
    const dbs = await pool.query('select datname from pg_database where not datistemplate order by 1');
    console.log('Bases en este servidor:', dbs.rows.map((r) => r.datname).join(', '));
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await pool.end();
  }
})();
