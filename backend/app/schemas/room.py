from pydantic import BaseModel
from typing import Optional

class RoomBase(BaseModel):
    name: str
    prof_capacity: int
    resident_capacity: int
    proctor_capacity: int = 0  # Capacité administration

class RoomCreate(RoomBase):
    id: Optional[str] = None  # Permettre de spécifier un ID personnalisé

class RoomUpdate(BaseModel):
    name: Optional[str] = None
    prof_capacity: Optional[int] = None
    resident_capacity: Optional[int] = None
    proctor_capacity: Optional[int] = None

class RoomResponse(RoomBase):
    id: str

    class Config:
        from_attributes = True
