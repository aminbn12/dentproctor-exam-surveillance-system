@echo off
REM Script de démarrage du backend DentProctor pour Windows

echo.
echo ========================================
echo     DentProctor Backend Launcher
echo ========================================
echo.

REM Vérifier si venv existe
if not exist "venv\" (
    echo ❌ Environnement virtuel non trouvé!
    echo Création du venv...
    python -m venv venv
    if errorlevel 1 (
        echo ❌ Erreur: Python non trouvé ou problème d'installation
        echo Assurez-vous que Python 3.11+ est installé
        pause
        exit /b 1
    )
)

REM Activer venv
call venv\Scripts\activate.bat

REM Vérifier si requirements sont installés
pip show fastapi > nul 2>&1
if errorlevel 1 (
    echo 📦 Installation des dépendances...
    pip install -r requirements.txt
    if errorlevel 1 (
        echo ❌ Erreur lors de l'installation des dépendances
        pause
        exit /b 1
    )
)

REM Vérifier si admin existe
python -c "from app.database import SessionLocal; from app.models.user import User; db = SessionLocal(); admin = db.query(User).filter(User.role == 'ADMIN').first(); exit(0 if admin else 1)" 2>nul
if errorlevel 1 (
    echo 👤 Création de l'administrateur initial...
    python scripts/create_admin.py
)

echo.
echo ✅ Tous les fichiers sont prêts!
echo.
echo 🚀 Démarrage du serveur...
echo.
echo API disponible sur: http://localhost:8100
echo Documentation: http://localhost:8100/docs
echo.
echo Appuie sur Ctrl+C pour arrêter
echo.

REM Lancer le serveur
uvicorn app.main:app --reload --host 0.0.0.0 --port 8100

pause
