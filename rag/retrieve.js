require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY;

// --- Generar el embedding de la consulta (query, no document) ---
async function embedQuery(text) {
  const response = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${VOYAGE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: [text],
      model: 'voyage-4',
      input_type: 'query', // distinto a 'document': Voyage optimiza el vector para búsqueda
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Voyage API error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

/**
 * Busca los chunks más relevantes para una consulta.
 *
 * @param {string} queryText - la pregunta o texto de búsqueda
 * @param {number} topK - cuántos chunks devolver (default 5)
 * @param {string|null} tipoObjeto - filtro opcional por tipo de estrella (ej. 'RR Lyrae')
 * @returns {Array} chunks ordenados por similitud, con su documento de origen
 */
async function retrieveContext(queryText, topK = 5, tipoObjeto = null) {
  const queryEmbedding = await embedQuery(queryText);
  const embeddingStr = `[${queryEmbedding.join(',')}]`;

  let sql = `
    SELECT
      c.id,
      c.contenido,
      c.posicion,
      d.titulo,
      d.autor,
      d.url,
      d.tipo_objeto,
      1 - (c.embedding <=> $1) AS similitud
    FROM chunks c
    JOIN documentos d ON d.id = c.documento_id
  `;
  const params = [embeddingStr];

  if (tipoObjeto) {
    sql += ` WHERE d.tipo_objeto = $2`;
    params.push(tipoObjeto);
  }

  sql += ` ORDER BY c.embedding <=> $1 ASC LIMIT ${topK}`;

  const result = await pool.query(sql, params);
  return result.rows;
}

// --- Modo CLI: permite probar el retrieval directo desde la terminal ---
async function main() {
  const query = process.argv.slice(2).join(' ');

  if (!query) {
    console.log('Uso: node retrieve.js "tu pregunta o consulta aquí"');
    process.exit(1);
  }

  console.log(`Buscando contexto para: "${query}"\n`);

  const results = await retrieveContext(query, 5);

  if (results.length === 0) {
    console.log('No se encontraron chunks. ¿Corriste ingest.js primero?');
  } else {
    results.forEach((r, i) => {
      console.log(`--- Resultado ${i + 1} (similitud: ${r.similitud.toFixed(4)}) ---`);
      console.log(`Fuente: ${r.titulo} (chunk #${r.posicion})`);
      console.log(r.contenido.slice(0, 300) + '...');
      console.log('');
    });
  }

  await pool.end();
}

// Solo corre el CLI si el archivo se ejecuta directamente (no si se importa como módulo)
if (require.main === module) {
  main().catch(err => {
    console.error('Error durante el retrieval:', err);
    process.exit(1);
  });
}

module.exports = { retrieveContext, embedQuery };