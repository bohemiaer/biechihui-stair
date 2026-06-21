import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';

import { resetMockSource } from '../api/mockSource';
import { useCreateFolderMutation, useFoldersQuery } from './folders';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
};

describe('query hooks', () => {
  beforeEach(() => {
    resetMockSource();
  });

  it('reads mock data and refreshes folder cache after mutation', async () => {
    const wrapper = createWrapper();
    const foldersHook = renderHook(() => useFoldersQuery(), { wrapper });
    const createFolderHook = renderHook(() => useCreateFolderMutation(), { wrapper });

    await waitFor(() => expect(foldersHook.result.current.data?.some((folder) => folder.id === 'uncategorized')).toBe(true));

    await act(async () => {
      await createFolderHook.result.current.mutateAsync({ name: 'Hook Created Folder' });
    });

    await waitFor(() => expect(foldersHook.result.current.data?.some((folder) => folder.name === 'Hook Created Folder')).toBe(true));
  });
});
