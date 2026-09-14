@echo off
title Endcord 1-Click Update & Release
cd /d "%~dp0"
"node-v22\node.exe" scripts/uploadRelease.mjs
echo.
echo ========================================================
echo [OK] Endcord Guncelleme ve Release basariyla tamamlandi!
echo ========================================================
echo.
pause
