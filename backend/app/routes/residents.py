from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.resident import Resident
from app.models.professor import Professor
from app.models.absence import Absence
from app.models.config_change_log import EntityType, ActionType
from app.schemas.resident import ResidentResponse, ResidentCreate, ResidentUpdate
from app.middleware.auth import get_admin_user
from app.models.user import User
from app.services.config_change_logger import log_config_change

router = APIRouter(prefix="/api/residents", tags=["residents"])

@router.get("", response_model=List[ResidentResponse])
async def get_residents(
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 1000
):
    """Récupérer tous les résidents (avec pagination)"""
    return db.query(Resident).offset(skip).limit(limit).all()

@router.post("", response_model=ResidentResponse)
async def create_resident(
    resident: ResidentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """Créer un résident"""
    # Vérifier si un résident avec cet ID existe déjà
    if resident.id:
        existing = db.query(Resident).filter(Resident.id == resident.id).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Un résident avec l'ID '{resident.id}' existe déjà"
            )
    
    # Vérifier que l'utilisateur associé n'est pas déjà un professeur
    if resident.user_id:
        existing_prof = db.query(Professor).filter(Professor.user_id == resident.user_id).first()
        if existing_prof:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cet utilisateur est déjà enregistré comme professeur. Un utilisateur ne peut être que résident OU professeur."
            )
    
    new_resident = Resident(**resident.dict())
    db.add(new_resident)
    db.commit()
    db.refresh(new_resident)
    
    # Enregistrer la modification dans les logs
    log_config_change(
        db=db,
        user=current_user,
        entity_type=EntityType.RESIDENT,
        entity_id=new_resident.id,
        action=ActionType.CREATE,
        new_value=resident.dict(),
        entity_name=getattr(new_resident, 'name', None) or getattr(new_resident, 'full_name', None) or new_resident.id
    )
    
    return new_resident

@router.put("/{resident_id}", response_model=ResidentResponse)
async def update_resident(
    resident_id: str,
    resident_data: ResidentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """Mettre à jour un résident"""
    resident = db.query(Resident).filter(Resident.id == resident_id).first()
    if not resident:
        raise HTTPException(status_code=404, detail="Résident non trouvé")
    
    # Sauvegarder l'ancienne valeur avant modification
    old_value = {col.name: getattr(resident, col.name) for col in resident.__table__.columns}
    
    for key, value in resident_data.dict(exclude_unset=True).items():
        setattr(resident, key, value)
    
    db.commit()
    db.refresh(resident)
    
    # Enregistrer la modification dans les logs
    new_value = {col.name: getattr(resident, col.name) for col in resident.__table__.columns}
    log_config_change(
        db=db,
        user=current_user,
        entity_type=EntityType.RESIDENT,
        entity_id=resident.id,
        action=ActionType.UPDATE,
        old_value=old_value,
        new_value=new_value,
        entity_name=getattr(resident, 'name', None) or getattr(resident, 'full_name', None) or resident.id
    )
    
    return resident

@router.delete("/{resident_id}")
async def delete_resident(
    resident_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """Supprimer un résident"""
    resident = db.query(Resident).filter(Resident.id == resident_id).first()
    if not resident:
        raise HTTPException(status_code=404, detail="Résident non trouvé")
    
    # Sauvegarder les infos avant suppression
    old_value = {col.name: getattr(resident, col.name) for col in resident.__table__.columns}
    entity_name = getattr(resident, 'name', None) or getattr(resident, 'full_name', None) or resident.id
    
    db.delete(resident)
    db.commit()
    
    # Enregistrer la modification dans les logs
    log_config_change(
        db=db,
        user=current_user,
        entity_type=EntityType.RESIDENT,
        entity_id=resident_id,
        action=ActionType.DELETE,
        old_value=old_value,
        entity_name=entity_name
    )
    
    return {"message": "✅ Résident supprimé"}
