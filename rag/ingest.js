require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { PDFParse } = require('pdf-parse');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY;
const PAPERS_DIR = path.join(__dirname, 'papers');

// --- Partir el texto en chunks con overlap ---
// tamaño en palabras, no caracteres, para que sea más estable entre idiomas
function chunkText(text, chunkSize = 400, overlap = 50) {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks = [];
  let start = 0;
  while (start < words.length) {
    const end = Math.min(start + chunkSize, words.length);
    chunks.push(words.slice(start, end).join(' '));
    start += chunkSize - overlap;
  }
  return chunks;
}

// --- Llamar a la API de Voyage para generar embeddings ---
async function getEmbeddings(textsArray) {
  const response = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${VOYAGE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: textsArray,
      model: 'voyage-4',
      input_type: 'document', // le indica a Voyage que esto se va a indexar, no que es una query
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Voyage API error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  return data.data.map(d => d.embedding);
}

// --- Procesar un PDF completo ---
async function ingestPdf(filePath, metadata) {
  const yaExiste = await pool.query(
    `SELECT id FROM documentos WHERE titulo = $1`,
    [metadata.titulo]
  );
  if (yaExiste.rows.length > 0) {
    console.log(`  → ya ingestado antes (id=${yaExiste.rows[0].id}), saltando.\n`)
    return;
  }
  
  const buffer = fs.readFileSync(filePath);
  const parser = new PDFParse({ data: buffer });
  const parsed = await parser.getText();
  const rawText = parsed.text;
  await parser.destroy(); // libera recursos internos del parser

  console.log(`  → ${rawText.length} caracteres extraídos`);

  const chunks = chunkText(rawText);
  console.log(`  → dividido en ${chunks.length} chunks`);

  // 1. Insertar el documento y obtener su id
  const docResult = await pool.query(
    `INSERT INTO documentos (titulo, autor, fuente, url, tipo_objeto)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [metadata.titulo, metadata.autor || null, metadata.fuente || null,
     metadata.url || null, metadata.tipo_objeto || null]
  );
  const documentoId = docResult.rows[0].id;

  // 2. Generar embeddings en lotes (Voyage acepta arrays, evitamos 1 request por chunk)
  const BATCH_SIZE = 10;
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const embeddings = await getEmbeddings(batch);

    for (let j = 0; j < batch.length; j++) {
      const embeddingStr = `[${embeddings[j].join(',')}]`; // formato que pgvector espera
      await pool.query(
        `INSERT INTO chunks (documento_id, contenido, posicion, embedding)
         VALUES ($1, $2, $3, $4)`,
        [documentoId, batch[j], i + j, embeddingStr]
      );
    }
    console.log(`  → chunks ${i + 1}-${Math.min(i + BATCH_SIZE, chunks.length)} guardados`);
  }

  console.log(`✓ Documento "${metadata.titulo}" ingestado (id=${documentoId})\n`);
}

// --- Correr sobre todos los PDFs de la carpeta ---
async function main() {
  const files = fs.readdirSync(PAPERS_DIR).filter(f => f.endsWith('.pdf'));

  if (files.length === 0) {
    console.log('No hay PDFs en la carpeta ./papers');
    return;
  }

  for (const file of files) {
    console.log(`Procesando: ${file}`);
    const filePath = path.join(PAPERS_DIR, file);

    // Por ahora usamos el nombre del archivo como título;
    // más adelante podemos pedir metadata por archivo (autor, tipo_objeto, etc.)
    await ingestPdf(filePath, { titulo: file.replace('.pdf', '') });
  }

  await pool.end();
  console.log('Ingesta completa.');
}

main().catch(err => {
  console.error('Error durante la ingesta:', err);
  process.exit(1);
});