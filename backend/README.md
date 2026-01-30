# DentProctor Backend - API REST pour la surveillance d'examens

## 🚀 Démarrage Rapide

### Prérequis
- Python 3.11+
- pip

### Installation

1. **Cloner le repository**
```bash
cd dentproctor-backend
```

2. **Créer un environnement virtuel**
```bash
python -m venv venv
source venv/bin/activate  # Linux/Mac
# ou
venv\Scripts\activate  # Windows
```

3. **Installer les dépendances**
```bash
pip install -r requirements.txt
```

4. **Configurer les variables d'environnement**
```bash
cp .env.example .env
# Éditer .env si nécessaire
```

5. **Créer l'admin initial**
```bash
python scripts/create_admin.py
```

6. **Lancer le serveur**
```bash
uvicorn app.main:app --reload
```

L'API est maintenant accessible sur:
- **API**: http://localhost:8000
- **Swagger Docs**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

---

## 📚 Documentation API

### Authentification

Tous les endpoints (sauf /auth/login et /auth/register) nécessitent un token Bearer.

**Login:**
```bash
POST /api/auth/login
{
  "username": "admin",
  "password": "admin123"
}
```

**Réponse:**
```json
{
  "access_token": "eyJhbGc...",
  "token_type": "bearer",
  "user": {
    "id": "...",
    "username": "admin",
    "role": "ADMIN",
    "staff_type": null
  }
}
```

### Endpoints

#### Professeurs
- `GET /api/professors` - Lister tous les professeurs
- `POST /api/professors` - Créer un professeur (admin)
- `PUT /api/professors/{id}` - Mettre à jour un professeur (admin)
- `DELETE /api/professors/{id}` - Supprimer un professeur (admin)
- `POST /api/professors/{id}/absences` - Ajouter une absence (admin)

#### Résidents
- `GET /api/residents` - Lister tous les résidents
- `POST /api/residents` - Créer un résident (admin)
- `PUT /api/residents/{id}` - Mettre à jour un résident (admin)
- `DELETE /api/residents/{id}` - Supprimer un résident (admin)

#### Salles
- `GET /api/rooms` - Lister toutes les salles
- `POST /api/rooms` - Créer une salle (admin)
- `PUT /api/rooms/{id}` - Mettre à jour une salle (admin)
- `DELETE /api/rooms/{id}` - Supprimer une salle (admin)

#### Examens
- `GET /api/exams` - Lister tous les examens
- `POST /api/exams` - Créer un examen (admin)
- `PUT /api/exams/{id}` - Mettre à jour un examen (admin)
- `DELETE /api/exams/{id}` - Supprimer un examen (admin)

#### Assignments
- `GET /api/assignments` - Lister tous les assignments
- `POST /api/assignments` - Créer un assignment (admin)
- `DELETE /api/assignments/{id}` - Supprimer un assignment (admin)

---

## 🗄️ Base de Données

Par défaut, l'API utilise SQLite (`dentproctor.db`).

Pour PostgreSQL, modifier `DATABASE_URL` dans `.env`:
```
DATABASE_URL=postgresql://user:password@localhost:5432/dentproctor_db
```

---

## 🧪 Tests

```bash
pytest
```

---

## 📦 Déploiement

### Docker

```bash
docker build -t dentproctor-api .
docker run -p 8000:8000 dentproctor-api
```

### Production avec Gunicorn

```bash
gunicorn -w 4 -b 0.0.0.0:8000 app.main:app
```

---

## 📝 Variables d'Environnement

Voir `.env.example` pour la liste complète.

### Principales:
- `ENVIRONMENT` - `development` ou `production`
- `DATABASE_URL` - URL de la base de données
- `SECRET_KEY` - Clé secrète pour JWT (générer une longue chaîne aléatoire)
- `CORS_ORIGINS` - Domaines autorisés (séparés par des virgules)

---

## 🔒 Sécurité

⚠️ **Avant la production:**
1. Générer une nouvelle `SECRET_KEY` longue et aléatoire
2. Changer le mot de passe admin
3. Configurer les CORS correctement
4. Utiliser HTTPS
5. Configurer les variables d'environnement avec des valeurs sécurisées

---

## 📞 Support

Pour des questions ou problèmes, consultez la documentation ou contactez l'équipe de développement.

---

**Version:** 1.0.0  
**Dernière mise à jour:** Janvier 2026
