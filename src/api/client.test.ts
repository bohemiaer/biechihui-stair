import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiClientError, fetchJson, resolveApiBaseUrl, resolveDataSource } from './client';

describe('api client', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('parses JSON responses from the configured API base URL', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    });
    vi.stubGlobal('fetch', fetchSpy);

    await expect(fetchJson('/api/home/summary')).resolves.toEqual({ ok: true });
    expect(fetchSpy).toHaveBeenCalledWith('http://127.0.0.1:8001/api/home/summary', expect.objectContaining({ headers: expect.any(Headers) }));
  });

  it('prefers the local backend URL when running inside the Tauri shell build', async () => {
    expect(
      resolveApiBaseUrl({
        configuredBaseUrl: '',
        isDev: false,
        isTauri: true,
      }),
    ).toBe('http://127.0.0.1:18001');
  });

  it('prefers the backend URL injected by the desktop shell over the default Tauri port', () => {
    expect(
      resolveApiBaseUrl({
        configuredBaseUrl: '',
        isDev: false,
        isTauri: true,
        desktopBaseUrl: 'http://127.0.0.1:28765',
      }),
    ).toBe('http://127.0.0.1:28765');
  });

  it('converts failed responses into ApiClientError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ message: 'Backend exploded' }),
      }),
    );

    await expect(fetchJson('/api/fail')).rejects.toBeInstanceOf(ApiClientError);
    await expect(fetchJson('/api/fail')).rejects.toMatchObject({
      status: 500,
      apiError: {
        message: 'Backend exploded',
        recoverable: true,
      },
    });
  });

  it('distinguishes request failures from backend outages', async () => {
    const fetchSpy = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/api/home/summary')) {
        throw new TypeError('Failed to fetch');
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
      };
    });

    vi.stubGlobal('fetch', fetchSpy);

    await expect(fetchJson('/api/home/summary')).rejects.toMatchObject({
      status: 0,
      apiError: {
        message: '本地后端在线，但当前请求没有成功完成。请重试；如果是在导入或生成内容，请检查模型配置、额度或网络状态。',
        recoverable: true,
      },
    });
  });

  it('resolves mock mode in tests unless VITE_USE_MOCK_API is explicitly false', () => {
    expect(resolveDataSource()).toBe('mock');

    vi.stubEnv('VITE_USE_MOCK_API', 'false');

    expect(resolveDataSource()).toBe('real');
  });

  it('allows explicit mock mode for offline development', () => {
    vi.stubEnv('VITE_USE_MOCK_API', 'true');

    expect(resolveDataSource()).toBe('mock');
  });
});
