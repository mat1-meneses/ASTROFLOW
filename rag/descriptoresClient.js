require('dotenv').config();

const URL_DESCRIPTORES = process.env.DESCRIPTORES_URL || 'http://127.0.0.1:8000';

/**
 * Llama al microservicio Python (FastAPI + feets) y devuelve su respuesta completa.
 * @param {{time: number[], magnitude: number[], error?: number[]}} curva
 */
async function obtenerDescriptores({ time, magnitude, error = null }) {
  const resp = await fetch(`${URL_DESCRIPTORES}/descriptores`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ time, magnitude, error, limpiar_ruido: true }),
  });
  const cuerpo = await resp.json();
  if (!resp.ok) {
    const detalle = typeof cuerpo.detail === 'string' ? cuerpo.detail : JSON.stringify(cuerpo.detail);
    throw new Error(`Servicio de descriptores (${resp.status}): ${detalle}`);
  }
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
function adaptarParaReporte(respuesta, { calibracion = 'desconocida', banda = null } = {}) {
  const d = respuesta.derivados;
  const descartados = respuesta.n_puntos_recibidos - respuesta.n_puntos_usados;
  const notas = [];

  if (calibracion === 'instrumental') {
    notas.push('Magnitudes con calibración instrumental: no representan magnitud aparente.');
  } else if (calibracion !== 'estandar') {
    notas.push('El archivo no declara la calibración fotométrica: la magnitud media no debe interpretarse como magnitud aparente.');
  }
  if (d.n_atipicos_4sigma > 0) {
    notas.push(`Tras la limpieza, ${d.n_atipicos_4sigma} punto(s) atípico(s) a más de 4 sigmas robustas permanece(n) en los datos analizados (no fue descartado).`);
  }

  return {
    periodo: d.periodo_principal_dias,
    periodoHoras: d.periodo_principal_dias === null ? null : Number((d.periodo_principal_dias * 24).toFixed(2)),
    probabilidadFalsaAlarma: d.prob_falsa_alarma,
    amplitud: d.amplitud_fats,
    R21: d.R21,
    R31: d.R31,
    banda,
    puntosRecibidos: respuesta.n_puntos_recibidos,
    puntosUsados: respuesta.n_puntos_usados,
    puntosDescartados: descartados,
    porcentajeDescartado: Number((100 * descartados / respuesta.n_puntos_recibidos).toFixed(1)),
    notas,
  };
}

module.exports = { obtenerDescriptores, adaptarParaReporte };
