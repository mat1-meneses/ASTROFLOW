// Llena rag/referencias.json (autores, año, título) consultando la API de arXiv
// para cada documento de la tabla `documentos` cuyo título sea un id de arXiv.
// Uso (desde la raíz del proyecto):  node rag/completarReferencias.js
const fs = require('fs');
const path = require('path');

const SALIDA = path.join(__dirname, 'referencias.json');
const PENDIENTES = path.join(__dirname, 'referencias_pendientes.txt');
const LOTE = 40;
const ESPERA_MS = 3500; // arXiv pide ≤ 1 consulta cada 3 s
const MAX_AUTORES = 6;

// "2604.19255v1 (1)" -> "2604.19255" | "0402424v2" -> "astro-ph/0402424" | "[2101.06216] ..." -> "2101.06216"
function idDeArxiv(titulo) {
  const t = String(titulo).trim().replace(/\s*\(\d+\)$/, '');
  let m = t.match(/^\[?(\d{4}\.\d{4,5})(?:v\d+)?\]?/);
  if (m) return m[1];
  m = t.match(/^(\d{7})(?:v\d+)?$/);
  if (m) return `astro-ph/${m[1]}`;
  return null;
}

function limpiar(s) {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ').trim();
}

// "Pablo A. Estevez" -> "Estevez, P. A."
function formatoAutor(nombre) {
  const partes = limpiar(nombre).split(' ');
  if (partes.length === 1) return partes[0];
  const apellido = partes[partes.length - 1];
  const iniciales = partes.slice(0, -1).map((p) => (p[0] ? p[0].toUpperCase() + '.' : '')).join(' ');
  return `${apellido}, ${iniciales}`;
}

// Respuesta Atom de arXiv -> { "<id sin versión>": { autores, anio, titulo } }
function parsearAtom(xml) {
  const out = {};
  for (const m of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const e = m[1];
    const idm = e.match(/<id>https?:\/\/arxiv\.org\/abs\/([^<]+?)(?:v\d+)?<\/id>/);
    const tit = e.match(/<title>([\s\S]*?)<\/title>/);
    const pub = e.match(/<published>(\d{4})/);
    if (!idm || !tit || !pub) continue;
    const titulo = limpiar(tit[1]);
    if (/^error$/i.test(titulo)) continue;
    const autores = [...e.matchAll(/<author>\s*<name>([\s\S]*?)<\/name>/g)]
      .map((a) => formatoAutor(a[1]))
      .slice(0, MAX_AUTORES)
      .join('; ');
    out[idm[1]] = { autores, anio: Number(pub[1]), titulo };
  }
  return out;
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  require('dotenv').config();
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const { rows } = await pool.query('SELECT titulo FROM documentos ORDER BY 1');
  await pool.end();

  let existente = {};
  try { existente = JSON.parse(fs.readFileSync(SALIDA, 'utf8')); } catch { /* primera vez */ }

  const porId = new Map(); // id arXiv -> [títulos guardados en la BD]
  const manuales = [];
  for (const { titulo } of rows) {
    if (existente[titulo]) continue;
    const id = idDeArxiv(titulo);
    if (!id) { manuales.push(titulo); continue; }
    if (!porId.has(id)) porId.set(id, []);
    porId.get(id).push(titulo);
  }

  const ids = [...porId.keys()];
  console.log(`${ids.length} ids por consultar en arXiv (${manuales.length} documentos sin id de arXiv).`);

  const resueltos = {};
  for (let i = 0; i < ids.length; i += LOTE) {
    const lote = ids.slice(i, i + LOTE);
    const url = `https://export.arxiv.org/api/query?id_list=${lote.join(',')}&max_results=${lote.length}`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      Object.assign(resueltos, parsearAtom(await res.text()));
      console.log(`lote ${i / LOTE + 1}/${Math.ceil(ids.length / LOTE)} ok`);
    } catch (err) {
      console.log(`lote ${i / LOTE + 1} falló: ${err.message}`);
    }
    await dormir(ESPERA_MS);
  }

  const pendientes = [...manuales];
  for (const [id, titulos] of porId) {
    const ref = resueltos[id];
    if (ref) titulos.forEach((t) => { existente[t] = ref; });
    else pendientes.push(...titulos);
  }

  fs.writeFileSync(SALIDA, JSON.stringify(existente, null, 2), 'utf8');
  fs.writeFileSync(PENDIENTES, pendientes.join('\n'), 'utf8');
  console.log(`Listo: ${Object.keys(existente).length} referencias, ${pendientes.length} pendientes (ver referencias_pendientes.txt)`);
}

if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
module.exports = { idDeArxiv, parsearAtom, formatoAutor };