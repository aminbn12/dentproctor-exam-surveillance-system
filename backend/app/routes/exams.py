from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.exam import Exam
from app.schemas.exam import ExamResponse, ExamCreate, ExamUpdate
from app.middleware.auth import get_admin_user
from app.models.user import User

router = APIRouter(prefix="/api/exams", tags=["exams"])

@router.get("", response_model=List[ExamResponse])
async def get_exams(db: Session = Depends(get_db)):
    """Récupérer tous les examens"""
    return db.query(Exam).all()

@router.post("", response_model=ExamResponse)
async def create_exam(
    exam: ExamCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """Créer un examen"""
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
