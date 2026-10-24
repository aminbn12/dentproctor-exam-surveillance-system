# Guide de Déploiement - Matières des Professeurs

## ⚡ Déploiement Rapide (5 minutes)

### Étape 1: Mettre à Jour la Base de Données (1 min)

```bash
# Aller dans le dossier backend
cd backend

# Exécuter la migration
alembic upgrade head
```

**Output attendu**:

```
INFO  [alembic.runtime.migration] Running upgrade 0affe9a8d3b4 -> 0001_add_subjects, add subjects field to professors ...
INFO  [alembic.runtime.migration] Done.
```

### Étape 2: Redémarrer le Backend (1 min)

```bash
# Arrêter le serveur backend actuel (Ctrl+C)
# Redémarrer
python run_server.py
# ou sur Windows
start_backend.bat
```

### Étape 3: Redémarrer le Frontend (1 min)

```bash
# Depuis la racine du projet
npm run dev
# ou
start_dev.bat
```

### Étape 4: Tester (2 min)

1. Ouvrir http://localhost:5173 (ou votre URL)
2. Aller à Configuration > Enseignants
3. Vérifier que la colonne "Matières" s'affiche
4. Cliquer sur un bouton matières
5. Ajouter une matière de test

---

## 🔍 Vérification Post-Déploiement

### Checklist Technique

- [ ] Migration exécutée sans erreur
- [ ] Backend redémarré
- [ ] Frontend compilé
- [ ] Pas d'erreurs dans la console (F12)
- [ ] Colonne subjects visible en base de données

```bash
# Vérifier la migration
sqlite3 dentproctor.db "PRAGMA table_info(professors);"
# Ou pour PostgreSQL:
# psql -d dentproctor -c "\d professors"
```

### Checklist Fonctionnelle

- [ ] Ajouter une matière fonctionne
- [ ] Supprimer une matière fonctionne
- [ ] Sync Server fonctionne
- [ ] Import CSV fonctionne
- [ ] Export JSON fonctionne

### Checklist API

```bash
# Vérifier que l'API retourne subjects
curl -H "Authorization: Bearer <token>" http://localhost:8000/api/professors | jq '.[] | {name, subjects}'
```

---

## 📦 En Cas de Problème

### Problem: Migration Échoue

**Cause Possible**: Alembic pas configuré

**Solution**:

```bash
# Vérifier alembic.ini
cat backend/alembic.ini | grep sqlalchemy.url

# Ou manuellement:
# Ajouter colonne à la base directement
# Pour SQLite:
ALTER TABLE professors ADD COLUMN subjects JSON DEFAULT '[]';
```

### Problem: Frontend Affiche Erreur

**Cause Possible**: Cache navigateur

**Solution**:

```
Ctrl+Shift+Delete (Windows) ou Cmd+Shift+Delete (Mac)
Ou F12 > Application > Clear All
```

### Problem: API Retourne 400 sur subjects

**Cause Possible**: Schéma API pas à jour

**Solution**:

```bash
# Vérifier que professor.py schema inclut subjects
grep -n "subjects" backend/app/schemas/professor.py

# Si manquant, vérifier les modifications apportées
```

---

## 🔄 Rollback (Si Nécessaire)

### Annuler la Migration

```bash
cd backend

# Voir l'historique des migrations
alembic history

# Revenir à la version antérieure
alembic downgrade 0affe9a8d3b4
```

### Restaurer les Fichiers

```bash
# Si vous avez sauvegardé vos données
git checkout -- .  # Attentionàtoutes les modifications!

# Ou restaurer spécifiquement:
git checkout HEAD backend/app/models/professor.py
```

---

## 📊 Vérification des Données

### SQLite

```bash
# Consulter les professeurs et leurs matières
sqlite3 dentproctor.db "SELECT name, rank, subjects FROM professors LIMIT 5;"
```

### PostgreSQL

```bash
psql -d dentproctor -c "SELECT name, rank, subjects FROM professors LIMIT 5;"
```

### Depuis l'API

```bash
# Obtenir tous les professeurs avec matières
curl -s http://localhost:8000/api/professors | python -m json.tool | grep -A5 "subjects"
```

---

## 🚀 Checklist de Sécurité

- [ ] Pas de données sensibles dans les logs
- [ ] API auth toujours activée
- [ ] Validation des subjects côté backend
- [ ] Pas de SQL injection possible (Pydantic/SQLAlchemy)
- [ ] Migration pas de rollback automatique

---

## 📝 Notes d'Exploitation

### Monitoring

Ajouter aux logs de monitoring:

- Nombre de matières par professeur
- Temps de sync des matières
- Erreurs lors de l'ajout de matières

### Sauvegarde

Les données subjects sont dans la colonne JSON.  
Assurez-vous que votre système de sauvegarde BD inclut bien cette colonne.

### Performance

- Pas d'index nécessaire sur subjects (sauf très volumineux)
- Requêtes simples sur JSON colonne
- Aucun impact de performance notable

---

## ✅ Validation de Succès

**Succès** si:

1. Migration exécutée sans erreur ✅
2. Interface affiche colonne Matières ✅
3. Ajout de matière fonctionnel ✅
4. Données sauvegardées en BD ✅
5. Sync Server fonctionne ✅
6. CSV import/export inclut matières ✅

**Prêt pour la production** si tous les points ci-dessus sont OK.

---

## 📞 Support Rapide

```
Erreur: "column subjects not found"
→ Migration pas exécutée. Faire: alembic upgrade head

Erreur: "subjects: Invalid value"
→ Format invalide. subjects doit être List[str]

Erreur: "API 400"
→ Vérifier que le payload inclut subjects (peut être vide [])

Erreur: "Modal ne s'affiche pas"
→ Vérifier console F12 pour erreurs JavaScript
```

---

## 🎯 Résumé du Déploiement

| Étape        | Commande                | Durée      |
| ------------ | ----------------------- | ---------- |
| 1. Migration | `alembic upgrade head`  | 30s        |
| 2. Backend   | `python run_server.py`  | 10s        |
| 3. Frontend  | `npm run dev`           | 1m         |
| 4. Test      | Vérifications manuelles | 2m         |
| **Total**    |                         | **~4 min** |

**C'est tout! Prêt à l'emploi!** 🚀

---

**Date**: 2026-06-16  
**Version**: 1.0.0  
**Status**: ✅ Prêt au déploiement
