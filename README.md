# 🦷 DentProctor - Gestion des Examens et Surveillants

<div align="center">

**Plateforme complète de gestion des examens, surveillants et planification pour les écoles dentaires**

[Features](#-features-principales) • [Installation](#-installation) • [Architecture](#-architecture) • [Documentation](#-documentation) • [Support](#-support)

</div>

---

## 📋 Vue d'Ensemble

**DentProctor** est une application web complète pour gérer:

- ✅ **Examens (Épreuves)** - Création et planification
- ✅ **Surveillants (Proctors)** - Gestion et affectation
- ✅ **Enseignants** - Configuration et matières enseignées
- ✅ **Résidents** - Gestion des étudiants
- ✅ **Salles** - Gestion des espaces
- ✅ **Planification** - Affectation automatique avec gestion des conflits
- ✅ **Rapports & Historique** - Suivi complet des configurations
- ✅ **Synchronisation Backend** - Sauvegarde sécurisée

---

## ✨ Features Principales

### 🎓 Configuration Complète

- **Enseignants** - Ajouter/modifier les professeurs avec leurs matières
- **Résidents** - Gérer les étudiants par niveau et spécialité
- **Surveillants** - Gérer les surveillants administratifs
- **Salles** - Configurer les capacités des salles d'examen

### 📚 Gestion des Matières (NOUVEAU ✅)

- ➕ Ajouter des matières à chaque professeur
- 🗑️ Supprimer des matières facilement
- 🔄 Synchronisation automatique avec le backend
- 📤 Import/Export via CSV

### 📅 Planification Intelligente

- Créer des épreuves avec date, heure et durée
- Assigner des salles aux examens
- Affecter surveillants et professeurs
- Détection automatique des conflits horaires
- Gestion des indisponibilités

### 📊 Rapports & Historique

- Vue d'ensemble des statistiques
- Historique des modifications de configuration
- Export des données en JSON
- Historique des surveillances

### 🔐 Authentification

- Connexion sécurisée
- Rôles (Admin, Super Admin, Proctor)
- Stockage sécurisé des données

---

## 🚀 Installation Rapide

### Prérequis

- **Node.js** 16+
- **Python** 3.10+
- **SQLite** (ou PostgreSQL)

### Installation Frontend

```bash
# Installer les dépendances
npm install

# Démarrer le serveur de développement
npm run dev

# L'app est accessible à http://localhost:5173
```

### Installation Backend

```bash
# Aller dans le dossier backend
cd backend

# Installer les dépendances Python
pip install -r requirements.txt

# Exécuter les migrations
alembic upgrade head

# Démarrer le serveur
python run_server.py

# L'API est accessible à http://localhost:8000
```

### Migration de la Base de Données

```bash
cd backend
alembic upgrade head
```

---

## 📁 Structure du Projet

```
dentproctor/
├── 📂 backend/                    # API FastAPI
│   ├── app/
│   │   ├── models/               # Modèles SQLAlchemy
│   │   ├── routes/               # Routes API
│   │   ├── schemas/              # Schémas Pydantic
│   │   ├── middleware/           # Auth middleware
│   │   └── services/             # Services métier
│   ├── alembic/                  # Migrations BD
│   └── run_server.py             # Entry point
├── 📂 components/                # Composants React
│   ├── ConfigTab.tsx             # Configuration
│   ├── PlanningTab.tsx           # Planification
│   ├── AdminProfileTab.tsx       # Administration
│   └── ...
├── 📂 hooks/                     # Hooks personnalisés
├── 📂 services/                  # Services (API, scheduler)
├── 📂 types/                     # Définitions TypeScript
├── 📂 utils/                     # Utilitaires
│   ├── apiIntegration.ts         # Intégration API
│   ├── apiAdapter.ts             # Adaptateurs données
│   └── storage.ts                # LocalStorage
├── App.tsx                       # Composant principal
├── index.tsx                     # Entry point
└── vite.config.ts               # Config Vite
```

---

## 🏗️ Architecture

### Frontend

- **Framework**: React 18 + TypeScript
- **Styling**: Tailwind CSS
- **State Management**: React Hooks
- **UI Components**: Lucide Icons
- **Build Tool**: Vite
- **API Client**: Fetch API

### Backend

- **Framework**: FastAPI (Python)
- **ORM**: SQLAlchemy
- **Migrations**: Alembic
- **Validation**: Pydantic
- **Authentication**: JWT Tokens
- **Database**: SQLite / PostgreSQL

### Base de Données

- **Professeurs** - Avec matières (JSON array)
- **Résidents** - Avec niveau et spécialité
- **Surveillants** - Avec spécialité
- **Examens** - Avec date, heure, durée
- **Salles** - Avec capacités
- **Affectations** - Liaison exam-salle-personnel
- **Historique** - Audit trail complet

---

## 📚 Documentation

### Pour Commencer

- 🚀 **[LIRE_CECI_D_ABORD.md](./LIRE_CECI_D_ABORD.md)** - Quick start (5 min)
- 📖 **[RESUME_IMPLEMENTATION.md](./RESUME_IMPLEMENTATION.md)** - Vue d'ensemble

### Pour Utilisateurs

- 👤 **[MATIERES_CONFIG.md](./MATIERES_CONFIG.md)** - Configuration des matières
- 📋 **[GUIDE_AMELIORATIONS.md](./GUIDE_AMELIORATIONS.md)** - Guide utilisateur

### Pour Administrateurs

- 🔧 **[DEPLOYMENT_MATIERES.md](./DEPLOYMENT_MATIERES.md)** - Déploiement
- 📊 **[PROJECT_TRACKER.md](./PROJECT_TRACKER.md)** - Suivi du projet

### Pour Développeurs

- 💻 **[TECHNICAL_MATIERES.md](./TECHNICAL_MATIERES.md)** - Architecture technique
- 📋 **[CHANGELOG_MATIERES.md](./CHANGELOG_MATIERES.md)** - Historique des changements
- 🗂️ **[INDEX_DOCUMENTATION.md](./INDEX_DOCUMENTATION.md)** - Index complet

---

## 🎯 Cas d'Usage

### Administrateur

1. Configurer les enseignants, résidents, salles
2. Assigner les matières aux enseignants
3. Créer les épreuves
4. Afficher les surveillants

### Planificateur

1. Accéder à la vue de planification
2. Créer et modifier les examens
3. Affecter les surveillants
4. Vérifier les conflits
5. Exporter les plannings

### Surveillant

1. Se connecter avec ses identifiants
2. Voir ses affectations
3. Consulter les informations d'examen
4. Marquer sa présence

---

## 🔄 Flux de Travail Typique

```
1. Configuration
   └─ Enseignants + Matières
   └─ Résidents
   └─ Salles

2. Création des Examens
   └─ Date/Heure/Durée
   └─ Assignation salles

3. Planification
   └─ Affectation surveillants
   └─ Vérification conflits

4. Exécution
   └─ Suivi des surveillances
   └─ Historique

5. Rapports
   └─ Export données
   └─ Statistiques
```

---

## 🆕 Nouvelle Fonctionnalité: Configuration des Matières

Vous pouvez maintenant configurer les matières pour chaque professeur!

### Accès

Configuration > Enseignants > Colonne "Matières"

### Fonctionnalités

- ➕ Ajouter des matières
- 🗑️ Supprimer des matières
- 🔄 Synchronisation automatique
- 📤 Import/Export CSV

👉 **[En savoir plus](./MATIERES_CONFIG.md)**

---

## 🛠️ Développement

### Installation dépendances

```bash
npm install
cd backend && pip install -r requirements.txt
```

### Démarrer en développement

```bash
# Terminal 1 - Frontend
npm run dev

# Terminal 2 - Backend
cd backend && python run_server.py
```

### Build production

```bash
npm run build
cd backend && pip install -r requirements.txt
```

### Tests

```bash
# Frontend
npm run test

# Backend
pytest backend/tests/
```

---

## 📦 Stack Technologique

| Couche          | Technologies                             |
| --------------- | ---------------------------------------- |
| **Frontend**    | React 18, TypeScript, Tailwind CSS, Vite |
| **Backend**     | FastAPI, SQLAlchemy, Pydantic            |
| **BD**          | SQLite / PostgreSQL                      |
| **Déploiement** | Docker, Alembic migrations               |
| **Auth**        | JWT Tokens                               |

---

## 🔒 Sécurité

- ✅ Authentification JWT
- ✅ Validation des données (Pydantic)
- ✅ Middleware d'authentification
- ✅ Rôles et permissions
- ✅ CORS configuré
- ✅ Données encryptées (si sensible)

---

## 🐛 Dépannage

### Frontend ne démarre pas

```bash
# Vider cache et réinstaller
rm -rf node_modules package-lock.json
npm install
npm run dev
```

### Backend migration échoue

```bash
# Réinitialiser les migrations
cd backend
alembic downgrade base
alembic upgrade head
```

### API indisponible

```bash
# Vérifier que le backend tourne
curl http://localhost:8000/health

# Vérifier les logs
# Accédez au terminal du backend
```

---

## 📞 Support & Contribution

### Documentation

- 📖 Consultez la [documentation complète](./INDEX_DOCUMENTATION.md)
- 🆘 Voir la [section dépannage](./LIRE_CECI_D_ABORD.md#-problème)

### Signaler un bug

1. Vérifiez la documentation
2. Consultez les [problèmes connus](./PROJECT_TRACKER.md)
3. Créez une issue avec les détails

### Contribuer

1. Fork le projet
2. Créez une branche (`git checkout -b feature/AmazingFeature`)
3. Commit vos changements (`git commit -m 'Add amazing feature'`)
4. Push la branche (`git push origin feature/AmazingFeature`)
5. Ouvrez une Pull Request

---

## 📊 Statistiques du Projet

| Métrique          | Valeur               |
| ----------------- | -------------------- |
| **Frontend**      | React + TypeScript   |
| **Backend**       | FastAPI + SQLAlchemy |
| **Composants**    | 10+                  |
| **Routes API**    | 30+                  |
| **Documentation** | ~100 KB              |
| **Statut**        | ✅ Production Ready  |

---

## 🎓 Apprentissage & Formation

### Pour les Utilisateurs

- Durée: 30 min
- Contenu: Guide utilisateur + démo
- Ressource: [MATIERES_CONFIG.md](./MATIERES_CONFIG.md)

### Pour les Administrateurs

- Durée: 1 heure
- Contenu: Déploiement + configuration
- Ressource: [DEPLOYMENT_MATIERES.md](./DEPLOYMENT_MATIERES.md)

### Pour les Développeurs

- Durée: 2 heures
- Contenu: Architecture + code
- Ressource: [TECHNICAL_MATIERES.md](./TECHNICAL_MATIERES.md)

---

## 📄 Licence

Ce projet est sous licence [MIT](LICENSE) - voir le fichier LICENSE pour les détails.

---

## ✨ Remerciements

Merci à tous les contributeurs et utilisateurs qui ont rendu ce projet possible!

---

<div align="center">

**[⬆ Haut de page](#-dentproctor---gestion-des-examens-et-surveillants)**

Fait avec ❤️ pour les écoles dentaires

**2026** © DentProctor

</div>
