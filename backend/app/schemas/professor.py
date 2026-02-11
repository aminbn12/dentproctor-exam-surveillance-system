from pydantic import BaseModel
from typing import Optional

class ProfessorBase(BaseModel):
    name: str
    rank: str  # 'Pr' ou 'Dr'
    responsible_promo: Optional[str] = None

class ProfessorCreate(ProfessorBase):
    id: Optional[str] = None  # Permettre de spécifier un ID personnalisé

class ProfessorUpdate(BaseModel):
    name: Optional[str] = None
    rank: Optional[str] = None
    responsible_promo: Optional[str] = None

class ProfessorResponse(ProfessorBase):
    id: str

    class Config:
        from_attributes = True
