// Rutas de análisis.
//   POST /api/analisis/descriptores  → invitados y usuarios: llama al microservicio Python
//   POST /api/analisis/reporte       → invitados y usuarios: genera el reporte RAG (con límite de uso)
//   POST /api/analisis               → solo con sesión: guarda el análisis
//   GET  /api/analisis               → solo con sesión: lista los análisis del usuario
//   GET  /api/analisis/:id           → solo con sesión: abre uno (si es del usuario)
const express = require('express');
const rateLimit = require('express-rate-limit');
const { obtenerDescriptores, adaptarParaReporte } = require('../../rag/descriptoresClient.js');
const { generarReporte } = require('../../rag/ragFacade.js');
const analisisRepo = require('../repositories/analisisRepository');
const { requerirSesion } = require('../middleware/auth');

const router = express.Router();

const MIN_PUNTOS = 30;
const MAX_PUNTOS = 200000;
const CALIBRACIONES = ['instrumental', 'estandar', 'desconocida'];

// Cada reporte es una llamada pagada al LLM y está abierta a invitados: se limita por IP.
const limiteReporte = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Alcanzaste el límite de reportes. Intenta de nuevo en unos minutos.' },
});

const limiteDescriptores = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Demasiados análisis seguidos. Intenta de nuevo en unos minutos.' },
});

function esSerieNumerica(arr) {
  return Array.isArray(arr) && arr.every((v) => typeof v === 'number' && Number.isFinite(v));
}

/** Devuelve un mensaje de error, o null si la serie es válida. */
function validarSerie(serie) {
  const { time, magnitude, error } = serie || {};
  if (!esSerieNumerica(time) || !esSerieNumerica(magnitude)) {
    return 'time y magnitude deben ser listas de números.';
  }
  if (error != null && !esSerieNumerica(error)) return 'error debe ser una lista de números.';
  if (time.length !== magnitude.length || (error != null && error.length !== time.length)) {
    return 'time, magnitude y error deben tener el mismo largo.';
  }
  if (time.length < MIN_PUNTOS || time.length > MAX_PUNTOS) {
    return `Se requieren entre ${MIN_PUNTOS} y ${MAX_PUNTOS} observaciones.`;
  }
  return null;
}

function responderErrorServicio(res, err) {
  if (err.message?.startsWith('Servicio de descriptores')) {
    return res.status(422).json({ error: err.message });
  }
  if (err.message === 'fetch failed') {
    return res.status(503).json({ error: 'El servicio de descriptores no está disponible. Verifica que uvicorn esté en ejecución.' });
  }
  throw err;
}

router.post('/descriptores', limiteDescriptores, async (req, res) => {
  const problema = validarSerie(req.body);
  if (problema) return res.status(400).json({ error: problema });

  const { time, magnitude, error = null } = req.body;
  try {
    res.json(await obtenerDescriptores({ time, magnitude, error }));
  } catch (err) {
    responderErrorServicio(res, err);
  }
});

router.post('/reporte', limiteReporte, async (req, res) => {
  const { resultado, banda = null, calibracion = 'desconocida' } = req.body || {};
  if (!resultado?.derivados) {
    return res.status(400).json({ error: 'Falta el resultado de descriptores.' });
  }
  if (!CALIBRACIONES.includes(calibracion)) {
    return res.status(400).json({ error: 'Calibración no válida.' });
  }

  const descriptores = adaptarParaReporte(resultado, {
    calibracion,
    banda: typeof banda === 'string' ? banda.slice(0, 40) : null,
  });
  const { reporte, fuentesUsadas, advertencias } = await generarReporte(descriptores);
  res.json({ texto: reporte, fuentes: fuentesUsadas, advertencias });
});

router.post('/', requerirSesion, async (req, res) => {
  const { nombre, configuracion, serie, resultado, reporte = null } = req.body || {};
  const problemaSerie = validarSerie(serie);

  if (typeof nombre !== 'string' || !nombre.trim() || nombre.length > 200) {
    return res.status(400).json({ error: 'Nombre de análisis no válido.' });
  }
  if (problemaSerie) return res.status(400).json({ error: problemaSerie });
  if (!configuracion || typeof configuracion !== 'object' || !resultado?.derivados) {
    return res.status(400).json({ error: 'Faltan la configuración o el resultado del análisis.' });
  }

  const { id } = await analisisRepo.crear({
    usuarioId: req.usuarioId,
    nombre: nombre.trim(),
    configuracion,
    serie,
    resultado,
    reporte,
  });
  res.status(201).json({ id });
});

router.get('/', requerirSesion, async (req, res) => {
  res.json({ analisis: await analisisRepo.listarPorUsuario(req.usuarioId) });
});

router.get('/:id', requerirSesion, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(404).json({ error: 'Análisis no encontrado.' });

  const analisis = await analisisRepo.obtenerDeUsuario(id, req.usuarioId);
  if (!analisis) return res.status(404).json({ error: 'Análisis no encontrado.' });
  res.json(analisis);
});

module.exports = router;
