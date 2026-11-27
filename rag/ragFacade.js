require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { retrieveContext } = require('./retrieve.js');
const {
  MAX_DECIMALES,
  enriquecerDescriptores,
  analizarCitasDeFuentes,
  formatearCitas,
  verificarNumeros,
} = require('./helpersReporte.js');

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = 'claude-haiku-4-5-20251001';
const FRAGMENTOS_POR_CONSULTA = 3;
const MAX_FRAGMENTOS = 10;

// ============================================================
// TODO LO DE ABAJO ES INTERNO. El resto del backend nunca debería
// importar estas funciones directamente — solo usan generarReporte()
// al final del archivo. Esto es la Facade: una interfaz simple y
// estable que esconde retrieval + prompt engineering + llamada al
// LLM + verificación automática.
// ============================================================

// Metadatos de las referencias (autor, año, título) generados por
// rag/completarReferencias.js. Si el archivo no existe, se usa el título guardado.
function cargarReferencias() {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, 'referencias.json'), 'utf8'));
  } catch {
    return {};
  }
}

// Configuración por idioma de salida. Las reglas del prompt son las mismas
// para ambos idiomas; solo cambian el idioma, la etiqueta de las fuentes
// y los títulos de las secciones.
const IDIOMAS = {
  es: {
    nombre: 'Spanish',
    etiquetaFuente: 'Fuente',
    avisoTruncado: 'Reporte incompleto: la respuesta del modelo alcanzó el límite de longitud. Vuelve a generarlo.',
    confianza: ['alta', 'media', 'baja'],
    indeterminada: 'indeterminada',
    secciones: [
      'Resumen',
      'Clasificación del tipo de estrella',
      'Interpretación de la curva de luz',
      'Calidad de los datos y limitaciones',
    ],
  },
  en: {
    nombre: 'English',
    etiquetaFuente: 'Source',
    avisoTruncado: 'Incomplete report: the model response hit the length limit. Please regenerate it.',
    confianza: ['high', 'medium', 'low'],
    indeterminada: 'indeterminate',
    secciones: [
      'Summary',
      'Star type classification',
      'Light curve interpretation',
      'Data quality and limitations',
    ],
  },
};

// ─── Decimales: se controlan en el código, no se confían al LLM ──────────────

function redondearNumero(v) {
  if (!Number.isFinite(v) || Number.isInteger(v)) return v;
  const r = Number(v.toFixed(MAX_DECIMALES));
  if (r === 0) {
    // Un valor muy pequeño (p. ej. FAP = 1e-8) no debe mostrarse como 0.
    const limite = (10 ** -MAX_DECIMALES).toFixed(MAX_DECIMALES);
    return v > 0 ? `< ${limite}` : `> -${limite}`;
  }
  return r;
}

function redondearDescriptores(valor, clave = '') {
  if (typeof valor === 'number') return redondearNumero(valor);
  if (Array.isArray(valor)) return valor.map((v) => redondearDescriptores(v, clave));
  if (valor && typeof valor === 'object') {
    return Object.fromEntries(
      Object.entries(valor).map(([k, v]) => [k, redondearDescriptores(v, k)])
    );
  }
  return valor;
}

// Red de seguridad: si el LLM escribe más de MAX_DECIMALES decimales, se recortan.
function limitarDecimales(texto) {
  const patron = new RegExp(`\\d+\\.\\d{${MAX_DECIMALES + 1},}`, 'g');
  return texto.replace(patron, (m) => String(Number(Number(m).toFixed(MAX_DECIMALES))));
}

// ─── Retrieval: varias consultas, una por clase candidata ────────────────────
// Se arman en inglés porque el corpus de papers está en inglés.

function buildRetrievalQueries(d) {
  // El orden importa: los fragmentos se intercalan por ronda y se cortan en MAX_FRAGMENTOS,
  // así que las consultas más específicas van primero y la más genérica (el período) al final.
  const periodo = d.periodo ?? null;
  const consultas = [];
  if (d.tipoProbable) {
    consultas.push(`${d.tipoProbable} variable star${d.subtipo ? `, subtype ${d.subtipo}` : ''} light curve, period and amplitude`);
  }
  if (d.segundoTipo) {
    consultas.push(`${d.segundoTipo} variable star light curve, period and amplitude`);
  }
  // Curvas casi sinusoidales: cefeidas de sobretono, RRc y binarias de contacto se parecen;
  // los catálogos de OGLE las separan con el período, la amplitud y los parámetros de Fourier.
  if (typeof d.R21 === 'number' && d.R21 < 0.25) {
    consultas.push('first-overtone classical Cepheids in the Magellanic Clouds: periods, amplitudes and light curve shapes');
  }
  consultas.push(
    'classification of classical Cepheids using Fourier parameters R21 phi21 of the I-band light curve, OGLE',
    'RR Lyrae light curve shape, period range, amplitude and Fourier parameters R21 R31',
    'eclipsing binary and other periodic variable star light curve classification',
  );
  if (periodo) consultas.push(`periodic variable star with a period of ${periodo} days`);
  return consultas;
}

