from pydantic import BaseModel
from typing import Optional, List, Any

class ResidentBase(BaseModel):
    name: str
    level: int  # 1, 2, 3, 4
    specialty: str
    user_id: Optional[str] = None
    absences: Optional[List[Any]] = []

class ResidentCreate(ResidentBase):
    id: Optional[str] = None  # Permettre de spécifier un ID personnalisé

class ResidentUpdate(BaseModel):
    name: Optional[str] = None
    level: Optional[int] = None
    specialty: Optional[str] = None
    absences: Optional[List[Any]] = None

class ResidentResponse(ResidentBase):
    id: str

    class Config:
        from_attributes = True
