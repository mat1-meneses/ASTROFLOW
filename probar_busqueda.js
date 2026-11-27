// Muestra qué papers devuelve la búsqueda para cada consulta (base local). Solo lectura.
// Uso:  node probar_busqueda.js
require('dotenv').config({ quiet: true });
const { retrieveContext } = require('./rag/retrieve');

const NUEVOS = ['1601.01318', '1601.02020', '1706.09452', '1712.01307', '1810.09489'];
const CONSULTAS = [
  // las que usa hoy el reporte para la CEP-0019 (clase del modelo ECL, segunda Cepheid, R21 < 0,25)
  'eclipsing binary variable star light curve, period and amplitude',
  'Cepheid variable star light curve, period and amplitude',
  'periodic variable star with a period of 1.92907 days',
  'Cepheid light curve shape, period range, amplitude and Fourier decomposition (fundamental mode and first overtone)',
  'nearly sinusoidal light curves: first-overtone Cepheids, RRc stars and contact binaries, Fourier phase phi21 versus period',
  // candidatas más específicas
  'classification of classical Cepheids using Fourier parameters R21 phi21 of the I-band light curve, OGLE',
  'first-overtone classical Cepheids in the Magellanic Clouds: periods, amplitudes and light curve shapes',
];

(async () => {
  for (const q of CONSULTAS) {
    const r = await retrieveContext(q, 8);
    console.log(`\n> ${q}`);
    r.forEach((c, i) => {
      const nuevo = NUEVOS.some((n) => String(c.titulo).startsWith(n)) ? '  <-- OGLE nuevo' : '';
      console.log(`  ${i + 1}. ${Number(c.similitud).toFixed(3)}  ${c.titulo}${nuevo}`);
    });
  }
  process.exit(0);
})().catch((e) => { console.error(e.message); process.exit(1); });
