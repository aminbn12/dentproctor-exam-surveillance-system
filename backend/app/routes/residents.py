from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.resident import Resident
from app.models.absence import Absence
from app.schemas.resident import ResidentResponse, ResidentCreate, ResidentUpdate
from app.middleware.auth import get_admin_user
from app.models.user import User

router = APIRouter(prefix="/api/residents", tags=["residents"])

@router.get("", response_model=List[ResidentResponse])
async def get_residents(db: Session = Depends(get_db)):
    """Récupérer tous les résidents"""
    return db.query(Resident).all()

@router.post("", response_model=ResidentResponse)
async def create_resident(
    resident: ResidentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """Créer un résident"""
    new_resident = Resident(**resident.dict())
    db.add(new_resident)
    db.commit()
    db.refresh(new_resident)
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
    
    for key, value in resident_data.dict(exclude_unset=True).items():
        setattr(resident, key, value)
    
    db.commit()
    db.refresh(resident)
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
    
    db.delete(resident)
    db.commit()
    return {"message": "✅ Résident supprimé"}
