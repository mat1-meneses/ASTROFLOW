const fs = require('fs');
const path = require('path');
const { pool } = require('./db');

(async () => {
  await pool.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8'));
  console.log('Esquema aplicado.');
  await pool.end();
})().catch((err) => {
  console.error('Error al migrar:', err.message);
  process.exit(1);
});