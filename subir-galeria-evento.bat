@echo off
cd /d "%~dp0"
title Galeria por evento: SQL + subir a GitHub
echo ======================================================
echo   1/2  SQL en la base de datos + pasar videos al evento
echo ======================================================
echo.
where node
if errorlevel 1 goto sinnode
if exist node_modules goto hayMod
call npm install --omit=dev --no-audit --no-fund
:hayMod
set "PGUSER=postgres"
set "PGPORT=5433"
if not defined PGPASSWORD set /p PGPASSWORD=Clave de postgres: 
node mover-galeria-evento.js 2026 11 gong > mover-galeria.log 2>&1
set RC=%errorlevel%
type mover-galeria.log
set "PGPASSWORD="
if not "%RC%"=="0" goto fallo
echo.
echo ======================================================
echo   2/2  Subir cambios a GitHub
echo ======================================================
call subir.bat "Galeria por evento"
echo.
echo Ahora, en Dokploy: Deployments - Deploy
goto fin
:sinnode
echo [ERROR] No se encuentra Node.js.
goto fin
:fallo
echo.
echo [ERROR] La base de datos no se ha podido actualizar. No se sube nada a GitHub.
:fin
echo.
pause
