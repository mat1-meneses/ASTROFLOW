const { pool } = require('../db');

async function buscarPorEmail(email) {
  const { rows } = await pool.query(
    'SELECT id, nombre, email, password_hash FROM usuarios WHERE email = $1',
    [email]
  );
  return rows[0] || null;
}

async function buscarPorId(id) {
  const { rows } = await pool.query('SELECT id, nombre, email FROM usuarios WHERE id = $1', [id]);
  return rows[0] || null;
}

async function crear({ nombre, email, passwordHash }) {
  const { rows } = await pool.query(
    'INSERT INTO usuarios (nombre, email, password_hash) VALUES ($1, $2, $3) RETURNING id, nombre, email',
    [nombre, email, passwordHash]
  );
  return rows[0];
}

module.exports = { buscarPorEmail, buscarPorId, crear };