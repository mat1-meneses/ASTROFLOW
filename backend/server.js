require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { leerSesion } = require('./middleware/auth');
const authRoutes = require('./routes/auth');
const analisisRoutes = require('./routes/analisis');

if (!process.env.JWT_SECRET) {
  // En Vercel no hay .env: la variable se configura en el panel del proyecto.
  throw new Error('Falta JWT_SECRET en las variables de entorno');
}

const app = express();
// Detrás del proxy de Vercel, la IP real del usuario viene en X-Forwarded-For;
// sin esto, el límite por IP trataría a todos los usuarios como uno solo.
app.set('trust proxy', 1);
app.use(helmet());
// 15 MB: una curva de 10 MB convertida a JSON (tiempo, magnitud, error) cabe con holgura.
app.use(express.json({ limit: '15mb' }));
app.use(cookieParser());
app.use(leerSesion);

const limiteAuth = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Intenta de nuevo en unos minutos.' },
});
app.use('/api/auth/login', limiteAuth);
app.use('/api/auth/registro', limiteAuth);

app.use('/api/auth', authRoutes);
app.use('/api/analisis', analisisRoutes);

app.use((err, _req, res, _next) => {
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'La curva es demasiado grande para procesarla.' });
  }
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor.' });
});

// En local (node backend/server.js) se levanta el servidor; en Vercel, api/index.js importa la app.
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Backend ASTROFLOW en http://localhost:${PORT}`));
}

module.exports = app;
