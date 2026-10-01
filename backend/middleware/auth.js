const jwt = require('jsonwebtoken');

const COOKIE = 'astroflow_sesion';
const OPCIONES = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
};

function firmarSesion(res, usuario) {
  const token = jwt.sign({ sub: usuario.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.cookie(COOKIE, token, { ...OPCIONES, maxAge: 7 * 24 * 60 * 60 * 1000 });
}

function cerrarSesion(res) {
  res.clearCookie(COOKIE, OPCIONES);
}

// Se ejecuta en todas las requests: deja req.usuarioId con el id o null (invitado).
function leerSesion(req, _res, next) {
  req.usuarioId = null;
  const token = req.cookies?.[COOKIE];
  if (token) {
    try {
      req.usuarioId = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] }).sub;
    } catch {
      // token vencido o alterado: se trata como invitado
    }
  }
  next();
}

// Para rutas que exigen cuenta (ej. guardar análisis).
function requerirSesion(req, res, next) {
  if (!req.usuarioId) return res.status(401).json({ error: 'Debes iniciar sesión.' });
  next();
}

module.exports = { firmarSesion, cerrarSesion, leerSesion, requerirSesion };
