const { generarReporte } = require('./ragFacade.js');

// --- Modo CLI de prueba, con descriptores de ejemplo ---
// En el futuro, estos descriptores vendrán del microservicio Python
// (feets, Lomb-Scargle, etc.), no de un objeto hardcodeado como este.
async function main() {
  const descriptoresEjemplo = {
    periodo: 0.56479,
    amplitud: 0.3115,
    R21: 0.438,
    R31: 0.329,
    phi21: 4.126,
    phi31: 2.432,
    asimetria: -0.372,
    curtosis: -0.876,
    indiceKStetson: 0.74,
    puntosUsados: 401,
    puntosDescartados: 0,
    notas: ['El archivo no declara la calibración fotométrica: la magnitud media no debe interpretarse como magnitud aparente.'],
  };

  console.log('Generando reporte para descriptores de ejemplo:');
  console.log(JSON.stringify(descriptoresEjemplo, null, 2));
  console.log('\n' + '='.repeat(60) + '\n');

  const { reporte, fuentesUsadas, advertencias } = await generarReporte(descriptoresEjemplo);

  console.log('REPORTE GENERADO:\n');
  console.log(reporte);
  console.log('\n' + '='.repeat(60));

  if (advertencias.length > 0) {
    console.log('\n⚠️  ADVERTENCIAS DE VERIFICACIÓN AUTOMÁTICA:');
    advertencias.forEach(a => console.log(`   - "${a}"`));
    console.log('   → Revisar manualmente antes de confiar en el reporte.');
  } else {
    console.log('\n✓ Verificación automática: todas las referencias a catálogos citadas coinciden con el contexto.');
  }

  console.log('\nReferencias:');
  fuentesUsadas.forEach((r) => console.log(`  - ${r}`));

}

main().catch(err => {
  console.error('Error generando el reporte:', err);
  process.exit(1);
});