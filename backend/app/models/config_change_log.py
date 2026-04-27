from sqlalchemy import Column, Integer, String, DateTime, JSON, ForeignKey, Enum
from datetime import datetime
from app.models.base import Base
import enum

class EntityType(str, enum.Enum):
    """Types d'entités configurables"""
    PROFESSOR = "professor"
    RESIDENT = "resident"
    ROOM = "room"
    PROCTOR = "proctor"

class ActionType(str, enum.Enum):
    """Types d'actions effectuées"""
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"

class ConfigChangeLog(Base):
    """
    Modèle pour enregistrer les modifications de configuration
    (professeurs, résidents, salles d'examen)
    """
    __tablename__ = "config_change_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(36), ForeignKey('users.id'), nullable=False, index=True)
    user_name = Column(String(255), nullable=True)  # Nom de l'admin pour affichage
    entity_type = Column(Enum(EntityType), nullable=False, index=True)
    entity_id = Column(String(36), nullable=False, index=True)
    entity_name = Column(String(255), nullable=True)  # Nom de l'entité pour affichage
    action = Column(Enum(ActionType), nullable=False, index=True)
    old_value = Column(JSON, nullable=True)  # Valeur avant modification
    new_value = Column(JSON, nullable=True)  # Valeur après modification
    change_summary = Column(String(500), nullable=True)  # Résumé des changements
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
