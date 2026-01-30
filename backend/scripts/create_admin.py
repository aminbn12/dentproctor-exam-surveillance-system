#!/usr/bin/env python
"""Script pour créer un utilisateur admin initial"""
import sys
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.user import User
from app.utils.security import hash_password

def create_admin():
    db = SessionLocal()
    try:
        # Vérifier si un admin existe déjà
        existing_admin = db.query(User).filter(User.role == 'ADMIN').first()
        if existing_admin:
            print("❌ Un administrateur existe déjà")
            return
        
        # Créer le premier admin
        admin = User(
            username="admin",
            email="admin@dentproctor.com",
            hashed_password=hash_password("admin123"),
            full_name="Administrateur",
            role="ADMIN",
            is_active=True
        )
        
        db.add(admin)
        db.commit()
        print("✅ Administrateur créé avec succès!")
        print("   Username: admin")
        print("   Password: admin123")
        print("   ⚠️  CHANGEZ CE MOT DE PASSE EN PRODUCTION!")
        
    except Exception as e:
        print(f"❌ Erreur: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    create_admin()
