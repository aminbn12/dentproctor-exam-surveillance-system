# ✅ Suivi des Modifications - DentProctor

**Date de création** : 2026-04-27  
**État** : En cours de correction

---

## 📋 Modifications Déjà Appliquées

| # | Fichier | Ligne | Description | Statut |
|---|---------|-------|-------------|--------|
| 1 | `backend/run.bat` | 24 | Activation venv avec chemin absolu `%~dp0` | ✅ Fait |
| 2 | `backend/run.bat` | 39 | Check admin par `username` au lieu de `role` | ✅ Fait |
| 3 | `backend/run.bat` | 57 | `uvicorn` → `python -m uvicorn` | ✅ Fait |
| 4 | `services/schedulerService.ts` | 103 | Responsable promo sur **première salle** (pas seulement Omnisport) | ✅ Fait |
| 5 | `services/schedulerService.ts` | 216 | Message warning mis à jour | ✅ Fait |
| 6 | `backend/venv` | — | Venv recréé (ancien corrompu) | ✅ Fait |
| 7 | `backend/app/main.py` | 24 | CORS restrictif: `allow_origins=settings.CORS_ORIGINS` | ✅ Fait |
| 8 | `backend/app/main.py` | 60-65 | Masque détails d'erreur en production | ✅ Fait |
| 9 | `backend/app/models/absence.py` | — | Ajout `start_time`, `end_time` (String) et `CheckConstraint` XOR | ✅ Fait |
| 10 | `backend/app/models/assignment.py` | 1, 28-36 | `UniqueConstraint('exam_id','room_id')` ; index sur `room_id` | ✅ Fait |
| 11 | `backend/app/models/proctor.py` | 1, 24 | `is_active` en `Boolean` (default True) | ✅ Fait |
| 12 | `backend/app/routes/proctors.py` | 22, 113 | Filtre `is_active == True` ; soft-delete `False` | ✅ Fait |
| 13 | `backend/app/routes/assignments.py` | 1, 42-150 | Validation capacités, conflits horaires, imports additions, eager loading, pagination | ✅ Fait |
| 14 | `backend/app/routes/assignments.py` | 33-40 | `get_assignments` avec `selectinload` et pagination | ✅ Fait |
| 15 | `backend/app/routes/professors.py` | 15-18 | Pagination ajoutée | ✅ Fait |
| 16 | `backend/app/routes/residents.py` | 15-18 | Pagination ajoutée | ✅ Fait |
| 17 | `backend/app/routes/rooms.py` | 14-17 | Pagination ajoutée | ✅ Fait |
| 18 | `backend/app/routes/exams.py` | 12-15 | Pagination ajoutée | ✅ Fait |
| 19 | `backend/app/routes/proctors.py` | 19-25 | Pagination ajoutée | ✅ Fait |
|---|---------|-------|-------------|--------|
| 20 | `components/PlanningTab.tsx` | 310-315, 340 | Export Excel: résidents sans "Dr." + salle en rouge | ✅ Fait |
| 21 | `components/HistoryTab.tsx` | 104-111, 115, 82-90, 158-169 | Export Excel archive: ajout colonne "Heure Fin" + "Heure Début" renommé, résidents avec "Dr." (une fois) + salle en rouge | ✅ Fait |

---

## 🔴 Prioritaires (P0) - À Faire

### A. Sécurité & Configuration
- [x] **CORS** : Restreindre `allow_origins` dans `backend/app/main.py` (ligne 22-29) ✅
- [x] **SECRET_KEY** : Lire depuis variable d'environnement (déjà fait via `os.getenv`) ✅
- [x] **Exposition erreurs** : Masquer détails en production dans `global_exception_handler` (`backend/app/main.py:60-65`) ✅
- [ ] **.env.backend** : Vérifier s'il contient des secrets, ajouter à `.gitignore` si besoin

### B. Modèle & Base de données
- [ ] **User unicité** : Empêcher un User d'être à la fois Professor ET Resident (`backend/app/models/user.py:23-24`)
- [x] **Assignment contrainte** : Ajouter `UniqueConstraint('exam_id', 'room_id')` dans `assignment.py` ✅
- [x] **Absence validator** : Ajout colonnes `start_time`/`end_time` et contrainte XOR (`professor_id` OU `resident_id` requis) dans `absence.py` ✅
- [ ] **Types DB** : Convertir `Exam.date` et `Exam.time` en `Date`/`Time` (au lieu de String) dans `exam.py`
- [x] **Proctor.is_active** : Changer en `Boolean` dans `proctor.py` ✅
- [x] **Index manquant** : Ajouter `index=True` sur `Assignment.room_id` (`assignment.py:33`) ✅

### C. Routes & API
- [x] **Routes manquantes** : Vérifié, `sync.py`/`sync_config.py` non référencés dans `main.py` ✅
- [x] **Validation assignement** : Vérifier capacités salles et conflits horaires dans `backend/app/routes/assignments.py:create_assignment` ✅
- [x] **Validation exam** : Vérifier que `room_ids` existent et associer dans `exams.py:create_exam` ✅
- [x] **Pagination** : Ajoutée sur toutes les routes liste (profs, residents, rooms, exams, assignments, proctors) ✅

