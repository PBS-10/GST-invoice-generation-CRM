import { getApiBaseUrl } from './config';
import {
  AuthExpiredError,
  DeviceRevokedError,
  NetworkError,
  ServerError,
} from './errors';
import { clearTokens, getAccessToken, getRefreshToken, saveTokens } from './tokenStore';

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  auth?: boolean;
  deviceId?: string;
};

let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(deviceId: string): Promise<boolean> {
  if (refreshPromise) {
    return refreshPromise;
  }
  refreshPromise = (async () => {
    const refreshToken = await getRefreshToken();
    const base = getApiBaseUrl();
    if (!refreshToken || !base) {
      return false;
    }
    try {
      const response = await fetchWithTimeout(`${base}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken, deviceId }),
      });
      if (!response.ok) {
        await clearTokens();
        return false;
      }
      const json = (await response.json()) as {
        accessToken: string;
        refreshToken: string;
      };
      await saveTokens(json.accessToken, json.refreshToken);
      return true;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 15_000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new NetworkError('Request timed out');
    }
    throw new NetworkError();
  } finally {
    clearTimeout(timer);
  }
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const base = getApiBaseUrl();
  if (!base) {
    throw new NetworkError('Cloud backup is not configured');
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (options.auth !== false) {
    const token = await getAccessToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  const doFetch = () =>
    fetchWithTimeout(`${base}${path}`, {
      method: options.method ?? (options.body !== undefined ? 'POST' : 'GET'),
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

  let response = await doFetch();
  if (response.status === 401 && options.auth !== false && options.deviceId) {
    const refreshed = await refreshAccessToken(options.deviceId);
    if (!refreshed) {
      throw new AuthExpiredError();
    }
    const token = await getAccessToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    response = await doFetch();
  }

  if (response.status === 401) {
    const body = await safeJson(response);
    if (body?.code === 'DEVICE_REVOKED') {
      await clearTokens();
      throw new DeviceRevokedError(String(body.message ?? 'This device was signed out'));
    }
    throw new AuthExpiredError();
  }

  if (!response.ok) {
    const body = await safeJson(response);
    throw new ServerError(
      String(body?.message ?? `Request failed (${response.status})`),
      response.status,
      typeof body?.code === 'string' ? body.code : undefined,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

async function safeJson(response: Response): Promise<{ message?: string; code?: string } | null> {
  try {
    return (await response.json()) as { message?: string; code?: string };
  } catch {
    return null;
  }
}
