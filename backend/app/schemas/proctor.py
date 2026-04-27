from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class ProctorBase(BaseModel):
    name: str
    specialty: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    is_active: Optional[int] = 1

class ProctorCreate(ProctorBase):
    pass

class ProctorUpdate(BaseModel):
    name: Optional[str] = None
    specialty: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    is_active: Optional[int] = None

class ProctorResponse(ProctorBase):
    id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
