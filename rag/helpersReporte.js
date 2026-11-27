const MAX_DECIMALES = 5;

// feets/FATS entrega la SEMIAMPLITUD; el rango completo se calcula en código.
function enriquecerDescriptores(d) {
  const out = { ...d };
  for (const [k, v] of Object.entries(d)) {
    if (/^(semi)?amplitud(e)?$/i.test(k) && Number.isFinite(v)) {
      out.rango_pico_a_pico = 2 * v;
      out.nota_amplitud =
        `"${k}" es la semiamplitud (mitad del rango entre mínimo y máximo). ` +
        `El rango completo mínimo-máximo es "rango_pico_a_pico".`;
      break;
    }
  }
  return out;
}

function idsDeCita(textoIds) {
  return textoIds.split(/[,;\s]+/).map(Number).filter((n) => Number.isInteger(n));
}

function analizarCitasDeFuentes(reporte, nFuentes, etiqueta) {
  const patron = new RegExp(`\\[${etiqueta}s?\\s+([\\d,;\\s]+)\\]`, 'g');
  const citadas = new Set();
  const inexistentes = new Set();
  let m;
  while ((m = patron.exec(reporte)) !== null) {
    for (const id of idsDeCita(m[1])) {
      if (id >= 1 && id <= nFuentes) citadas.add(id);
      else inexistentes.add(`[${etiqueta} ${id}]`);
    }
  }
  return { citadas, inexistentes: [...inexistentes] };
}

// refs: { "<titulo guardado en la BD>": { autores: "Apellido, A.; Apellido, B.", anio: 2021, titulo: "..." } }
function datosReferencia(chunk, refs) {
  const r = refs[chunk.titulo] || {};
  const autores = r.autores ? r.autores.split(';').map((a) => a.split(',')[0].trim()) : [];
  const primero = autores[0];
  const corto = primero
    ? `${primero}${autores.length > 2 ? ' et al.' : autores.length === 2 ? ` y ${autores[1]}` : ''}, ${r.anio ?? 's. f.'}`
    : String(chunk.titulo);
  const largo = r.titulo ? `${r.autores ? r.autores + ' ' : ''}(${r.anio ?? 's. f.'}). ${r.titulo}.` : String(chunk.titulo);
  return { clave: largo, corto, largo };
}

// [Fuente 3, 7] -> (Autor, año; Autor2, año) y lista de referencias.
function formatearCitas(reporte, chunks, refs, etiqueta) {
  const patron = new RegExp(`\\[${etiqueta}s?\\s+([\\d,;\\s]+)\\]`, 'g');
  const usadas = new Map();
  const texto = reporte.replace(patron, (_, ids) => {
    const cortos = [];
    for (const id of idsDeCita(ids)) {
      const c = chunks[id - 1];
      if (!c) continue;
      const d = datosReferencia(c, refs);
      usadas.set(d.clave, d);
      if (!cortos.includes(d.corto)) cortos.push(d.corto);
    }
    return cortos.length ? `(${cortos.join('; ')})` : '';
  });
  return { texto, referencias: [...usadas.values()].map((d) => d.largo).sort() };
}

// Números del reporte que no están ni en los descriptores ni en las fuentes.
function hojasNumericas(valor, acc = new Set()) {
  if (typeof valor === 'number' && Number.isFinite(valor)) acc.add(valor);
  else if (typeof valor === 'string')
    for (const m of valor.matchAll(/-?\d+(?:\.\d+)?(?:e-?\d+)?/gi)) acc.add(Number(m[0]));
  else if (Array.isArray(valor)) valor.forEach((v) => hojasNumericas(v, acc));
  else if (valor && typeof valor === 'object') Object.values(valor).forEach((v) => hojasNumericas(v, acc));
  return acc;
}

function verificarNumeros(reporte, descriptores, chunks) {
  const permitidos = hojasNumericas(descriptores);
  for (const c of chunks)
    for (const m of String(c.contenido).matchAll(/\d+(?:\.\d+)?/g)) permitidos.add(Number(m[0]));
  const aceptados = new Set();
  for (const p of permitidos) for (let k = 0; k <= 5; k++) aceptados.add(Number(p.toFixed(k)));

  const limpio = reporte
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\([^)]*\b(19|20)\d{2}\b[^)]*\)/g, ' ')
    .replace(/^#+\s.*$/gm, ' ')
    .replace(/(\d),(\d)/g, '$1.$2'); // coma decimal en español: 0,71 -> 0.71
  const sospechosos = new Set();
  for (const m of limpio.matchAll(/(?<![\w.])\d+(?:\.\d+)?(?:e-?\d+)?/gi)) {
    if (!aceptados.has(Number(m[0]))) sospechosos.add(m[0]);
  }
  return [...sospechosos];
}

module.exports = { MAX_DECIMALES, enriquecerDescriptores, analizarCitasDeFuentes, formatearCitas, verificarNumeros };