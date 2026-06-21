import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import { resetMockSource } from '../api/mockSource';
import { useUiStore } from '../stores/uiStore';
import { KnowledgeBase } from './KnowledgeBase';

const renderKnowledgeBase = (initialEntry = '/knowledge') => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <KnowledgeBase />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe('KnowledgeBase', () => {
  const guideTitle = '别吃灰功能介绍：这个知识库现在能帮你做什么';

  beforeEach(() => {
    resetMockSource();
    vi.restoreAllMocks();
    useUiStore.getState().setSelectedKnowledgeCardId(null);
    useUiStore.getState().setLibraryTagFilter('all');
    useUiStore.getState().setLibrarySourceFilter('all');
    useUiStore.getState().setLibrarySortBy('updatedAt');
    useUiStore.getState().setImportModalOpen(false);
  });

  it('does not open a card detail by default', async () => {
    renderKnowledgeBase();

    expect(await screen.findByText(guideTitle)).toBeInTheDocument();
    expect(screen.queryByText('请选择一篇笔记')).not.toBeInTheDocument();
    expect(screen.queryByText('内容摘要')).not.toBeInTheDocument();
  });

  it('opens the detail only after selecting a card', async () => {
    renderKnowledgeBase();

    fireEvent.click(await screen.findByText(guideTitle));

    expect(await screen.findByText('内容摘要')).toBeInTheDocument();
  });

  it('renders full article content directly with preserved line-break styling', async () => {
    renderKnowledgeBase('/knowledge?card=c-1');

    const contentHeading = await screen.findByText('原文');
    const previewSection = contentHeading.closest('section');

    expect(screen.getByText(/功能总览/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '查看完整原文' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '收起原文' })).not.toBeInTheDocument();
    expect(previewSection?.querySelector('p')).toBeInTheDocument();
  });

  it('closes the detail panel from the icon action', async () => {
    renderKnowledgeBase('/knowledge?card=c-1');

    expect(await screen.findByText('内容摘要')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '关闭详情' }));

    expect(screen.queryByText('内容摘要')).not.toBeInTheDocument();
  });

  it('opens the detail when a card id is provided in the URL', async () => {
    renderKnowledgeBase('/knowledge?card=c-1');

    expect(await screen.findByText('内容摘要')).toBeInTheDocument();
  });

  it('shows edit draft state and resets unsaved changes on cancel', async () => {
    renderKnowledgeBase('/knowledge?card=c-1');

    fireEvent.click(await screen.findByRole('button', { name: '工具集成' }));
    fireEvent.click(screen.getByRole('button', { name: '编辑' }));

    expect(screen.queryByText('编辑')).not.toBeInTheDocument();
    expect(screen.queryByText('移入回收站')).not.toBeInTheDocument();
    expect(screen.getByText('当前没有草稿修改')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '保存修改' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '取消编辑' })).toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue(guideTitle), {
      target: { value: 'Updated normalization note' },
    });

    expect(screen.getByText('有未保存修改')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '保存修改' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: '取消编辑' }));

    expect(screen.queryByText('有未保存修改')).not.toBeInTheDocument();
    expect(screen.getAllByText(guideTitle).length).toBeGreaterThan(0);
  });

  it('opens the import entry from the add note action', async () => {
    renderKnowledgeBase();

    fireEvent.click(await screen.findByRole('button', { name: '添加新笔记' }));

    expect(useUiStore.getState().isImportModalOpen).toBe(true);
  });

  it('renders local images in the knowledge card detail view', async () => {
    renderKnowledgeBase('/knowledge?card=c-1');

    expect(await screen.findByText('内容摘要')).toBeInTheDocument();
    expect(screen.queryByText('图片')).not.toBeInTheDocument();
    expect(screen.queryByRole('img', { name: '知识卡图片 1' })).not.toBeInTheDocument();
  });

  it('keeps detail metadata as source and tag chips with source opening original link', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    renderKnowledgeBase('/knowledge?card=c-1');

    const sourceChip = await screen.findByRole('button', { name: '打开原文：产品内置指南' });
    fireEvent.click(sourceChip);

    expect(openSpy).toHaveBeenCalledWith('https://docs.biechihui.local/features', '_blank', 'noopener,noreferrer');
    expect(screen.getAllByText('产品介绍').length).toBeGreaterThan(0);
    expect(screen.getAllByText('新手必读').length).toBeGreaterThan(0);
    expect(screen.queryByText('最近修改')).not.toBeInTheDocument();
    expect(screen.queryByText('创建时间')).not.toBeInTheDocument();
    expect(screen.queryByText('状态')).not.toBeInTheDocument();
  });

  it('moves card management actions into the tool integration menu', async () => {
    renderKnowledgeBase('/knowledge?card=c-1');

    expect(await screen.findByRole('button', { name: '关闭详情' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '工具集成' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '编辑' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '工具集成' }));
    const menu = screen.getByRole('menu', { name: '工具集成' });

    expect(within(menu).getByText('移动至其他文件夹')).toBeInTheDocument();
    expect(within(menu).getByRole('button', { name: '编辑' })).toBeInTheDocument();
    expect(within(menu).getByRole('button', { name: '重新抓取' })).toBeInTheDocument();
    expect(within(menu).getByRole('button', { name: '重新生成' })).toBeInTheDocument();
    expect(within(menu).getByRole('button', { name: '删除' })).toBeInTheDocument();
  });

  it('closes the tool integration menu when clicking outside it', async () => {
    renderKnowledgeBase('/knowledge?card=c-1');

    fireEvent.click(await screen.findByRole('button', { name: '工具集成' }));

    expect(screen.getByRole('menu', { name: '工具集成' })).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByText('内容摘要'));

    expect(screen.queryByRole('menu', { name: '工具集成' })).not.toBeInTheDocument();
  });

  it('exposes a floating single-card AI question entry', async () => {
    renderKnowledgeBase('/knowledge?card=c-1');

    const askButton = await screen.findByRole('button', { name: '问问AI' });
    expect(askButton).toBeInTheDocument();
    expect(askButton.closest('[data-testid="ask-ai-float"]')).toHaveClass('right-6');
    expect(askButton).toHaveClass('bg-[#2B2B2B]');

    fireEvent.click(screen.getByRole('button', { name: '问问AI' }));

    expect(screen.getByPlaceholderText('向这篇文章提问')).toBeInTheDocument();
    expect(screen.getByTestId('ask-ai-panel')).toHaveClass('h-[50%]');
    expect(screen.getByTestId('ask-ai-panel')).toHaveClass('ml-auto');
    expect(screen.getByRole('button', { name: '归档对话' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '折叠聊天框' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '这篇文章适合用来解决什么问题？' })).toBeInTheDocument();
  });

  it('supports multi-turn ask AI chat and archives only when requested', async () => {
    renderKnowledgeBase('/knowledge?card=c-1');

    fireEvent.click(await screen.findByRole('button', { name: '问问AI' }));
    fireEvent.click(screen.getByRole('button', { name: '这篇文章适合用来解决什么问题？' }));
    fireEvent.click(screen.getByRole('button', { name: '发送问题' }));

    expect(screen.queryByRole('button', { name: '这篇文章适合用来解决什么问题？' })).not.toBeInTheDocument();
    expect(screen.queryByText('问答归档')).not.toBeInTheDocument();

    await screen.findByText(/基于你所选的 1 张知识卡/);
    await waitFor(() => {
      expect(screen.queryByText('AI 正在回复...')).not.toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('继续追问这篇文章'), {
      target: { value: '再展开一点' },
    });
    fireEvent.click(screen.getByRole('button', { name: '发送问题' }));

    await waitFor(() => {
      expect(screen.getAllByText(/基于你所选的 1 张知识卡/).length).toBeGreaterThanOrEqual(2);
    });
    await waitFor(() => {
      expect(screen.queryByText('AI 正在回复...')).not.toBeInTheDocument();
    });
    expect(screen.queryByText('问答归档')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '归档对话' }));

    expect(await screen.findByText('问答归档')).toBeInTheDocument();
    expect(screen.queryByText(/再展开一点/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /展开问答归档/ }));

    expect(screen.getByText(/再展开一点/)).toBeInTheDocument();
  });

  it('folds the ask AI chat box back to the floating bubble', async () => {
    renderKnowledgeBase('/knowledge?card=c-1');

    fireEvent.click(await screen.findByRole('button', { name: '问问AI' }));
    expect(screen.getByTestId('ask-ai-panel')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '折叠聊天框' }));

    expect(screen.queryByTestId('ask-ai-panel')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '问问AI' })).toBeInTheDocument();
  });

  it('does not render feedgrab front matter metadata in article content', async () => {
    renderKnowledgeBase('/knowledge?card=c-1');

    expect(await screen.findByText('原文')).toBeInTheDocument();
    expect(screen.queryByText(/item_id:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/tweet_count:/)).not.toBeInTheDocument();
  });
});
