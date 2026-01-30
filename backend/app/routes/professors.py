from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.professor import Professor
from app.models.absence import Absence
from app.schemas.professor import ProfessorResponse, ProfessorCreate, ProfessorUpdate
from app.middleware.auth import get_current_user, get_admin_user
from app.models.user import User

router = APIRouter(prefix="/api/professors", tags=["professors"])

@router.get("", response_model=List[ProfessorResponse])
async def get_professors(db: Session = Depends(get_db)):
    """Récupérer tous les professeurs"""
    return db.query(Professor).all()

@router.post("", response_model=ProfessorResponse)
async def create_professor(
    prof: ProfessorCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """Créer un professeur (admin only)"""
    new_prof = Professor(**prof.dict())
    db.add(new_prof)
    db.commit()
    db.refresh(new_prof)
    return new_prof

@router.put("/{prof_id}", response_model=ProfessorResponse)
async def update_professor(
    prof_id: str,
    prof_data: ProfessorUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """Mettre à jour un professeur"""
    prof = db.query(Professor).filter(Professor.id == prof_id).first()
    if not prof:
        raise HTTPException(status_code=404, detail="Professeur non trouvé")
    
    for key, value in prof_data.dict(exclude_unset=True).items():
        setattr(prof, key, value)
    
    db.commit()
    db.refresh(prof)
    return prof

@router.delete("/{prof_id}")
async def delete_professor(
    prof_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """Supprimer un professeur"""
    prof = db.query(Professor).filter(Professor.id == prof_id).first()
    if not prof:
        raise HTTPException(status_code=404, detail="Professeur non trouvé")
    
    db.delete(prof)
    db.commit()
    return {"message": "✅ Professeur supprimé"}

@router.post("/{prof_id}/absences")
async def add_absence(
    prof_id: str,
    absence_date: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """Ajouter une absence"""
    prof = db.query(Professor).filter(Professor.id == prof_id).first()
    if not prof:
        raise HTTPException(status_code=404, detail="Professeur non trouvé")
    
    # Vérifier si l'absence existe déjà
    existing = db.query(Absence).filter(
        Absence.professor_id == prof_id,
        Absence.date == absence_date
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="❌ Absence déjà enregistrée")
    
    absence = Absence(professor_id=prof_id, date=absence_date)
    db.add(absence)
    db.commit()
    return {"message": "✅ Absence ajoutée"}

@router.delete("/{prof_id}/absences/{absence_date}")
async def remove_absence(
    prof_id: str,
    absence_date: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """Supprimer une absence"""
    absence = db.query(Absence).filter(
        Absence.professor_id == prof_id,
        Absence.date == absence_date
    ).first()
    
    if not absence:
        raise HTTPException(status_code=404, detail="Absence non trouvée")
    
    db.delete(absence)
    db.commit()
    return {"message": "✅ Absence supprimée"}
