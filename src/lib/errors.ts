import { ApiClientError } from '../api/client';
import type { ImportTask } from '../types';

export function formatServiceErrorMessage(message: string, fallback = '请求失败，请稍后重试。') {
  const normalized = message.trim();
  const lowerCaseMessage = normalized.toLowerCase();

  if (!normalized) {
    return fallback;
  }

  if (lowerCaseMessage.includes('insufficient') || lowerCaseMessage.includes('account balance is insufficient')) {
    return '模型服务调用失败：SiliconFlow 账户余额不足，请更新 API Key 或充值后重试。';
  }

  if (
    lowerCaseMessage.includes('failed to fetch')
    || lowerCaseMessage.includes('connection refused')
    || lowerCaseMessage.includes('econnrefused')
  ) {
    return '无法连接本地后端，请确认桌面应用仍在运行，然后重试。';
  }

  return normalized;
}

export function getErrorMessage(error: unknown, fallback = '请求失败，请稍后重试。') {
  if (error instanceof ApiClientError) {
    return formatServiceErrorMessage(error.apiError.message, fallback);
  }

  if (error instanceof Error && error.message) {
    return formatServiceErrorMessage(error.message, fallback);
  }

  return fallback;
}

export function getRecoverableError(error: unknown) {
  if (error instanceof ApiClientError) {
    return error.apiError.recoverable;
  }

  return true;
}

export function getImportTaskFailureMessage(task: Pick<ImportTask, 'errorMessage' | 'status'>) {
  if (task.status !== 'failed') {
    return '';
  }

  return formatServiceErrorMessage(task.errorMessage || '', '导入失败，请稍后重试。');
}
