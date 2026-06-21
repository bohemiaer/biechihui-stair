import React, { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Archive,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FolderInput,
  Grid2X2,
  List,
  MessageCircle,
  Minimize2,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  Wand2,
  X,
} from 'lucide-react';
import { format } from 'date-fns';
import { useQueryClient } from '@tanstack/react-query';

import { resolveAssetUrl } from '../api/client';
import { streamAnswerQuestion } from '../api/search';
import { CompactCardRow } from '../components/cards/CompactCardRow';
import { KnowledgeCardItem } from '../components/cards/KnowledgeCardItem';
import { MarkdownContent } from '../components/content/MarkdownContent';
import { Button, ConfirmDialog, EmptyState, ErrorState, SkeletonList } from '../components/ui';
import {
  useArchiveAnswerMutation,
  useCardsQuery,
  useDeleteCardMutation,
  useRefreshCardMutation,
  useRegenerateCardMutation,
  useUpdateCardMutation,
} from '../queries/cards';
import { useFoldersQuery } from '../queries/folders';
import { useRecentImportTasksQuery } from '../queries/imports';
import { queryKeys } from '../queries/keys';
import { cn, dedupeTagsById } from '../lib/utils';
import { getErrorMessage } from '../lib/errors';
import { useUiStore } from '../stores/uiStore';
import type { SortOption, Tag as CardTag } from '../types';

type EditSaveStatus = 'idle' | 'draft' | 'saving' | 'saved' | 'failed';
type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

const stripFeedgrabFrontMatter = (content: string) => (
  content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '').trim()
);

