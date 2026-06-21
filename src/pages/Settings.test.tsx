import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useUiStore } from '../stores/uiStore';
import { Settings } from './Settings';

describe('Settings', () => {
  beforeEach(() => {
    useUiStore.getState().clearToast();
  });

  it('shows data source information and queues backup/export actions', async () => {
    render(<Settings />);

    expect(screen.getByText('API 与模型配置')).toBeInTheDocument();
    expect(
      await screen.findByText('先填写 SiliconFlow API Key，即可开始使用导入、摘要、搜索和问答。')
    ).toBeInTheDocument();
    expect(screen.getByText('Mock 数据')).toBeInTheDocument();
    expect(await screen.findByLabelText('Chat Model')).toHaveValue('deepseek-ai/DeepSeek-V4-Flash');
    expect(await screen.findAllByText('未登录')).toHaveLength(3);

    fireEvent.change(screen.getByLabelText('Embedding Model'), { target: { value: 'Qwen/Qwen3-Embedding-4B' } });
    fireEvent.click(screen.getByRole('button', { name: '保存配置' }));
    await waitFor(() => expect(useUiStore.getState().toastMessage).toBe('模型 API 配置已保存'));

    fireEvent.click(screen.getByRole('button', { name: '创建备份' }));
    expect(useUiStore.getState().toastMessage).toBe('备份任务已加入队列');

    fireEvent.click(screen.getByRole('button', { name: '导出数据' }));
    expect(useUiStore.getState().toastMessage).toBe('导出任务已加入队列');
  });

  it('starts feedgrab login from settings', async () => {
    render(<Settings />);

    fireEvent.click(await screen.findByRole('button', { name: '登录 X' }));

    await waitFor(() => expect(useUiStore.getState().toastMessage).toBe('已打开 X 登录窗口，请在浏览器完成授权'));
  });
});
