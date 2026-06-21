import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { resetMockSource } from '../api/mockSource';
import { Recommendations } from './Recommendations';

const renderRecommendations = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <Recommendations />
    </QueryClientProvider>,
  );
};

describe('Recommendations', () => {
  beforeEach(() => {
    resetMockSource();
  });

  it('filters articles by category and imports into the selected folder', async () => {
    renderRecommendations();

    expect((await screen.findAllByText('The Future of Retrieval-Augmented Generation (RAG)')).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: '刷新推荐' })).toBeInTheDocument();
    expect(screen.getByText(/每次从 AIHOT 拉取 30 篇，当前列表 \d+ 篇/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '前端' }));

    expect((await screen.findAllByText("Tailwind CSS 4.0 Released: What's New?")).length).toBeGreaterThan(0);
    expect(screen.queryByText('The Future of Retrieval-Augmented Generation (RAG)')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'AI 产品' }));
    fireEvent.click((await screen.findAllByRole('button', { name: '加入知识库' }))[0]);

    const importDialog = await screen.findByRole('dialog', { name: '导入推荐文章' });
    await within(importDialog).findByRole('option', { name: 'Interaction Design' });
    fireEvent.change(within(importDialog).getByLabelText('目标分类'), { target: { value: 'f-4' } });
    fireEvent.click(within(importDialog).getByRole('button', { name: '加入知识库' }));

    expect((await screen.findAllByText('导入中')).length).toBeGreaterThan(0);
  });
});
