CONTEXTO
Continúo el prototipo de ASTROFLOW en Figma (plataforma web para análisis, visualización
y reporte automático de curvas de luz de estrellas variables). Ya existe una versión con
pantallas de carga, mapeo de columnas, análisis y reporte IA. Necesito corregir el parser
de archivos y agregar edición/exportación del reporte.

PROBLEMA A CORREGIR — PARSER UNIVERSAL DE CATÁLOGOS
El parser actual no reconoce correctamente archivos de catálogos astronómicos reales.
Debe soportar, como mínimo, estos dos formatos de ejemplo (representativos de la
diversidad de catálogos existentes: OGLE, MACHO, ASAS, ZTF, Kepler/TESS exportados a texto):

FORMATO A (tipo OGLE): sin encabezado, columnas separadas por uno o más espacios,
3 columnas (tiempo, magnitud, error):
5262.50650 19.191 0.065
5264.50830 18.813 0.038

FORMATO B (tipo MACHO): con líneas de metadatos al inicio que comienzan con "#"
(deben ignorarse o mostrarse como metadata, no como datos), columnas separadas por
espacios/tabs, con MÁS de una banda fotométrica en el mismo archivo (columnas separadas
para banda r y banda b, cada una con su propio error), y valores faltantes codificados
como -99.000 (deben tratarse como "sin dato", no como un valor real):
# HJD-2.449e+06    r       err_r        b       err_b     obsid  tran
  -114.8203     -5.257     0.066     -5.209     0.071      1118     0
  -113.8646     -5.057     0.052    -99.000   -99.000      1148     0

REQUISITOS DEL PARSER
1. Detectar automáticamente el delimitador (espacio simple, múltiples espacios, tab,
   o coma) sin asumir uno fijo — probar varios separadores y usar el que produzca un
   número consistente de columnas en la mayoría de las filas.
2. Ignorar automáticamente líneas que comienzan con "#" o "!" y mostrarlas aparte como
   "Metadatos del archivo" (nombre de estrella, coordenadas, cantidad de observaciones,
   etc.) en un panel colapsable, en vez de tratarlas como datos o descartarlas en silencio.
3. Detectar cuántas columnas numéricas tiene el archivo y, si hay más de 3, asumir que
   puede tratarse de un archivo multibanda: mostrar todas las columnas detectadas en el
   paso de "Mapeo de columnas" para que el usuario asigne manualmente cuáles corresponden
   a tiempo, flujo/magnitud, error, y — si aplica — permitir marcar columnas adicionales
   como "banda secundaria" con su propio par magnitud/error.
4. Detectar valores centinela de "dato faltante" (ej. -99.000, -999, NaN, vacío) y
   marcarlos visualmente en la vista previa como "sin dato", excluyéndolos del conteo
   de observaciones válidas, en vez de graficarlos como si fueran mediciones reales.
5. La vista previa de "Mapeo de columnas" debe mostrar SIEMPRE las columnas ya separadas
   en una tabla (una columna de la tabla = una columna del archivo), nunca todo el
   contenido de la fila pegado en una sola celda, sin importar el formato de origen.
6. Si el parser no logra determinar un mapeo con confianza razonable, debe dejar los
   selectores en "— Seleccionar columna —" (como ya ocurre) en vez de forzar una
   asignación incorrecta — este comportamiento de "baja confianza" ya existe y debe
   mantenerse.

NUEVA FUNCIONALIDAD — REPORTE EDITABLE Y EXPORTABLE
En la pantalla de "Análisis IA" (donde se muestra el reporte generado), agregar:
1. Un botón "Editar reporte" que convierta el bloque de texto del reporte en un área
   de texto editable (textarea/rich text), manteniendo el formato de negritas en los
   valores numéricos si es posible. El usuario debe poder corregir o ajustar cualquier
   frase antes de darlo por válido — esto es clave porque el reporte siempre debe
   tratarse como un borrador que un astrónomo revisa, nunca como texto final automático.
2. Un botón "Guardar cambios" que reemplace el texto original por la versión editada,
   y un indicador visual (ej. una etiqueta "Editado manualmente") que distinga un
   reporte editado por el usuario de uno generado tal cual por la IA — esto refuerza
   la trazabilidad de quién validó qué.
3. Un botón "Exportar a PDF" que genere un documento descargable con: nombre de la
   curva, fecha de análisis, la tabla de descriptores calculados, los dos gráficos
   (curva cruda y curva faseada) y el texto del reporte (editado o generado). El PDF
   debe incluir el mismo aviso de "Este texto es orientativo, requiere validación de
   un astrónomo experto" que ya aparece en pantalla.
4. Mantener visible en todo momento el estado "Borrador" del reporte hasta que el
   usuario decida exportarlo, momento en el cual puede considerarse una versión
   "final" para esa sesión (sin necesidad de backend real, esto puede simularse
   con estado en memoria).

CRITERIO DE ÉXITO
Un usuario debe poder cargar tanto un archivo tipo OGLE (3 columnas simples) como uno
tipo MACHO (múltiples columnas con metadatos y bandas), ver en ambos casos una tabla de
mapeo de columnas correctamente separada, completar el análisis, editar el texto del
reporte generado, y exportar el resultado final como PDF — todo sin salir del flujo
existente ni romper las pantallas ya construidas.