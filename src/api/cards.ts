import { fetchJson, resolveDataSource } from './client';
import * as mockSource from './mockSource';
import type { AnswerArchive, ImportTask, KnowledgeCard } from '../types';

type CardFilters = Parameters<typeof mockSource.getCards>[0];
type UpdateCardInput = Parameters<typeof mockSource.updateCard>[1];

const cardListPath = (filters: CardFilters = {}) => {
  const params = new URLSearchParams();

  if (filters.folderId) params.set('folder_id', filters.folderId);
  if (filters.includeDeleted) params.set('include_deleted', 'true');

  const query = params.toString();

  return `/api/cards${query ? `?${query}` : ''}`;
};

export function getCards(filters: CardFilters = {}): Promise<KnowledgeCard[]> {
  if (resolveDataSource() === 'mock') {
    return mockSource.getCards(filters);
  }

  return fetchJson<KnowledgeCard[]>(cardListPath(filters));
}

export function getCardById(id: string): Promise<KnowledgeCard | undefined> {
  if (resolveDataSource() === 'mock') {
    return mockSource.getCardById(id);
  }

  return fetchJson<KnowledgeCard>(`/api/cards/${id}`);
}

export function updateCard(id: string, input: UpdateCardInput): Promise<KnowledgeCard> {
  if (resolveDataSource() === 'mock') {
    return mockSource.updateCard(id, input);
  }

  return fetchJson<KnowledgeCard>(`/api/cards/${id}`, {
    body: JSON.stringify(input),
    method: 'PATCH',
  });
}

export function deleteCard(id: string): Promise<KnowledgeCard> {
  if (resolveDataSource() === 'mock') {
    return mockSource.deleteCard(id);
  }

  return fetchJson<KnowledgeCard>(`/api/cards/${id}`, {
    method: 'DELETE',
  });
}

export function restoreCard(id: string): Promise<KnowledgeCard> {
  if (resolveDataSource() === 'mock') {
    return mockSource.restoreCard(id);
  }

  return fetchJson<KnowledgeCard>(`/api/cards/${id}/restore`, {
    method: 'POST',
  });
}

export function permanentlyDeleteCard(id: string): Promise<{ id: string }> {
  if (resolveDataSource() === 'mock') {
    return mockSource.permanentlyDeleteCard(id);
  }

  return fetchJson<{ id: string }>(`/api/cards/${id}/permanent`, {
    method: 'DELETE',
  });
}

export function refreshCard(id: string): Promise<ImportTask> {
  if (resolveDataSource() === 'mock') {
    return mockSource.refreshCard(id);
  }

  return fetchJson<ImportTask>(`/api/cards/${id}/refresh`, {
    body: JSON.stringify({}),
    method: 'POST',
  });
}

export function regenerateCard(id: string): Promise<KnowledgeCard> {
  if (resolveDataSource() === 'mock') {
    return mockSource.regenerateCard(id);
  }

  return fetchJson<KnowledgeCard>(`/api/cards/${id}/regenerate`, {
    method: 'POST',
  });
}

export function archiveAnswer(
  cardId: string,
  input: { question: string; answer: string; usedCardIds: string[]; model: string },
): Promise<AnswerArchive> {
  if (resolveDataSource() === 'mock') {
    return mockSource.archiveAnswer(cardId, input);
  }

  return fetchJson<AnswerArchive>(`/api/cards/${cardId}/answer-archives`, {
    body: JSON.stringify({ cardId, ...input }),
    method: 'POST',
  });
}
