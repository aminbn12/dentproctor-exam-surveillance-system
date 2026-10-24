# Guide Technique - Implémentation des Matières

## Architecture

### Flux de Données

```
Frontend (React) <---> Backend (FastAPI) <---> Database (SQLAlchemy)
   |                      |                         |
   v                      v                         v
Professor {              POST/PUT                professor.subjects
  subjects: []   ------>  payload              [JSON Array]
}                        {
                         subjects: []
                        }
```

### Modèle de Données

#### Frontend (TypeScript)

```typescript
interface Professor {
  id: string;
  name: string;
  rank: "Pr" | "Dr";
  responsiblePromo?: Promo;
  subjects: string[]; // ← NEW
  absences: Absence[];
}
```

#### Backend (Python)

```python
class Professor(Base):
    __tablename__ = "professors"
    id: String
    name: String
    rank: Enum('Pr', 'Dr')
    responsible_promo: String
    subjects: JSON = []  # ← NEW (list of strings)
    created_at: DateTime
    updated_at: DateTime
```

#### API Schema (Pydantic)

```python
class ProfessorBase(BaseModel):
    name: str
    rank: str
    responsible_promo: Optional[str] = None
    subjects: List[str] = []  # ← NEW

class ProfessorUpdate(BaseModel):
    name: Optional[str] = None
    rank: Optional[str] = None
    responsible_promo: Optional[str] = None
    subjects: Optional[List[str]] = None  # ← NEW
```

## Composants Frontend

### ConfigTab.tsx

#### États Ajoutés

```typescript
const [editingSubjectsId, setEditingSubjectsId] = useState<string | null>(null);
const [newSubjectInput, setNewSubjectInput] = useState("");
```

#### Fonctions Clés

**`addSubject(profId, subject)`**

- Ajoute une matière à un professeur
- Évite les doublons
- Synchronise avec le backend
- Réinitialise le champ d'input

**`removeSubject(profId, subject)`**

- Supprime une matière d'un professeur
- Synchronise avec le backend

**`SubjectsModal()`**

- Composant modal pour éditer les matières
- Affiche liste des matières
- Permet ajout/suppression
- Design cohérent avec AbsenceModal

#### Modificat au Rendu

```jsx
// Ancien (statique)
<div className="flex flex-wrap gap-1">
  {p.subjects.map((s, idx) => (
    <span key={idx}>{s}</span>
  ))}
</div>

// Nouveau (interactif)
<button onClick={() => setEditingSubjectsId(p.id)}>
  {p.subjects.length > 0
    ? `${p.subjects.length} MATIÈRE(S)`
    : "AJOUTER"}
</button>
```

### apiIntegration.ts

#### Modifications

**`createProfessor(prof)`**

```typescript
// Ancien
const payload = {
  name: prof.name,
  rank: prof.rank,
  responsible_promo: prof.responsiblePromo || null,
};

// Nouveau
const payload = {
  name: prof.name,
  rank: prof.rank,
  responsible_promo: prof.responsiblePromo || null,
  subjects: prof.subjects || [], // ← ADDED
};
```

**`updateProfessorApi(id, data)`**

```typescript
// Ajouter dans le payload
if (data.subjects !== undefined) payload.subjects = data.subjects;
```

### apiAdapter.ts

#### Interface BackendProfessor

```typescript
// Ancien
export interface BackendProfessor {
  id: string;
  name: string;
  rank: "Pr" | "Dr";
  responsible_promo?: string;
  user_id: string;
}

// Nouveau
export interface BackendProfessor {
  id: string;
  name: string;
  rank: "Pr" | "Dr";
  responsible_promo?: string;
  subjects?: string[]; // ← ADDED
  user_id: string;
}
```

#### Fonction adaptProfessor

```typescript
// Ancien
export const adaptProfessor = (backend: BackendProfessor): Professor => ({
  id: backend.id,
  name: backend.name,
  rank: backend.rank,
  responsiblePromo: backend.responsible_promo || "",
  subjects: [], // Toujours vide
  absences: [],
});

// Nouveau
export const adaptProfessor = (backend: BackendProfessor): Professor => ({
  id: backend.id,
  name: backend.name,
  rank: backend.rank,
  responsiblePromo: backend.responsible_promo || "",
  subjects: backend.subjects || [], // ← USES BACKEND DATA
  absences: [],
});
```

## Modèles et Schémas Backend

### Model Professor

**Fichier**: `backend/app/models/professor.py`

```python
from sqlalchemy import Column, String, Enum, ForeignKey, DateTime, JSON

class Professor(Base):
    __tablename__ = "professors"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey('users.id'), nullable=True)
    name = Column(String(150), nullable=False, index=True)
    rank = Column(Enum('Pr', 'Dr', name='prof_rank'), nullable=False)
    responsible_promo = Column(String(20), nullable=True)
    subjects = Column(JSON, nullable=False, default=list)  # ← NEW
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
```

### Schema ProfessorBase

**Fichier**: `backend/app/schemas/professor.py`

