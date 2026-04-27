from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Table, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
from app.models.base import Base

# Association table for room proctors (optional proctors assigned to a room)
room_proctor = Table(
    'room_proctor',
    Base.metadata,
    Column('proctor_id', String(36), ForeignKey('proctors.id')),
    Column('room_id', String(36), ForeignKey('rooms.id'))
)


class Proctor(Base):
    __tablename__ = "proctors"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(150), nullable=False)
    specialty = Column(String(200), nullable=True)  # Text field for specialty
    phone = Column(String(20), nullable=True)  # Phone number
    email = Column(String(100), nullable=True)  # Email
    is_active = Column(Boolean, default=True)  # Active status
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<Proctor {self.name}>"
