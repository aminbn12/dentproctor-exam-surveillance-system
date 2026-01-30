from sqlalchemy import Column, String, Integer, DateTime, Table, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
from app.models.base import Base

exam_room = Table(
    'exam_room',
    Base.metadata,
    Column('exam_id', String(36), ForeignKey('exams.id')),
    Column('room_id', String(36), ForeignKey('rooms.id'))
)

class Exam(Base):
    __tablename__ = "exams"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    date = Column(String(10), nullable=False, index=True)  # YYYY-MM-DD
    time = Column(String(5), nullable=False)  # HH:MM
    duration = Column(Integer, nullable=False)  # minutes
    promo = Column(String(10), nullable=False, index=True)
    subject = Column(String(200), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relations
    assignments = relationship("Assignment", back_populates="exam", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Exam {self.subject} ({self.date} {self.time})>"
