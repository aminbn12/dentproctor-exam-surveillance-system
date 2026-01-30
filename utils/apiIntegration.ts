// Utilitaires pour intégrer l'API backend avec localStorage
import { Professor, Resident, Room, Exam, Assignment } from './types';

export const syncWithBackend = async () => {
  const backendUrl = '';
  const apiUrl = '/api';

  try {
    // Vérifier la santé du backend
    const response = await fetch(`${backendUrl}/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(2000) // Timeout de 2 secondes
    });

    if (!response.ok) throw new Error('Backend indisponible');

    return {
      apiUrl,
      isBackendAvailable: true
    };
  } catch (error) {
    console.warn('Backend indisponible, utilisation de localStorage:', error);
    return {
      apiUrl,
      isBackendAvailable: false
    };
  }
};

export const getAuthToken = (): string | null => {
  return localStorage.getItem('access_token');
};

export const setAuthToken = (token: string) => {
  localStorage.setItem('access_token', token);
};

export const clearAuthToken = () => {
  localStorage.removeItem('access_token');
};

export const getFetchHeaders = (): HeadersInit => {
  const token = getAuthToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
};

export const handleApiError = (status: number, detail?: any) => {
  if (status === 401) {
    clearAuthToken();
    window.location.href = '/';
    throw new Error('Session expirée. Veuillez vous reconnecter.');
  }

  if (status === 403) {
    throw new Error('Accès refusé. Permissions insuffisantes.');
  }

  if (status === 400) {
    const message = typeof detail === 'string' ? detail : JSON.stringify(detail);
    throw new Error(`Erreur de validation: ${message}`);
  }

  throw new Error(`Erreur API (${status}): ${detail || 'Erreur inconnue'}`);
};
