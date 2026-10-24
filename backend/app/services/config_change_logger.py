"""
Service de journalisation des modifications de configuration
"""
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any
from datetime import datetime, date

from app.models.config_change_log import ConfigChangeLog, EntityType, ActionType
from app.models.user import User

def _sanitize_for_json(data: Any) -> Any:
    if data is None:
        return None
    if isinstance(data, dict):
        return {k: _sanitize_for_json(v) for k, v in data.items()}
    elif isinstance(data, (list, tuple, set)):
        return [_sanitize_for_json(v) for v in data]
    elif isinstance(data, (datetime, date)):
        return data.isoformat()
    return data

def log_config_change(
    db: Session,
    user: User,
    entity_type: EntityType,
    entity_id: str,
    action: ActionType,
    old_value: Optional[Dict[str, Any]] = None,
    new_value: Optional[Dict[str, Any]] = None,
    entity_name: Optional[str] = None,
    change_summary: Optional[str] = None
) -> Optional[ConfigChangeLog]:
    """
    Enregistre une modification de configuration.
    """
    try:
        clean_old = _sanitize_for_json(old_value)
        clean_new = _sanitize_for_json(new_value)

        # Générer un résumé automatique si non fourni
        if change_summary is None:
            change_summary = _generate_change_summary(entity_type, action, clean_old, clean_new, entity_name)
        
        # Obtenir le nom de l'utilisateur
        user_name = user.full_name or user.username
        
        log_entry = ConfigChangeLog(
            user_id=user.id,
            user_name=user_name,
            entity_type=entity_type,
            entity_id=entity_id,
            entity_name=entity_name,
            action=action,
            old_value=clean_old,
            new_value=clean_new,
            change_summary=change_summary,
            timestamp=datetime.utcnow()
        )
        
        db.add(log_entry)
        db.commit()
        db.refresh(log_entry)
        return log_entry
    except Exception as e:
        print(f"Warning: log_config_change failed: {e}")
        return None


def _generate_change_summary(
    entity_type: EntityType,
    action: ActionType,
    old_value: Optional[Dict[str, Any]],
    new_value: Optional[Dict[str, Any]],
    entity_name: Optional[str]
) -> str:
    """Génère un résumé automatique des changements"""
    
    entity_label = {
        EntityType.PROFESSOR: "Professeur",
        EntityType.RESIDENT: "Résident",
        EntityType.ROOM: "Salle"
    }.get(entity_type, "Entité")
    
    action_label = {
        ActionType.CREATE: "création",
        ActionType.UPDATE: "modification",
        ActionType.DELETE: "suppression"
    }.get(action, "action")
    
    name = entity_name or entity_id
    
    if action == ActionType.CREATE:
        return f"{entity_label} '{name}' créé"
    elif action == ActionType.DELETE:
        return f"{entity_label} '{name}' supprimé"
    else:  # UPDATE
        if old_value and new_value:
            changed_fields = []
            for key in new_value:
                if key in old_value and old_value[key] != new_value[key]:
                    changed_fields.append(key)
            if changed_fields:
                return f"{entity_label} '{name}' modifié: {', '.join(changed_fields)}"
        return f"{entity_label} '{name}' modifié"


def get_config_change_logs(
    db: Session,
    user: User,
    entity_type: Optional[EntityType] = None,
    action: Optional[ActionType] = None,
    skip: int = 0,
    limit: int = 100
):
    """
    Récupère les logs de modification de configuration.
    
    - SUPER_ADMIN voit tous les logs
    - ADMIN voit uniquement ses propres logs
    """
    query = db.query(ConfigChangeLog)
    
    if user.role != 'SUPER_ADMIN':
        # Les admins normaux ne voient que leurs propres modifications
        query = query.filter(ConfigChangeLog.user_id == user.id)
    
    if entity_type:
        query = query.filter(ConfigChangeLog.entity_type == entity_type)
    
    if action:
        query = query.filter(ConfigChangeLog.action == action)
    
    return query.order_by(ConfigChangeLog.timestamp.desc()).offset(skip).limit(limit).all()
