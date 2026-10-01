const express = require('express');
const bcrypt = require('bcryptjs');
const usuarios = require('../repositories/usuarioRepository');
const { firmarSesion, cerrarSesion } = require('../middleware/auth');

const router = express.Router();
const HASH_FALSO = bcrypt.hashSync('usuario-inexistente', 12);
const limpiarEmail = (v) => String(v || '').trim().toLowerCase();

router.post('/registro', async (req, res) => {
  const nombre = String(req.body.nombre || '').trim();
  const email = limpiarEmail(req.body.email);
  const password = String(req.body.password || '');

  const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
  if (!nombre || nombre.length > 100 || !emailValido ||
      password.length < 8 || Buffer.byteLength(password) > 72) {
    return res.status(400).json({ error: 'Datos inválidos.' });
  }
  if (await usuarios.buscarPorEmail(email)) {
    return res.status(409).json({ error: 'Ese correo ya está registrado.' });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  try {
    const usuario = await usuarios.crear({ nombre, email, passwordHash });
    firmarSesion(res, usuario);
    res.status(201).json({ usuario });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Ese correo ya está registrado.' });
    throw err;
  }
});

router.post('/login', async (req, res) => {
  const email = limpiarEmail(req.body.email);
  const password = String(req.body.password || '');

  const usuario = await usuarios.buscarPorEmail(email);
  // Siempre se ejecuta bcrypt, exista o no el usuario, para que el tiempo de respuesta no lo delate.
  const coincide = await bcrypt.compare(password, usuario ? usuario.password_hash : HASH_FALSO);
  if (!usuario || !coincide) return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });

  firmarSesion(res, usuario);
  res.json({ usuario: { id: usuario.id, nombre: usuario.nombre, email: usuario.email } });
});

router.post('/logout', (_req, res) => {
  cerrarSesion(res);
  res.status(204).end();
});

// Invitado es un estado válido: responde 200 con usuario null.
router.get('/me', async (req, res) => {
  if (!req.usuarioId) return res.json({ usuario: null });
  res.json({ usuario: await usuarios.buscarPorId(req.usuarioId) });
});

module.exports = router;