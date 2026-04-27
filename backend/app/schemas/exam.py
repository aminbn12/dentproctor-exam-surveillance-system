from pydantic import BaseModel
from typing import List, Optional

class ExamBase(BaseModel):
    date: str  # YYYY-MM-DD
    time: str  # HH:MM
    duration: int
    promo: str
    subject: str

class ExamCreate(ExamBase):
    room_ids: List[str] = []

class ExamUpdate(BaseModel):
    date: Optional[str] = None
    time: Optional[str] = None
    duration: Optional[int] = None
    subject: Optional[str] = None

class ExamResponse(ExamBase):
    id: str
    room_ids: List[str] = []

    class Config:
        from_attributes = True
