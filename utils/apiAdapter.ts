// Adaptateurs pour convertir les données API backend au format frontend
import { Professor, Resident, Room, Exam, Assignment } from './types';

export interface BackendProfessor {
  id: string;
  name: string;
  rank: 'Pr' | 'Dr';
  responsible_promo?: string;
  user_id: string;
}

export interface BackendResident {
  id: string;
  name: string;
  level: number;
  specialty: string;
  user_id: string;
}

export interface BackendRoom {
  id: string;
  name: string;
  prof_capacity: number;
  resident_capacity: number;
}

export interface BackendExam {
  id: string;
  date: string;
  time: string;
  duration: number;
  promo: string;
  subject: string;
}

export interface BackendAssignment {
  id: string;
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
  responsiblePromo: backend.responsible_promo || '',
});

// Convertir les résidents du backend au format frontend
export const adaptResident = (backend: BackendResident): Resident => ({
  id: backend.id,
  name: backend.name,
  level: backend.level,
  specialty: backend.specialty,
});

// Convertir les salles du backend au format frontend
export const adaptRoom = (backend: BackendRoom): Room => ({
  id: backend.id,
  name: backend.name,
  capacity: backend.prof_capacity + backend.resident_capacity,
});

// Convertir les examens du backend au format frontend
export const adaptExam = (backend: BackendExam): Exam => ({
  id: backend.id,
  date: backend.date,
  time: backend.time,
  duration: backend.duration,
  promo: backend.promo,
  subject: backend.subject,
});

// Convertir les assignments du backend au format frontend
export const adaptAssignment = (
  backend: BackendAssignment,
  rooms: Map<string, Room>
): Assignment => ({
  id: backend.id,
  examId: backend.exam_id,
  roomId: backend.room_id,
  room: rooms.get(backend.room_id),
  profIds: backend.professors.map(p => p.id),
  residentIds: backend.residents.map(r => r.id),
});
