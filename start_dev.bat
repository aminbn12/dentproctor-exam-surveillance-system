@echo off
echo ==================================================
echo     DentProctor - Démarrage Complet
echo ==================================================

echo 1. Lancement du Backend (dans une nouvelle fenêtre)...
start "DentProctor Backend" cmd /k "cd backend && run.bat"

echo.
echo 2. Lancement du Frontend (ici)...
echo.
npm run dev
