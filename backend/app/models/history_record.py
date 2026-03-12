from sqlalchemy import Column, Integer, String, DateTime, JSON
from datetime import datetime
from app.models.base import Base

class HistoryRecord(Base):
    __tablename__ = "history_records"

    id = Column(Integer, primary_key=True, index=True)
    date_saved = Column(DateTime, default=datetime.utcnow)
    period_name = Column(String, index=True)
    exams_snapshot = Column(JSON)
    assignments_snapshot = Column(JSON)
