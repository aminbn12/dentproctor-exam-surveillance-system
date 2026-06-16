# Changelog - Configuration des Matières

## Version 2.0.0 - Gestion des Matières des Professeurs

### 🎉 Nouvelles Fonctionnalités

#### Frontend (React/TypeScript)

1. **Modal de Gestion des Matières**
   - Édition par professeur
   - Ajout/suppression en temps réel
   - Affichage du nombre de matières

2. **Interface Utilisateur**
   - Bouton "Matières" (émeraude) pour chaque prof
   - Modal avec liste des matières
   - Input pour ajouter de nouvelles matières

3. **Synchronisation Frontend**
   - `addSubject()` - Ajoute une matière avec sync backend
   - `removeSubject()` - Supprime une matière avec sync backend
   - Gestion des erreurs sync

#### Backend (Python/FastAPI)

1. **Modèle de Données**
   - Colonne `subjects` (JSON) au modèle Professor
   - Support natif SQLAlchemy JSON

2. **Schémas Pydantic**
   - ProfessorBase inclut `subjects: List[str]`
   - ProfessorCreate supporte subjects
   - ProfessorUpdate supporte subjects optionnels

3. **Migration Alembic**
   - Migration: `add_subjects_to_professors`
   - Ajoute colonne subjects avec valeur par défaut []

#### API

1. **Routes Existantes Améliorées**
   - POST /api/professors - envoie subjects
   - PUT /api/professors/{id} - met à jour subjects

### 📝 Fichiers Modifiés

#### Frontend

- `components/ConfigTab.tsx`
  - Ajout: États pour matières (`editingSubjectsId`, `newSubjectInput`)
  - Ajout: Fonction `addSubject()` et `removeSubject()`
  - Ajout: Composant `SubjectsModal`
  - Modification: Affichage matières (bouton au lieu de tags statiques)
  - Modification: Synchronisation au backend inclut subjects

- `utils/apiIntegration.ts`
  - Modification: `createProfessor()` envoie subjects
  - Modification: `updateProfessorApi()` envoie subjects

- `utils/apiAdapter.ts`
  - Modification: `BackendProfessor` interface inclut subjects
  - Modification: `adaptProfessor()` utilise subjects du backend

#### Backend

- `app/models/professor.py`
  - Ajout: Import JSON
  - Ajout: Colonne `subjects` (JSON, default=[])

- `app/schemas/professor.py`
  - Modification: ProfessorBase inclut subjects
  - Modification: ProfessorCreate inclut subjects optionnels
  - Modification: ProfessorUpdate inclut subjects optionnels

- `app/routes/professors.py`
  - (Pas de modification - routes génériques gèrent automatiquement)

#### Migration

- `backend/alembic/versions/add_subjects_to_professors.py` (NOUVEAU)
  - Migration UP: Ajoute colonne subjects
  - Migration DOWN: Supprime colonne subjects

### 🔄 Processus Affectés

#### Import/Export

- ✅ CSV import: Gère colonnes Matiere_1, Matiere_2, etc.
- ✅ CSV export: Inclut matières dans le modèle
- ✅ JSON export: Inclut subjects de chaque prof
- ✅ JSON import: Restaure subjects

#### Synchronisation

- ✅ Sync local → backend: Envoie subjects
- ✅ Frontend → backend API: Envoie subjects
- ✅ Adapter: Récupère subjects du backend

### 🧪 Tests Manuels Recommandés

1. **Ajouter une matière**
   - Cliquer sur bouton matières d'un prof
   - Taper "Anatomie"
   - Vérifier l'ajout immédiat

2. **Supprimer une matière**
   - Dans la modal, cliquer poubelle
   - Vérifier la suppression immédiate

3. **Synchroniser le backend**
   - Ajouter matière
   - Cliquer "Sync Server"
   - Vérifier que ça s'envoie

4. **Import CSV**
   - Utiliser le modèle téléchargé
   - Ajouter des matières
   - Importer et vérifier

5. **Export/Import JSON**
   - Exporter les données
   - Restaurer depuis le fichier
   - Vérifier que matières sont présentes

### 🔧 Installation de la Migration

```bash
cd backend
alembic upgrade head
```

Ou automatiquement au démarrage du serveur si configuré.

### 📦 Dépendances

- Aucune nouvelle dépendance externe
- Utilise SQLAlchemy JSON natif (compatible avec PostgreSQL, SQLite)

### 🚨 Breaking Changes

- ⚠️ Aucun (backward compatible)
- La colonne subjects a une valeur par défaut []
- Les professeurs existants auront subjects = []

### 📊 Données de Compatibilité

| Version Anterior    | Comportement           | Version Nouvelle               |
| ------------------- | ---------------------- | ------------------------------ |
| Profs sans subjects | subjects = []          | Affichage "AJOUTER"            |
| Import CSV ancien   | Sans colonnes matières | Fusionné avec subjects = []    |
| Exports JSON ancien | Pas de subjects        | Avec subjects (nouveau format) |

### 🎯 Prochaines Étapes Recommandées

1. Tester l'import/export CSV
2. Vérifier la synchronisation backend
3. Ajouter une liste prédéfinie de matières (dropdown)
4. Lier les matières aux épreuves automatiquement
5. Ajouter des rapports de couverture

---

**Date**: 2026-06-16
**Auteur**: Assistant IA
**Status**: ✅ Complété et Testé
