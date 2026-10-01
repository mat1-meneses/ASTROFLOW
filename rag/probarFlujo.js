const fs = require('fs');
const { obtenerDescriptores, adaptarParaReporte } = require('./descriptoresClient.js');
const { generarReporte } = require('./ragFacade.js');

function leerMacho(ruta, banda = 'r') {
  const [iMag, iErr] = banda === 'r' ? [1, 2] : [3, 4];
  const time = [], magnitude = [], error = [];
  for (const linea of fs.readFileSync(ruta, 'utf-8').split('\n')) {
    const v = linea.trim().split(/\s+/).map(Number);
    if (v.length >= 5 && v.every(Number.isFinite)) {
      time.push(v[0]); magnitude.push(v[iMag]); error.push(v[iErr]);
    }
  }
  return { time, magnitude, error };
}

(async () => {
  const [ruta, banda = 'r'] = process.argv.slice(2);
  const respuesta = await obtenerDescriptores(leerMacho(ruta, banda));
  const descriptores = adaptarParaReporte(respuesta, { banda });
  console.log('Descriptores enviados al reporte:', descriptores);
  const { reporte, fuentesUsadas, advertencias } = await generarReporte(descriptores);
  console.log('\n=== REPORTE ===\n' + reporte);
  console.log('\nFuentes:', fuentesUsadas);
  console.log('Advertencias:', advertencias);
})().catch(err => console.error('Error:', err.message));