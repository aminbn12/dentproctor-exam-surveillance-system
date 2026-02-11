from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.room import Room
from app.schemas.room import RoomResponse, RoomCreate, RoomUpdate
from app.middleware.auth import get_admin_user
from app.models.user import User

router = APIRouter(prefix="/api/rooms", tags=["rooms"])

@router.get("", response_model=List[RoomResponse])
async def get_rooms(db: Session = Depends(get_db)):
    """Récupérer toutes les salles"""
    return db.query(Room).all()

@router.post("", response_model=RoomResponse)
async def create_room(
    room: RoomCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """Créer une salle"""
    # Vérifier si une salle avec cet ID existe déjà
    if room.id:
        existing_id = db.query(Room).filter(Room.id == room.id).first()
        if existing_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Une salle avec l'ID '{room.id}' existe déjà"
            )
    
    # Vérifier unicité du nom
    existing = db.query(Room).filter(Room.name == room.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="❌ Cette salle existe déjà")
    
    new_room = Room(**room.dict())
    db.add(new_room)
    db.commit()
    db.refresh(new_room)
    return new_room

@router.put("/{room_id}", response_model=RoomResponse)
async def update_room(
    room_id: str,
    room_data: RoomUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """Mettre à jour une salle"""
    room = db.query(Room).filter(Room.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Salle non trouvée")
    
    for key, value in room_data.dict(exclude_unset=True).items():
        setattr(room, key, value)
    
    db.commit()
    db.refresh(room)
    return room

@router.delete("/{room_id}")
async def delete_room(
    room_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """Supprimer une salle"""
    room = db.query(Room).filter(Room.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Salle non trouvée")
    
    db.delete(room)
    db.commit()
    return {"message": "✅ Salle supprimée"}
