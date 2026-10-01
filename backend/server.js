require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { leerSesion } = require('./middleware/auth');
const authRoutes = require('./routes/auth');
const analisisRoutes = require('./routes/analisis');

if (!process.env.JWT_SECRET) {
  console.error('Falta JWT_SECRET en .env');
  process.exit(1);
}

const app = express();
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend ASTROFLOW en http://localhost:${PORT}`));
