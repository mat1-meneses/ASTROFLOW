const { generarReporte } = require('./ragFacade.js');

// --- Modo CLI de prueba, con descriptores de ejemplo ---
// En el futuro, estos descriptores vendrán del microservicio Python
// (feets, Lomb-Scargle, etc.), no de un objeto hardcodeado como este.
async function main() {
  const descriptoresEjemplo = {
    tipoProbable: 'RR Lyrae',
    subtipo: 'RRab',
    periodo: 0.523,
    amplitud: 0.87,
    magnitudAparentePromedio: 15.2,
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

  console.log('\nFuentes usadas:', fuentesUsadas.join(', '));
}

main().catch(err => {
  console.error('Error generando el reporte:', err);
  process.exit(1);
});