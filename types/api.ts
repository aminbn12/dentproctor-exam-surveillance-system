// Types pour les réponses API

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: {
    id: string;
    username: string;
    email: string;
    full_name: string;
    role: "ADMIN" | "PROCTOR" | "SUPER_ADMIN";
    staff_type?: "prof" | "resident";
    department?: string;
  };
}

export interface ApiError {
  detail: string | { [key: string]: string[] };
}

export interface HealthResponse {
  status: string;
  message: string;
}
