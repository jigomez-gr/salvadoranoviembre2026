@echo off
chcp 65001 >nul
setlocal EnableExtensions

cd /d "%~dp0"

echo ============================================
echo   SUBIR CAMBIOS A GITHUB
echo   salvadoranoviembre2026
echo ============================================
echo.

REM 1. Comprobar que es un repositorio Git
git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Esta carpeta no es un repositorio Git.
    exit /b 1
)
echo [OK] Repositorio Git verificado.
echo [INFO] Los videos e imagenes pesados NO van a Git: usa transferir.bat
echo.

REM 2. Mostrar cambios
echo Cambios detectados:
echo.
git status -s
echo.

REM 3. Mensaje del commit:  subir.bat "mi mensaje"
set "MSG=%~1"
if "%MSG%"=="" set "MSG=Actualizacion automatica"
echo Mensaje: %MSG%
echo.

REM 4. Anadir cambios (el .gitignore deja fuera mp4, jpg, media-nuevos...)
git add -A
if errorlevel 1 (
    echo [ERROR] git add ha fallado.
    exit /b 4
)

REM 5. Si no hay cambios, no se hace commit
git diff --cached --quiet
if not errorlevel 1 (
    echo [INFO] No hay cambios nuevos para guardar.
    goto COMPROBAR_REMOTO
)

echo Creando commit...
git commit -m "%MSG%"
if errorlevel 1 (
    echo [ERROR] No se pudo crear el commit.
    exit /b 6
)

:COMPROBAR_REMOTO
echo.
echo Comprobando GitHub...
git fetch origin
if errorlevel 1 (
    echo [ERROR] No se pudo acceder a GitHub.
    exit /b 7
)

REM Si GitHub tiene commits que no tenemos, se detiene (sin pull automatico)
git merge-base --is-ancestor origin/main main >nul 2>&1
if errorlevel 1 (
    echo.
    echo ============================================
    echo [ERROR] GITHUB TIENE CAMBIOS NUEVOS
    echo ============================================
    echo No se hace pull ni rebase automaticamente.
    exit /b 8
)

echo.
echo Subiendo a GitHub...
git push origin main
if errorlevel 1 (
    echo.
    echo [ERROR] El push ha fallado.
    exit /b 9
)

echo.
git status --short
echo.
echo ============================================
echo   SUBIDA CORRECTA
echo   Ahora en Dokploy: Deployments - Deploy
echo ============================================
echo.
exit /b 0
