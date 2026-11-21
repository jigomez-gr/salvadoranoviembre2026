@echo off
chcp 65001 >nul
REM Copia los medios NUEVOS (carpeta media-nuevos, fuera de Git) al servidor,
REM al mismo sistema de archivos compartido que usa la landing (media_base).
REM Estructura: media-nuevos\videos\*  ->  /var/data/salvadora/media/videos/

cd /d "%~dp0"

if not exist "media-nuevos" (
    echo [ERROR] No existe la carpeta media-nuevos
    exit /b 1
)

echo Copiando medios al servidor 192.168.1.17 ...
scp -r "media-nuevos\*" root@192.168.1.17:/var/data/salvadora/media/
if errorlevel 1 (
    echo [ERROR] La copia ha fallado.
    exit /b 2
)

echo.
echo Comprobando en la web...
curl.exe -s https://salvadoranov2026.jigretera.com/api/estado
echo.
echo Listo. Todos los medios deben salir en true.
