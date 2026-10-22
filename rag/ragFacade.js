require('dotenv').config();
const { retrieveContext } = require('./retrieve.js');

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = 'claude-haiku-4-5-20251001';

// ============================================================
// TODO LO DE ABAJO ES INTERNO. El resto del backend nunca debería
// importar estas funciones directamente — solo usan generarReporte()
// al final del archivo. Esto es la Facade: una interfaz simple y
// estable que esconde retrieval + prompt engineering + llamada al
// LLM + verificación automática.
// ============================================================

function buildRetrievalQuery(descriptores) {
  const partes = [];
  if (descriptores.tipoProbable) partes.push(`estrella variable tipo ${descriptores.tipoProbable}`);
  if (descriptores.subtipo) partes.push(`subtipo ${descriptores.subtipo}`);
  if (descriptores.periodo) partes.push(`periodo de ${descriptores.periodo} días`);
  return partes.join(', ');
}

const fs = require("fs");
fs.writeFileSync(
  "tests/ultimo_fragmentos.json",
  JSON.stringify(
    fragmentos.map((f, i) => ({ n: i + 1, doc: f.documento, texto: f.texto })),
    null, 2
  )
);

function buildPrompt(descriptores, chunksContexto) {
  const contextoTexto = chunksContexto
    .map((c, i) => `[Fuente ${i + 1}: ${c.titulo}]\n${c.contenido}`)
    .join('\n\n---\n\n');

  return `Eres un asistente que redacta reportes técnicos de análisis de curvas de luz de estrellas variables, para astrónomos y analistas.

DESCRIPTORES YA CALCULADOS (no los recalcules, no los cuestiones, son datos verificados):
${JSON.stringify(descriptores, null, 2)}

CONTEXTO DE REFERENCIA (extraído de papers científicos reales, vía RAG):
${contextoTexto}

INSTRUCCIONES:
- Redacta un reporte breve (3-4 párrafos) que describa esta curva de luz usando ÚNICAMENTE los descriptores entregados arriba.
- Usa el contexto de referencia para enriquecer la explicación (por ejemplo, para explicar qué significa el tipo/subtipo detectado, o comparar con patrones conocidos en la literatura).
- NO inventes valores numéricos que no estén en los descriptores.
- NO realices cálculos ni conversiones de unidades. Si un valor derivado no está en los descriptores, no lo incluyas.
- REGLA ESTRICTA: toda afirmación del reporte debe ser (a) un dato tomado directamente de los descriptores, o (b) una idea respaldada explícitamente por el contexto de referencia y citada con su fuente (ej: "según [Fuente 2]..."). No incluyas conclusiones, recomendaciones o afirmaciones generales que no estén ancladas a (a) o (b), aunque te parezcan razonables o típicas del dominio.
- Cuando describas cualitativamente un descriptor (por ejemplo, diciendo que un valor es "típico", "significativo", "consistente con" algo, o "dentro del rango esperado"), esa interpretación debe estar respaldada y citada con el contexto de referencia. Si no tienes contexto que respalde esa interpretación cualitativa, limítate a reportar el valor numérico tal cual, sin calificarlo.
- Si te ves tentado a agregar una recomendación de seguimiento (ej: "se recomienda observación espectroscópica"), inclúyela SOLO si el contexto de referencia la menciona explícitamente y cítala; si no, omítela por completo.
- Si el contexto no tiene información relevante para algún punto, dilo explícitamente en vez de inventar o rellenar con generalidades.
- Cita la fuente cada vez que uses información del contexto (ej: "según [Fuente 1]...").
- Tono: técnico pero claro, como si fuera para un astrónomo revisando resultados de la plataforma.`;
}

async function callClaude(prompt) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Anthropic API error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  return data.content
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('\n');
}

function verificarCatalogosCitados(reporte, chunksContexto) {
  const contextoCompleto = chunksContexto.map(c => c.contenido).join(' ');
  const patron = /\b([A-Z][\w-]*)\s+DR(\d+)\b/g;

  const encontrados = new Set();
  const advertencias = [];

  let match;
  while ((match = patron.exec(reporte)) !== null) {
    const citaCompleta = match[0];
    if (encontrados.has(citaCompleta)) continue;
    encontrados.add(citaCompleta);

    if (!contextoCompleto.includes(citaCompleta)) {
      advertencias.push(citaCompleta);
    }
  }

  return advertencias;
}

// ============================================================
// INTERFAZ PÚBLICA DE LA FACADE
// Esta es la única función que el resto del backend debería llamar.
// ============================================================

/**
 * Genera un reporte narrativo de una curva de luz a partir de sus
 * descriptores ya calculados (período, amplitud, tipo, subtipo, etc.).
 *
 * Internamente: arma una consulta de retrieval -> busca contexto relevante
 * en pgvector -> construye el prompt -> llama al LLM -> verifica
 * automáticamente las citas de catálogos -> devuelve el resultado.
 *
 * @param {Object} descriptores - descriptores calculados por el microservicio
 *   Python (tipoProbable, subtipo, periodo, amplitud, magnitudAparentePromedio, etc.)
 * @returns {Promise<{reporte: string, fuentesUsadas: string[], advertencias: string[]}>}
 */
async function generarReporte(descriptores) {
  const query = buildRetrievalQuery(descriptores);
  const chunksContexto = await retrieveContext(query, 5);
  const prompt = buildPrompt(descriptores, chunksContexto);
  const reporte = await callClaude(prompt);
  const advertencias = verificarCatalogosCitados(reporte, chunksContexto);

  return {
    reporte,
    fuentesUsadas: [...new Set(chunksContexto.map(c => c.titulo))],
    advertencias,
  };
}

module.exports = { generarReporte };