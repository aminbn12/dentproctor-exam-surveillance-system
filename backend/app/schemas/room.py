from pydantic import BaseModel
from typing import Optional

class RoomBase(BaseModel):
    name: str
    prof_capacity: int
    resident_capacity: int

class RoomCreate(RoomBase):
    id: Optional[str] = None  # Permettre de spécifier un ID personnalisé

class RoomUpdate(BaseModel):
    name: Optional[str] = None
    prof_capacity: Optional[int] = None
    resident_capacity: Optional[int] = None

class RoomResponse(RoomBase):
    id: str

    class Config:
        from_attributes = True
