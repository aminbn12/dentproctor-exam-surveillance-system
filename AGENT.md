# 🤖 DentProctor - Guide pour Agents IA & Développeurs (AGENT.md)

> Ce fichier est la référence centrale pour tout agent d'intelligence artificielle ou développeur intervenant sur le projet **DentProctor**.
> Il décrit l'architecture, la structure des fichiers, les règles métier critiques, le pipeline Excel/VBA et les bonnes pratiques pour modifier le projet sans régression.

---

## 1. Vue d'Ensemble du Projet

**DentProctor** est un système complet de gestion et de surveillance des examens conçu pour la **Faculté de Médecine Dentaire (UM6SS)**.

### Objectifs Principaux
1. **Planification Intelligente :** Affectation automatique et assistée des surveillants (Enseignants, Résidents, Administration/IT/Zones) aux salles d'examen.
2. **Équité & Lissage de Charge :** Répartition équitable des vacations sur la session et lissage journalier pour éviter la surcharge d'une même personne sur un seul jour.
3. **Encadrement Pédagogique :**
   - Présence obligatoire des responsables de promotion lors des examens de leur promotion.
   - Hiérarchie d'expérience pour les résidents (présence d'un senior R3/R4 par salle pour encadrer les R1/R2).
   - Mixité des spécialités dans chaque salle.
4. **Gestion des Quotas de Salle :** Respect strict des capacités Enseignants ($P$), Résidents ($R$), et Administration ($A$) découpée en **ADM**, **IT**, et **Resp. Zones**.
5. **Exports & Macros VBA :** Exportation du planning vers Excel avec génération automatique d'un classeur macro `.xlsm` pré-rempli et stylisé avec actualisation en un clic.

---

## 2. Pile Technologique (Tech Stack)

