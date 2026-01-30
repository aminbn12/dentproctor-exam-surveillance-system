from sqlalchemy import Column, String, Integer, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
from app.models.base import Base

class Resident(Base):
    __tablename__ = "residents"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey('users.id'), nullable=True)
    name = Column(String(150), nullable=False, index=True)
    level = Column(Integer, nullable=False)  # 1, 2, 3, 4
    specialty = Column(String(100), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relations
    user = relationship("User", back_populates="resident")
    absences = relationship("Absence", back_populates="resident", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Resident {self.name} (Y{self.level})>"
