@echo off
cd /d "%~dp0"
title Alta de galeria - Noviembre 2026
echo ======================================================
echo   ALTA DE GALERIA - Noviembre 2026
echo ======================================================
echo.
where node
if errorlevel 1 goto sinnode
if exist node_modules goto hayMod
echo Instalando dependencias...
call npm install --omit=dev --no-audit --no-fund
:hayMod
set "PGUSER=postgres"
set "PGPORT=5433"
if not defined PGPASSWORD set /p PGPASSWORD=Clave de postgres: 
echo.
echo Ejecutando (puede tardar unos segundos)...
node alta-galeria.js 2026 11 galeria-noviembre-2026.json > alta-galeria.log 2>&1
echo Codigo de salida: %errorlevel%
type alta-galeria.log
set "PGPASSWORD="
goto fin
:sinnode
echo [ERROR] No se encuentra Node.js en este PC.
:fin
echo.
echo (Resultado guardado tambien en alta-galeria.log)
pause
