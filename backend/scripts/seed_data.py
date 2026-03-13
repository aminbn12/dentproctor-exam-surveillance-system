# -*- coding: utf-8 -*-
import os
import sys
# Force UTF-8 output on Windows
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from datetime import datetime, timedelta
from uuid import uuid4

# Ajouter le répertoire parent au path pour importer les modules app
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal, engine
from app.models import (
    Base, User, Professor, Resident, Room, Exam, Assignment,
)
from app.utils.security import hash_password
from sqlalchemy import select

def create_test_data():
    """Crée les données de test dans la base de données"""
    
    # Créer les tables
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    
    try:
        # ===================== USERS =====================
        print("📝 Création des utilisateurs...")
        
        # Check if users already exist
        existing_users = db.query(User).count()
        if existing_users > 0:
            print(f"  {existing_users} utilisateurs deja existants, skip...")
        else:
            # Admin
            admin_user = User(
            username="admin",
            email="admin@dentproctor.tn",
            hashed_password=hash_password("admin123"),
            full_name="Administrateur",
            role="ADMIN",
            is_active=True
        )
        
        # Professeurs
        prof_users = []
        prof_names = [
            ("Dr. Ahmed Khalifa", "khalifa", "khalifa@univ.tn"),
            ("Pr. Fatima Ben Ali", "benali", "benali@univ.tn"),
            ("Dr. Mohamed Saïdi", "saidi", "saidi@univ.tn"),
        ]
        
        for name, username, email in prof_names:
            user = User(
                username=username,
                email=email,
                hashed_password=hash_password("prof123"),
                full_name=name,
                role="PROCTOR",
                staff_type="prof",
                is_active=True
            )
            prof_users.append(user)
        
        # Résidents
        resident_users = []
        resident_names = [
            ("Amine Chaari", "achaari", "achaari@univ.tn", 3),
            ("Zaineb Makhlouf", "zmakhlouf", "zmakhlouf@univ.tn", 2),
            ("Hedi Souissi", "hsouissi", "hsouissi@univ.tn", 1),
            ("Marwa Khaled", "mkhaled", "mkhaled@univ.tn", 4),
        ]
        
        for name, username, email, level in resident_names:
            user = User(
                username=username,
                email=email,
                hashed_password=hash_password("resident123"),
                full_name=name,
                role="PROCTOR",
                staff_type="resident",
                is_active=True
            )
            resident_users.append((user, level))
        
        all_users = [admin_user] + prof_users + [u for u, _ in resident_users]
        db.add_all(all_users)
        db.flush()  # Flush pour récupérer les IDs
        
        # ===================== PROFESSEURS =====================
        print("👨‍🏫 Création des professeurs...")
        professors = []
        ranks = ["Pr", "Dr", "Dr"]
        
        for user, rank in zip(prof_users, ranks):
            prof = Professor(
                user_id=user.id,
                name=user.full_name,
                rank=rank,
                responsible_promo="FM6MD1"
            )
            professors.append(prof)
        
        db.add_all(professors)
        db.flush()
        
        # ===================== RÉSIDENTS =====================
        print("👨‍🎓 Création des résidents...")
        residents = []
        
        for user, level in resident_users:
            resident = Resident(
                user_id=user.id,
                name=user.full_name,
                level=level,
                specialty="Dentisterie Conservatrice"
            )
            residents.append(resident)
        
        db.add_all(residents)
        db.flush()
        
        # ===================== SALLES =====================
        print("🏫 Création des salles...")
        rooms = []
        room_data = [
            ("Salle A1", 2, 3),
            ("Salle A2", 2, 3),
            ("Salle B1", 2, 2),
            ("Salle B2", 2, 2),
            ("Salle C1", 1, 4),
        ]
        
        for name, prof_cap, resident_cap in room_data:
            room = Room(
                name=name,
                prof_capacity=prof_cap,
                resident_capacity=resident_cap
            )
            rooms.append(room)
        
        db.add_all(rooms)
        db.flush()
        
        # ===================== EXAMENS =====================
        print("📋 Création des examens...")
        exams = []
        
        # Créer des examens pour les 5 prochains jours de la semaine
        today = datetime.now().replace(hour=8, minute=0, second=0, microsecond=0)
        
        exam_times = ["08:00", "10:00", "14:00", "16:00"]
        subjects = [
            "Dentisterie Conservatrice",
            "Parodontologie",
            "Prosthodontie",
            "Chirurgie Buccale"
        ]
        
        for day_offset in range(0, 5):  # 5 jours
            exam_date = (today + timedelta(days=day_offset)).strftime("%Y-%m-%d")
            
            # Skip weekends
            if datetime.strptime(exam_date, "%Y-%m-%d").weekday() >= 5:
                continue
            
            for time_idx, time_str in enumerate(exam_times):
                if day_offset == 4 and time_idx > 1:  # Limite les examens du vendredi
                    break
                
                exam = Exam(
                    date=exam_date,
                    time=time_str,
                    duration=120,
                    promo="FM6MD1",
                    subject=subjects[time_idx % len(subjects)]
                )
                exams.append(exam)
        
        db.add_all(exams)
        db.flush()
        
        # ===================== ASSIGNMENTS =====================
        print("📍 Création des assignments...")
        
        # Assigner les staff aux examens
        assignment_count = 0
        for exam in exams:
            # Ajouter 2-3 salles par examen
            selected_rooms = rooms[:3] if exam.date != exams[0].date else rooms[:2]
            
            for room in selected_rooms:
                assignment = Assignment(
                    exam_id=exam.id,
                    room_id=room.id
                )
                
                # Ajouter 1-2 professeurs
                selected_profs = professors[:2]
                for prof in selected_profs:
                    assignment.professors.append(prof)
                
                # Ajouter 2-3 résidents
                selected_residents = residents[:3]
                for resident in selected_residents:
                    assignment.residents.append(resident)
                
                db.add(assignment)
                assignment_count += 1
        
        # Commit toutes les données
        db.commit()
        
        # ===================== RÉSUMÉ =====================
        print("\n" + "="*50)
        print("✅ Données de test créées avec succès!")
        print("="*50)
        print(f"✓ {len(all_users)} utilisateurs")
        print(f"  - 1 administrateur")
        print(f"  - {len(prof_users)} professeurs")
        print(f"  - {len(resident_users)} résidents")
        print(f"✓ {len(professors)} professeurs")
        print(f"✓ {len(residents)} résidents")
        print(f"✓ {len(rooms)} salles")
        print(f"✓ {len(exams)} examens")
        print(f"✓ {assignment_count} assignments")
        
        print("\n" + "="*50)
        print("🔐 Utilisateurs de Test:")
        print("="*50)
        print("Admin:")
        print("  - Username: admin")
        print("  - Email: admin@dentproctor.tn")
        print("  - Password: admin123")
        print("\nProfesseurs:")
        for user, _ in zip(prof_users, ranks):
            print(f"  - Username: {user.username} | Password: prof123")
        print("\nRésidents:")
        for user, _ in resident_users:
            print(f"  - Username: {user.username} | Password: resident123")
        print("="*50 + "\n")
        
    except Exception as e:
        db.rollback()
        print(f"❌ Erreur lors de la création des données: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    create_test_data()
