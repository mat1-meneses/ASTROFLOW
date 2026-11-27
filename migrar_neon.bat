@echo off
setlocal
REM Migra la base local (Docker astroflow-db) a Neon.
REM Uso: en una terminal cmd, primero  set "NEON_URL=tu_url_directa"  y luego  migrar_neon.bat

if "%NEON_URL%"=="" (
  echo [ERROR] Falta la variable NEON_URL. Ejecuta primero: set "NEON_URL=tu_url_directa"
  exit /b 1
)

echo.
echo === 1/5 Revisando que el contenedor astroflow-db este corriendo ===
docker exec astroflow-db pg_isready -U astroflow
if errorlevel 1 (
  echo [ERROR] astroflow-db no responde. Abre Docker Desktop y ejecuta: docker compose up -d
  exit /b 1
)

echo.
echo === 2/5 Activando pgvector en Neon ===
docker exec astroflow-db psql "%NEON_URL%" -v ON_ERROR_STOP=1 -c "CREATE EXTENSION IF NOT EXISTS vector;"
if errorlevel 1 goto :error

echo.
echo === 3/5 Exportando la base local ===
docker exec astroflow-db pg_dump -U astroflow -d astroflow -Fc --no-owner --no-privileges -f /tmp/astroflow.dump
if errorlevel 1 goto :error
docker exec astroflow-db ls -lh /tmp/astroflow.dump

echo.
echo === 4/5 Restaurando en Neon (puede demorar varios minutos, no cierres esta ventana) ===
docker exec -e PGOPTIONS="-c maintenance_work_mem=256MB" astroflow-db pg_restore --no-owner --no-privileges -d "%NEON_URL%" /tmp/astroflow.dump
echo Codigo de salida de pg_restore: %ERRORLEVEL%  (avisos sobre la extension vector se pueden ignorar)

echo.
echo === 5/5 Verificando en Neon ===
docker exec astroflow-db psql "%NEON_URL%" -c "SELECT (SELECT count(*) FROM documentos) AS papers, (SELECT count(*) FROM chunks) AS chunks, (SELECT count(*) FROM usuarios) AS usuarios, pg_size_pretty(pg_database_size(current_database())) AS tamano;"

echo.
echo === Migracion terminada. Esperado: 1002 papers y 25848 chunks. ===
exit /b 0

:error
echo.
echo [ERROR] Fallo el paso anterior. Revisa el mensaje de arriba y pegaselo a Claude.
exit /b 1