### D. Performance
- [x] **N+1 queries (assignments)** : `selectinload` dans `get_assignments` ✅
- [x] **N+1 queries (exams)** : `selectinload(Exam.rooms)` dans `get_exams` ✅
- [ ] **Fetch parallèles** : Utiliser `Promise.all` dans `App.tsx:loadDataFromBackend` (au lieu de séquentiel)

---

## 🟠 Importants (P1) - À Faire

### E. Logging & Monitoring
- [ ] Configurer `logging` structuré dans backend (rotating logs)
- [ ] Retirer `print` et `console.log` de production
- [ ] Ajouter logging des requêtes et erreurs

### F. UX / Frontend
- [ ] Ajouter spinner/indicateur de chargement global (`App.tsx`)
- [ ] Remplacer `alert()` par toasts (ex: `react-hot-toast`)
- [ ] Ajouter feedback après actions (ex: "✅ X assignations créées")
- [ ] Accessibilité : ajouter `aria-label` aux boutons, vérifier contrastes
- [ ] Responsive : vérifier textes très petits (`text-[9px]`) sur mobile

### G. Gestion d'état
- [ ] Centraliser état avec Zustand/Jotai (remplacer useState distribué dans `App.tsx`)
- [ ] Unifier loading states avec contexte ou requêtes asynchrones

### H. Algorithme & Métier
- [ ] **Implémenter proctors** : `suggestProctorsForExamRoom` doit retourner `proctorIds` basé sur `proctorCapacity`
- [ ] **Validation proctors** : Vérifier `proctorCapacity` dans `validateAssignment`
- [ ] **Gestion Responsible** : Si responsable indisponible, proposer remplaçant automatiquement (amélioration logique)

---

## 🟡 Améliorations (P2/P3) - À Faire

### I. Tests & Qualité
- [ ] Ajouter `pytest` (backend) et `vitest` (frontend)
- [ ] Tester `schedulerService` (autour de 20 scénarios)
- [ ] Tester endpoints CRUD (auth, professors, exams, assignments)
- [ ] Configurer GitHub Actions pour CI

### J. Déploiement & DevOps
- [ ] Initialiser Alembic pour migrations
- [ ] Créer `docker-compose.yml` (postgres + backend + frontend)
- [ ] Créer scripts cross-platform (`start_dev.sh` / `Makefile`)
- [ ] Ajouter `.env.example` complet

### K. Documentation
- [ ] Écrire vrai README.md (installation, usage, architecture)
- [ ] Ajouter docstrings sur fonctions critiques
- [ ] Ajouter descriptions dans schémas Pydantic (`Field(description=...)`)
- [ ] Créer `CONTRIBUTING.md` et diagramme d'architecture

### L. Nettoyage & Refactoring
- [ ] Supprimer duplication dans `apiIntegration.ts` (créer fonctions génériques)
- [ ] Supprimer duplication dans `ConfigTab.syncLocalDataToBackend`
- [ ] Harmoniser nommage : `responsiblePromo` vs `responsible_promo` (choisir camelCase partout)
- [ ] Renommer `proctorCapacity` en `adminCapacity` pour cohérence
- [ ] Extraire chaînes françaises pour i18n (`i18next`)

### M. Base de données
- [ ] Créer table `Promotions` (id, name) et remplacer strings par FK
- [ ] Créer table `Subjects` et relation many-to-many avec `Professor`
- [ ] Ajouter `ON DELETE CASCADE` approprié sur relations
- [ ] Ajouter contraintes CHECK (ex: `Exam.duration > 0`)

---

## 📊 Priorités

| Priorité | Catégorie | Problème | Estimation |
|----------|-----------|----------|------------|
| **P0** | Sécurité | CORS + SECRET_KEY + erreurs exposées | 1h |
| **P0** | Modèle | Unicité User/Professor/Resident | 2h |
| **P0** | Routes | Routes `sync.py` manquantes | 30min |
| **P0** | Validation | Capacités & conflits non vérifiés backend | 2h |
| **P0** | Performance | N+1 queries + pagination | 2h |
| **P1** | Logging | Logging structuré manquant | 1h |
| **P1** | UX | Feedback utilisateur (toasts, spinners) | 2h |
| **P1** | Algorithme | Proctors non suggérés | 1h |
| **P2** |Tests | Ajout couverture | 4h+ |
| **P3** | i18n | Internationalisation | 3h |
| **P3** | Docker | Containerisation | 1h |

**Total estimé** : ~20h de travail (hors tests complets)

---

## 🎯 Prochaines Actions (Ordre suggéré)

1. **Sécurité** : CORS restrictif + SECRET_KEY env + erreurs masquées
2. **Modèle** : Unicité User/Professor/Resident + contraintes Assignment/Absence
3. **Routes** : Soit créer `sync.py`/`sync_config.py`, soit retirer références
4. **Validation** : Ajouter vérifications capacités/conflits dans `create_assignment`
5. **Performance** : Eager loading + pagination
6. **Logging** : Configurer module logging
7. **UX** : Ajouter toasts et indicateurs de chargement
8. **Algorithme** : Intégrer proctors dans suggestion
9. **Tests** : Commencer par `schedulerService` + endpoints critiques
10. **Docs** : README + docstrings

---

**Dernière mise à jour** : 2026-04-27 09:30