export function KnowledgeBase() {
  const location = useLocation();
  const queryClient = useQueryClient();
  const toolMenuRef = useRef<HTMLDivElement>(null);
  const searchParams = new URLSearchParams(location.search);
  const selectedFolderId = searchParams.get('folder') ?? undefined;
  const selectedCardIdFromUrl = searchParams.get('card');
  const [isEditing, setIsEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftSummary, setDraftSummary] = useState('');
  const [draftNote, setDraftNote] = useState('');
  const [draftTags, setDraftTags] = useState('');
  const [editSaveStatus, setEditSaveStatus] = useState<EditSaveStatus>('idle');
  const [editError, setEditError] = useState('');
  const [confirmAction, setConfirmAction] = useState<'refresh' | 'regenerate' | null>(null);
  const [isToolMenuOpen, setIsToolMenuOpen] = useState(false);
  const [isAskPanelOpen, setIsAskPanelOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatModel, setChatModel] = useState('');
  const [answerError, setAnswerError] = useState('');
  const [activeAnswerCount, setActiveAnswerCount] = useState(0);
  const [isArchivesExpanded, setIsArchivesExpanded] = useState(false);

  const foldersQuery = useFoldersQuery();
  const cardsQuery = useCardsQuery(selectedFolderId);
  const updateCardMutation = useUpdateCardMutation();
  const deleteCardMutation = useDeleteCardMutation();
  const refreshCardMutation = useRefreshCardMutation();
  const regenerateCardMutation = useRegenerateCardMutation();
  const archiveAnswerMutation = useArchiveAnswerMutation();
  const recentImportTasksQuery = useRecentImportTasksQuery();
  const showToast = useUiStore((state) => state.showToast);
  const libraryViewMode = useUiStore((state) => state.libraryViewMode);
  const setLibraryViewMode = useUiStore((state) => state.setLibraryViewMode);
  const setImportModalOpen = useUiStore((state) => state.setImportModalOpen);
  const selectedCardId = useUiStore((state) => state.selectedKnowledgeCardId);
  const setSelectedCardId = useUiStore((state) => state.setSelectedKnowledgeCardId);
  const tagFilter = useUiStore((state) => state.libraryTagFilter);
  const setTagFilter = useUiStore((state) => state.setLibraryTagFilter);
  const sourceFilter = useUiStore((state) => state.librarySourceFilter);
  const setSourceFilter = useUiStore((state) => state.setLibrarySourceFilter);
  const sortBy = useUiStore((state) => state.librarySortBy);
  const setSortBy = useUiStore((state) => state.setLibrarySortBy);
  const folders = foldersQuery.data ?? [];
  const cards = cardsQuery.data ?? [];
  const allTags = useMemo(() => {
    return dedupeTagsById(cards.flatMap((card) => card.tags as CardTag[]));
  }, [cards]);
  const allSources = useMemo(() => Array.from(new Set(cards.map((card) => card.siteName))).sort(), [cards]);
  const visibleCards = useMemo(() => {
    return [...cards]
      .filter((card) => tagFilter === 'all' || card.tags.some((tag) => tag.name === tagFilter))
      .filter((card) => sourceFilter === 'all' || card.siteName === sourceFilter)
      .sort((a, b) => {
        if (sortBy === 'title') return (a.userTitle || a.title).localeCompare(b.userTitle || b.title);
        if (sortBy === 'source') return a.siteName.localeCompare(b.siteName);

        return new Date(b[sortBy]).getTime() - new Date(a[sortBy]).getTime();
      });
  }, [cards, sourceFilter, sortBy, tagFilter]);
  const selectedCard = selectedCardId ? cards.find((card) => card.id === selectedCardId) : undefined;
  const selectedCardFolder = folders.find((folder) => folder.id === selectedCard?.folderId);
  const folderName = selectedFolderId ? folders.find((folder) => folder.id === selectedFolderId)?.name : '全部收藏';
  const isDetailOpen = Boolean(selectedCard);
  const coverImage = selectedCard?.imageAssets?.[0]
    ? resolveAssetUrl(selectedCard.imageAssets[0].localPath || selectedCard.imageAssets[0].sourceUrl)
    : '';
  const articleContent = selectedCard ? stripFeedgrabFrontMatter(selectedCard.fullContent || selectedCard.contentPreview) : '';
  const hasAskedQuestion = chatMessages.some((message) => message.role === 'user');
  const suggestedQuestions = selectedCard?.suggestedQuestions?.slice(0, 3) ?? [];
  const canArchiveConversation = chatMessages.some((message) => message.role === 'assistant' && message.content.trim());
  const isAnswering = activeAnswerCount > 0;
  const originalEditableValues = useMemo(() => {
    if (!selectedCard) {
      return null;
    }

    return {
      title: selectedCard.userTitle || selectedCard.title,
      summary: selectedCard.userSummary || selectedCard.summary,
      note: selectedCard.note ?? selectedCard.notes ?? '',
      tags: selectedCard.tags.map((tag) => tag.name).join(', '),
    };
  }, [selectedCard]);
  const hasDraftChanges = Boolean(
    originalEditableValues
    && (
      draftTitle !== originalEditableValues.title
      || draftSummary !== originalEditableValues.summary
      || draftNote !== originalEditableValues.note
      || draftTags !== originalEditableValues.tags
    ),
  );

  useEffect(() => {
    if (selectedCardIdFromUrl) {
      setSelectedCardId(selectedCardIdFromUrl);
      return;
    }

    setSelectedCardId(null);
  }, [selectedCardIdFromUrl, selectedFolderId, setSelectedCardId]);

  useEffect(() => {
    if (selectedCard) {
      setDraftTitle(selectedCard.userTitle || selectedCard.title);
      setDraftSummary(selectedCard.userSummary || selectedCard.summary);
      setDraftNote(selectedCard.note ?? selectedCard.notes ?? '');
      setDraftTags(selectedCard.tags.map((tag) => tag.name).join(', '));
      setEditSaveStatus('idle');
      setEditError('');
      setIsToolMenuOpen(false);
      setIsAskPanelOpen(false);
      setQuestion('');
      setChatMessages([]);
      setChatModel('');
      setAnswerError('');
      setActiveAnswerCount(0);
      setIsArchivesExpanded(false);
    }
  }, [selectedCard]);

  useEffect(() => {
    if (!recentImportTasksQuery.data) {
      return;
    }

    const replacementTask = recentImportTasksQuery.data.find(
      (task) => task.status === 'succeeded' && task.targetCardId === selectedCardId && task.resultCardId,
    );

    if (replacementTask?.resultCardId && replacementTask.resultCardId !== selectedCardId) {
      setSelectedCardId(replacementTask.resultCardId);
    }

    void queryClient.invalidateQueries({ queryKey: queryKeys.cards.all });
    if (selectedCardId) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.cards.detail(selectedCardId) });
    }
  }, [queryClient, recentImportTasksQuery.data, selectedCardId, setSelectedCardId]);

  useEffect(() => {
    if (!isToolMenuOpen) return;

    const handlePointerOutside = (event: MouseEvent) => {
      if (!toolMenuRef.current?.contains(event.target as Node)) {
        setIsToolMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerOutside);

    return () => {
      document.removeEventListener('mousedown', handlePointerOutside);
    };
  }, [isToolMenuOpen]);

  const tags = useMemo(() => dedupeTagsById((selectedCard?.tags ?? []) as CardTag[]), [selectedCard]);

  const resetDraft = () => {
    if (!originalEditableValues) return;

    setDraftTitle(originalEditableValues.title);
    setDraftSummary(originalEditableValues.summary);
    setDraftNote(originalEditableValues.note);
    setDraftTags(originalEditableValues.tags);
    setEditSaveStatus('idle');
    setEditError('');
  };

  const updateDraft = (updater: () => void) => {
    updater();
    setEditSaveStatus('draft');
    setEditError('');
  };

  const handleToggleEditing = () => {
    if (isEditing) {
      resetDraft();
      setIsEditing(false);
      return;
    }

    setIsEditing(true);
    setIsToolMenuOpen(false);
  };

  const handleSave = async () => {
    if (!selectedCard || !hasDraftChanges) return;

    setEditSaveStatus('saving');
    setEditError('');

    try {
      await updateCardMutation.mutateAsync({
        id: selectedCard.id,
        input: {
          userTitle: draftTitle,
          userSummary: draftSummary,
          note: draftNote,
          tags: draftTags
            .split(',')
            .map((name) => name.trim())
            .filter(Boolean)
            .map((name, index) => ({ id: `tag-${selectedCard.id}-${index}`, name })),
        },
      });
      setEditSaveStatus('saved');
      showToast('已保存修改');
      setIsEditing(false);
    } catch (error) {
      setEditSaveStatus('failed');
      setEditError(getErrorMessage(error, '保存失败，请稍后重试。'));
    }
  };

  const handleMoveFolder = async (folderId: string) => {
    if (!selectedCard) return;

    await updateCardMutation.mutateAsync({
      id: selectedCard.id,
      input: { folderId },
    });
    showToast('已移动文件夹');
  };

  const handleDelete = async () => {
    if (!selectedCard) return;

    await deleteCardMutation.mutateAsync(selectedCard.id);
    showToast('已删除');
    setIsToolMenuOpen(false);
    setSelectedCardId(null);
  };

  const handleConfirmedAction = async () => {
    if (!selectedCard || !confirmAction) return;

    if (confirmAction === 'refresh') {
      await refreshCardMutation.mutateAsync(selectedCard.id);
      showToast('已创建重新抓取任务，请前往首页查看进度');
    }

    if (confirmAction === 'regenerate') {
      await regenerateCardMutation.mutateAsync(selectedCard.id);
      showToast('已重新生成摘要和标签');
    }

    setConfirmAction(null);
    setIsToolMenuOpen(false);
  };

  const handleOpenSource = () => {
    if (!selectedCard?.url) return;

    window.open(selectedCard.url, '_blank', 'noopener,noreferrer');
  };

  const handleAskSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedCard || !question.trim()) return;

    const prompt = question.trim();
    const userMessageId = `user-${Date.now()}`;
    const assistantMessageId = `assistant-${Date.now()}`;
    setAnswerError('');
    setActiveAnswerCount((count) => count + 1);
    setQuestion('');
    setChatMessages((messages) => [
      ...messages,
      { id: userMessageId, role: 'user', content: prompt },
      { id: assistantMessageId, role: 'assistant', content: '' },
    ]);

    try {
      const response = await streamAnswerQuestion(
        { question: prompt, cardIds: [selectedCard.id] },
        (token) => {
          setChatMessages((messages) => messages.map((message) => (
            message.id === assistantMessageId
              ? { ...message, content: `${message.content}${token}` }
              : message
          )));
        },
      );
      setChatModel(response.model);
      setChatMessages((messages) => messages.map((message) => (
        message.id === assistantMessageId ? { ...message, content: response.answer } : message
      )));
    } catch (error) {
      setChatMessages((messages) => messages.filter((message) => message.id !== assistantMessageId));
      setAnswerError(getErrorMessage(error, '回答生成失败，请稍后重试。'));
    } finally {
      setActiveAnswerCount((count) => Math.max(0, count - 1));
    }
  };

  const handleArchiveConversation = async () => {
    if (!selectedCard || !canArchiveConversation || archiveAnswerMutation.isPending) return;

    const firstQuestion = chatMessages.find((message) => message.role === 'user')?.content ?? '问问AI对话';
    const transcript = chatMessages
      .filter((message) => message.content.trim())
      .map((message) => `${message.role === 'user' ? '我' : 'AI'}：${message.content.trim()}`)
      .join('\n\n');

    try {
      await archiveAnswerMutation.mutateAsync({
        cardId: selectedCard.id,
        input: {
          question: firstQuestion,
          answer: transcript,
          usedCardIds: [selectedCard.id],
          model: chatModel,
        },
      });
      setIsArchivesExpanded(false);
      showToast('已归档对话');
    } catch (error) {
      setAnswerError(getErrorMessage(error, '归档失败，请稍后重试。'));
    }
  };

  return (
    <div className="flex h-full w-full bg-[#FFFFFF] max-lg:flex-col">
      <div
        className={cn(
          'flex min-w-0 flex-col bg-[#FFFFFF] max-lg:w-full max-lg:border-b max-lg:border-r-0',
          isDetailOpen
            ? 'w-[352px] shrink-0 border-r border-[#EAEAEA] max-lg:hidden'
            : 'w-full flex-1',
        )}
      >
        <div className="shrink-0 px-6 pb-4 pt-8">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[22px] font-semibold tracking-tight text-[#1A1A1A]">{folderName}</h2>
              <p className="mt-1 text-[12px] text-[#868E96]">{visibleCards.length} / {cards.length} 篇</p>
            </div>
            <div className="flex rounded-lg border border-[#EAEAEA] bg-[#F8F9FA] p-1">
              <button
                aria-label="卡片视图"
                className={cn('rounded-md p-1.5 text-[#868E96]', libraryViewMode === 'card' && 'bg-white text-[#1A1A1A] shadow-sm')}
                onClick={() => setLibraryViewMode('card')}
                type="button"
              >
                <Grid2X2 size={15} />
              </button>
              <button
                aria-label="紧凑列表视图"
                className={cn('rounded-md p-1.5 text-[#868E96]', libraryViewMode === 'compact' && 'bg-white text-[#1A1A1A] shadow-sm')}
                onClick={() => setLibraryViewMode('compact')}
                type="button"
              >
                <List size={15} />
              </button>
            </div>
          </div>
        </div>

        <div className="shrink-0 px-6 pb-4">
          <button
            className="flex w-full items-center justify-center space-x-2 rounded-xl border border-[#EAEAEA] bg-[#F8F9FA] px-4 py-2.5 text-[14px] font-medium text-[#1A1A1A] transition-colors hover:bg-[#F1F3F5]"
            onClick={() => setImportModalOpen(true)}
            type="button"
          >
            <Plus size={16} />
            <span>添加新笔记</span>
          </button>
        </div>

        <div className="shrink-0 space-y-3 px-6 pb-4">
          <div className="grid grid-cols-2 gap-2">
            <select
              className="min-w-0 rounded-lg border border-[#EAEAEA] bg-[#F8F9FA] px-3 py-2 text-[12px] text-[#495057] outline-none focus:border-[#ADB5BD]"
              onChange={(event) => setTagFilter(event.target.value)}
              value={tagFilter}
            >
              <option value="all">全部标签</option>
              {allTags.map((tag) => (
                <option key={tag.id} value={tag.name}>{tag.name}</option>
              ))}
            </select>
            <select
              className="min-w-0 rounded-lg border border-[#EAEAEA] bg-[#F8F9FA] px-3 py-2 text-[12px] text-[#495057] outline-none focus:border-[#ADB5BD]"
              onChange={(event) => setSourceFilter(event.target.value)}
              value={sourceFilter}
            >
              <option value="all">全部来源</option>
              {allSources.map((source) => (
                <option key={source} value={source}>{source}</option>
              ))}
            </select>
          </div>
          <select
            className="w-full rounded-lg border border-[#EAEAEA] bg-[#F8F9FA] px-3 py-2 text-[12px] text-[#495057] outline-none focus:border-[#ADB5BD]"
            onChange={(event) => setSortBy(event.target.value as SortOption)}
            value={sortBy}
          >
            <option value="updatedAt">最近修改优先</option>
            <option value="createdAt">最新创建优先</option>
            <option value="title">标题 A-Z</option>
            <option value="source">来源 A-Z</option>
          </select>
        </div>

        <div
          className={cn(
            'flex-1 overflow-y-auto px-6 pb-6',
            libraryViewMode === 'card' ? (isDetailOpen ? 'space-y-4' : 'grid content-start gap-4 md:grid-cols-2 xl:grid-cols-3') : 'space-y-0',
          )}
        >
          {(cardsQuery.isError || foldersQuery.isError) && (
            <ErrorState
              message={getErrorMessage(cardsQuery.error ?? foldersQuery.error, '知识库内容加载失败，请稍后重试。')}
              onRetry={() => {
                void cardsQuery.refetch();
                void foldersQuery.refetch();
              }}
            />
          )}
          {cardsQuery.isLoading && <SkeletonList rows={4} />}
          {!cardsQuery.isLoading && visibleCards.map((card) => (
            libraryViewMode === 'compact' ? (
              <CompactCardRow card={card} key={card.id} onClick={() => setSelectedCardId(card.id)} />
            ) : (
              <KnowledgeCardItem
                card={card}
                key={card.id}
                onClick={() => setSelectedCardId(card.id)}
                selected={selectedCard?.id === card.id}
              />
            )
          ))}
          {!cardsQuery.isLoading && visibleCards.length === 0 && (
            <EmptyState title="没有匹配内容" description="换个标签、来源或文件夹再试试。" />
          )}
        </div>
      </div>

      {selectedCard && (
        <div className="relative flex min-w-0 flex-1 flex-col bg-[#FFFFFF]">
          <div className="flex-1 overflow-y-auto">
            <article className="relative min-h-full w-full overflow-hidden px-8 pb-16 pt-8 sm:px-12">
              {coverImage && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-cover bg-center opacity-20"
                  style={{
                    backgroundImage: `linear-gradient(to bottom, rgba(255,255,255,0.05), #FFFFFF 92%), url("${coverImage}")`,
                  }}
                />
              )}

              <div className="relative mb-8 flex items-center justify-between gap-4">
                <span className="rounded-full border border-[#EAEAEA] bg-white/85 px-3 py-1 text-[12px] font-medium text-[#6C757D] shadow-sm">
                  {selectedCardFolder?.name ?? folderName ?? '未分类'}
                </span>
                <div className="relative ml-auto flex items-center gap-2" ref={toolMenuRef}>
                  <Button aria-label="关闭详情" icon={<X size={16} />} onClick={() => setSelectedCardId(null)} title="关闭详情" variant="icon" />
                  <Button
                    aria-label="工具集成"
                    icon={<MoreHorizontal size={17} />}
                    onClick={() => setIsToolMenuOpen((current) => !current)}
                    title="工具集成"
                    variant="icon"
                  />
                  {isToolMenuOpen && (
                    <div
                      aria-label="工具集成"
                      className="absolute right-0 top-11 z-20 w-64 rounded-xl border border-[#EAEAEA] bg-white p-3 text-[13px] shadow-xl"
                      role="menu"
                    >
                      <label className="mb-3 block">
                        <span className="mb-1.5 flex items-center gap-2 text-[12px] font-medium text-[#868E96]">
                          <FolderInput size={14} />
                          移动至其他文件夹
                        </span>
                        <select
                          className="w-full rounded-lg border border-[#EAEAEA] bg-[#F8F9FA] px-3 py-2 text-[#212529] focus:border-[#ADB5BD] focus:outline-none"
                          onChange={(event) => void handleMoveFolder(event.target.value)}
                          value={selectedCard.folderId}
                        >
                          {folders.map((folder) => (
                            <option key={folder.id} value={folder.id}>{folder.name}</option>
                          ))}
                        </select>
                      </label>
                      <button
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left font-medium text-[#212529] hover:bg-[#F8F9FA]"
                        onClick={handleToggleEditing}
                        type="button"
                      >
                        {isEditing ? <X size={15} /> : <Pencil size={15} />}
                        {isEditing ? '取消编辑' : '编辑'}
                      </button>
                      <button
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left font-medium text-[#212529] hover:bg-[#F8F9FA] disabled:opacity-60"
                        disabled={refreshCardMutation.isPending}
                        onClick={() => setConfirmAction('refresh')}
                        type="button"
                      >
                        <RefreshCw size={15} />
                        重新抓取
                      </button>
                      <button
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left font-medium text-[#212529] hover:bg-[#F8F9FA] disabled:opacity-60"
                        disabled={regenerateCardMutation.isPending}
                        onClick={() => setConfirmAction('regenerate')}
                        type="button"
                      >
                        <Wand2 size={15} />
                        重新生成
                      </button>
                      <button
                        className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left font-medium text-[#C92A2A] hover:bg-[#FFF5F5] disabled:opacity-60"
                        disabled={deleteCardMutation.isPending}
                        onClick={() => void handleDelete()}
                        type="button"
                      >
                        <Trash2 size={15} />
                        删除
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {isEditing ? (
                <div className="relative mb-8 space-y-4">
                  <div
                    className={cn(
                      'rounded-xl border px-4 py-3 text-[13px] font-medium',
                      editSaveStatus === 'failed'
                        ? 'border-[#FFE3E3] bg-[#FFF5F5] text-[#C92A2A]'
                        : hasDraftChanges
                          ? 'border-[#D0EBFF] bg-[#F1F8FF] text-[#1971C2]'
                          : 'border-[#EAEAEA] bg-[#F8F9FA] text-[#868E96]',
                    )}
                  >
                    {editSaveStatus === 'failed'
                      ? editError
                      : hasDraftChanges
                        ? '有未保存修改'
                        : '当前没有草稿修改'}
                  </div>
                  <input
                    className="w-full rounded-xl border border-[#EAEAEA] bg-[#F8F9FA] px-4 py-3 text-[24px] font-semibold text-[#1A1A1A] focus:border-[#ADB5BD] focus:bg-white focus:outline-none"
                    onChange={(event) => updateDraft(() => setDraftTitle(event.target.value))}
                    value={draftTitle}
                  />
                  <textarea
                    className="min-h-[120px] w-full rounded-xl border border-[#EAEAEA] bg-[#F8F9FA] px-4 py-3 text-[14px] leading-7 text-[#495057] focus:border-[#ADB5BD] focus:bg-white focus:outline-none"
                    onChange={(event) => updateDraft(() => setDraftSummary(event.target.value))}
                    value={draftSummary}
                  />
                  <textarea
                    className="min-h-[100px] w-full rounded-xl border border-[#EAEAEA] bg-[#F8F9FA] px-4 py-3 text-[14px] leading-7 text-[#495057] focus:border-[#ADB5BD] focus:bg-white focus:outline-none"
                    onChange={(event) => updateDraft(() => setDraftNote(event.target.value))}
                    placeholder="备注"
                    value={draftNote}
                  />
                  <input
                    className="w-full rounded-xl border border-[#EAEAEA] bg-[#F8F9FA] px-4 py-3 text-[14px] text-[#495057] focus:border-[#ADB5BD] focus:bg-white focus:outline-none"
                    onChange={(event) => updateDraft(() => setDraftTags(event.target.value))}
                    placeholder="标签，用逗号分隔"
                    value={draftTags}
                  />
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      disabled={!hasDraftChanges || editSaveStatus === 'saving'}
                      loading={editSaveStatus === 'saving'}
                      onClick={handleSave}
                      variant="primary"
                    >
                      {editSaveStatus === 'saving' ? '保存中' : '保存修改'}
                    </Button>
                    <Button onClick={handleToggleEditing} variant="secondary">
                      取消编辑
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="relative mb-8">
                  <h1 className="max-w-4xl text-[32px] font-semibold leading-tight tracking-tight text-[#1A1A1A]">{selectedCard.userTitle || selectedCard.title}</h1>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <button
                      aria-label={`打开原文：${selectedCard.siteName}`}
                      className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-[#B8E0D7] bg-[#E9FBF7] px-3 py-1.5 text-[12px] font-semibold text-[#2F6F68] transition-colors hover:bg-[#DDF7F0]"
                      onClick={handleOpenSource}
                      type="button"
                    >
                      <span className="truncate">{selectedCard.siteName}</span>
                      <ExternalLink size={13} />
                    </button>
                    {tags.map((tag) => (
                      <span
                        className="inline-flex max-w-full items-center rounded-full border border-[#E5DBFF] bg-[#F3F0FF] px-3 py-1.5 text-[12px] font-semibold text-[#5F3DC4]"
                        key={tag.id}
                      >
                        <span className="truncate">{tag.name}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <section className="relative mb-10 max-w-4xl rounded-xl border border-[#EAEAEA] bg-white/90 p-5 shadow-sm">
                <h2 className="mb-3 text-[15px] font-semibold text-[#1A1A1A]">内容摘要</h2>
                <p className="text-[15px] leading-[1.8] text-[#495057]">{selectedCard.userSummary || selectedCard.summary || '暂无摘要。'}</p>
              </section>

              {selectedCard.note && (
                <section className="relative mb-10 max-w-4xl">
                  <h2 className="mb-4 text-[20px] font-semibold text-[#1A1A1A]">备注</h2>
                  <p className="text-[15px] leading-[1.8] text-[#495057]">{selectedCard.note}</p>
                </section>
              )}

              {Boolean(selectedCard.answerArchives?.length) && (
                <section className="relative mb-10 max-w-4xl">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-[20px] font-semibold text-[#1A1A1A]">问答归档</h2>
                      <p className="mt-1 text-[12px] text-[#868E96]">{selectedCard.answerArchives?.length ?? 0} 条已归档对话</p>
                    </div>
                    <button
                      aria-label={isArchivesExpanded ? '收起问答归档' : '展开问答归档'}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[#EAEAEA] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#495057] hover:bg-[#F8F9FA]"
                      onClick={() => setIsArchivesExpanded((current) => !current)}
                      type="button"
                    >
                      {isArchivesExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      {isArchivesExpanded ? '收起' : '展开'}
                    </button>
                  </div>
                  {isArchivesExpanded && (
                    <div className="space-y-4">
                      {selectedCard.answerArchives?.map((archive) => (
                        <article className="rounded-2xl border border-[#EAEAEA] bg-[#F8F9FA] p-5" key={archive.id}>
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <h3 className="text-[14px] font-semibold leading-6 text-[#1A1A1A]">{archive.question}</h3>
                            <span className="shrink-0 text-[11px] text-[#ADB5BD]">{format(new Date(archive.createdAt), 'MM/dd HH:mm')}</span>
                          </div>
                          <p className="whitespace-pre-wrap text-[14px] leading-7 text-[#495057]">{archive.answer}</p>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              )}

              <section className="relative max-w-4xl">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <h2 className="text-[20px] font-semibold text-[#1A1A1A]">原文</h2>
                </div>
                <MarkdownContent content={articleContent} imageAssets={selectedCard?.imageAssets ?? []} />
              </section>
            </article>
          </div>

          <div className="pointer-events-none absolute inset-y-0 right-6 z-30 flex flex-col items-end justify-end py-6" data-testid="ask-ai-float">
            {isAskPanelOpen && (
              <div
                className="pointer-events-auto mb-3 ml-auto flex h-[50%] min-h-[360px] w-[min(360px,calc(100vw-48px))] flex-col rounded-2xl border border-[#EAEAEA] bg-white p-4 shadow-xl"
                data-testid="ask-ai-panel"
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="text-[14px] font-semibold text-[#1A1A1A]">问问AI</h2>
                  <div className="flex items-center gap-1">
                    <button
                      aria-label="归档对话"
                      className="rounded-md p-1.5 text-[#868E96] hover:bg-[#F1F3F5] disabled:opacity-40"
                      disabled={!canArchiveConversation || archiveAnswerMutation.isPending}
                      onClick={() => void handleArchiveConversation()}
                      title="归档对话"
                      type="button"
                    >
                      <Archive size={15} />
                    </button>
                    <button
                      aria-label="折叠聊天框"
                      className="rounded-md p-1.5 text-[#868E96] hover:bg-[#F1F3F5]"
                      onClick={() => setIsAskPanelOpen(false)}
                      title="折叠聊天框"
                      type="button"
                    >
                      <Minimize2 size={15} />
                    </button>
                  </div>
                </div>
                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-xl bg-[#F8F9FA] p-3">
                  {chatMessages.length === 0 && (
                    <p className="text-[13px] leading-6 text-[#868E96]">选一个问题开始，或直接输入你想追问的点。</p>
                  )}
                  {chatMessages.map((message) => (
                    <div
                      className={cn(
                        'flex',
                        message.role === 'user' ? 'justify-end' : 'justify-start',
                      )}
                      key={message.id}
                    >
                      <p
                        className={cn(
                          'max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-[13px] leading-6',
                          message.role === 'user'
                            ? 'bg-[#2B2B2B] text-white'
                            : 'border border-[#EAEAEA] bg-white text-[#495057]',
                        )}
                      >
                        {message.content || '正在生成回答...'}
                      </p>
                    </div>
                  ))}
                </div>
                {!hasAskedQuestion && suggestedQuestions.length > 0 && (
                  <div className="mt-3 flex flex-wrap justify-end gap-2">
                    {suggestedQuestions.map((suggestedQuestion) => (
                      <button
                        className="rounded-full border border-[#EAEAEA] bg-[#F8F9FA] px-3 py-1.5 text-left text-[12px] font-medium leading-5 text-[#495057] hover:bg-[#F1F3F5]"
                        key={suggestedQuestion}
                        onClick={() => setQuestion(suggestedQuestion)}
                        type="button"
                      >
                        {suggestedQuestion}
                      </button>
                    ))}
                  </div>
                )}
                <form className="mt-3 flex gap-2" onSubmit={(event) => void handleAskSubmit(event)}>
                  <input
                    className="min-w-0 flex-1 rounded-lg border border-[#EAEAEA] bg-[#F8F9FA] px-3 py-2 text-[13px] text-[#212529] outline-none focus:border-[#ADB5BD] focus:bg-white"
                    onChange={(event) => setQuestion(event.target.value)}
                    placeholder={hasAskedQuestion ? '继续追问这篇文章' : '向这篇文章提问'}
                    value={question}
                  />
                  <Button
                    aria-label="发送问题"
                    disabled={!question.trim()}
                    icon={<Send size={15} />}
                    type="submit"
                    variant="icon"
                  />
                </form>
                {isAnswering && <p className="mt-2 text-right text-[12px] text-[#868E96]">AI 正在回复...</p>}
                {answerError && <p className="mt-3 text-[13px] leading-6 text-[#C92A2A]">{answerError}</p>}
              </div>
            )}
            <button
              aria-label="问问AI"
              className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-[#3A3A3A] bg-[#2B2B2B] px-4 py-2.5 text-[14px] font-semibold text-white shadow-lg transition-colors hover:bg-[#1F1F1F]"
              onClick={() => setIsAskPanelOpen((current) => !current)}
              type="button"
            >
              <MessageCircle size={16} />
              问问AI
            </button>
          </div>
        </div>
      )}
      {confirmAction && (
        <ConfirmDialog
          cancelLabel="取消"
          confirmLabel={confirmAction === 'refresh' ? '重新抓取' : '重新生成'}
          description={confirmAction === 'refresh'
            ? '重新抓取会加入统一导入队列，后台重新抓取原文并覆盖当前卡片内容。'
            : '重新生成会更新 AI 摘要和标签，可能覆盖你手动调整过的摘要与标签。'}
          onCancel={() => setConfirmAction(null)}
          onConfirm={() => void handleConfirmedAction()}
          title={confirmAction === 'refresh' ? '确认重新抓取原文？' : '确认重新生成摘要和标签？'}
        />
      )}
    </div>
  );
}