| Domaine | Technologies |
|---|---|
| **Frontend** | React 18, TypeScript, Tailwind CSS, Lucide React, Vite 6 |
| **Backend** | Python 3.11+, FastAPI, SQLAlchemy 1.4/2.0, Pydantic v2, Alembic, Openpyxl |
| **Base de Données** | SQLite (`backend/dentproctor.db`) en local / PostgreSQL en production |
| **Conteneurisation** | Docker multi-étapes (`node:20-alpine` pour le build + `python:3.11-slim` pour l'exécution) |
| **Bureautique** | Microsoft Excel VBA (`.xlsm`), Openpyxl pour le parsing et styling |

---

## 3. Arborescence du Projet

```text
dentproctor/
├── App.tsx                    # Composant racine, navigation principale et gestion de session
├── constants.tsx              # Constantes globales (icônes, promos, couleurs, seed initial)
├── types.ts                   # Types TypeScript fondamentaux (Professor, Resident, Room, Exam, Assignment...)
├── index.html / index.tsx     # Points d'entrée de l'application web
├── vite.config.ts             # Configuration du bundler Vite (proxy /api vers backend:8000)
├── start_dev.bat              # Script de démarrage rapide local (Frontend + Backend)
├── Dockerfile                 # Image Docker multi-stage pour déploiement Cloud
├── railway.toml               # Configuration pour Railway (ou Render / Koyeb)
├── AGENT.md                   # Ce guide de référence
├── README.md                  # Documentation générale du projet
│
├── components/                # Composants d'interface React
│   ├── PlanningTab.tsx        # Vue principale : Grille du planning, tri dynamique, exports
│   ├── ConfigTab.tsx          # Gestion des Enseignants, Résidents, Surveillants, Salles, Examens
│   ├── StatsTab.tsx           # Statistiques et graphiques de charge des surveillants
│   ├── HistoryTab.tsx         # Historique des plannings archivés et journaux d'audit
│   ├── AdminProfileTab.tsx    # Gestion des comptes utilisateurs et permissions
│   ├── ProctorView.tsx        # Vue dédiée au surveillant connecté (son propre planning)
│   └── LoginScreen.tsx        # Authentification et écran de connexion
│
├── services/                  # Logique métier Frontend
│   ├── schedulerService.ts    # Moteur algorithmique d'affectation, d'équité et de validation
│   └── apiClient.ts           # Client API HTTP avec fallback vers localStorage
│
├── utils/                     # Utilitaires & Adaptateurs
│   ├── apiIntegration.ts      # Synchronisation Frontend <-> Backend
│   ├── apiAdapter.ts          # Mappage entre modèles frontend et schémas backend
│   ├── excelExamService.ts    # Parsing d'import d'examens depuis Excel/CSV
│   └── storage.ts             # Persistance locale (localStorage)
│
├── public/                    # Fichiers statiques servis directement
│   └── Modele_Planning_Surveillance.xlsm  # Modèle officiel avec macro VBA intégrée
│
├── backend/                   # Application serveur FastAPI
│   ├── alembic/               # Migrations de schéma de base de données
│   ├── requirements.txt       # Dépendances Python (fastapi, uvicorn, openpyxl, etc.)
│   ├── dentproctor.db         # Fichier SQLite local
│   ├── run.bat / run_server.py# Scripts de démarrage du serveur Python
│   └── app/
│       ├── main.py            # Point d'entrée FastAPI (CORS, montage staticfiles en prod)
│       ├── config.py          # Variables d'environnement et paramètres Pydantic
│       ├── database.py        # Session SQLAlchemy et connexion DB
│       ├── models/            # Modèles ORM (Professor, Resident, Proctor, Room, Exam, Assignment)
│       ├── schemas/           # Schémas Pydantic pour validation des requêtes et réponses
│       ├── routes/            # Endpoints d'API REST
│       │   ├── exams.py       # CRUD examens + endpoint POST /export-macro-xlsm
│       │   ├── professors.py  # CRUD enseignants et gestion des matières
│       │   ├── residents.py   # CRUD résidents
│       │   ├── proctors.py    # CRUD surveillants administratifs
│       │   ├── rooms.py       # CRUD salles et gestion des capacités
│       │   ├── assignments.py # Affectations examens <-> surveillants
│       │   ├── auth.py        # Connexion JWT et hachage de mots de passe
│       │   └── history.py     # Archivage des plannings
│       └── services/          # Services serveur (ex: config_change_logger.py)
│
├── docs/                      # Documentation technique détaillée
│   ├── INDEX_DOCUMENTATION.md # Index complet de la documentation
│   ├── MATIERES_CONFIG.md     # Documentation de la gestion des matières
│   └── ...                    # Guides spécifiques et historique
└── scripts/                   # Scripts d'automatisation et de maintenance
```

---

## 4. Règles Métier Critiques (Business Logic)

Tout agent ou développeur modifiant le code de planification doit **impérativement respecter** ces règles :

### A. Règle du Responsable de Promotion (Enseignants)
1. **Présence Obligatoire :** Chaque promotion a un professeur responsable (`p.responsiblePromo === exam.promo`).
2. Sa présence est **garantie et obligatoire** lors de chaque examen de sa promotion (sauf congé ou arrêt maladie déclaré).
3. **Aucune limite de vacations journalières** ne doit le bloquer pour les épreuves de sa promo.
4. **Rotation des Salles :** Si l'examen se déroule dans plusieurs salles simultanément, l'option `resp.roomAlternation !== false` effectue une rotation chronologique afin qu'il visite alternativement les différentes salles au fil des examens de la session.

### B. Hiérarchie & Mixité des Résidents
1. **Encadrement par un Senior :** Dans chaque salle nécessitant au moins un résident, le premier résident choisi doit être de **3ème ou 4ème année (R3 ou R4)** pour encadrer.
2. **Complétion par des Juniors :** Les places restantes sont attribuées prioritairement aux **R1 ou R2**.
3. **Mixité des Spécialités :** Deux résidents de la même spécialité ne doivent pas être affectés dans la même salle (sauf salle spéciale comme l'Omnisport).

### C. Partitionnement Exclusif des Surveillants Polyvalents (Double Rôle)
1. Certains surveillants de l'administration possèdent la double casquette : `"Administration & Resp. de Zones"`.
2. **Règle stricte d'unicité :** Un surveillant ne doit **JAMAIS** apparaître dans deux colonnes différentes pour un même examen.
3. La fonction [`partitionAssignedProctors`](services/schedulerService.ts) sépare les surveillants assignés en 3 listes disjointes selon les capacités de la salle :
   - Si la salle requiert un Responsable de Zone (`zoneLeaderCapacity > 0`), le surveillant polyvalent est placé exclusivement dans la colonne **Resp. Zones**.
   - Si le quota de zone est atteint ou nul, il est placé exclusivement dans la colonne **Administration**.

### D. Gestion des Absences & Conflits
1. Les professeurs et résidents peuvent avoir des absences complètes (journée entière) ou partielles (heures de début et fin).
2. La fonction [`isStaffAvailable`](services/schedulerService.ts) vérifie à la fois :
   - Le statut actif (`is_active === 1`).
   - L'absence de chevauchement avec une indisponibilité déclarée.
   - L'absence de chevauchement horaire avec un autre examen auquel la personne est déjà affectée le même jour.

---

## 5. Pipeline Excel & Macro VBA (.xlsm)

L'application fournit deux modes d'export :
1. **Export Excel Classique (`.xls`) :** Généré côté client en HTML Table compatible Excel avec mise en forme des couleurs par promo.
2. **Export Macro VBA Intégrée (`.xlsm`) :**
   - Le bouton déclenche `handleExportMacroXlsm` dans `PlanningTab.tsx`.
   - Les données sont transmises à l'API `POST /api/exams/export-macro-xlsm` dans `backend/app/routes/exams.py`.
   - Le backend charge `public/Modele_Planning_Surveillance.xlsm`, injecte les données dans `Feuil1` avec les styles exacts (Indigo 600, couleurs promos, salles en rouge), et **pré-génère les 5 feuilles d'analyse** :
     - `Enseignants`
     - `Residents`
     - `Administration`
     - `IT`
     - `RespZones`
   - **Visibilité garantie des dates :** Chaque demi-journée (`Matin` et `Aprem`) est configurée avec une largeur minimale de **13.5** (largeur combinée >= 27 pour la journée fusionnée). Les jours complets (ex. `"mercredi 20/05/2026"`) ne sont ainsi jamais tronqués et ne demandent aucun réajustement manuel.
   - Le code VBA dans `ModPlanningSurveillance` applique les mêmes règles lors du clic sur le bouton **« ACTUALISER »**.

---

## 6. Commandes & Workflow de Développement

### Démarrage Local
Double-cliquez sur `start_dev.bat` ou lancez en ligne de commande :
```powershell
# Démarre simultanément le Backend (port 8000) et le Frontend Vite (port 5173)
.\start_dev.bat
```

### Vérifications de Qualité de Code
Avant toute validation, lancez impérativement :
```powershell
# 1. Vérification TypeScript Frontend (doit renvoyer code 0)
npx tsc --noEmit

# 2. Build de production Frontend (doit compiler dist/ sans erreur)
npm run build

# 3. Migrations de base de données (si modification des modèles SQLAlchemy)
cd backend
python -m alembic upgrade head
```

---

## 7. Règles d'Or pour les Agents IA

1. **Ne jamais ouvrir le navigateur** de manière autonome si l'utilisateur a expressément demandé des réponses textuelles directes sans browser.
2. **Ne jamais exécuter de commande `cd` isolée** dans le terminal Powershell : utilisez toujours l'argument `Cwd` de votre outil d'exécution.
3. **Intégrité de la documentation :** Préservez toujours les commentaires existants et les docstrings.
4. **Pas d'écrasement aveugle :** Modifiez les fichiers chirurgicalement avec `replace_file_content` ou `multi_replace_file_content`.
5. **Vérification systématique :** Après toute modification TypeScript, testez avec `npx tsc --noEmit`. Après toute modification du backend, testez la syntaxe Python.
6. **Double persistance :** DentProctor synchronise les données entre `localStorage` et les tables SQLite/PostgreSQL du backend. Assurez-vous que les adaptateurs dans `utils/apiAdapter.ts` restent cohérents lors de l'ajout d'un champ.
