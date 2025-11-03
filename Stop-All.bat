@echo off
REM =======================
REM Conductor - Stop-All.bat
REM Place this file in the project ROOT (same level as \docker\ and \apps\)
REM It will: stop Web server, API dev server, and docker compose stack
REM =======================

setlocal ENABLEDELAYEDEXPANSION

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"

echo [Stop] Project root: "%ROOT%"
echo.

REM --- 1) Kill typical dev ports (5173 web, 4000 api, 5555 prisma studio)
for %%P in (5173 4000 5555) do (
  echo [1] Checking port %%P ...
  for /f "tokens=5" %%i in ('netstat -ano ^| findstr /r /c:":%%P[ ]"') do (
    echo     -> Killing PID %%i (port %%P)
    taskkill /PID %%i /F >nul 2>&1
  )
)

REM --- 2) docker compose down (keep volumes by default)
echo.
echo [2] docker compose down (keeping volumes)
pushd "%ROOT%\docker"
docker compose -f docker-compose.yml down
if errorlevel 1 (
  echo [Warn] docker compose down returned non-zero (maybe not running). Continuing...
)
popd

REM Optional: uncomment to remove volumes (DANGEROUS - wipes DB/files)
REM pushd "%ROOT%\docker"
REM docker compose -f docker-compose.yml down -v
REM popd

echo.
echo [Done] All dev services attempted to stop.
echo       If any terminals remain (titled "Conductor API/Web"), close them manually.
exit /b 0