// "0402424v2 (1)" es el mismo paper que "0402424v2" (archivo subido dos veces).
function tituloBase(titulo) {
  return String(titulo).replace(/\s*\(\d+\)$/, '');
}

async function recuperarContexto(descriptores) {
  const consultas = buildRetrievalQueries(descriptores);
  const resultados = await Promise.all(
    consultas.map((q) => retrieveContext(q, FRAGMENTOS_POR_CONSULTA))
  );

  // Se intercalan (el 1.º de cada consulta, luego el 2.º...) para que todas
  // las clases candidatas tengan representación, y se eliminan repetidos.
  const vistos = new Set();
  const chunks = [];
  for (let i = 0; i < FRAGMENTOS_POR_CONSULTA; i++) {
    for (const lista of resultados) {
      const c = lista[i];
      if (!c) continue;
      const clave = `${tituloBase(c.titulo)}|${c.contenido.slice(0, 120)}`;
      if (vistos.has(clave)) continue;
      vistos.add(clave);
      chunks.push(c);
    }
  }
  return chunks.slice(0, MAX_FRAGMENTOS);
}

// ─── Prompt ──────────────────────────────────────────────────────────────────

function buildSystemPrompt(cfg) {
  const [sResumen, sClasificacion, sCurva, sCalidad] = cfg.secciones;
  const cita = `[${cfg.etiquetaFuente} N]`;

  return `You are an astronomy assistant inside ASTROFLOW, a platform that analyzes variable star light curves. You write technical reports for astronomers.

Your task has three parts:
1. Classify the star (RR Lyrae, Cepheid, or another type) by comparing the computed descriptors with the criteria found in the reference sources.
2. Explain the light curve: what its shape, period and amplitude mean physically, according to the sources.
3. Report data quality and limitations.

<rules>
1. Numbers: use only the numbers in <descriptors>, copied exactly as written. Never compute new values, convert units or add decimals. Never add decimals that are not in the descriptors.
2. Literature: every interpretation, comparison or physical explanation must come from <sources> and be cited as ${cita}, where N is the source id. Do not use astronomical knowledge that is not in the sources, even if you are sure it is correct.
3. If the sources lack the information needed for a point, say so explicitly instead of filling the gap with general statements.
4. Magnitude scale: if brightness is given in magnitudes, smaller values mean a brighter star. Keep this in mind when describing maxima, minima, rises, declines and asymmetry.
5. The "banda"/"band" field may be a column name from the file (e.g. "Col2"), not a photometric filter. Call it a filter only if it is a standard filter name (U, B, V, R, I, G, etc.).
6. Do not add follow-up recommendations unless a source mentions them explicitly (and cite it).
7. "semiamplitud" / "semi-amplitude" is HALF of the peak-to-peak range. Never describe it as the total variation between minimum and maximum. The full range is the field "rango_pico_a_pico" when present; use that one when comparing against amplitude ranges in the sources.
8. If sources give different ranges for the same quantity, cite each one separately; never merge or reconcile them into a single range.
9. Each fact appears once in the whole report. Do not restate the star type, the period or the Fourier values in a section if an earlier section already did; refer to them briefly instead.
10. Confidence: "${cfg.confianza[0]}" only if period, R21, R31 and amplitude all fall inside ranges given in the sources; "${cfg.confianza[1]}" if one is borderline or unsupported; "${cfg.confianza[2]}" otherwise.
11. A calibration note affects the mean magnitude only. Do not say it affects the amplitude or the Fourier ratios unless a source says so.
12. A citation must support the exact claim it is attached to. If a source is about a different kind of star or a different topic (e.g. Cepheids when discussing RR Lyrae), do not cite it for that claim; say instead that the sources do not cover it.
13. Never use evaluative words ("excellent", "robust", "reliable", "clean", "critical") unless a source says so. Never write bracketed notes such as [note in descriptors].
14. State the false alarm probability once, in the data quality section only.
15. Compare a descriptor only with ranges or values stated in the sources. Never compare it with mathematical constants (π, 2π, 1.5π…) or with ranges that no source gives.
16. Use a criterion only if the star falls inside the period range (or class) that the source states for it. If the star is outside that range, do not apply the criterion; say that the sources do not cover that range.
17. Before saying a value is near the "lower" or "upper" limit of a range, check both limits of that range as written in the source.
</rules>

<classification_procedure>
Candidate classes: RR Lyrae (RRab / RRc), classical Cepheid (fundamental mode or first overtone), Type II Cepheid, delta Scuti, eclipsing binary (detached or contact), long-period variable, other.
Criteria to use, always taken from the sources: period range, amplitude, light-curve shape (skewness), and the Fourier parameters R21, R31 and the phases phi21, phi31 (in radians, cosine series φk1 = φk − kφ1, the convention used by OGLE). Light curves that are almost sinusoidal (small R21, skewness near 0) can belong to different classes (first-overtone Cepheids, RRc stars, contact binaries); in those cases phi21 and the period–phi21 relations in the sources are the key separators, so look for them explicitly.

If <descriptors> contains "clasificacionModelo", that is the star type computed by the platform's machine-learning classifier. Always report its class, its score ("puntaje") and its confidence ("confianza") exactly as given; they are computed results, like the period. The scores are model scores, not calibrated probabilities: never call them probabilities or percentages of certainty. Then, depending on its confidence:
- "alta" / high: check the criteria in the sources against the descriptors and state whether they agree or disagree with the model's class, citing them. The most likely type of the report is the model's class.
- "media" / medium: evaluate the model's class, its second class and the other candidates with the criteria above. If the descriptors meet the cited criteria of another class clearly better, say so explicitly, for example: "The classifier proposes X (score …, medium confidence), but the period, R21 and phi21 are more consistent with Y [n]". In that case the most likely type of the report is that other class, and the model's class becomes the second most likely. If the evidence does not clearly favor another class, keep the model's class.
- "baja" / low, or it has warnings ("avisos"): state clearly that the automatic classification is unreliable and why, and then classify with the procedure below as if it were absent.
If "clasificacionModelo" is absent or null, use the procedure below.

Procedure: for each candidate class, find in the sources the criteria that define it and compare them with the descriptors. Choose the most likely class and a confidence level (${cfg.confianza.join(' / ')}), name the second most likely class, and state which descriptor separates them.
If the sources do not give enough criteria to decide, the classification is "${cfg.indeterminada}". That is a valid and honest answer; do not force a class.
</classification_procedure>

<output_format>
First, reason inside <analysis> tags: for each candidate class, write the criteria found in the sources (with citation) and whether the descriptors meet them. This part is not shown to the user.

Then write the final report inside <report> tags, in ${cfg.nombre}, using Markdown, with exactly these four sections:

## ${sResumen}
Two sentences: most likely star type, confidence level and the single descriptor that weighs most. No ranges, no lists.

## ${sClasificacion}
One short line per candidate class (max 25 words each): the cited criterion and whether the descriptors meet it. Final line: second most likely class and the descriptor that separates them. No physical explanations here.

## ${sCurva}
Only what the shape descriptors (skewness, kurtosis, R21, R31, phi21, phi31, Stetson K) add beyond the classification. Do not use the star type name as a justification. Every sentence must be cited.

## ${sCalidad}
Only facts from the descriptors and their notes: points used and discarded, false alarm probability, outliers, calibration. No interpretation or favorable/unfavorable judgments unless a source supports them.

Length: 250–400 words. Technical but clear tone. Write headings and text entirely in ${cfg.nombre}; if a descriptor name or note is in another language, translate it.
</output_format>`;
}

