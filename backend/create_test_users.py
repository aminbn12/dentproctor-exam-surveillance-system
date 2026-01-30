#!/usr/bin/env python3
import sys
sys.path.insert(0, '.')

from app.database import SessionLocal, engine
from app.models.base import Base
from app.models.user import User
from app.utils.security import hash_password
from uuid import uuid4

# Créer les tables
Base.metadata.create_all(bind=engine)

# Créer une session
db = SessionLocal()

try:
    # Vérifier si les users existent déjà
    existing_count = db.query(User).count()
    
    if existing_count == 0:
        # Créer admin
        admin = User(
            id=str(uuid4()),
            username='admin',
            email='admin@dentproctor.local',
            hashed_password=hash_password('admin123'),
            full_name='Administrateur',
            role='ADMIN',
            staff_type='prof',
            is_active=True
        )
        db.add(admin)
        
        # Créer prof khalifa
        prof = User(
            id=str(uuid4()),
            username='khalifa',
            email='khalifa@dentproctor.local',
            hashed_password=hash_password('prof123'),
            full_name='Prof Khalifa',
            role='PROCTOR',
            staff_type='prof',
            is_active=True
        )
        db.add(prof)
        
        # Créer resident achaari
        resident = User(
            id=str(uuid4()),
            username='achaari',
            email='achaari@dentproctor.local',
            hashed_password=hash_password('resident123'),
            full_name='Achaari',
            role='PROCTOR',
            staff_type='resident',
            is_active=True
        )
        db.add(resident)
        
        db.commit()
        print('✅ Utilisateurs de test créés avec succès!')
        print('  - admin / admin123')
        print('  - khalifa / prof123')
        print('  - achaari / resident123')
    else:
        print(f'✅ {existing_count} utilisateurs existent déjà')

finally:
    db.close()
