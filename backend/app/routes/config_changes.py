# -*- coding: utf-8 -*-
"""
Routes API pour les logs de modifications de configuration
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database import get_db
from app.models.user import User
from app.models.config_change_log import EntityType, ActionType
from app.schemas.config_change_log import ConfigChangeLogResponse, EntityTypeEnum, ActionTypeEnum
from app.middleware.auth import get_current_user
from app.services.config_change_logger import get_config_change_logs

router = APIRouter(prefix="/api/config-changes", tags=["config-changes"])


@router.get("", response_model=List[ConfigChangeLogResponse])
def read_config_changes(
    entity_type: Optional[str] = None,
    action: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Récupérer les logs de modifications de configuration.
    - SUPER_ADMIN voit tous les logs
    - ADMIN voit uniquement ses propres modifications
    """
    # Convertir les paramètres string en enums
    entity_type_enum = None
    action_enum = None
    
    if entity_type:
        try:
            entity_type_enum = EntityType(entity_type)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"Type d'entité invalide. Types valides: {[e.value for e in EntityType]}"
            )
    
    if action:
        try:
            action_enum = ActionType(action)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"Type d'action invalide. Types valides: {[e.value for e in ActionType]}"
            )
    
    return get_config_change_logs(
        db=db,
        user=current_user,
        entity_type=entity_type_enum,
        action=action_enum,
        skip=skip,
        limit=limit
    )
