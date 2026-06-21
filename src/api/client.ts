import type { ApiError } from '../types';

type ApiBaseUrlOptions = {
  configuredBaseUrl?: string;
  isDev: boolean;
  isTauri: boolean;
  desktopBaseUrl?: string;
};

const detectTauriRuntime = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
const DEV_API_BASE_URL = 'http://127.0.0.1:8001';
const DESKTOP_API_BASE_URL = 'http://127.0.0.1:18001';
const HEALTHCHECK_TIMEOUT_MS = 1500;

function detectDesktopApiBaseUrl() {
  if (typeof window === 'undefined') {
    return '';
  }

  return window.__BIECHIHUI_API_BASE__ || '';
}

export function resolveApiBaseUrl(options: ApiBaseUrlOptions): string {
  if (options.configuredBaseUrl) {
    return options.configuredBaseUrl;
  }

  if (options.desktopBaseUrl) {
    return options.desktopBaseUrl;
  }

  if (options.isTauri) {
    return DESKTOP_API_BASE_URL;
  }

  if (options.isDev) {
    return DEV_API_BASE_URL;
  }

  return '';
}

export const apiBaseUrl = resolveApiBaseUrl({
  configuredBaseUrl: import.meta.env.VITE_API_BASE_URL,
  desktopBaseUrl: detectDesktopApiBaseUrl(),
  isDev: import.meta.env.DEV,
  isTauri: detectTauriRuntime(),
});

export type DataSourceMode = 'mock' | 'real';

export class ApiClientError extends Error {
  status: number;
  apiError: ApiError;

  constructor(status: number, apiError: ApiError) {
    super(apiError.message);
    this.name = 'ApiClientError';
    this.status = status;
    this.apiError = apiError;
  }
}

export function resolveDataSource(): DataSourceMode {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') return 'mock';
  if (import.meta.env.VITE_USE_MOCK_API === 'false') return 'real';
  if (import.meta.env.MODE === 'test') return 'mock';

  return 'real';
}

const buildUrl = (path: string) => {
  if (/^https?:\/\//.test(path)) {
    return path;
  }

  return `${apiBaseUrl}${path}`;
};

export function resolveAssetUrl(path: string) {
  if (!path) {
    return '';
  }
  if (/^https?:\/\//.test(path)) {
    return path;
  }
  return buildUrl(`/api/assets/${path}`);
}

async function probeBackendHealth() {
  if (!apiBaseUrl) {
    return false;
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), HEALTHCHECK_TIMEOUT_MS);

  try {
    const response = await fetch(`${apiBaseUrl}/health`, {
      method: 'GET',
      signal: controller.signal,
    });

    return response.ok;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timeout);
  }
}

const toApiError = (status: number, payload: unknown): ApiError => {
  const detail = payload && typeof payload === 'object' && 'detail' in payload ? payload.detail : null;
  const message =
    payload && typeof payload === 'object' && 'message' in payload && typeof payload.message === 'string'
      ? payload.message
      : detail && typeof detail === 'object' && 'message' in detail && typeof detail.message === 'string'
        ? detail.message
      : '请求失败，请稍后重试。';

  return {
    type: status >= 500 ? 'network' : 'unknown',
    message,
    recoverable: true,
    context: { status, payload },
  };
};

export async function fetchJson<TResponse>(path: string, init: RequestInit = {}): Promise<TResponse> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');

  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let response: Response;

  try {
    response = await fetch(buildUrl(path), {
      ...init,
      headers,
    });
  } catch (error) {
    const backendHealthy = await probeBackendHealth();

    throw new ApiClientError(0, {
      type: 'network',
      message: backendHealthy
        ? '本地后端在线，但当前请求没有成功完成。请重试；如果是在导入或生成内容，请检查模型配置、额度或网络状态。'
        : '无法连接本地后端，请确认桌面应用仍在运行，然后重试。',
      recoverable: true,
      context: {
        path,
        cause: error instanceof Error ? error.message : String(error),
        backendHealthy,
      },
    });
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiClientError(response.status, toApiError(response.status, payload));
  }

  return payload as TResponse;
}
