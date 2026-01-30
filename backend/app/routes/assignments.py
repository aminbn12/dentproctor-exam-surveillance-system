from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.assignment import Assignment
from app.schemas.assignment import AssignmentResponse, AssignmentCreate
from app.middleware.auth import get_current_user, get_admin_user
from app.models.user import User

router = APIRouter(prefix="/api/assignments", tags=["assignments"])

@router.get("", response_model=List[AssignmentResponse])
async def get_assignments(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Récupérer tous les assignments"""
    return db.query(Assignment).all()

@router.post("", response_model=AssignmentResponse)
async def create_assignment(
    assignment: AssignmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """Créer un assignment"""
    # Vérifier que l'assignment n'existe pas déjà
    existing = db.query(Assignment).filter(
        Assignment.exam_id == assignment.exam_id,
        Assignment.room_id == assignment.room_id
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="❌ Assignment existe déjà")
    
    new_assign = Assignment(
        exam_id=assignment.exam_id,
        room_id=assignment.room_id
    )
    
    # Importer les modèles
    from app.models.professor import Professor
    from app.models.resident import Resident
    
    # Lier les professeurs
    for prof_id in assignment.prof_ids:
        prof = db.query(Professor).filter(Professor.id == prof_id).first()
        if prof:
            new_assign.professors.append(prof)
    
    # Lier les résidents
    for res_id in assignment.resident_ids:
        res = db.query(Resident).filter(Resident.id == res_id).first()
        if res:
            new_assign.residents.append(res)
    
    db.add(new_assign)
    db.commit()
    db.refresh(new_assign)
    return new_assign

@router.delete("/{assignment_id}")
async def delete_assignment(
    assignment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """Supprimer un assignment"""
    assign = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not assign:
        raise HTTPException(status_code=404, detail="Assignment non trouvé")
    
    db.delete(assign)
    db.commit()
    return {"message": "✅ Assignment supprimé"}
