from pydantic import BaseModel
from typing import Optional, Any, Dict, List
from datetime import datetime
from enum import Enum

class EntityTypeEnum(str, Enum):
    PROFESSOR = "professor"
    RESIDENT = "resident"
    ROOM = "room"

class ActionTypeEnum(str, Enum):
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"

class ConfigChangeLogBase(BaseModel):
    entity_type: EntityTypeEnum
    entity_id: str
    entity_name: Optional[str] = None
    action: ActionTypeEnum
    old_value: Optional[Dict[str, Any]] = None
    new_value: Optional[Dict[str, Any]] = None
    change_summary: Optional[str] = None

class ConfigChangeLogCreate(ConfigChangeLogBase):
    pass

class ConfigChangeLogResponse(ConfigChangeLogBase):
    id: int
    user_id: str
    user_name: Optional[str] = None
    timestamp: datetime

    class Config:
        from_attributes = True
