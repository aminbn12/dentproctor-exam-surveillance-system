from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, selectinload
from typing import List
from app.database import get_db
from app.models.assignment import Assignment
from app.models.exam import Exam
from app.models.room import Room
from app.models.professor import Professor
from app.models.resident import Resident
from app.models.proctor import Proctor
from app.schemas.assignment import AssignmentResponse, AssignmentCreate
from app.middleware.auth import get_current_user, get_admin_user
from app.models.user import User

router = APIRouter(prefix="/api/assignments", tags=["assignments"])

def time_to_minutes(t: str) -> int:
    """Convertir HH:MM en minutes"""
    h, m = t.split(":")
    return int(h) * 60 + int(m)

def assignment_to_response(assign: Assignment) -> dict:
    """Convert assignment to response dict with proctor_ids"""
    return {
        "id": assign.id,
        "exam_id": assign.exam_id,
        "room_id": assign.room_id,
        "prof_ids": [p.id for p in assign.professors],
        "resident_ids": [r.id for r in assign.residents],
        "proctor_ids": [p.id for p in assign.proctors] if hasattr(assign, 'proctors') else []
    }

@router.get("", response_model=List[AssignmentResponse])
async def get_assignments(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    skip: int = 0,
    limit: int = 100
):
    """Récupérer tous les assignments (avec eager loading et pagination)"""
    assignments = db.query(Assignment).options(
        selectinload(Assignment.professors),
        selectinload(Assignment.residents),
        selectinload(Assignment.proctors)
    ).offset(skip).limit(limit).all()
    return [assignment_to_response(a) for a in assignments]

@router.post("", response_model=AssignmentResponse)
async def create_assignment(
    assignment: AssignmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """Créer un assignment avec validation des capacités et conflits horaires"""
    # 1. Vérifier unicité exam/salle
    existing = db.query(Assignment).filter(
        Assignment.exam_id == assignment.exam_id,
        Assignment.room_id == assignment.room_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="❌ Assignment existe déjà")

    # 2. Récupérer salle et exam
    room = db.query(Room).filter(Room.id == assignment.room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Salle non trouvée")

    exam = db.query(Exam).filter(Exam.id == assignment.exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Examen non trouvé")

    # 3. Validation des capacités
    if len(assignment.prof_ids) > room.prof_capacity:
        raise HTTPException(
            status_code=400,
            detail=f"Trop de professeurs: {len(assignment.prof_ids)} > capacité {room.prof_capacity}"
        )
    if len(assignment.resident_ids) > room.resident_capacity:
        raise HTTPException(
            status_code=400,
            detail=f"Trop de résidents: {len(assignment.resident_ids)} > capacité {room.resident_capacity}"
        )
    if len(assignment.proctor_ids) > (room.proctor_capacity or 0):
        raise HTTPException(
            status_code=400,
            detail=f"Trop d'administrateurs: {len(assignment.proctor_ids)} > capacité {room.proctor_capacity}"
        )

    # 4. Fonction de détection de conflit horaire
    def has_time_conflict(exam1: Exam, exam2: Exam) -> bool:
        if not exam1.time or not exam2.time:
            return False
        start1 = time_to_minutes(exam1.time)
        end1 = start1 + exam1.duration
        start2 = time_to_minutes(exam2.time)
        end2 = start2 + exam2.duration
        return start1 < end2 and end1 > start2

    # 5. Vérifier conflits pour chaque staff
    def check_staff_conflict(staff_type: str, staff_ids: List[str]) -> tuple[bool, str]:
        """Retourne (conflit_trouvé, message)"""
        if staff_type == "professor":
            # Récupérer tous les assignments existants de ces profs (jointure)
            existing_assigns = db.query(Assignment).join(Assignment.professors).filter(
                Professor.id.in_(staff_ids)
            ).all()
        elif staff_type == "resident":
            existing_assigns = db.query(Assignment).join(Assignment.residents).filter(
                Resident.id.in_(staff_ids)
            ).all()
        elif staff_type == "proctor":
            existing_assigns = db.query(Assignment).join(Assignment.proctors).filter(
                Proctor.id.in_(staff_ids)
            ).all()
        else:
            return False, ""

        for assign in existing_assigns:
            # Ne pas vérifier conflit avec le même assignment (serait bizarre, mais en création, aucun existing avec même exam/room)
            if assign.exam_id == exam.id:
                continue
            other_exam = db.query(Exam).filter(Exam.id == assign.exam_id).first()
            if not other_exam or other_exam.date != exam.date:
                continue
            if has_time_conflict(exam, other_exam):
                return True, f"{staff_type} déjà assigné à {other_exam.subject} ({other_exam.time})"
        return False, ""

    # Vérifier chaque catégorie
    for prof_id in assignment.prof_ids:
        prof = db.query(Professor).filter(Professor.id == prof_id).first()
        if not prof:
            raise HTTPException(status_code=404, detail=f"Professeur {prof_id} non trouvé")
        conflict, msg = check_staff_conflict("professor", [prof_id])
        if conflict:
            raise HTTPException(status_code=400, detail=f"Conflit d'horaires pour {prof.name}: {msg}")

    for res_id in assignment.resident_ids:
        res = db.query(Resident).filter(Resident.id == res_id).first()
        if not res:
            raise HTTPException(status_code=404, detail=f"Résident {res_id} non trouvé")
        conflict, msg = check_staff_conflict("resident", [res_id])
        if conflict:
            raise HTTPException(status_code=400, detail=f"Conflit d'horaires pour {res.name}: {msg}")

    for proctor_id in assignment.proctor_ids:
        proctor = db.query(Proctor).filter(Proctor.id == proctor_id).first()
        if not proctor:
            raise HTTPException(status_code=404, detail=f"Administrateur {proctor_id} non trouvé")
        conflict, msg = check_staff_conflict("proctor", [proctor_id])
        if conflict:
            raise HTTPException(status_code=400, detail=f"Conflit d'horaires pour {proctor.name}: {msg}")

    # 6. Création de l'assignment
    new_assign = Assignment(exam_id=assignment.exam_id, room_id=assignment.room_id)
    new_assign.professors.extend(db.query(Professor).filter(Professor.id.in_(assignment.prof_ids)).all())
    new_assign.residents.extend(db.query(Resident).filter(Resident.id.in_(assignment.resident_ids)).all())
    new_assign.proctors.extend(db.query(Proctor).filter(Proctor.id.in_(assignment.proctor_ids)).all())

    db.add(new_assign)
    db.commit()
    db.refresh(new_assign)
    return assignment_to_response(new_assign)

@router.delete("/{assignment_id}")
async def delete_assignment(
    assignment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """Supprimer un assignment"""
    assign = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not assign:
        raise HTTPException(status_code=404, detail="Assignment non trouvé")
    
    db.delete(assign)
    db.commit()
    return {"message": "✅ Assignment supprimé"}