function buildUserMessage(descriptores, chunks, cfg) {
  const fuentes = chunks
    .map((c, i) => `<source id="${i + 1}" title="${String(c.titulo).replace(/"/g, "'")}">\n${c.contenido}\n</source>`)
    .join('\n\n');

  return `<descriptors>
${JSON.stringify(descriptores, null, 2)}
</descriptors>

<sources>
${fuentes}
</sources>

Write the report following the rules, the classification procedure and the output format. Cite sources as [${cfg.etiquetaFuente} N].`;
}

// ─── LLM ─────────────────────────────────────────────────────────────────────

async function callClaude(system, userMessage) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 6000, // incluye el razonamiento en <analysis>, que se descarta
      temperature: 0, // la misma curva da siempre el mismo reporte (con 0,2 variaba la clase en casos ambiguos)
      system,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Anthropic API error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const texto = data.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n');
  // Si se agotó max_tokens, el reporte quedó cortado: se avisa en vez de entregarlo como completo.
  return { texto, truncado: data.stop_reason === 'max_tokens' };
}

// Devuelve solo el contenido de <report>; el razonamiento en <analysis> se descarta.
function extraerReporte(respuesta) {
  const m = respuesta.match(/<report>([\s\S]*?)(?:<\/report>|$)/);
  if (m) return m[1].trim();
  return respuesta.replace(/<analysis>[\s\S]*?<\/analysis>/, '').trim();
}

