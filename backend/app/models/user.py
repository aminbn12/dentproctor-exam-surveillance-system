from sqlalchemy import Column, String, Enum, DateTime, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
from app.models.base import Base

class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    username = Column(String(100), unique=True, nullable=False, index=True)
    email = Column(String(100), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(150), nullable=True)
    role = Column(Enum('ADMIN', 'PROCTOR', name='user_role'), nullable=False, default='PROCTOR')
    staff_type = Column(Enum('prof', 'resident', name='staff_type'), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relations
    professor = relationship("Professor", uselist=False, back_populates="user", cascade="all, delete-orphan")
    resident = relationship("Resident", uselist=False, back_populates="user", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<User {self.username}>"
