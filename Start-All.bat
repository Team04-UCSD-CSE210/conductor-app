@echo off
REM =========================
REM Conductor - Start-All.bat
REM Place this file in the project ROOT (same level as \docker\ and \apps\)
REM It will: start Docker Desktop, bring up Postgres+MinIO, run API & Web demo
REM =========================

setlocal ENABLEDELAYEDEXPANSION

REM Detect project root as the folder this .bat resides in
set "ROOT=%~dp0"
REM Normalize (remove trailing backslash on some shells)
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"

echo [Start] Project root: "%ROOT%"
echo.

REM --- 0) Check admin (Docker on Windows often needs elevated privileges)
net session >nul 2>&1
if not %errorlevel%==0 (
  echo [Warn] It is recommended to run this script as Administrator.
  echo        Right-click this .bat and choose "Run as administrator".
  echo        Continuing anyway...
  echo.
)

REM --- 1) Start Docker Desktop (if not running)
echo [1/5] Starting Docker Desktop (if not already running)...
start "" "%ProgramFiles%\Docker\Docker\Docker Desktop.exe"
REM Give Docker Desktop a moment to start its service
echo       Waiting for Docker engine to become ready...
set "TRIES=0"
:wait_docker
docker info >nul 2>&1
if errorlevel 1 (
  set /a TRIES+=1
  if !TRIES! GEQ 60 (
    echo [Error] Docker engine is not ready after ~60s. Please open Docker Desktop and try again.
    goto :eof
  )
  >nul timeout /t 1 /nobreak
  goto :wait_docker
)
echo       Docker engine is ready.
echo.

REM --- 2) Bring up Postgres + MinIO
echo [2/5] docker compose up -d (Postgres + MinIO)
pushd "%ROOT%\docker"
docker compose -f docker-compose.yml up -d
if errorlevel 1 (
  echo [Error] docker compose failed.
  popd
  goto :eof
)
popd
echo.

REM --- 3) Show running containers
echo [3/5] Current containers:
docker ps
echo.

REM --- 4) Start API (port 4000) in a new window
echo [4/5] Starting API on :4000
start "Conductor API" cmd /k "cd /d \"%ROOT%\apps\api\" && npm run dev"
echo.

REM --- 5) Start Web demo (port 5173) in a new window
echo [5/5] Starting Web demo on :5173
start "Conductor Web" cmd /k "cd /d \"%ROOT%\apps\web\" && npx serve . -l 5173"
echo.

echo [Done] Windows may prompt firewall permissions. Allow access for node.exe.
echo        Open http://127.0.0.1:5173 in your browser.
exit /b 0
