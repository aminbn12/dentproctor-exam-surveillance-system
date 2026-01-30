import { useState, useCallback } from 'react';
import { getFetchHeaders, handleApiError } from '../utils/apiIntegration';

interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export function useApi<T>() {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const fetch = useCallback(
    async (url: string, options: RequestInit = {}) => {
      setState({ data: null, loading: true, error: null });
      
      try {
        const response = await window.fetch(url, {
          ...options,
          headers: {
            ...getFetchHeaders(),
            ...(options.headers as HeadersInit),
          },
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          handleApiError(response.status, error.detail);
        }

        const data = await response.json();
        setState({ data: data as T, loading: false, error: null });
        return data as T;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
        setState({ data: null, loading: false, error: errorMessage });
        throw error;
      }
    },
    []
  );

  return { ...state, fetch };
}
