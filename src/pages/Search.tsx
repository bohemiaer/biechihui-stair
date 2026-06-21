import React, { useState } from 'react';
import { Archive, ArrowRight, MessageSquare, Search as SearchIcon, Sparkles } from 'lucide-react';

import { EmptyState, ErrorState, Tag } from '../components/ui';
import { useFoldersQuery } from '../queries/folders';
import { useSearchCardsQuery } from '../queries/search';
import { rewriteSearchQuery, streamAnswerQuestion } from '../api/search';
import { useArchiveAnswerMutation } from '../queries/cards';
import { getErrorMessage } from '../lib/errors';
import type { SearchResult } from '../types';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  status?: 'streaming' | 'done' | 'error';
  question?: string;
  usedCardIds?: string[];
  model?: string;
  archived?: boolean;
};

export function Search() {
  const [inputValue, setInputValue] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [rewrittenQuery, setRewrittenQuery] = useState('');
  const [selectedResults, setSelectedResults] = useState<SearchResult[]>([]);
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [answerError, setAnswerError] = useState('');
  const [isAnswering, setIsAnswering] = useState(false);
  const foldersQuery = useFoldersQuery();
  const searchQuery = useSearchCardsQuery(submittedQuery);
  const archiveAnswerMutation = useArchiveAnswerMutation();
  const results = searchQuery.data ?? [];

  const folderNameById = new Map((foldersQuery.data ?? []).map((folder) => [folder.id, folder.name]));

  const handleSearch = async (event: React.FormEvent) => {
    event.preventDefault();
    const nextQuery = inputValue.trim();

    setSubmittedQuery(nextQuery);
    setRewrittenQuery(nextQuery ? await rewriteSearchQuery(nextQuery) : '');
    setSelectedResults([]);
    setMessages([]);
    setAnswerError('');
  };

  const handleAsk = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!question.trim() || selectedResults.length === 0) return;

    const submittedQuestion = question.trim();
    const usedCardIds = selectedResults.map((result) => result.cardId);
    const userMessage: ChatMessage = { id: `u-${Date.now()}`, role: 'user', content: submittedQuestion };
    const assistantId = `a-${Date.now()}`;
    const assistantMessage: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      status: 'streaming',
      question: submittedQuestion,
      usedCardIds,
    };
    setMessages((current) => [...current, userMessage, assistantMessage]);
    setQuestion('');
    setAnswerError('');
    setIsAnswering(true);

    try {
      const response = await streamAnswerQuestion(
        { question: submittedQuestion, cardIds: usedCardIds },
        (token) => {
          setMessages((current) => current.map((message) => (
            message.id === assistantId ? { ...message, content: `${message.content}${token}` } : message
          )));
        },
      );
      setMessages((current) => current.map((message) => (
        message.id === assistantId
          ? { ...message, content: response.answer || message.content, model: response.model, status: 'done' }
          : message
      )));
    } catch (error) {
      const message = getErrorMessage(error, '回答生成失败，请稍后重试。');
      setAnswerError(message);
      setMessages((current) => current.map((item) => (
        item.id === assistantId ? { ...item, content: message, status: 'error' } : item
      )));
    } finally {
      setIsAnswering(false);
    }
  };

  const toggleSelectResult = (result: SearchResult) => {
    setSelectedResults((current) =>
      current.some((item) => item.cardId === result.cardId)
        ? current.filter((item) => item.cardId !== result.cardId)
        : [...current, result],
    );
  };

  const handleArchiveAnswer = async (message: ChatMessage) => {
    const cardId = message.usedCardIds?.[0];
    if (!cardId || !message.question || !message.content.trim()) return;
    await archiveAnswerMutation.mutateAsync({
      cardId,
      input: {
        question: message.question,
        answer: message.content,
        usedCardIds: message.usedCardIds ?? [cardId],
        model: message.model ?? '',
      },
    });
    setMessages((current) => current.map((item) => (item.id === message.id ? { ...item, archived: true } : item)));
  };

  return (
    <div className="flex h-full w-full flex-col bg-[#FFFFFF]">
      <header className="shrink-0 border-b border-[#F1F3F5] bg-[#FFFFFF] px-12 pb-8 pt-16">
        <h1 className="mb-8 text-[32px] font-semibold tracking-tight text-[#1A1A1A]">AI 检索问答</h1>
        <form className="relative max-w-3xl" onSubmit={handleSearch}>
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-[#868E96]" size={20} strokeWidth={1.5} />
          <input
            className="w-full rounded-xl border border-[#EAEAEA] bg-[#F8F9FA] py-4 pl-12 pr-6 text-[15px] transition-all focus:border-[#ADB5BD] focus:bg-[#FFFFFF] focus:outline-none"
            onChange={(event) => setInputValue(event.target.value)}
            placeholder="根据记忆检索... 例如：数据库范式化"
            type="text"
            value={inputValue}
          />
        </form>
      </header>

      <div className="flex min-h-0 flex-1 text-[#212529]">
        <div className="w-1/2 overflow-y-auto border-r border-[#EAEAEA] p-12">
          <h2 className="mb-6 text-[12px] font-bold uppercase tracking-widest text-[#868E96]">搜索结果</h2>
          {submittedQuery && rewrittenQuery && rewrittenQuery !== submittedQuery.toLowerCase() && (
            <p className="mb-4 rounded-lg bg-[#F8F9FA] px-3 py-2 text-[12px] text-[#868E96]">
              已将查询理解为：<span className="font-medium text-[#495057]">{rewrittenQuery}</span>
            </p>
          )}
          <div className="space-y-4">
            {searchQuery.isError && (
              <ErrorState
                message={getErrorMessage(searchQuery.error, '搜索失败，请换个关键词或稍后重试。')}
                onRetry={() => void searchQuery.refetch()}
              />
            )}
            {results.map((result) => {
              const card = result.card;
              const isSelected = selectedResults.some((item) => item.cardId === result.cardId);

              return (
                <button
                  className={`w-full cursor-pointer rounded-2xl border p-5 text-left transition-all ${isSelected ? 'border-[#868E96] bg-[#FFFFFF] shadow-sm' : 'border-[#EAEAEA] bg-[#F8F9FA] hover:bg-[#FFFFFF]'}`}
                  key={result.cardId}
                  onClick={() => toggleSelectResult(result)}
                  type="button"
                >
                  <div className="mb-3 flex items-start justify-between">
                    <h3 className="pr-6 text-[16px] font-medium leading-snug tracking-tight text-[#1A1A1A]">{card.userTitle || card.title}</h3>
                    <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${isSelected ? 'border-[#1A1A1A] bg-[#1A1A1A]' : 'border-[#CED4DA] bg-[#FFFFFF]'}`}>
                      {isSelected && <svg className="h-3 w-3 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>}
                    </div>
                  </div>
                  <p className="line-clamp-2 text-[14px] leading-relaxed text-[#868E96]">{card.userSummary || card.summary || card.contentPreview}</p>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <span className="rounded bg-[#E9ECEF] px-2 py-1 text-[11px] font-medium text-[#495057]">相关度 {Math.round(result.score * 100)}%</span>
                    <span className="rounded bg-[#F1F3F5] px-2 py-1 text-[11px] text-[#868E96]">{folderNameById.get(card.folderId) ?? '未分类'}</span>
                    <span className="rounded bg-[#F1F3F5] px-2 py-1 text-[11px] text-[#868E96]">{card.siteName}</span>
                    {card.tags.slice(0, 2).map((tag) => (
                      <Tag key={tag.id}>{tag.name}</Tag>
                    ))}
                  </div>
                </button>
              );
            })}

            {submittedQuery && results.length === 0 && !searchQuery.isFetching && !searchQuery.isError && (
              <EmptyState title="没有找到相关内容" description="换一个关键词，或先导入更多资料。" />
            )}
            {!submittedQuery && <EmptyState title="输入关键词开始检索" description="可以描述你想找的内容。" />}
          </div>
        </div>

        <div className="flex w-1/2 flex-col overflow-y-auto bg-[#FFFFFF] p-12">
          <h2 className="mb-6 text-[12px] font-bold uppercase tracking-widest text-[#868E96]">多文档问答综述</h2>

          <div className="mb-6 flex flex-1 flex-col justify-end">
            {messages.length > 0 ? (
              <div className="space-y-6 p-2">
                {messages.map((message) => (
                  <div className="flex items-start gap-4" key={message.id}>
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${message.role === 'user' ? 'bg-[#E9ECEF] text-[12px] font-bold text-[#868E96]' : 'bg-[#1A1A1A]'}`}>
                      {message.role === 'user' ? '我' : <Sparkles className="h-4 w-4 text-[#FFFFFF]" />}
                    </div>
                    <div className={`max-w-[88%] rounded-2xl border p-5 ${message.role === 'user' ? 'border-[#EAEAEA] bg-[#F8F9FA]' : 'border-[#EAEAEA] bg-[#FFFFFF] shadow-sm'}`}>
                      <p className={`whitespace-pre-wrap text-[14px] leading-[1.8] ${message.status === 'error' ? 'text-[#C92A2A]' : 'text-[#495057]'}`}>
                        {message.content || (message.status === 'streaming' ? '正在生成...' : '')}
                      </p>
                      {message.role === 'assistant' && message.status === 'done' && (
                        <div className="mt-4 flex items-center gap-3 border-t border-[#F1F3F5] pt-3">
                          <button
                            className="inline-flex items-center gap-1.5 rounded-lg bg-[#F1F3F5] px-3 py-1.5 text-[12px] font-medium text-[#495057] hover:bg-[#E9ECEF] disabled:opacity-60"
                            disabled={message.archived || archiveAnswerMutation.isPending}
                            onClick={() => void handleArchiveAnswer(message)}
                            type="button"
                          >
                            <Archive size={13} />
                            {message.archived ? '已归档' : '归档到文章'}
                          </button>
                          <span className="text-[11px] text-[#ADB5BD]">{message.model}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center space-y-4 text-[#ADB5BD]">
                <MessageSquare size={32} strokeWidth={1} />
                <p className="max-w-xs text-center text-[14px] leading-relaxed">选中左侧文档组合，发起提问。</p>
              </div>
            )}
            {answerError && (
              <ErrorState
                message={answerError}
              />
            )}
          </div>

          <form className="relative mt-8 border-t border-[#F1F3F5] pt-4" onSubmit={handleAsk}>
            <input
              className="w-full rounded-xl border border-[#EAEAEA] bg-[#F8F9FA] py-4 pl-5 pr-14 text-[14px] transition-all focus:border-[#ADB5BD] focus:bg-[#FFFFFF] focus:outline-none disabled:cursor-not-allowed disabled:bg-[#F1F3F5] disabled:text-[#ADB5BD]"
              disabled={selectedResults.length === 0}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder={selectedResults.length > 0 ? '向选中的知识卡提问...' : '请先勾选知识卡...'}
              type="text"
              value={question}
            />
            <button
              className="absolute right-3 top-1/2 mt-2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg bg-[#1A1A1A] text-[#FFFFFF] transition-colors disabled:bg-[#E9ECEF] disabled:text-[#ADB5BD]"
              disabled={selectedResults.length === 0 || !question.trim() || isAnswering}
              type="submit"
            >
              <ArrowRight size={16} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
