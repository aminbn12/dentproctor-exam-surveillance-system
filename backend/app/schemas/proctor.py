from pydantic import BaseModel
from typing import Optional, Union, List, Any
from datetime import datetime

class ProctorBase(BaseModel):
    name: str
    specialty: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    is_active: Optional[Union[bool, int]] = 1
    absences: Optional[List[Any]] = []

class ProctorCreate(ProctorBase):
    id: Optional[str] = None

class ProctorUpdate(BaseModel):
    name: Optional[str] = None
    specialty: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    is_active: Optional[Union[bool, int]] = None
    absences: Optional[List[Any]] = None

class ProctorResponse(ProctorBase):
    id: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
