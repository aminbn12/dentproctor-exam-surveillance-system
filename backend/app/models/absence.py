from sqlalchemy import Column, String, ForeignKey, DateTime, CheckConstraint
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
    start_time = Column(String(5), nullable=True)  # HH:MM (pour absence partielle)
    end_time = Column(String(5), nullable=True)    # HH:MM
    reason = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Contrainte :必须 either professor_id OR resident_id (XOR)
    __table_args__ = (
        CheckConstraint(
            "(professor_id IS NOT NULL) OR (resident_id IS NOT NULL)",
            name="absence_has_entity"
        ),
    )

    # Relations
    professor = relationship("Professor", back_populates="absences")
    resident = relationship("Resident", back_populates="absences")

    def __repr__(self):
        return f"<Absence {self.date}>"
