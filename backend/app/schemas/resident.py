from pydantic import BaseModel
from typing import Optional

class ResidentBase(BaseModel):
    name: str
    level: int  # 1, 2, 3, 4
    specialty: str

class ResidentCreate(ResidentBase):
    pass

class ResidentUpdate(BaseModel):
    name: Optional[str] = None
    level: Optional[int] = None
    specialty: Optional[str] = None

class ResidentResponse(ResidentBase):
    id: str

    class Config:
        from_attributes = True
