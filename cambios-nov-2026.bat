@echo off
cd /d "%~dp0"
title Cambios noviembre 2026: video entrevista, quitar flamenco y promo
echo ======================================================
echo   1/3  Copiar el video de la entrevista al servidor
echo ======================================================
call transferir.bat
if errorlevel 1 goto fallo1
echo.
echo ======================================================
echo   2/3  Actualizar la base de datos
echo ======================================================
where node
if errorlevel 1 goto sinnode
if exist node_modules goto hayMod
call npm install --omit=dev --no-audit --no-fund
:hayMod
set "PGUSER=postgres"
set "PGPORT=5433"
if not defined PGPASSWORD set /p PGPASSWORD=Clave de postgres: 
node cambios-nov-2026.js > cambios-nov-2026.log 2>&1
set RC=%errorlevel%
type cambios-nov-2026.log
set "PGPASSWORD="
if not "%RC%"=="0" goto fallo2
echo.
echo ======================================================
echo   3/3  Subir cambios a GitHub
echo ======================================================
call subir.bat "Telegram, pie de pagina, entrevista en galerias, sin flamenco ni promo"
echo.
echo Ahora, en Dokploy: Deployments - Deploy
echo Despues, Ctrl+F5 en la web.
goto fin
:sinnode
echo [ERROR] No se encuentra Node.js.
goto fin
:fallo1
echo.
echo [ERROR] No se ha podido copiar el video al servidor (scp). No se cambia nada mas.
goto fin
:fallo2
echo.
echo [ERROR] La base de datos no se ha podido actualizar. No se sube nada a GitHub.
:fin
echo.
pause
