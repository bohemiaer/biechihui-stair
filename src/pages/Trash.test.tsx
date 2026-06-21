import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { deleteCard, resetMockSource } from '../api/mockSource';
import { useUiStore } from '../stores/uiStore';
import { Trash } from './Trash';

const renderTrash = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <Trash />
    </QueryClientProvider>,
  );
};

describe('Trash', () => {
  beforeEach(async () => {
    resetMockSource();
    useUiStore.getState().clearToast();
    await deleteCard('c-1');
  });

  it('restores a deleted card', async () => {
    renderTrash();

    fireEvent.click(await screen.findByRole('button', { name: '恢复' }));

    await waitFor(() => expect(useUiStore.getState().toastMessage).toBe('已恢复知识卡'));
  });

  it('requires confirmation before permanent delete', async () => {
    renderTrash();

    fireEvent.click(await screen.findByRole('button', { name: '永久删除' }));

    expect(await screen.findByText('确认永久删除？')).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: '永久删除' })[1]);

    await waitFor(() => expect(useUiStore.getState().toastMessage).toBe('已永久删除'));
  });
});
