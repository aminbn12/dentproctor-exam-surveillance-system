# Configuration des Matières pour les Professeurs

## 📋 Aperçu

Vous pouvez maintenant configurer les matières pour chaque professeur directement dans l'interface d'administration. Cela vous permet de:

- **Ajouter** des matières à un professeur
- **Supprimer** des matières existantes
- **Synchroniser** automatiquement avec le backend
- **Importer/Exporter** via CSV

## 🎯 Comment Utiliser

### 1. Interface Graphique (Recommandé)

#### Accès à la Configuration

1. Allez dans l'onglet **"Enseignants"** (Gestion des Enseignants)
2. Pour chaque professeur, vous verrez une colonne **"Matières"**
3. Cliquez sur le bouton vert (vert émeraude) pour éditer les matières

#### Ajouter une Matière

1. Dans la modal qui s'ouvre, tapez le nom de la matière (ex: "Anatomie")
2. Cliquez sur **"+ AJOUTER"** ou appuyez sur Entrée
3. La matière apparaît immédiatement dans la liste

#### Supprimer une Matière

1. Dans la liste des matières configurées
2. Cliquez sur l'icône **Poubelle** (🗑️) à droite de la matière
3. Elle est supprimée immédiatement

### 2. Import via CSV

#### Format du Fichier CSV

Le fichier doit avoir la structure suivante:

```
sep=;
Nom;Grade;Promo_Responsable;Matiere_1;Matiere_2;Matiere_3;Matiere_4
Alami Ahmed;Pr;FM6MD1;Anatomie;Biologie;Histologie;
Berrada Sarah;Dr;;Pathologie;Microbiologie;;
```

#### Télécharger le Modèle

1. Dans l'onglet "Enseignants"
2. Cliquez sur **"Importer"** (en haut à droite)
3. Un modèle CSV s'affichera automatiquement

#### Importer le Fichier

1. Préparez votre fichier CSV avec la structure ci-dessus
2. Cliquez sur **"Importer"** dans la section des enseignants
3. Sélectionnez votre fichier
4. Les données seront fusionnées (ajout des nouveaux, mise à jour des existants)

### 3. Synchronisation avec le Backend

#### Synchronisation Manuelle

1. Une fois vos matières configurées
2. Cliquez sur **"Sync Server"** (orange, en haut)
3. Confirmez l'action
4. Les données seront sauvegardées dans la base de données

#### Synchronisation Automatique

- Quand vous modifiez les matières d'un professeur, la modification est envoyée au backend automatiquement (si disponible)

## 📊 Intégration avec les Épreuves

Les matières configurées pour les professeurs peuvent être utilisées pour:

- **Organiser** les épreuves par sujet
- **Planifier** les surveillances selon les compétences
- **Générer** des rapports (futurs)

### Exemple de Flux

1. Configurez Pr. Ahmed avec matières: "Anatomie", "Histologie"
2. Créez une épreuve "Anatomie Générale" (FM6MD1)
3. Affectez Pr. Ahmed pour surveiller cette épreuve
4. L'association matière/professeur est maintenant tracée

## 🔄 Exemple Complet

### Étape 1: Configurer des Matières

- Professeur: **ELHIJAZI (Pr)**
- Matières: Anatomie, Biologie dentaire, Histologie

### Étape 2: Créer une Épreuve

- Date: 2026-06-20
- Heure: 09:00
- Sujet: **Anatomie Générale**
- Durée: 120 minutes

### Étape 3: Affecter le Professeur

- ELHIJAZI surveille cette épreuve
- Son expertise en "Anatomie" est confirmée dans le système

## 💾 Export/Sauvegarde

### Exporter les Données

1. Cliquez sur **"Exporter"** (cyan/bleu)
2. Un fichier JSON est téléchargé avec tous les données (professeurs + matières)
3. Conservez ce fichier pour les sauvegardes

### Restaurer les Données

1. Cliquez sur **"Restaurer"** (violet)
2. Sélectionnez le fichier JSON sauvegardé
3. Les données sont importées et fusionnées

## ⚠️ Notes Importantes

### Limites Actuelles

- Les matières sont stockées comme liste de textes simples
- Pas de validation de doublons au niveau de la base de données
- Les matières des professeurs n'affectent pas automatiquement les calendriers

### Bonnes Pratiques

1. **Standardisez les noms**: Utilisez toujours "Anatomie" et non "anatomie" ou "Anat"
2. **Sauvegardez régulièrement**: Exportez vos données en JSON
3. **Synchronisez après modifications**: Cliquez "Sync Server" après les changements importants
4. **Vérifiez les imports**: Après import CSV, vérifiez les données dans l'interface

## 🚀 Fonctionnalités Futures

Possibilités d'amélioration:

- [ ] Liste prédéfinie de matières (dropdown)
- [ ] Création automatique de matières manquantes
- [ ] Liaison matière-épreuve-professeur
- [ ] Rapport de couverture (qui enseigne quoi)
- [ ] Validation de l'expertise avant affectation

## ❓ Dépannage

### Problem: Les matières ne s'affichent pas

- **Solution**: Rafraîchissez la page (F5)
- **Vérifier**: Que le backend est en cours d'exécution

### Problem: Import CSV ne fonctionne pas

- **Solution**: Vérifiez le format (separateur `;`)
- **Vérifier**: Que la première ligne est `sep=;`

### Problem: Synchronisation échouée

- **Solution**: Vérifiez que le backend est accessible
- **Fallback**: Les données restent locales, réessayez plus tard

## 📞 Support

Pour plus d'informations sur la configuration de l'application, consultez [README.md](README.md) ou les autres fichiers de documentation du projet.
