@echo off
rem Arranca la minilanding en local: http://localhost:3100
rem Usa los medios REALES de la landing (media_base) + los medios nuevos de esta carpeta (media-nuevos).
cd /d "%~dp0"
set PORT=3100
set MEDIA_STORAGE_ROOT=D:\tmp\antigraviti\salvadora\media_base
set MEDIA_EXTRA_DIR=%~dp0media-nuevos
set LANDING_URL=https://salvadoraconesa.es
rem Descomenta y rellena para probar tambien la base de datos compartida:
rem set DATABASE_URL=postgresql://USUARIO:CLAVE@localhost:5432/BASE
if not exist node_modules ( call npm install --omit=dev --no-audit --no-fund )
start "" http://localhost:3100
node server.js
pause
