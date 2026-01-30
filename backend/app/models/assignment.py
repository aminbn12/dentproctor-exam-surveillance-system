from sqlalchemy import Column, String, ForeignKey, DateTime, Table
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
from app.models.base import Base

prof_assignment = Table(
    'prof_assignment',
    Base.metadata,
    Column('prof_id', String(36), ForeignKey('professors.id')),
    Column('assignment_id', String(36), ForeignKey('assignments.id'))
)

resident_assignment = Table(
    'resident_assignment',
    Base.metadata,
    Column('resident_id', String(36), ForeignKey('residents.id')),
    Column('assignment_id', String(36), ForeignKey('assignments.id'))
)

class Assignment(Base):
    __tablename__ = "assignments"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    exam_id = Column(String(36), ForeignKey('exams.id'), nullable=False, index=True)
    room_id = Column(String(36), ForeignKey('rooms.id'), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relations
    exam = relationship("Exam", back_populates="assignments")
    professors = relationship("Professor", secondary=prof_assignment)
    residents = relationship("Resident", secondary=resident_assignment)

    def __repr__(self):
        return f"<Assignment exam={self.exam_id} room={self.room_id}>"
