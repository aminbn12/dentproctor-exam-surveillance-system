# -*- coding: utf-8 -*-
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel

from app.database import get_db
from app.models.user import User
from app.schemas.user import UserCreate, UserResponse
from app.middleware.auth import get_current_user
from app.utils.security import hash_password

router = APIRouter(prefix="/api/admin", tags=["admin"])


class AdminCreateRequest(BaseModel):
    """Request model for creating admin users"""
    username: str
    email: str
    password: str
    full_name: Optional[str] = None
    department: Optional[str] = None
    role: str = "ADMIN"  # Default to ADMIN, can be SUPER_ADMIN


class AdminUpdateRequest(BaseModel):
    """Request model for updating admin profiles"""
    email: Optional[str] = None
    full_name: Optional[str] = None
    department: Optional[str] = None
    is_active: Optional[bool] = None


@router.post("/users", response_model=UserResponse)
def create_admin_user(
    user_data: AdminCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Créer un nouvel utilisateur administrateur.
    Seul SUPER_ADMIN peut créer de nouveaux administrateurs.
    """
    # Vérifier que seul SUPER_ADMIN peut créer des utilisateurs
    if current_user.role != 'SUPER_ADMIN':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seul le SUPER_ADMIN peut créer des utilisateurs"
        )
    
    # Vérifier que le username n'existe pas déjà
    existing_user = db.query(User).filter(User.username == user_data.username).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Nom d'utilisateur déjà existant")
    
    # Vérifier que l'email n'existe pas déjà
    existing_email = db.query(User).filter(User.email == user_data.email).first()
    if existing_email:
        raise HTTPException(status_code=400, detail="Email déjà existant")
    
    # Créer le nouvel utilisateur
    hashed_password = hash_password(user_data.password)
    new_user = User(
        username=user_data.username,
        email=user_data.email,
        hashed_password=hashed_password,
        full_name=user_data.full_name,
        department=user_data.department,
        role=user_data.role,
        is_active=True
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return new_user


@router.get("/users", response_model=List[UserResponse])
def get_all_users(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Récupérer tous les utilisateurs.
    Seul SUPER_ADMIN peut voir tous les utilisateurs.
    """
    if current_user.role != 'SUPER_ADMIN':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seul le SUPER_ADMIN peut voir tous les utilisateurs"
        )
    
    users = db.query(User).order_by(User.created_at.desc()).all()
    return users


@router.get("/users/me", response_model=UserResponse)
def get_current_user_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Récupérer le profil de l'utilisateur actuel.
    Accessible par tous les utilisateurs connectés.
    """
    return current_user


@router.put("/users/me", response_model=UserResponse)
def update_current_user_profile(
    user_data: AdminUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Mettre à jour le profil de l'utilisateur actuel.
    Accessible par tous les utilisateurs connectés.
    """
    # Mettre à jour les champs fournis
    if user_data.email is not None:
        # Vérifier que le nouvel email n'est pas déjà utilisé par un autre utilisateur
        existing = db.query(User).filter(
            User.email == user_data.email,
            User.id != current_user.id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email déjà utilisé par un autre utilisateur")
        current_user.email = user_data.email
    
    if user_data.full_name is not None:
        current_user.full_name = user_data.full_name
    
    if user_data.department is not None:
        current_user.department = user_data.department
    
    if user_data.is_active is not None:
        current_user.is_active = user_data.is_active
    
    db.commit()
    db.refresh(current_user)
    return current_user


@router.put("/users/{user_id}", response_model=UserResponse)
def update_user_by_id(
    user_id: str,
    user_data: AdminUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Mettre à jour un utilisateur par ID.
    Seul SUPER_ADMIN peut modifier d'autres utilisateurs.
    """
    if current_user.role != 'SUPER_ADMIN':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seul le SUPER_ADMIN peut modifier d'autres utilisateurs"
        )
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
    
    # Mettre à jour les champs fournis
    if user_data.email is not None:
        # Vérifier que le nouvel email n'est pas déjà utilisé
        existing = db.query(User).filter(
            User.email == user_data.email,
            User.id != user_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email déjà utilisé par un autre utilisateur")
        user.email = user_data.email
    
    if user_data.full_name is not None:
        user.full_name = user_data.full_name
    
    if user_data.department is not None:
        user.department = user_data.department
    
    if user_data.is_active is not None:
        user.is_active = user_data.is_active
    
    db.commit()
    db.refresh(user)
    return user


@router.delete("/users/{user_id}")
def delete_user(
    user_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Supprimer un utilisateur par ID.
    Seul SUPER_ADMIN peut supprimer des utilisateurs.
    """
    if current_user.role != 'SUPER_ADMIN':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seul le SUPER_ADMIN peut supprimer des utilisateurs"
        )
    
    # Empêcher la suppression de soi-même
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Vous ne pouvez pas vous supprimer vous-même")
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
    
    db.delete(user)
    db.commit()
    return {"message": "Utilisateur supprimé avec succès"}


@router.post("/users/{user_id}/reset-password")
def reset_user_password(
    user_id: str,
    new_password: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Réinitialiser le mot de passe d'un utilisateur.
    Seul SUPER_ADMIN peut réinitialiser les mots de passe.
    """
    if current_user.role != 'SUPER_ADMIN':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seul le SUPER_ADMIN peut réinitialiser les mots de passe"
        )
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
    
    user.hashed_password = hash_password(new_password)
    db.commit()
    return {"message": "Mot de passe réinitialisé avec succès"}
