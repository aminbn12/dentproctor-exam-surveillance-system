# Import all models to ensure they're registered with Base
from app.models.base import Base
from app.models.user import User
from app.models.professor import Professor
from app.models.resident import Resident
from app.models.room import Room
from app.models.exam import Exam
from app.models.assignment import Assignment
from app.models.absence import Absence
from app.models.history_record import HistoryRecord

__all__ = ['Base', 'User', 'Professor', 'Resident', 'Room', 'Exam', 'Assignment', 'Absence', 'HistoryRecord']
