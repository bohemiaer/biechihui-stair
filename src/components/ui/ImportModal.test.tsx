import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as importsApi from '../../api/imports';
import { getRecentImportTasks, resetMockSource } from '../../api/mockSource';
import { useUiStore } from '../../stores/uiStore';
import { ImportModal } from './ImportModal';
import { ToastViewport } from './ToastViewport';

const renderModal = (onClose = vi.fn()) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <ImportModal onClose={onClose} />
    </QueryClientProvider>,
  );

  return { onClose };
};

describe('ImportModal', () => {
  beforeEach(() => {
    resetMockSource();
    useUiStore.getState().clearToast();
  });

  it('defaults to uncategorized and validates URL before submit', async () => {
    renderModal();

    expect(screen.getByLabelText('目标分类')).toHaveValue('uncategorized');

    fireEvent.change(screen.getByLabelText('目标链接'), { target: { value: 'not-a-url' } });
    fireEvent.click(screen.getByRole('button', { name: '确认导入' }));

    expect(await screen.findByText('请输入有效链接')).toBeInTheDocument();
  });

  it('creates an import task, closes, and shows the unified success message', async () => {
    const onClose = vi.fn();
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    function TestHarness() {
      const [isOpen, setIsOpen] = useState(true);

      return (
        <QueryClientProvider client={queryClient}>
          {isOpen ? (
            <ImportModal
              onClose={() => {
                onClose();
                setIsOpen(false);
              }}
            />
          ) : null}
          <ToastViewport />
        </QueryClientProvider>
      );
    }

    render(<TestHarness />);

    fireEvent.change(screen.getByLabelText('目标链接'), { target: { value: 'https://example.com/article' } });
    fireEvent.click(screen.getByRole('button', { name: '确认导入' }));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('任务创建成功，请前往首页查看任务进度')).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: '导入新内容' })).not.toBeInTheDocument();
  });

  it('allows closing the modal while the import task continues in the background', async () => {
    const onClose = vi.fn();
    const originalCreateImportTask = importsApi.createImportTask;
    const createImportTaskSpy = vi.spyOn(importsApi, 'createImportTask').mockImplementation(
      async (input) =>
        new Promise((resolve) => {
          setTimeout(async () => {
            resolve(await originalCreateImportTask(input));
          }, 10);
        }),
    );

    renderModal(onClose);

    fireEvent.change(screen.getByLabelText('目标链接'), { target: { value: 'https://example.com/background-import' } });
    fireEvent.click(screen.getByRole('button', { name: '确认导入' }));
    fireEvent.click(screen.getByRole('button', { name: '关闭导入弹窗' }));

    expect(onClose).toHaveBeenCalledTimes(1);

    await waitFor(async () => {
      const tasks = await getRecentImportTasks();
      expect(tasks.some((task) => task.url === 'https://example.com/background-import')).toBe(true);
    });

    createImportTaskSpy.mockRestore();
  });

  it('supports creating a new folder from the modal', async () => {
    renderModal();

    fireEvent.click(screen.getByRole('button', { name: '新建文件夹' }));
    fireEvent.change(screen.getByLabelText('新文件夹名称'), { target: { value: 'Research Inbox' } });
    fireEvent.click(screen.getByRole('button', { name: '保存文件夹' }));

    expect(await screen.findByRole('option', { name: 'Research Inbox' })).toBeInTheDocument();
    expect((screen.getByLabelText('目标分类') as HTMLSelectElement).value).toMatch(/^folder-/);
  });
});
