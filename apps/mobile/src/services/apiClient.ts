import { secureStorage } from './secureStorage';
import { ENDPOINTS } from '../constants/endpoints';

const DEFAULT_API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.18.60:3000';

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export async function secureFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = await secureStorage.getAccessToken();
  const customRelayUrl = await secureStorage.getRelayUrl();
  const baseUrl = customRelayUrl || DEFAULT_API_URL;
  const url = endpoint.startsWith('http') ? endpoint : `${baseUrl}${endpoint}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      await secureStorage.clearTokens();
      throw new ApiError('Session expired. Please re-authenticate.', 401);
    }

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = await response.text();
      }
      throw new ApiError(
        errorData?.message || `HTTP ${response.status}: Request failed`,
        response.status,
        errorData
      );
    }

    if (response.status === 204) {
      return {} as T;
    }

    return await response.json();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      error instanceof Error ? error.message : 'Network connection failed',
      0
    );
  }
}
