// Adaptateurs pour convertir les données API backend au format frontend
import { Professor, Resident, Room, Exam, Assignment, Promo } from "../types";

export interface BackendProfessor {
  id: string;
  name: string;
  rank: "Pr" | "Dr";
  responsible_promo?: string;
  mandatory_promo_presence?: boolean | number;
  room_alternation?: boolean | number;
  subjects?: string[];
  user_id?: string;
}

export interface BackendResident {
  id: string;
  name: string;
  level: number;
  specialty: string;
  user_id?: string;
}

export interface BackendRoom {
  id: string;
  name: string;
  prof_capacity: number;
  resident_capacity: number;
  proctor_capacity?: number;
  is_active?: number | boolean;
  admin_capacity?: number;
  it_capacity?: number;
  zone_leader_capacity?: number;
}

export interface BackendExam {
  id: string;
  date: string;
  time: string;
  duration: number;
  promo: string;
  subject: string;
  room_ids?: string[];
}

export interface BackendAssignment {
  id?: string;
  exam_id: string;
  room_id: string;
  professors: BackendProfessor[];
  residents: BackendResident[];
}

// Convertir les professeurs du backend au format frontend
export const adaptProfessor = (backend: BackendProfessor): Professor => ({
  id: backend.id,
  name: backend.name,
  rank: backend.rank,
  responsiblePromo: (backend.responsible_promo as Promo) || undefined,
  mandatoryPromoPresence:
    backend.mandatory_promo_presence !== undefined
      ? backend.mandatory_promo_presence === true ||
        (backend.mandatory_promo_presence as any) === 1
      : true,
  roomAlternation:
    backend.room_alternation !== undefined
      ? backend.room_alternation === true ||
        (backend.room_alternation as any) === 1
      : true,
  subjects: backend.subjects || [],
  absences: [],
});

// Convertir les résidents du backend au format frontend
export const adaptResident = (backend: BackendResident): Resident => ({
  id: backend.id,
  name: backend.name,
  level: ((backend.level >= 1 && backend.level <= 4) ? backend.level : 1) as 1 | 2 | 3 | 4,
  specialty: backend.specialty,
  absences: [],
});

// Convertir les salles du backend au format frontend
export const adaptRoom = (backend: BackendRoom): Room => {
  const isActive =
    backend.is_active === undefined
      ? true
      : backend.is_active === 1 || backend.is_active === true;
  const adminCap = backend.admin_capacity ?? (backend.proctor_capacity ?? 1);
  const itCap = backend.it_capacity ?? 0;
  const zoneCap = backend.zone_leader_capacity ?? 0;
  const totalProctor = backend.proctor_capacity ?? (adminCap + itCap + zoneCap);

  return {
    id: backend.id,
    name: backend.name,
    profCapacity: backend.prof_capacity,
    residentCapacity: backend.resident_capacity,
    proctorCapacity: totalProctor,
    isActive,
    adminCapacity: adminCap,
    itCapacity: itCap,
    zoneLeaderCapacity: zoneCap,
  };
};

// Convertir les examens du backend au format frontend
export const adaptExam = (backend: BackendExam): Exam => ({
  id: backend.id,
  date: backend.date,
  time: backend.time,
  duration: backend.duration,
  promo: backend.promo as Promo,
  subject: backend.subject,
  roomIds: backend.room_ids || [],
});

// Convertir les assignments du backend au format frontend
export const adaptAssignment = (
  backend: BackendAssignment,
  _rooms?: Map<string, Room>,
): Assignment => ({
  id: backend.id,
  examId: backend.exam_id,
  roomId: backend.room_id,
  profIds: backend.professors.map((p) => p.id),
  residentIds: backend.residents.map((r) => r.id),
});
