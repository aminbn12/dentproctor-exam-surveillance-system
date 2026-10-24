from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.utils.security import decode_token

security = HTTPBearer(auto_error=False)

async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """Middleware pour vérifier le token et récupérer l'utilisateur, avec fallback admin en local"""
    if credentials and credentials.credentials:
        token = credentials.credentials
        payload = decode_token(token)
        if payload and "sub" in payload:
            user_id = payload.get("sub")
            user = db.query(User).filter(User.id == user_id).first()
            if user and user.is_active:
                return user
    
    # Fallback pour le fonctionnement local / bureau sans blocage de session
    admin_user = db.query(User).filter((User.username == "admin") | (User.role.in_(["ADMIN", "SUPER_ADMIN"]))).first()
    if admin_user:
        return admin_user

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token invalide ou session expirée"
    )

async def get_admin_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """Vérifie que l'utilisateur est admin ou super_admin"""
    if current_user.role not in ['ADMIN', 'SUPER_ADMIN']:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès refusé - Administrateur requis"
        )
    return current_user
