from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models.history_record import HistoryRecord
from app.schemas.history_record import HistoryRecord as HistoryRecordSchema, HistoryRecordCreate

router = APIRouter(prefix="/history", tags=["history"])

@router.post("/", response_model=HistoryRecordSchema)
def create_history_record(record: HistoryRecordCreate, db: Session = Depends(get_db)):
    db_record = HistoryRecord(
        period_name=record.period_name,
        exams_snapshot=record.exams_snapshot,
        assignments_snapshot=record.assignments_snapshot
    )
    db.add(db_record)
    db.commit()
    db.refresh(db_record)
    return db_record

@router.get("/", response_model=List[HistoryRecordSchema])
def read_history_records(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    records = db.query(HistoryRecord).order_by(HistoryRecord.date_saved.desc()).offset(skip).limit(limit).all()
    return records

@router.delete("/{record_id}")
def delete_history_record(record_id: int, db: Session = Depends(get_db)):
    db_record = db.query(HistoryRecord).filter(HistoryRecord.id == record_id).first()
    if db_record is None:
        raise HTTPException(status_code=404, detail="History record not found")
    db.delete(db_record)
    db.commit()
    return {"ok": True}
