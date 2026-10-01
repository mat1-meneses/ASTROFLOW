# Integración del frontend de Figma con el backend de ASTROFLOW

Este paquete conecta las pantallas que exportaste de Figma Make con lo que ya funciona:
el microservicio de descriptores (FastAPI + feets), el módulo RAG y la autenticación.
La estructura de carpetas del paquete es la misma de `AstroFlow\`, así que cada
archivo va en la ruta equivalente.

## Orden de trabajo

### 1. Preparar la carpeta del frontend

1. Renombra `AstroFlow\frontend` (el de ayer) a `AstroFlow\frontend-old`.
2. Copia la carpeta de Figma dentro de `AstroFlow\` con el nombre `frontend`, **sin** `node_modules`.
3. Dentro de `frontend\`, borra: `.figma\`, `node_modules\` (si se copió), `package-lock.json`,
   `.mise.toml`, `AGENTS.md`, `CLAUDE.md` y `src\data\mockData.ts`.
4. Mueve `src\imports\pasted_text\astroflow-figma-spec.md` a `AstroFlow\docs\` y borra `src\imports\`.
5. Instala y agrega React Router:

   ```
   cd frontend
   pnpm install
   pnpm add react-router
   ```

### 2. Copiar los archivos de este paquete

Copia todo `frontend\src\` del paquete sobre `AstroFlow\frontend\src\`, reemplazando lo que exista.
Copia `frontend\public\ejemplos\` y pon ahí el archivo `9.5482.957.publc.txt`.

### 3. Dos cambios a mano en archivos que no me pasaste

**`frontend/vite.config.ts`**: agrega el proxy dentro de `defineConfig`, junto a `plugins`:

```ts
  server: {
    proxy: { "/api": "http://localhost:3000" },
  },
```

**`frontend/src/components/AppHeader.tsx`**: agrega el menú de sesión en el lado derecho.

```tsx
import UserMenu from "./UserMenu";
```

y coloca `<UserMenu />` como último elemento dentro del contenedor del header
(el que tiene el logo). Si ese contenedor no usa `justify-between`, agrégaselo para
que el menú quede a la derecha. Si no calza, pásame el archivo y lo ajusto.

### 4. Backend

Desde la raíz `AstroFlow\`:

```
npm install express-rate-limit helmet
```

Copia `backend\` y `rag\descriptoresClient.js` del paquete (reemplazan a los actuales;
`backend\routes\auth.js` y `backend\middleware\auth.js` **no** vienen en el paquete y se mantienen).
Luego aplica la nueva tabla:

```
node backend\migrar.js
```

### 5. Levantar todo (cuatro terminales)

| Terminal | Carpeta | Comando |
|---|---|---|
| PostgreSQL | `AstroFlow\` | `docker compose up -d` (o como lo levantes) |
| Descriptores | `AstroFlow\descriptores\` | `.venv\Scripts\activate` y `uvicorn main:app --reload --port 8000` |
| Backend | `AstroFlow\` | `node backend\server.js` |
| Frontend | `AstroFlow\frontend\` | `pnpm dev` |

## Pruebas, en orden

1. Abre `http://localhost:5173`. Como invitado, aprieta **Usar curva de ejemplo**.
2. En el mapeo debe aparecer "Formato detectado: MACHO", con `HJD-2.449e+06`, `r` y `err_r` asignadas.
3. Confirma. Deben aparecer las dos curvas (eje de magnitud invertido), los descriptores
   (período ≈ 0,34059 d) y, unos segundos después, el reporte con sus fuentes.
4. Aprieta **Guardar en historial** como invitado: te lleva a iniciar sesión y, al volver,
   el análisis sigue ahí. Guárdalo.
5. Entra a **Mis análisis**: debe aparecer, y al abrirlo se ve igual que antes de guardar.
6. Prueba también **Exportar PDF**.

## Qué cambió respecto al código de Figma

| Archivo | Estado | Cambio |
|---|---|---|
| `types.ts` | Reemplazado | Tipos de la respuesta real del microservicio y del reporte |
| `App.tsx`, `main.tsx` | Reemplazados | Rutas con React Router y sesión |
| `pages/*` | Nuevos | Flujo de análisis, login, registro, panel, análisis guardado |
| `api/analisis.ts` | Nuevo | Llamadas al backend |
| `context/SesionContext.tsx` | Nuevo | Sesión compartida (viene de `frontend-old`) |
| `components/UserMenu.tsx`, `Campo.tsx`, `TextoReporte.tsx` | Nuevos | Menú de sesión, input, render seguro del reporte |
| `utils/serie.ts`, `fase.ts`, `filasDescriptores.ts`, `rutaSegura.ts` | Nuevos | Extracción de la serie, plegado para graficar, filas de la tabla, redirecciones seguras |
| `data/parseFile.ts` | Sin cambios | Lectura del archivo en el navegador (vista previa) |
| `utils/detectColumns.ts` | Modificado | Reconoce el formato MACHO real (`r`, `err_r`) e ignora columnas como `obsid` |
| `ColumnMapping.tsx` | Modificado | Solo la etiqueta "Magnitud / Flujo" |
| `UploadStep.tsx` | Modificado | Límite de 10 MB, texto de instrucciones, ejemplo MACHO real, "Volver al panel" solo con sesión |
| `ProcessingScreen.tsx` | Reescrito | Sin valores inventados; muestra errores reales y permite reintentar |
| `AnalysisView.tsx` | Reescrito | Datos reales, pide el reporte al backend, guardado con sesión |
| `charts/*` | Reescritos | Eje de magnitud invertido, eje de tiempo numérico, dos ciclos de fase |
| `DescriptorsPanel.tsx`, `PrintView.tsx` | Reescritos | Descriptores reales de feets |
| `ReportPanel.tsx` | Reescrito | Reporte del RAG en vez de plantilla fija |
| `Dashboard.tsx` | Modificado | Historial desde la base de datos |
| `data/mockData.ts` | Eliminado | Datos de ejemplo sintéticos |

### Problemas del prototipo que se corrigieron (útil para la tesis)

- **Valores inventados en pantalla.** El procesamiento mostraba "P = 5.3664 días", "FAP < 0.001" y
  "2 puntos atípicos" fijos, sin importar el archivo.
- **Afirmaciones falsas en los descriptores.** "Magnitud aparente media (V), calibrada con AAVSO"
  y "Residuo RMS del ajuste de Fourier N=4" no se calculaban en ninguna parte.
- **Clasificación solo por período.** `classifyByPeriod` llamaba "RR Lyrae" a todo lo menor a 1 día,
  incluidas binarias eclipsantes o delta Scuti.
- **Riesgo de inyección de HTML.** El reporte se mostraba con `dangerouslySetInnerHTML`. Con texto
  generado por un LLM eso permite ejecutar código en el navegador; ahora se renderiza como texto.
- **Gráficos incorrectos para magnitudes.** El eje no estaba invertido (en magnitudes, menor es más
  brillante) y el margen del eje se calculaba multiplicando, lo que recorta puntos con magnitudes
  negativas como las instrumentales de MACHO.

## Pendientes conocidos

- Las ediciones del reporte en un análisis **ya guardado** se ven en pantalla pero no se guardan
  (falta un endpoint `PATCH /api/analisis/:id`).
- El reporte se genera en la misma petición HTTP. Pasarlo a BullMQ queda para después.
- Falta un selector explícito de "magnitud o flujo": hoy se infiere del nombre de la columna.
- En producción, el límite de intentos necesita `app.set('trust proxy', 1)` si hay un proxy delante.
