require('dotenv').config();

const URL_DESCRIPTORES = process.env.DESCRIPTORES_URL || 'http://127.0.0.1:8000';
// Si el microservicio no responde en este tiempo, se corta la espera con un error claro.
const TIEMPO_MAXIMO_MS = Number(process.env.DESCRIPTORES_TIMEOUT_MS) || 60000;

/**
 * Llama al microservicio Python (FastAPI + feets) y devuelve su respuesta completa.
 * @param {{time: number[], magnitude: number[], error?: number[]}} curva
 */
async function obtenerDescriptores({ time, magnitude, error = null }, { timeoutMs = TIEMPO_MAXIMO_MS } = {}) {
  let resp;
  try {
    resp = await fetch(`${URL_DESCRIPTORES}/descriptores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ time, magnitude, error, limpiar_ruido: true }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      throw new Error(`Servicio de descriptores: no respondió en ${Math.round(timeoutMs / 1000)} s.`);
    }
    throw err; // p. ej. 'fetch failed' cuando el servicio no está levantado
  }

  const texto = await resp.text();
  let cuerpo = null;
  try {
    cuerpo = JSON.parse(texto);
  } catch {
    // respuesta no JSON (por ejemplo, una página de error del servidor)
  }
  if (!resp.ok) {
    const det = cuerpo?.detail;
    const detalle = typeof det === 'string' ? det : det ? JSON.stringify(det) : texto.slice(0, 200) || 'sin detalle';
    throw new Error(`Servicio de descriptores (${resp.status}): ${detalle}`);
  }
  if (!cuerpo) throw new Error('Servicio de descriptores: la respuesta no es JSON válido.');
  return cuerpo;
}

/**
 * Adapter: traduce la respuesta del microservicio al formato que espera
 * generarReporte(). Solo pasa al LLM lo que es interpretable y entrega ya
 * calculados los valores derivados (horas, porcentajes) para que el LLM no calcule.
 *
 * @param {object} respuesta - respuesta de obtenerDescriptores()
 * @param {{calibracion?: 'instrumental'|'estandar'|'desconocida', banda?: string|null}} opciones
 */
// Nombres de las clases del clasificador (en inglés, como el corpus de papers).
const NOMBRES_CLASE = {
  CEP: 'Cepheid',
  DSCT: 'Delta Scuti',
  ECL: 'eclipsing binary',
  LPV: 'long-period variable (Mira or semiregular)',
  RRLYR: 'RR Lyrae',
};

const TEXTO_AVISO = {
  magnitud_fuera_de_rango:
    'La magnitud media está fuera del rango de los datos de entrenamiento del clasificador (OGLE-III, magnitudes calibradas en banda I).',
  periodo_fuera_de_rango: 'El período está fuera del rango de los datos de entrenamiento del clasificador.',
  puntaje_bajo: 'El puntaje de la clase más probable es menor a 0.5.',
};

/** Resultado del clasificador Random Forest en el formato que recibe el LLM. */
function adaptarClasificacion(c) {
  if (!c || !c.clase) return null;
  return {
    clase: NOMBRES_CLASE[c.clase] ?? c.clase,
    puntaje: c.probabilidades?.[c.clase] ?? null,
    segundaClase: NOMBRES_CLASE[c.segunda_clase] ?? c.segunda_clase ?? null,
    puntajeSegunda: c.probabilidades?.[c.segunda_clase] ?? null,
    confianza: c.confianza,
    avisos: (c.avisos || []).map((a) => TEXTO_AVISO[a] ?? a),
    modelo:
      'Random Forest entrenado con curvas de luz de OGLE-III (clases: Cepheid, Delta Scuti, eclipsing binary, ' +
      'long-period variable, RR Lyrae). Los puntajes son del modelo, no probabilidades calibradas.',
  };
}

function adaptarParaReporte(respuesta, { calibracion = 'desconocida', banda = null } = {}) {
  const d = respuesta.derivados;
  const descartados = respuesta.n_puntos_recibidos - respuesta.n_puntos_usados;
  const notas = [];

  if (calibracion === 'instrumental') {
    notas.push('Magnitudes con calibración instrumental: no representan magnitud aparente.');
  } else if (calibracion !== 'estandar') {
    notas.push('El archivo no declara la calibración fotométrica: la magnitud media no debe interpretarse como magnitud aparente.');
  }
  if (d.metodo_periodo === 'multiarmonico' && typeof d.periodo_ls_dias === 'number') {
    notas.push(
      `El pico más alto del periodograma Lomb-Scargle estaba en ${Number(d.periodo_ls_dias.toFixed(5))} d, ` +
      'un submúltiplo del período: el período informado se eligió con un ajuste de Fourier de varios armónicos, ' +
      'que reproduce mejor curvas no sinusoidales (típico de binarias eclipsantes).'
    );
  }
  if (d.n_atipicos_4sigma > 0) {
    notas.push(`Tras la limpieza, ${d.n_atipicos_4sigma} punto(s) atípico(s) a más de 4 sigmas robustas permanece(n) en los datos analizados (no fue descartado).`);
  }

  const f = respuesta.descriptores || {};
  const clasificacionModelo = adaptarClasificacion(respuesta.clasificacion);
  // Solo una clasificación confiable orienta la búsqueda de papers.
  const confiable = clasificacionModelo && clasificacionModelo.confianza !== 'baja';
  const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

  // Caso parejo: confianza media y una segunda clase fuerte. Se decide aquí (no en el LLM)
  // para que el reporte concluya siempre "indeterminada entre ambas", en cualquier entorno.
  const casoParejo =
    clasificacionModelo && clasificacionModelo.confianza === 'media' && clasificacionModelo.puntajeSegunda >= 0.2
      ? { clases: [clasificacionModelo.clase, clasificacionModelo.segundaClase] }
      : null;

  return {
    clasificacionModelo,
    casoParejo,
    tipoProbable: confiable ? clasificacionModelo.clase : null,
    segundoTipo: confiable && clasificacionModelo.puntajeSegunda >= 0.2 ? clasificacionModelo.segundaClase : null,
    periodo: d.periodo_principal_dias,
    periodoHoras: d.periodo_principal_dias === null ? null : Number((d.periodo_principal_dias * 24).toFixed(2)),
    probabilidadFalsaAlarma: d.prob_falsa_alarma,
    amplitud: d.amplitud_fats,
    R21: d.R21,
    R31: d.R31,
    phi21: d.phi21 ?? null,
    phi31: d.phi31 ?? null,
    asimetria: num(f.Skew),
    curtosis: num(f.SmallKurtosis),
    indiceKStetson: num(f.StetsonK),
    magnitudMedia: num(f.Mean),
    desviacionEstandar: num(f.Std),
    banda,
    puntosRecibidos: respuesta.n_puntos_recibidos,
    puntosUsados: respuesta.n_puntos_usados,
    puntosDescartados: descartados,
    porcentajeDescartado: Number((100 * descartados / respuesta.n_puntos_recibidos).toFixed(1)),
    notas,
  };
}

module.exports = { obtenerDescriptores, adaptarParaReporte, NOMBRES_CLASE };