```python
from typing import List

class ProfessorBase(BaseModel):
    name: str
    rank: str
    responsible_promo: Optional[str] = None
    subjects: List[str] = []  # ← NEW

class ProfessorCreate(ProfessorBase):
    id: Optional[str] = None

class ProfessorUpdate(BaseModel):
    name: Optional[str] = None
    rank: Optional[str] = None
    responsible_promo: Optional[str] = None
    subjects: Optional[List[str]] = None  # ← NEW
```

## Migration Alembic

**Fichier**: `backend/alembic/versions/add_subjects_to_professors.py`

```python
"""Add subjects field to professors

Revision ID: 0001_add_subjects
Revises: 0affe9a8d3b4
"""

def upgrade() -> None:
    op.add_column('professors', sa.Column(
        'subjects',
        sa.JSON(),
        nullable=False,
        server_default='[]'
    ))

def downgrade() -> None:
    op.drop_column('professors', 'subjects')
```

**Exécution**:

```bash
cd backend
alembic upgrade head
```

## Flux d'Utilisation Typique

### 1. Édition via Modal

```
User clicks [Matières] button
    ↓
setEditingSubjectsId(profId)
    ↓
SubjectsModal renders
    ↓
User enters subject name
    ↓
User clicks "+ AJOUTER"
    ↓
addSubject(profId, subject)
    ↓
- Update prof.subjects locally
- Update state
- Call updateProfessorApi()
    ↓
API sends PUT to /api/professors/{id}
    ↓
Backend updates JSON column
```

### 2. CSV Import

```
User selects CSV file
    ↓
handleFileUpload()
    ↓
Parse columns: [name, rank, promo, ...subjects]
    ↓
Create/Update prof with subjects array
    ↓
setProfs(updated)
    ↓
User clicks "Sync Server"
    ↓
createProfessor/updateProfessorApi sends subjects
```

### 3. Backend Sync

```
syncLocalDataToBackend()
    ↓
for each prof:
    ↓
    createProfessor({
        id, name, rank, responsiblePromo, subjects ← INCLUDED
    })
    ↓
    catch 409 → updateProfessorApi()
```

## Considérations de Performance

### Base de Données

- Colonne JSON est indexable (si souhaité)
- Pas de jointure nécessaire (vs. table séparée)
- Requête simple: `SELECT subjects FROM professors WHERE id = ?`

### Frontend

- État limité: 2 nouvelles variables d'état
- Rendu: 1 modal supplémentaire (non visible par défaut)
- Pas de changement majeur de performance

### API

- Payload légèrement plus volumineux (+ subjects array)
- Pas d'appels additionnels
- Format JSON standard supporté partout

## Gestion des Erreurs

### Frontend

- Try-catch autour des appels API
- Message console.warn si sync échoue
- Données restent en local si backend indisponible

### Backend

- SQLAlchemy gère JSON automatiquement
- Pydantic valide List[str]
- Erreurs HTTP 400 si format invalide

## Tests à Faire

### Unitaires (Backend)

```python
def test_professor_subjects_column():
    prof = Professor(name="Test", rank="Pr", subjects=["Math", "Science"])
    assert prof.subjects == ["Math", "Science"]

def test_professor_empty_subjects_default():
    prof = Professor(name="Test", rank="Pr")
    assert prof.subjects == []
```

### Intégration (API)

```python
# POST
response = client.post("/api/professors", json={
    "name": "Test",
    "rank": "Pr",
    "subjects": ["Anatomy"]
})
assert response.json()["subjects"] == ["Anatomy"]

# PUT
response = client.put("/api/professors/123", json={
    "subjects": ["Anatomy", "Biology"]
})
assert response.json()["subjects"] == ["Anatomy", "Biology"]
```

### Frontend

- Ajouter matière
- Supprimer matière
- Éditer matière (via modal)
- Import CSV avec matières
- Export JSON et reimport

## Compatibilité

### Bases de Données

| Système    | JSON Support   | Notes      |
| ---------- | -------------- | ---------- |
| PostgreSQL | ✅ Native      | Recommandé |
| MySQL 5.7+ | ✅ Native      | OK         |
| SQLite     | ✅ (Text JSON) | Fonctionne |
| Oracle     | ✅             | À tester   |

### Navigateurs

| Navigateur | Support | Notes        |
| ---------- | ------- | ------------ |
| Chrome     | ✅      | Testé        |
| Firefox    | ✅      | Testé        |
| Safari     | ✅      | OK           |
| Edge       | ✅      | OK           |
| IE 11      | ⚠️      | Pas supporté |

## Dépannage

### Problem: Colonne subjects est NULL

**Cause**: Migration pas exécutée
**Solution**: `alembic upgrade head`

### Problem: Subjects n'apparaissent pas après import

**Cause**: Cache ou refresh
**Solution**: F5 ou rechargement manuel

### Problem: API retourne 400 sur subjects

**Cause**: Format invalide (pas List[str])
**Solution**: Vérifier le type de données envoyé

---

## Ressources

- [Types.ts](../types.ts)
- [ConfigTab.tsx](../components/ConfigTab.tsx)
- [professor.py](../backend/app/models/professor.py)
- [professor.py schema](../backend/app/schemas/professor.py)
- [MATIERES_CONFIG.md](../MATIERES_CONFIG.md)
