from pydantic import BaseModel
from typing import Optional, Any, Dict, List
from datetime import datetime

class HistoryRecordBase(BaseModel):
    period_name: str
    exams_snapshot: List[Dict[str, Any]]
    assignments_snapshot: List[Dict[str, Any]]

class HistoryRecordCreate(HistoryRecordBase):
    pass

class HistoryRecord(HistoryRecordBase):
    id: int
    date_saved: datetime

    class Config:
        from_attributes = True
