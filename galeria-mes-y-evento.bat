@echo off
cd /d "%~dp0"
title Videos del bano de gong tambien en la galeria del mes
echo ======================================================
echo   1/2  Marcar la galeria del bano de gong (evento + mes)
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
node marcar-galeria-mes.js 2026 11 gong ambas > marcar-galeria.log 2>&1
set RC=%errorlevel%
type marcar-galeria.log
set "PGPASSWORD="
if not "%RC%"=="0" goto fallo
echo.
echo ======================================================
echo   2/2  Subir cambios a GitHub
echo ======================================================
call subir.bat "Galeria del mes desde eventos"
echo.
echo Ahora, en Dokploy: Deployments - Deploy
echo Despues, Ctrl+F5 en la web.
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
