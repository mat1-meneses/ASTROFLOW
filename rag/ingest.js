require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { PDFParse } = require('pdf-parse');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY;
const PAPERS_DIR = path.join(__dirname, 'papers');

const BATCH_SIZE = 64;      // chunks por llamada a Voyage (~35k tokens por lote)
const MAX_REINTENTOS = 6;   // ante 429 o errores 5xx de Voyage
const MIN_PALABRAS = 300;   // menos que esto: PDF escaneado o sin texto extraíble

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

// --- Limpiar el texto extraído del PDF ---
function limpiarTexto(text) {
  let t = text
    .replace(/\u0000/g, '')            // Postgres no acepta bytes nulos en columnas de texto
    .replace(/(\w)-\n(\w)/g, '$1$2');  // une palabras cortadas con guion al final de línea

  // Quita la sección de referencias: último encabezado "References"/"Bibliography"
  // ubicado en la segunda mitad del texto (para no cortar un índice al inicio).
  const patron = /\n\s*(References|REFERENCES|Bibliography|BIBLIOGRAPHY)\s*\n/g;
  let ultimo = -1;
  let m;
  while ((m = patron.exec(t)) !== null) ultimo = m.index;
  if (ultimo > t.length * 0.5) t = t.slice(0, ultimo);

  return t;
}

// --- URL de arXiv a partir del nombre del archivo (p. ej. "2101.06216v2") ---
function urlArxiv(nombre) {
  const m = nombre.match(/(\d{4}\.\d{4,5})(v\d+)?/);
  return m ? `https://arxiv.org/abs/${m[1]}${m[2] ?? ''}` : null;
}

// --- Partir el texto en chunks con overlap ---
// tamaño en palabras, no caracteres, para que sea más estable entre idiomas
function chunkText(words, chunkSize = 400, overlap = 50) {
  const chunks = [];
  let start = 0;
  while (start < words.length) {
    const end = Math.min(start + chunkSize, words.length);
    chunks.push(words.slice(start, end).join(' '));
    start += chunkSize - overlap;
  }
  return chunks;
}

// --- Llamar a la API de Voyage, con reintentos ante límites de uso o fallos temporales ---
async function getEmbeddings(textsArray) {
  for (let intento = 0; ; intento++) {
    let status = 0;
    let detalle = '';
    try {
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
      if (response.ok) {
        const data = await response.json();
        return data.data.map((d) => d.embedding);
      }
      status = response.status;
      detalle = await response.text();
    } catch (err) {
      detalle = err.message; // error de red: también se reintenta
    }

    const reintentable = status === 0 || status === 429 || status >= 500;
    if (!reintentable || intento >= MAX_REINTENTOS) {
      throw new Error(`Voyage API error (${status || 'red'}): ${detalle}`);
    }
    const espera = Math.min(60000, 2000 * 2 ** intento); // 2 s, 4 s, 8 s... hasta 60 s
    console.log(`  … Voyage respondió ${status || 'error de red'}, reintentando en ${espera / 1000} s`);
    await esperar(espera);
  }
}

// --- Procesar un PDF completo ---
// Devuelve 'ingestado', 'existente' o 'sin-texto'.
async function ingestPdf(filePath, metadata) {
  const yaExiste = await pool.query(`SELECT id FROM documentos WHERE titulo = $1`, [metadata.titulo]);
  if (yaExiste.rows.length > 0) {
    console.log(`  → ya ingestado antes (id=${yaExiste.rows[0].id}), saltando.\n`);
    return 'existente';
  }

  const buffer = fs.readFileSync(filePath);
  const parser = new PDFParse({ data: buffer });
  let rawText;
  try {
    rawText = (await parser.getText()).text;
  } finally {
    await parser.destroy(); // libera recursos internos del parser
  }

  const words = limpiarTexto(rawText).split(/\s+/).filter(Boolean);
  if (words.length < MIN_PALABRAS) {
    console.log(`  → solo ${words.length} palabras extraídas (¿PDF escaneado?), saltando.\n`);
    return 'sin-texto';
  }

  const chunks = chunkText(words);
  console.log(`  → ${words.length} palabras, ${chunks.length} chunks`);

  // 1. Calcular TODOS los embeddings antes de tocar la base de datos.
  const embeddings = [];
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    embeddings.push(...(await getEmbeddings(chunks.slice(i, i + BATCH_SIZE))));
  }

  // 2. Guardar documento y chunks en una transacción: o queda completo o no queda nada.
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const docResult = await client.query(
      `INSERT INTO documentos (titulo, autor, fuente, url, tipo_objeto)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [metadata.titulo, metadata.autor || null, metadata.fuente || null,
       metadata.url || null, metadata.tipo_objeto || null]
    );
    const documentoId = docResult.rows[0].id;

    for (let i = 0; i < chunks.length; i++) {
      await client.query(
        `INSERT INTO chunks (documento_id, contenido, posicion, embedding)
         VALUES ($1, $2, $3, $4)`,
        [documentoId, chunks[i], i, `[${embeddings[i].join(',')}]`] // formato que pgvector espera
      );
    }
    await client.query('COMMIT');
    console.log(`✓ "${metadata.titulo}" ingestado (id=${documentoId})\n`);
    return 'ingestado';
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// --- Correr sobre todos los PDFs de la carpeta ---
async function main() {
  const files = fs.readdirSync(PAPERS_DIR)
    .filter((f) => f.toLowerCase().endsWith('.pdf'))
    .sort();

  if (files.length === 0) {
    console.log('No hay PDFs en la carpeta ./papers');
    await pool.end();
    return;
  }

  const resumen = { ingestado: 0, existente: 0, 'sin-texto': 0 };
  const fallidos = [];

  for (const [n, file] of files.entries()) {
    console.log(`[${n + 1}/${files.length}] Procesando: ${file}`);
    const titulo = file.replace(/\.pdf$/i, '');
    try {
      const estado = await ingestPdf(path.join(PAPERS_DIR, file), { titulo, url: urlArxiv(titulo) });
      resumen[estado]++;
    } catch (err) {
      console.error(`✗ Error en ${file}: ${err.message}\n`);
      fallidos.push(file);
    }
  }

  await pool.end();
  console.log('Ingesta completa.');
  console.log(`  Nuevos: ${resumen.ingestado} · Ya existían: ${resumen.existente} · Sin texto: ${resumen['sin-texto']} · Fallidos: ${fallidos.length}`);
  if (fallidos.length > 0) {
    console.log('  Vuelve a ejecutar el script para reintentar estos archivos:');
    fallidos.forEach((f) => console.log(`   - ${f}`));
  }
}

main().catch((err) => {
  console.error('Error durante la ingesta:', err);
  process.exit(1);
});