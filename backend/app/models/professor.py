from sqlalchemy import Column, String, Enum, ForeignKey, DateTime, Table, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
from app.models.base import Base

class Professor(Base):
    __tablename__ = "professors"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey('users.id'), nullable=True)
    name = Column(String(150), nullable=False, index=True)
    rank = Column(Enum('Pr', 'Dr', name='prof_rank'), nullable=False)
    responsible_promo = Column(String(20), nullable=True)
    subjects = Column(JSON, nullable=False, default=list)  # Liste des matières
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relations
    user = relationship("User", back_populates="professor")
    absences = relationship("Absence", back_populates="professor", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Professor {self.name}>"