// ─── Verificación automática ─────────────────────────────────────────────────

function verificarCatalogosCitados(reporte, chunksContexto) {
  const contextoCompleto = chunksContexto.map((c) => c.contenido).join(' ');
  const patron = /\b([A-Z][\w-]*)\s+DR(\d+)\b/g;

  const encontrados = new Set();
  const advertencias = [];

  let match;
  while ((match = patron.exec(reporte)) !== null) {
    const citaCompleta = match[0];
    if (encontrados.has(citaCompleta)) continue;
    encontrados.add(citaCompleta);
    if (!contextoCompleto.includes(citaCompleta)) advertencias.push(citaCompleta);
  }

  return advertencias;
}

// ============================================================
// INTERFAZ PÚBLICA DE LA FACADE
// Esta es la única función que el resto del backend debería llamar.
// ============================================================

/**
 * Genera un reporte narrativo de una curva de luz a partir de sus
 * descriptores ya calculados.
 *
 * Internamente: enriquece y redondea los descriptores -> recupera contexto con
 * varias consultas (una por clase candidata) -> construye el prompt -> llama al
 * LLM -> extrae el reporte -> convierte las citas a (Autor, año) -> verifica
 * citas, catálogos y números -> devuelve el resultado.
 *
 * @param {Object} descriptores - descriptores calculados por el microservicio Python
 * @param {Object} [opciones]
 * @param {'es'|'en'} [opciones.idioma='es'] - idioma en que se redacta el reporte
 * @returns {Promise<{reporte: string, fuentesUsadas: string[], advertencias: string[], descriptores: Object}>}
 */
async function generarReporte(descriptores, { idioma = 'es' } = {}) {
  const cfg = IDIOMAS[idioma] ?? IDIOMAS.es;

  const refs = cargarReferencias();
  const descriptoresRedondeados = redondearDescriptores(enriquecerDescriptores(descriptores));
  const chunksContexto = await recuperarContexto(descriptoresRedondeados);
  if (process.env.RAG_DEBUG) {
    // Diagnóstico: qué fragmentos recibe el LLM (activar con  set RAG_DEBUG=1  antes de iniciar el backend).
    console.log('[RAG] Consultas:', buildRetrievalQueries(descriptoresRedondeados));
    chunksContexto.forEach((c, i) =>
      console.log(`[RAG] Fuente ${i + 1}: ${c.titulo} | ${String(c.contenido).replace(/\s+/g, ' ').slice(0, 220)}`)
    );
  }

  const { texto: respuesta, truncado } = await callClaude(
    buildSystemPrompt(cfg),
    buildUserMessage(descriptoresRedondeados, chunksContexto, cfg)
  );
  const reporteBruto = limitarDecimales(extraerReporte(respuesta));

  const { inexistentes } = analizarCitasDeFuentes(
    reporteBruto, chunksContexto.length, cfg.etiquetaFuente
  );
  const { texto: reporte, referencias } = formatearCitas(
    reporteBruto, chunksContexto, refs, cfg.etiquetaFuente
  );
  const advertencias = [
    ...(truncado ? [cfg.avisoTruncado] : []),
    ...verificarCatalogosCitados(reporteBruto, chunksContexto),
    ...inexistentes,
    ...verificarNumeros(reporteBruto, descriptoresRedondeados, chunksContexto)
      .map((n) => `Número sin respaldo: ${n}`),
  ];

  return {
    reporte,
    fuentesUsadas: referencias,
    advertencias,
    descriptores: descriptoresRedondeados, // para que la tabla use el mismo redondeo
  };
}

module.exports = { generarReporte };