from pydantic import BaseModel
from typing import Optional

class RoomBase(BaseModel):
    name: str
    prof_capacity: int
    resident_capacity: int
    proctor_capacity: int = 0  # Capacité administration totale
    is_active: int = 1  # 1: Actif, 0: Inactif
    admin_capacity: int = 1  # Administration
    it_capacity: int = 0  # IT / EVALBOX
    zone_leader_capacity: int = 0  # Resp. de Zones

class RoomCreate(RoomBase):
    id: Optional[str] = None  # Permettre de spécifier un ID personnalisé

class RoomUpdate(BaseModel):
    name: Optional[str] = None
    prof_capacity: Optional[int] = None
    resident_capacity: Optional[int] = None
    proctor_capacity: Optional[int] = None
    is_active: Optional[int] = None
    admin_capacity: Optional[int] = None
    it_capacity: Optional[int] = None
    zone_leader_capacity: Optional[int] = None

class RoomResponse(RoomBase):
    id: str

    class Config:
        from_attributes = True
