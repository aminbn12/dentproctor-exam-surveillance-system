from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.room import Room
from app.models.config_change_log import EntityType, ActionType
from app.schemas.room import RoomResponse, RoomCreate, RoomUpdate
from app.middleware.auth import get_admin_user
from app.models.user import User
from app.services.config_change_logger import log_config_change

router = APIRouter(prefix="/api/rooms", tags=["rooms"])

@router.get("", response_model=List[RoomResponse])
async def get_rooms(
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 1000
):
    """Récupérer toutes les salles (avec pagination)"""
    return db.query(Room).offset(skip).limit(limit).all()

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
    
    # Enregistrer la modification dans les logs
    log_config_change(
        db=db,
        user=current_user,
        entity_type=EntityType.ROOM,
        entity_id=new_room.id,
        action=ActionType.CREATE,
        new_value=room.dict(),
        entity_name=new_room.name
    )
    
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
    
    # Sauvegarder l'ancienne valeur avant modification
    old_value = {col.name: getattr(room, col.name) for col in room.__table__.columns}
    
    for key, value in room_data.dict(exclude_unset=True).items():
        setattr(room, key, value)
    
    db.commit()
    db.refresh(room)
    
    # Enregistrer la modification dans les logs
    new_value = {col.name: getattr(room, col.name) for col in room.__table__.columns}
    log_config_change(
        db=db,
        user=current_user,
        entity_type=EntityType.ROOM,
        entity_id=room.id,
        action=ActionType.UPDATE,
        old_value=old_value,
        new_value=new_value,
        entity_name=room.name
    )
    
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
    
    # Sauvegarder les infos avant suppression
    old_value = {col.name: getattr(room, col.name) for col in room.__table__.columns}
    room_name = room.name
    
    db.delete(room)
    db.commit()
    
    # Enregistrer la modification dans les logs
    log_config_change(
        db=db,
        user=current_user,
        entity_type=EntityType.ROOM,
        entity_id=room_id,
        action=ActionType.DELETE,
        old_value=old_value,
        entity_name=room_name
    )
    
    return {"message": "✅ Salle supprimée"}
