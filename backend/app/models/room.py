from sqlalchemy import Column, String, Integer, DateTime
from datetime import datetime
import uuid
from app.models.base import Base

class Room(Base):
    __tablename__ = "rooms"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(100), nullable=False, unique=True, index=True)
    prof_capacity = Column(Integer, nullable=False)
    resident_capacity = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<Room {self.name}>"
