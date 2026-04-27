from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, selectinload
from typing import List
from app.database import get_db
from app.models.exam import Exam
from app.models.room import Room
from app.schemas.exam import ExamResponse, ExamCreate, ExamUpdate
from app.middleware.auth import get_admin_user
from app.models.user import User

router = APIRouter(prefix="/api/exams", tags=["exams"])

@router.get("", response_model=List[ExamResponse])
async def get_exams(
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 1000
):
    """Récupérer tous les examens (avec pagination et préchargement des salles)"""
    exams = db.query(Exam).options(
        selectinload(Exam.rooms)
    ).offset(skip).limit(limit).all()
    return exams

@router.post("", response_model=ExamResponse)
async def create_exam(
    exam: ExamCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """Créer un examen (avec association des salles)"""
    # 1. Valider que toutes les salles existent (si fournies)
    rooms_to_associate: List[Room] = []
    if exam.room_ids:
        for room_id in exam.room_ids:
            room = db.query(Room).filter(Room.id == room_id).first()
            if not room:
                raise HTTPException(
                    status_code=404,
                    detail=f"Salle avec ID '{room_id}' non trouvée"
                )
            rooms_to_associate.append(room)

    # 2. Créer l'examen
    new_exam = Exam(
        date=exam.date,
        time=exam.time,
        duration=exam.duration,
        promo=exam.promo,
        subject=exam.subject
    )
    db.add(new_exam)
    db.commit()
    db.refresh(new_exam)

    # 3. Associer les salles validées
    for room in rooms_to_associate:
        new_exam.rooms.append(room)
    db.commit()
    db.refresh(new_exam)

    return new_exam

@router.put("/{exam_id}", response_model=ExamResponse)
async def update_exam(
    exam_id: str,
    exam_data: ExamUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """Mettre à jour un examen"""
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Examen non trouvé")
    
    for key, value in exam_data.dict(exclude_unset=True).items():
        setattr(exam, key, value)
    
    db.commit()
    db.refresh(exam)
    return exam

@router.delete("/{exam_id}")
async def delete_exam(
    exam_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """Supprimer un examen"""
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Examen non trouvé")
    
    db.delete(exam)
    db.commit()
    return {"message": "✅ Examen supprimé"}
