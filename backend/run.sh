#!/bin/bash
# Script de démarrage du backend DentProctor pour Linux/Mac

echo ""
echo "========================================"
echo "    DentProctor Backend Launcher"
echo "========================================"
echo ""

# Vérifier si venv existe
if [ ! -d "venv" ]; then
    echo "❌ Environnement virtuel non trouvé!"
    echo "Création du venv..."
    python3 -m venv venv
    if [ $? -ne 0 ]; then
        echo "❌ Erreur: Python3 non trouvé ou problème d'installation"
        exit 1
    fi
fi

# Activer venv
source venv/bin/activate

# Vérifier si requirements sont installés
pip show fastapi > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "📦 Installation des dépendances..."
    pip install -r requirements.txt
    if [ $? -ne 0 ]; then
        echo "❌ Erreur lors de l'installation des dépendances"
        exit 1
    fi
fi

# Vérifier si admin existe
python -c "from app.database import SessionLocal; from app.models.user import User; db = SessionLocal(); admin = db.query(User).filter(User.role == 'ADMIN').first(); exit(0 if admin else 1)" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "👤 Création de l'administrateur initial..."
    python scripts/create_admin.py
fi

echo ""
echo "✅ Tous les fichiers sont prêts!"
echo ""
echo "🚀 Démarrage du serveur..."
echo ""
echo "API disponible sur: http://localhost:8000"
echo "Documentation: http://localhost:8000/docs"
echo ""
echo "Appuie sur Ctrl+C pour arrêter"
echo ""

# Lancer le serveur
uvicorn app.main:app --reload
