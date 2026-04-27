from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.professor import Professor
from app.models.resident import Resident
from app.models.absence import Absence
from app.models.config_change_log import EntityType, ActionType
from app.schemas.professor import ProfessorResponse, ProfessorCreate, ProfessorUpdate
from app.middleware.auth import get_current_user, get_admin_user
from app.models.user import User
from app.services.config_change_logger import log_config_change

router = APIRouter(prefix="/api/professors", tags=["professors"])

@router.get("", response_model=List[ProfessorResponse])
async def get_professors(
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 1000
):
    """Récupérer tous les professeurs (avec pagination)"""
    return db.query(Professor).offset(skip).limit(limit).all()

@router.post("", response_model=ProfessorResponse)
async def create_professor(
    prof: ProfessorCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """Créer un professeur (admin only)"""
    # Vérifier si un professeur avec cet ID existe déjà
    if prof.id:
        existing = db.query(Professor).filter(Professor.id == prof.id).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Un professeur avec l'ID '{prof.id}' existe déjà"
            )
    
    # Vérifier que l'utilisateur associé n'est pas déjà un résident
    if prof.user_id:
        existing_resident = db.query(Resident).filter(Resident.user_id == prof.user_id).first()
        if existing_resident:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cet utilisateur est déjà enregistré comme résident. Un utilisateur ne peut être que professeur OU résident."
            )
    
    new_prof = Professor(**prof.dict())
    db.add(new_prof)
    db.commit()
    db.refresh(new_prof)
    
    # Enregistrer la modification dans les logs
    log_config_change(
        db=db,
        user=current_user,
        entity_type=EntityType.PROFESSOR,
        entity_id=new_prof.id,
        action=ActionType.CREATE,
        new_value=prof.dict(),
        entity_name=getattr(new_prof, 'name', None) or getattr(new_prof, 'full_name', None) or new_prof.id
    )
    
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
    
    # Sauvegarder l'ancienne valeur avant modification
    old_value = {col.name: getattr(prof, col.name) for col in prof.__table__.columns}
    
    for key, value in prof_data.dict(exclude_unset=True).items():
        setattr(prof, key, value)
    
    db.commit()
    db.refresh(prof)
    
    # Enregistrer la modification dans les logs
    new_value = {col.name: getattr(prof, col.name) for col in prof.__table__.columns}
    log_config_change(
        db=db,
        user=current_user,
        entity_type=EntityType.PROFESSOR,
        entity_id=prof.id,
        action=ActionType.UPDATE,
        old_value=old_value,
        new_value=new_value,
        entity_name=getattr(prof, 'name', None) or getattr(prof, 'full_name', None) or prof.id
    )
    
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
    
    # Sauvegarder les infos avant suppression
    old_value = {col.name: getattr(prof, col.name) for col in prof.__table__.columns}
    entity_name = getattr(prof, 'name', None) or getattr(prof, 'full_name', None) or prof.id
    
    db.delete(prof)
    db.commit()
    
    # Enregistrer la modification dans les logs
    log_config_change(
        db=db,
        user=current_user,
        entity_type=EntityType.PROFESSOR,
        entity_id=prof_id,
        action=ActionType.DELETE,
        old_value=old_value,
        entity_name=entity_name
    )
    
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
