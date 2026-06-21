import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import { resetMockSource } from '../api/mockSource';
import { Home } from './Home';

const renderHome = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe('Home', () => {
  beforeEach(() => {
    resetMockSource();
  });

  it('renders dashboard stats, heatmap months, and recent import states', async () => {
    renderHome();

    const totalCardsStat = screen.getByText('总计文章').parentElement;
    const totalWordsStat = screen.getByText('总计字数').parentElement;
    const totalFoldersStat = screen.getByText('文件夹数').parentElement;

    expect(totalCardsStat).not.toBeNull();
    expect(totalWordsStat).not.toBeNull();
    expect(totalFoldersStat).not.toBeNull();
    await waitFor(() => {
      expect(within(totalCardsStat as HTMLElement).getByText('3')).toBeInTheDocument();
      expect(within(totalWordsStat as HTMLElement).getByText('2k')).toBeInTheDocument();
      expect(within(totalFoldersStat as HTMLElement).getByText('1')).toBeInTheDocument();
    });
    expect(screen.getByText('文章导入树')).toBeInTheDocument();
    expect(screen.queryByText('每日')).not.toBeInTheDocument();
    expect(screen.getByTestId('activity-heatmap').getAttribute('style')).toContain('repeat(');
    expect(screen.getByText('7月')).toBeInTheDocument();
    expect(screen.getByText('6月')).toBeInTheDocument();
    expect(await screen.findByText('完成')).toBeInTheDocument();
    expect(await screen.findByText('失败')).toBeInTheDocument();
    expect(screen.getByText(/页面抓取失败/)).toBeInTheDocument();
  });
});
