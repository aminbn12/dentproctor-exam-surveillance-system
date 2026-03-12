export type Promo = "FM6MD1" | "FM6MD2" | "FM6MD3" | "FM6MD4" | "FM6MD5";
export type UserRole = "ADMIN" | "PROCTOR";

export interface UserSession {
  id: string;
  name: string;
  role: UserRole;
  type?: "prof" | "resident";
}

/**
 * Représente une période d'indisponibilité.
 * - Si startTime et endTime sont définis, c'est une indisponibilité horaire sur un seul jour.
 * - Sinon, c'est une journée entière d'indisponibilité.
 */
export interface Absence {
  date: string;        // format YYYY-MM-DD
  startTime?: string;  // format HH:MM (optionnel, pour une plage horaire)
  endTime?: string;    // format HH:MM (optionnel, pour une plage horaire)
}

export interface Professor {
  id: string;
  name: string;
  rank: "Pr" | "Dr";
  responsiblePromo?: Promo;
  subjects: string[];
  absences: Absence[];
}

export interface Resident {
  id: string;
  name: string;
  level: 1 | 2 | 3 | 4;
  specialty: string;
  absences: Absence[];
}

export interface Room {
  id: string;
  name: string;
  profCapacity: number;
  residentCapacity: number;
}

export interface Exam {
  id: string;
  date: string;
  time: string;
  duration: number;
  promo: Promo;
  subject: string;
  roomIds: string[];
}

export interface Assignment {
  id?: string; // ID du backend pour les opérations CRUD
  examId: string;
  roomId: string;
  profIds: string[];
  residentIds: string[];
}

export interface HistoryRecord {
  id: number;
  date_saved: string;
  period_name: string;
  exams_snapshot: Exam[];
  assignments_snapshot: Assignment[];
}

export type AppTab = "config" | "planning" | "stats" | "my-planning" | "history";
