@echo off
title Dino Paint Game - Server
color 0A

echo ======================================================================
echo   [Dino Paint Game] - Server wird gestartet...
echo ======================================================================
echo.

cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
    echo [FEHLER] Node.js wurde nicht im PATH gefunden!
    echo Bitte installiere Node.js v20 oder neuer von https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo [INFO] Aktualisiere Web-App-Dateien (Build)...
call npm.cmd run build
if errorlevel 1 (
    echo [FEHLER] Bauen des Web-Clients fehlgeschlagen!
    pause
    exit /b 1
)

echo [INFO] Starte lokalen Server auf Port 3000...
echo.

set PORT=3000
set NODE_ENV=production
call npx.cmd tsx server/index.ts

if errorlevel 1 (
    echo.
    echo [HINWEIS] Server wurde unerwartet beendet.
    pause
)
