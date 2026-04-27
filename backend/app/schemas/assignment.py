from pydantic import BaseModel
from typing import List

class AssignmentBase(BaseModel):
    exam_id: str
    room_id: str

class AssignmentCreate(AssignmentBase):
    prof_ids: List[str]
    resident_ids: List[str]
    proctor_ids: List[str] = []

class AssignmentResponse(AssignmentBase):
    id: str
    prof_ids: List[str]
    resident_ids: List[str]
    proctor_ids: List[str] = []

    class Config:
        from_attributes = True
