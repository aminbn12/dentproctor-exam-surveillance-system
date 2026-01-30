from sqlalchemy import Column, String, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
from app.models.base import Base

class Absence(Base):
    __tablename__ = "absences"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    date = Column(String(10), nullable=False)  # YYYY-MM-DD
    professor_id = Column(String(36), ForeignKey('professors.id'), nullable=True)
    resident_id = Column(String(36), ForeignKey('residents.id'), nullable=True)
    reason = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relations
    professor = relationship("Professor", back_populates="absences")
    resident = relationship("Resident", back_populates="absences")

    def __repr__(self):
        return f"<Absence {self.date}>"
