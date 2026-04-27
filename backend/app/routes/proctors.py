# -*- coding: utf-8 -*-
"""
Routes API pour les surveillants (Proctors)
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models.proctor import Proctor
from app.models.config_change_log import EntityType, ActionType
from app.schemas.proctor import ProctorResponse, ProctorCreate, ProctorUpdate
from app.middleware.auth import get_admin_user
from app.models.user import User
from app.services.config_change_logger import log_config_change

router = APIRouter(prefix="/api/proctors", tags=["proctors"])


@router.get("", response_model=List[ProctorResponse])
async def get_proctors(
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 1000
):
    """Récupérer tous les surveillants"""
    return db.query(Proctor).filter(Proctor.is_active == True).offset(skip).limit(limit).all()


@router.post("", response_model=ProctorResponse)
async def create_proctor(
    proctor: ProctorCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """Créer un surveillant (admin only)"""
    # Vérifier si un surveillant avec cet ID existe déjà
    if proctor.id:
        existing = db.query(Proctor).filter(Proctor.id == proctor.id).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Un surveillant avec l'ID '{proctor.id}' existe déjà"
            )
    
    new_proctor = Proctor(**proctor.dict())
    db.add(new_proctor)
    db.commit()
    db.refresh(new_proctor)
    
    # Enregistrer la modification dans les logs
    log_config_change(
        db=db,
        user=current_user,
        entity_type=EntityType.PROCTOR,
        entity_id=new_proctor.id,
        action=ActionType.CREATE,
        new_value=proctor.dict(),
        entity_name=new_proctor.name
    )
    
    return new_proctor


@router.put("/{proctor_id}", response_model=ProctorResponse)
async def update_proctor(
    proctor_id: str,
    proctor_data: ProctorUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """Mettre à jour un surveillant"""
    proctor = db.query(Proctor).filter(Proctor.id == proctor_id).first()
    if not proctor:
        raise HTTPException(status_code=404, detail="Surveillant non trouvé")
    
    # Sauvegarder l'ancienne valeur avant modification
    old_value = {col.name: getattr(proctor, col.name) for col in proctor.__table__.columns}
    
    for key, value in proctor_data.dict(exclude_unset=True).items():
        setattr(proctor, key, value)
    
    db.commit()
    db.refresh(proctor)
    
    # Enregistrer la modification dans les logs
    new_value = {col.name: getattr(proctor, col.name) for col in proctor.__table__.columns}
    log_config_change(
        db=db,
        user=current_user,
        entity_type=EntityType.PROCTOR,
        entity_id=proctor.id,
        action=ActionType.UPDATE,
        old_value=old_value,
        new_value=new_value,
        entity_name=proctor.name
    )
    
    return proctor


@router.delete("/{proctor_id}")
async def delete_proctor(
    proctor_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """Supprimer un surveillant (soft delete)"""
    proctor = db.query(Proctor).filter(Proctor.id == proctor_id).first()
    if not proctor:
        raise HTTPException(status_code=404, detail="Surveillant non trouvé")
    
    # Sauvegarder les infos avant modification
    old_value = {col.name: getattr(proctor, col.name) for col in proctor.__table__.columns}
    proctor_name = proctor.name
    
    # Soft delete - just set is_active to False
    proctor.is_active = False
    db.commit()
    
    # Enregistrer la modification dans les logs
    log_config_change(
        db=db,
        user=current_user,
        entity_type=EntityType.PROCTOR,
        entity_id=proctor_id,
        action=ActionType.DELETE,
        old_value=old_value,
        entity_name=proctor_name
    )
    
    return {"message": "✅ Surveillant supprimé"}
