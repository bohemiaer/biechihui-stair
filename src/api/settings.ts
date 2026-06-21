import { fetchJson, resolveDataSource } from './client';

export interface RuntimeConfigStatus {
  chatConfigured: boolean;
  embeddingConfigured: boolean;
  rerankConfigured: boolean;
  siliconflowConfigured: boolean;
  siliconflowBaseUrl: string;
  chatBaseUrl: string;
  chatModel: string;
  embeddingBaseUrl: string;
  embeddingModel: string;
  rerankApiUrl: string;
  rerankModel: string;
  useLancedb: boolean;
  configPath: string;
}

export type RuntimeConfigUpdate = Partial<{
  siliconflowApiKey: string;
  siliconflowBaseUrl: string;
  chatApiKey: string;
  chatBaseUrl: string;
  chatModel: string;
  embeddingApiKey: string;
  embeddingBaseUrl: string;
  embeddingModel: string;
  rerankApiKey: string;
  rerankApiUrl: string;
  rerankModel: string;
  useLancedb: boolean;
}>;

export type FeedgrabLoginPlatform = 'x' | 'xhs' | 'wechat';

export interface FeedgrabLoginResponse {
  platform: string;
  pid: number;
}

export type FeedgrabLoginState = 'logged_in' | 'missing' | 'invalid' | 'stale';

export interface FeedgrabPlatformStatus {
  label: string;
  loggedIn: boolean;
  state: FeedgrabLoginState;
  message: string;
  sessionPath: string;
  updatedAt: string;
  ageHours: number | null;
  missingCookies: string[];
}

export interface FeedgrabLoginStatusResponse {
  sessionDir: string;
  platforms: Record<FeedgrabLoginPlatform, FeedgrabPlatformStatus>;
}

const mockRuntimeConfig: RuntimeConfigStatus = {
  chatConfigured: false,
  embeddingConfigured: false,
  rerankConfigured: false,
  siliconflowConfigured: false,
  siliconflowBaseUrl: 'https://api.siliconflow.cn/v1',
  chatBaseUrl: 'https://api.siliconflow.cn/v1',
  chatModel: 'deepseek-ai/DeepSeek-V4-Flash',
  embeddingBaseUrl: 'https://api.siliconflow.cn/v1',
  embeddingModel: 'Qwen/Qwen3-Embedding-0.6B',
  rerankApiUrl: '',
  rerankModel: '',
  useLancedb: false,
  configPath: 'backend/data/runtime_config.json',
};

const mockFeedgrabLoginStatus: FeedgrabLoginStatusResponse = {
  sessionDir: 'sessions',
  platforms: {
    x: {
      label: 'X',
      loggedIn: false,
      state: 'missing',
      message: '未检测到登录态',
      sessionPath: 'sessions/twitter.json',
      updatedAt: '',
      ageHours: null,
      missingCookies: ['auth_token', 'ct0'],
    },
    xhs: {
      label: '小红书',
      loggedIn: false,
      state: 'missing',
      message: '未检测到登录态',
      sessionPath: 'sessions/xhs.json',
      updatedAt: '',
      ageHours: null,
      missingCookies: ['a1'],
    },
    wechat: {
      label: '微信',
      loggedIn: false,
      state: 'missing',
      message: '未检测到登录态',
      sessionPath: 'sessions/wechat.json',
      updatedAt: '',
      ageHours: null,
      missingCookies: ['slave_sid', 'data_ticket'],
    },
  },
};

export async function getRuntimeConfig(): Promise<RuntimeConfigStatus> {
  if (resolveDataSource() === 'mock') return mockRuntimeConfig;

  return fetchJson<RuntimeConfigStatus>('/api/settings/runtime');
}

export async function updateRuntimeConfig(input: RuntimeConfigUpdate): Promise<RuntimeConfigStatus> {
  if (resolveDataSource() === 'mock') return { ...mockRuntimeConfig, ...input };

  return fetchJson<RuntimeConfigStatus>('/api/settings/runtime', {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export async function startFeedgrabLogin(platform: FeedgrabLoginPlatform): Promise<FeedgrabLoginResponse> {
  if (resolveDataSource() === 'mock') return { platform, pid: 1 };

  return fetchJson<FeedgrabLoginResponse>('/api/settings/feedgrab/login', {
    method: 'POST',
    body: JSON.stringify({ platform }),
  });
}

export async function getFeedgrabLoginStatus(): Promise<FeedgrabLoginStatusResponse> {
  if (resolveDataSource() === 'mock') return mockFeedgrabLoginStatus;

  return fetchJson<FeedgrabLoginStatusResponse>('/api/settings/feedgrab/status');
}
