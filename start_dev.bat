@echo off
title DentProctor - Démarrage Complet
cd /d "%~dp0"

echo =====================================================================
echo                 DENTPROCTOR - SYSTEME DE SURVEILLANCE
echo                  Faculte de Medecine Dentaire (UM6SS)
echo =====================================================================
echo.
echo [1/3] Lancement du Backend API (Port 8100)...
start "DentProctor - Backend API (Port 8100)" cmd /k "cd /d "%~dp0backend" && run.bat"

echo [2/3] Ouverture automatique du navigateur dans 3 secondes...
start /b cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:3456"

echo [3/3] Lancement du Frontend Web (Port 3456)...
echo.
echo ---------------------------------------------------------------------
echo   - Interface Web (Frontend) : http://localhost:3456
echo   - Serveur API (Backend)    : http://localhost:8100
echo   - Documentation API        : http://localhost:8100/docs
echo ---------------------------------------------------------------------
echo.
npm run dev
