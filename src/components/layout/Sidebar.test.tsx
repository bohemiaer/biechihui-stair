import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

import { resetMockSource } from '../../api/mockSource';
import { useUiStore } from '../../stores/uiStore';
import { Sidebar } from './Sidebar';

function LocationProbe() {
  const location = useLocation();

  return <span data-testid="location">{location.pathname}{location.search}</span>;
}

const renderSidebar = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/']}>
        <Sidebar />
        <Routes>
          <Route element={<LocationProbe />} path="*" />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe('Sidebar', () => {
  beforeEach(() => {
    resetMockSource();
    useUiStore.getState().setSidebarCollapsed(false);
    useUiStore.getState().setImportModalOpen(false);
    useUiStore.getState().setKnowledgeOpen(true);
  });

  it('renders primary navigation and knowledge folders', async () => {
    renderSidebar();

    expect(screen.getByAltText('Biechihui')).toBeInTheDocument();
    expect(screen.queryByText('Floyd Lawton')).not.toBeInTheDocument();
    expect(screen.getByText('首页')).toBeInTheDocument();
    expect(screen.getByText('知识库')).toBeInTheDocument();
    expect(await screen.findByText('Interaction Design')).toBeInTheDocument();
    expect(screen.queryByText('Exploration Ideas')).not.toBeInTheDocument();
    expect(screen.getByText('回收站')).toBeInTheDocument();
  });

  it('navigates to a folder from the knowledge section', async () => {
    renderSidebar();

    fireEvent.click(await screen.findByText('Interaction Design'));

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/knowledge?folder=f-4'));
  });

  it('opens the import modal from the bottom action', async () => {
    renderSidebar();

    fireEvent.click(screen.getByRole('button', { name: '添加新链接' }));

    expect(await screen.findByText('导入新内容')).toBeInTheDocument();
  });

  it('collapses navigation labels while keeping icon actions available', async () => {
    renderSidebar();

    fireEvent.click(screen.getByRole('button', { name: '收起侧边栏' }));

    expect(screen.queryByText('首页')).not.toBeInTheDocument();
    expect(screen.queryByText('知识库')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '首页' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '知识库' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '添加新链接' }));

    expect(await screen.findByText('导入新内容')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '展开侧边栏' }));

    expect(screen.getByText('首页')).toBeInTheDocument();
  });
});
