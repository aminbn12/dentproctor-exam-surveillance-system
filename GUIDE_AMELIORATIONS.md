# 🎯 Guide DentProctor - Nouvelles Fonctionnalités

## ✨ Améliorations Ajoutées

### 1️⃣ **Persistance Automatique** 💾
- ✅ **localStorage** : Vos données sont sauvegardées automatiquement à chaque modification
- ✅ Rechargez la page, vos données sont toujours là!
- ✅ Pas de perte de données lors du fermeture du navigateur

### 2️⃣ **Export/Import de Plannings** 📦

#### Exporter (Sauvegarder)
1. Allez à l'onglet **Configuration**
2. Cliquez sur le bouton **"Exporter"** (cyan)
3. Un fichier JSON est téléchargé: `dentproctor-backup-AAAA-MM-JJ.json`

#### Importer (Restaurer)
1. Allez à l'onglet **Configuration**
2. Cliquez sur le bouton **"Restaurer"** (purple)
3. Sélectionnez votre fichier JSON
4. Les données sont importées automatiquement ✅

**Cas d'usage:**
- Sauvegarder avant une modification importante
- Partager les plannings entre administrators
- Archiver les anciens plannings

### 3️⃣ **Affichage Amélioré du Planning Personnel** 👥

#### Vue Agenda (Liste)
Chaque examen affiche maintenant:

**📌 Informations Principales**
- Date et heure
- Sujet et promotion
- Numéro de salle

**👨‍🏫 Équipe Complète**
- **Enseignants**: Liste avec nom et rang (Pr/Dr)
  - 📍 = C'est vous (surligné)
  - 👤 = Autre enseignant
- **Résidents**: Liste avec nom et année (A1-A4)
  - 📍 = C'est vous (surligné)
  - 👤 = Autre résident

### 4️⃣ **Widget "Prochaine Échéance"** ⏰
- Barre flottante en bas de l'écran
- Affiche votre prochain examen en temps réel
- Visible sur toutes les pages

---

## 🚀 Comment Utiliser

### Administrateur
1. **Configuration**: Gérez les enseignants, résidents, salles, examens
2. **Planning Global**: Générez les affectations intelligentes
3. **Équité**: Vérifiez la distribution des surveillances
4. **Export**: Sauvegardez régulièrement vos données

**Boutons clés:**
- 📊 **Suggestion Auto**: Affectations intelligentes
- 💾 **Exporter**: Sauvegarder tout
- 📥 **Restaurer**: Charger une sauvegarde

### Proctor (Enseignant/Résident)
1. **Mon Planning**: Voir vos surveillances
2. **Vue Calendrier**: Navigation mensuelle
3. **Vue Liste**: Tous les examens avec détails complets
4. **Collègues**: Voir qui d'autre est assigné

---

## 📌 Conseils

✅ **Avant une modification importante:**
- Exportez votre planning (`Configuration` → `Exporter`)
- Faites vos modifications
- Testez, puis gardez ou restaurez si besoin

✅ **Pour partager les plannings:**
- Exporte ZIP de toutes les données
- Partagez le fichier JSON aux autres admins
- Ils peuvent restaurer chez eux

✅ **Pour l'archivage:**
- Exporte avant chaque semestre
- Classez les fichiers par date
- Gardez l'historique des plannings

---

## 🔧 Fonctionnalités Existantes

### Algorithme d'Affectation Intelligent ✨
- ✅ Au minimum 1 Professeur par salle
- ✅ Équité absolue des surveillances
- ✅ Respect des absences
- ✅ Pas de conflits horaires
- ✅ Diversité des spécialités (résidents)
- ✅ Responsable de promo pour Omnisport

### Importation CSV 📄
- Professeurs: `Nom;Rang;Promotion;Spécialité1;Spécialité2...`
- Résidents: `Nom;Année;Spécialité`

---

## 📞 Notes Techniques

- **Navigateur**: Chrome, Firefox, Safari, Edge
- **Données**: Stockées localement (pas d'envoi serveur)
- **Sauvegarde**: localStorage + JSON export
- **Rechargement**: Automatique et transparent

---

**Profitez du nouveau DentProctor! 🎉**
