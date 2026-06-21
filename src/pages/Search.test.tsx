import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import { resetMockSource } from '../api/mockSource';
import { Search } from './Search';

const renderSearch = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/search']}>
        <Search />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe('Search', () => {
  const guideTitle = '别吃灰功能介绍：这个知识库现在能帮你做什么';

  beforeEach(() => {
    resetMockSource();
  });

  it('searches cards, streams an answer, and archives it', async () => {
    renderSearch();

    fireEvent.change(screen.getByPlaceholderText(/根据记忆检索/), { target: { value: '知识库' } });
    fireEvent.submit(screen.getByPlaceholderText(/根据记忆检索/).closest('form')!);

    const result = await screen.findByText(guideTitle);
    fireEvent.click(result);

    fireEvent.change(screen.getByPlaceholderText('向选中的知识卡提问...'), { target: { value: 'What is normalization?' } });
    fireEvent.submit(screen.getByPlaceholderText('向选中的知识卡提问...').closest('form')!);

    expect(await screen.findByText(/基于你所选的 1 张知识卡/)).toBeInTheDocument();

    fireEvent.click(await screen.findByRole('button', { name: '归档到文章' }));

    await waitFor(() => expect(screen.getByRole('button', { name: '已归档' })).toBeInTheDocument());
  });
});
