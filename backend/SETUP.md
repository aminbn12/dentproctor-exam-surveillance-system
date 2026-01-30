# 🚀 GUIDE DE DÉMARRAGE COMPLET - DENTPROCTOR BACKEND

## 📋 Structure créée

```
dentproctor-backend/
├── app/
│   ├── __init__.py
│   ├── main.py                 # 🎯 Point d'entrée FastAPI
│   ├── config.py               # ⚙️ Configuration
│   ├── database.py             # 🗄️ SQLAlchemy
│   ├── models/                 # 📊 Modèles SQLAlchemy
│   ├── schemas/                # ✅ Validation Pydantic
│   ├── routes/                 # 🛣️ Routes API
│   ├── utils/security.py       # 🔒 JWT & Crypto
│   └── middleware/auth.py      # 🛡️ Authentification
├── scripts/
│   └── create_admin.py         # 👤 Créer l'admin initial
├── requirements.txt            # 📦 Dépendances
├── .env.example                # ⚙️ Exemple config
└── README.md                   # 📖 Documentation
```

## 🏁 Démarrage Étape par Étape

### Étape 1: Préparation de l'environnement

```bash
# Aller dans le dossier backend
cd c:\Users\Amin\Downloads\dentproctor-backend

# Créer l'environnement virtuel
python -m venv venv

# Activer l'environnement (Windows)
venv\Scripts\activate

# Ou sur Linux/Mac:
# source venv/bin/activate
```

### Étape 2: Installation des dépendances

```bash
# Installer les packages Python
pip install -r requirements.txt

# Cela installera:
# - FastAPI (framework)
# - SQLAlchemy (ORM)
# - Pydantic (validation)
# - python-jose (JWT)
# - passlib (encryption)
# - Et autres...
```

### Étape 3: Configuration

```bash
# Créer le fichier .env
copy .env.example .env

# Pour démarrage rapide, le .env.example utilise SQLite (pas besoin de PostgreSQL)
```

### Étape 4: Création de l'admin

```bash
# Créer le premier utilisateur admin
python scripts/create_admin.py

# Réponse:
# ✅ Administrateur créé avec succès!
#    Username: admin
#    Password: admin123
```

### Étape 5: Lancer le serveur

```bash
# Démarrer FastAPI avec hot-reload
uvicorn app.main:app --reload

# Réponse:
# INFO:     Uvicorn running on http://127.0.0.1:8000
# INFO:     Application startup complete
```

## 🌐 Accès à l'API

Ouvre ton navigateur:

### 1. **API Swagger Docs** (interactive)
```
http://localhost:8000/docs
```
➜ Permet de tester directement les endpoints!

### 2. **ReDoc** (documentation)
```
http://localhost:8000/redoc
```
➜ Documentation compréhensible et organisée

### 3. **Health Check**
```
http://localhost:8000/health
```
➜ Réponse: `{"status":"✅ API healthy"}`

## 🔑 Premier Test d'Authentification

1. Va sur http://localhost:8000/docs
2. Clique sur "POST /api/auth/login"
3. Clique sur "Try it out"
4. Remplis:
   ```json
   {
     "username": "admin",
     "password": "admin123"
   }
   ```
5. Clique "Execute"
6. Tu reçois un token!

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "user": {
    "id": "...",
    "username": "admin",
    "email": "admin@dentproctor.com",
    "role": "ADMIN",
    "staff_type": null
  }
}
```

## 📝 Exemples de Requêtes

### Créer un Professeur

```bash
curl -X POST http://localhost:8000/api/professors \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Dr. Ahmed",
    "rank": "Pr",
    "responsible_promo": "FM6MD4"
  }'
```

### Récupérer les Professeurs

```bash
curl http://localhost:8000/api/professors
```

### Créer un Résident

```bash
curl -X POST http://localhost:8000/api/residents \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Mohamed",
    "level": 4,
    "specialty": "Chirurgie"
  }'
```

## 🔗 Connecter le Frontend

Le frontend React utilise `apiClient.ts` pour communiquer avec le backend.

### Configuration:

1. Crée un `.env` dans le dossier frontend:
```env
REACT_APP_API_URL=http://localhost:8000/api
```

2. Le service API client est prêt dans:
```
services/apiClient.ts
```

3. Utilisation dans un composant:
```typescript
import { apiClient } from './services/apiClient';

// Login
const response = await apiClient.login('admin', 'admin123');
apiClient.setToken(response.access_token);

// Récupérer les profs
const profs = await apiClient.getProfessors();

// Créer un prof
await apiClient.createProfessor({
  name: "Dr. Smith",
  rank: "Pr",
  responsible_promo: "FM6MD1"
});
```

## 🗄️ Base de Données

### SQLite (Par défaut, idéal pour démo/développement)

```env
DATABASE_URL=sqlite:///./dentproctor.db
```

✅ Avantages: Zéro configuration, fichier simple
❌ Limites: Une seule connexion, pas bon pour production

### PostgreSQL (Pour production)

```env
DATABASE_URL=postgresql://user:password@localhost:5432/dentproctor_db
```

**Installation PostgreSQL:**

Sur Windows:
1. Télécharger depuis https://www.postgresql.org/download/windows/
2. Installer avec le setup
3. Créer une base: `createdb dentproctor_db`

## 📊 Modèles de Données

| Table | Description |
|-------|-------------|
| `users` | Utilisateurs (login) |
| `professors` | Professeurs (Pr/Dr) |
| `residents` | Résidents (Y1-Y4) |
| `rooms` | Salles d'examen |
| `exams` | Examens programmés |
| `assignments` | Affectations prof+resident |
| `absences` | Absence d'un prof/resident |

## 🧪 Tests

```bash
# Lancer les tests unitaires
pytest

# Avec couverture
pytest --cov=app

# Mode verbose
pytest -v
```

## 🐳 Docker (Optionnel)

```bash
# Construire l'image
docker build -t dentproctor-api .

# Lancer le conteneur
docker run -p 8000:8000 dentproctor-api
```

## 🚨 Troubleshooting

### "Module not found: app"
→ Assure-toi que tu es dans le dossier `dentproctor-backend`

### "Address already in use :8000"
→ Le port 8000 est occupé. Change avec:
```bash
uvicorn app.main:app --port 8001
```

### "Database locked" (SQLite)
→ Supprime `dentproctor.db` et relance:
```bash
rm dentproctor.db
python scripts/create_admin.py
```

### CORS errors (Frontend ne peut pas appeler API)
→ Vérifie CORS_ORIGINS dans `.env`:
```env
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
```

## ✅ Checklist Démarrage

- [ ] Dossier `dentproctor-backend` créé
- [ ] `venv` activé
- [ ] `requirements.txt` installé
- [ ] `.env` configuré
- [ ] Admin créé avec `create_admin.py`
- [ ] Serveur démarré `uvicorn app.main:app --reload`
- [ ] Accès à http://localhost:8000/docs
- [ ] Login réussi avec admin/admin123
- [ ] Frontend configuré avec REACT_APP_API_URL

## 🎉 C'est Prêt!

Ton backend API DentProctor fonctionne! 🚀

### Prochaines étapes:

1. **Configurer le frontend** pour utiliser le backend
2. **Créer des données de test** (profs, residents, exams)
3. **Tester l'intégration complète** frontend + backend
4. **Configurer PostgreSQL** pour la production
5. **Déployer** sur le serveur universitaire

---

**Questions?** Consulte `README.md` ou la documentation Swagger `/docs`
