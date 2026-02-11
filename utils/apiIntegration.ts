// Utilitaires pour intégrer l'API backend avec localStorage
import { Professor, Resident, Room, Exam, Assignment } from "./types";

export const syncWithBackend = async () => {
  // Utiliser une URL relative pour profiter du proxy Vite en développement
  const apiUrl = "/api";

  try {
    // Vérifier la santé du backend via le proxy (/health sera redirigé vers http://127.0.0.1:8000/health par Vite)
    const response = await fetch(`/health`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(2000), // Timeout de 2 secondes
    });

    if (!response.ok) throw new Error("Backend indisponible");

    return {
      apiUrl,
      isBackendAvailable: true,
    };
  } catch (error) {
    console.warn("Backend indisponible, utilisation de localStorage:", error);
    return {
      apiUrl,
      isBackendAvailable: false,
    };
  }
};

export const getAuthToken = (): string | null => {
  return localStorage.getItem("access_token");
};

export const setAuthToken = (token: string) => {
  localStorage.setItem("access_token", token);
};

export const clearAuthToken = () => {
  localStorage.removeItem("access_token");
};

export const getFetchHeaders = (): HeadersInit => {
  const token = getAuthToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  return headers;
};

export const handleApiError = (status: number, detail?: any) => {
  if (status === 401) {
    clearAuthToken();
    window.location.href = "/";
    throw new Error("Session expirée. Veuillez vous reconnecter.");
  }

  if (status === 403) {
    throw new Error("Accès refusé. Permissions insuffisantes.");
  }

  if (status === 400) {
    const message =
      typeof detail === "string" ? detail : JSON.stringify(detail);
    throw new Error(`Erreur de validation: ${message}`);
  }

  throw new Error(`Erreur API (${status}): ${detail || "Erreur inconnue"}`);
};

// --- API client CRUD helpers ---
const API_BASE = "/api";

const safeFetch = async (input: RequestInfo, init?: RequestInit) => {
  try {
    const res = await fetch(input, init);
    if (!res.ok) {
      const detail = await res.text();
      handleApiError(res.status, detail);
    }
    return res.json();
  } catch (err) {
    throw err;
  }
};

export const createProfessor = async (prof: Partial<Professor>) => {
  const payload = {
    name: prof.name,
    rank: prof.rank,
    responsible_promo: (prof as any).responsiblePromo || null,
  };
  const headers = getFetchHeaders();
  return safeFetch(`${API_BASE}/professors`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
};

export const updateProfessorApi = async (
  id: string,
  data: Partial<Professor>,
) => {
  const payload: any = {};
  if (data.name !== undefined) payload.name = data.name;
  if (data.rank !== undefined) payload.rank = data.rank;
  if ((data as any).responsiblePromo !== undefined)
    payload.responsible_promo = (data as any).responsiblePromo;
  const headers = getFetchHeaders();
  return safeFetch(`${API_BASE}/professors/${id}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(payload),
  });
};

export const deleteProfessorApi = async (id: string) => {
  const headers = getFetchHeaders();
  return safeFetch(`${API_BASE}/professors/${id}`, {
    method: "DELETE",
    headers,
  });
};

export const createResident = async (res: Partial<Resident>) => {
  const payload = {
    name: res.name,
    level: res.level,
    specialty: res.specialty,
  };
  const headers = getFetchHeaders();
  return safeFetch(`${API_BASE}/residents`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
};

export const updateResidentApi = async (
  id: string,
  data: Partial<Resident>,
) => {
  const payload: any = {};
  if (data.name !== undefined) payload.name = data.name;
  if (data.level !== undefined) payload.level = data.level;
  if (data.specialty !== undefined) payload.specialty = data.specialty;
  const headers = getFetchHeaders();
  return safeFetch(`${API_BASE}/residents/${id}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(payload),
  });
};

export const deleteResidentApi = async (id: string) => {
  const headers = getFetchHeaders();
  return safeFetch(`${API_BASE}/residents/${id}`, {
    method: "DELETE",
    headers,
  });
};

export const createRoomApi = async (room: Partial<Room>) => {
  const payload = {
    name: room.name,
    prof_capacity: (room as any).profCapacity,
    resident_capacity: (room as any).residentCapacity,
  };
  const headers = getFetchHeaders();
  return safeFetch(`${API_BASE}/rooms`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
};

export const updateRoomApi = async (id: string, data: Partial<Room>) => {
  const payload: any = {};
  if (data.name !== undefined) payload.name = data.name;
  if ((data as any).profCapacity !== undefined)
    payload.prof_capacity = (data as any).profCapacity;
  if ((data as any).residentCapacity !== undefined)
    payload.resident_capacity = (data as any).residentCapacity;
  const headers = getFetchHeaders();
  return safeFetch(`${API_BASE}/rooms/${id}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(payload),
  });
};

export const deleteRoomApi = async (id: string) => {
  const headers = getFetchHeaders();
  return safeFetch(`${API_BASE}/rooms/${id}`, { method: "DELETE", headers });
};

export const createExamApi = async (exam: Partial<Exam>) => {
  const payload = {
    date: exam.date,
    time: exam.time,
    duration: exam.duration,
    promo: (exam as any).promo,
    subject: exam.subject,
    room_ids: exam.roomIds || [],
  };
  const headers = getFetchHeaders();
  return safeFetch(`${API_BASE}/exams`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
};

export const updateExamApi = async (id: string, data: Partial<Exam>) => {
  const payload: any = {};
  if (data.date !== undefined) payload.date = data.date;
  if (data.time !== undefined) payload.time = data.time;
  if (data.duration !== undefined) payload.duration = data.duration;
  if (data.subject !== undefined) payload.subject = data.subject;
  const headers = getFetchHeaders();
  return safeFetch(`${API_BASE}/exams/${id}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(payload),
  });
};

export const deleteExamApi = async (id: string) => {
  const headers = getFetchHeaders();
  return safeFetch(`${API_BASE}/exams/${id}`, { method: "DELETE", headers });
};

export const createAssignmentApi = async (assignment: Partial<Assignment>) => {
  const payload = {
    exam_id: assignment.examId,
    room_id: assignment.roomId,
    prof_ids: assignment.profIds || [],
    resident_ids: assignment.residentIds || [],
  };
  const headers = getFetchHeaders();
  return safeFetch(`${API_BASE}/assignments`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
};

export const deleteAssignmentApi = async (id: string) => {
  const headers = getFetchHeaders();
  return safeFetch(`${API_BASE}/assignments/${id}`, {
    method: "DELETE",
    headers,
  });
};
