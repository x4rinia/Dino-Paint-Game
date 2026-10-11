@echo off
title Dino Draw Your Game - Server Beenden
color 0C

echo ======================================================================
echo   [Dino Draw Your Game] - Server wird beendet...
echo ======================================================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "$conns = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue; if ($conns) { foreach ($c in $conns) { Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue }; Write-Host '[ERFOLG] Dino Draw Server auf Port 3000 wurde beendet.' -ForegroundColor Green } else { Write-Host '[INFO] Kein aktiver Server auf Port 3000 gefunden.' -ForegroundColor Yellow }"

echo.
ping -n 3 127.0.0.1 >nul
exit /b 0
