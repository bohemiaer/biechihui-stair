import { describe, expect, it } from 'vitest';

import { formatServiceErrorMessage, getImportTaskFailureMessage } from './errors';

describe('errors helpers', () => {
  it('maps insufficient balance errors to a provider-specific message', () => {
    expect(
      formatServiceErrorMessage('embedding API failed: HTTP 403 {"code":30001,"message":"Sorry, your account balance is insufficient","data":null}'),
    ).toBe('模型服务调用失败：SiliconFlow 账户余额不足，请更新 API Key 或充值后重试。');
  });

  it('returns normalized import task errors for failed tasks', () => {
    expect(
      getImportTaskFailureMessage({
        status: 'failed',
        errorMessage: 'embedding API failed: HTTP 403 {"code":30001,"message":"Sorry, your account balance is insufficient","data":null}',
      }),
    ).toBe('模型服务调用失败：SiliconFlow 账户余额不足，请更新 API Key 或充值后重试。');
  });
});
