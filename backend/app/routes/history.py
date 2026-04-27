from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models.history_record import HistoryRecord
from app.models.user import User
from app.schemas.history_record import HistoryRecord as HistoryRecordSchema, HistoryRecordCreate
from app.middleware.auth import get_current_user

router = APIRouter(prefix="/api/history", tags=["history"])

@router.post("/", response_model=HistoryRecordSchema)
def create_history_record(
    record: HistoryRecordCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Créer un enregistrement d'historique - associé à l'utilisateur actuel"""
    db_record = HistoryRecord(
        user_id=current_user.id,  # Track which admin created this
        period_name=record.period_name,
        exams_snapshot=record.exams_snapshot,
        assignments_snapshot=record.assignments_snapshot
    )
    db.add(db_record)
    db.commit()
    db.refresh(db_record)
    return db_record

@router.get("/", response_model=List[HistoryRecordSchema])
def read_history_records(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Récupérer les enregistrements d'historique.
    - SUPER_ADMIN voit tous les enregistrements
    - ADMIN voit uniquement ses propres enregistrements
    """
    if current_user.role == 'SUPER_ADMIN':
        # SUPER_ADMIN voit tout
        records = db.query(HistoryRecord).order_by(HistoryRecord.date_saved.desc()).offset(skip).limit(limit).all()
    else:
        # ADMIN voit uniquement les siens
        records = db.query(HistoryRecord).filter(
            HistoryRecord.user_id == current_user.id
        ).order_by(HistoryRecord.date_saved.desc()).offset(skip).limit(limit).all()
    return records

@router.delete("/{record_id}")
def delete_history_record(
    record_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Supprimer un enregistrement d'historique - uniquement le sien sauf SUPER_ADMIN"""
    db_record = db.query(HistoryRecord).filter(HistoryRecord.id == record_id).first()
    if db_record is None:
        raise HTTPException(status_code=404, detail="History record not found")
    
    # Vérifier les permissions: SUPER_ADMIN peut tout supprimer, sinon uniquement les siens
    if current_user.role != 'SUPER_ADMIN' and db_record.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Vous ne pouvez pas supprimer cet enregistrement")
    
    db.delete(db_record)
    db.commit()
    return {"ok": True}
