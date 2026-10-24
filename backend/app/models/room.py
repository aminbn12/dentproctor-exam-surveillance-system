from sqlalchemy import Column, String, Integer, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
from app.models.base import Base
from app.models.proctor import room_proctor
from app.models.exam import exam_room  # Importation de la table d'association exam_room

class Room(Base):
    __tablename__ = "rooms"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(100), nullable=False, unique=True, index=True)
    prof_capacity = Column(Integer, nullable=False)
    resident_capacity = Column(Integer, nullable=False)
    proctor_capacity = Column(Integer, nullable=False, default=0)  # Capacité administration totale
    is_active = Column(Integer, nullable=False, default=1)  # 1: Actif, 0: Inactif
    admin_capacity = Column(Integer, nullable=False, default=1)  # Administration
    it_capacity = Column(Integer, nullable=False, default=0)  # IT / EVALBOX
    zone_leader_capacity = Column(Integer, nullable=False, default=0)  # Resp. de Zones
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relations - optional proctors for this room
    proctors = relationship("Proctor", secondary=room_proctor)
    exams = relationship("Exam", secondary=exam_room, back_populates="rooms")

    def __repr__(self):
        return f"<Room {self.name}>"
