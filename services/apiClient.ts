// Service API pour communiquer avec le backend DentProctor

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

class ApiClient {
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem('auth_token');
  }

  setToken(token: string) {
    this.token = token;
    localStorage.setItem('auth_token', token);
  }

  getToken(): string | null {
    return this.token || localStorage.getItem('auth_token');
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('auth_token');
  }

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  private async request<T>(
    method: string,
    endpoint: string,
    body?: any
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;

    try {
      const response = await fetch(url, {
        method,
        headers: this.getHeaders(),
        body: body ? JSON.stringify(body) : undefined,
      });

      if (response.status === 401) {
        this.clearToken();
        throw new Error('Session expirée - Veuillez vous reconnecter');
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }

  // ============ AUTHENTICATION ============
  async login(username: string, password: string) {
    const response = await this.request('/auth/login', 'POST', {
      username,
      password,
    });
    if (response.access_token) {
      this.setToken(response.access_token);
    }
    return response;
  }

  async register(userData: any) {
    return this.request('/auth/register', 'POST', userData);
  }

  async logout() {
    this.clearToken();
  }

  // ============ PROFESSORS ============
  async getProfessors() {
    return this.request('/professors', 'GET');
  }

  async createProfessor(prof: any) {
    return this.request('/professors', 'POST', prof);
  }

  async updateProfessor(id: string, prof: any) {
    return this.request(`/professors/${id}`, 'PUT', prof);
  }

  async deleteProfessor(id: string) {
    return this.request(`/professors/${id}`, 'DELETE');
  }

  async addProfessorAbsence(id: string, date: string) {
    return this.request(`/professors/${id}/absences`, 'POST', { absence_date: date });
  }

  async removeProfessorAbsence(id: string, date: string) {
    return this.request(`/professors/${id}/absences/${date}`, 'DELETE');
  }

  // ============ RESIDENTS ============
  async getResidents() {
    return this.request('/residents', 'GET');
  }

  async createResident(resident: any) {
    return this.request('/residents', 'POST', resident);
  }

  async updateResident(id: string, resident: any) {
    return this.request(`/residents/${id}`, 'PUT', resident);
  }

  async deleteResident(id: string) {
    return this.request(`/residents/${id}`, 'DELETE');
  }

  // ============ ROOMS ============
  async getRooms() {
    return this.request('/rooms', 'GET');
  }

  async createRoom(room: any) {
    return this.request('/rooms', 'POST', room);
  }

  async updateRoom(id: string, room: any) {
    return this.request(`/rooms/${id}`, 'PUT', room);
  }

  async deleteRoom(id: string) {
    return this.request(`/rooms/${id}`, 'DELETE');
  }

  // ============ EXAMS ============
  async getExams() {
    return this.request('/exams', 'GET');
  }

  async createExam(exam: any) {
    return this.request('/exams', 'POST', exam);
  }

  async updateExam(id: string, exam: any) {
    return this.request(`/exams/${id}`, 'PUT', exam);
  }

  async deleteExam(id: string) {
    return this.request(`/exams/${id}`, 'DELETE');
  }

  // ============ ASSIGNMENTS ============
  async getAssignments() {
    return this.request('/assignments', 'GET');
  }

  async createAssignment(assignment: any) {
    return this.request('/assignments', 'POST', assignment);
  }

  async deleteAssignment(id: string) {
    return this.request(`/assignments/${id}`, 'DELETE');
  }

  // ============ UTILS ============
  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL.replace('/api', '')}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const apiClient = new ApiClient();
