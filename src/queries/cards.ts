import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  deleteCard,
  archiveAnswer,
  getCardById,
  getCards,
  permanentlyDeleteCard,
  refreshCard,
  regenerateCard,
  restoreCard,
  updateCard,
} from '../api/cards';
import type { KnowledgeCard } from '../types';
import { queryKeys } from './keys';

export function useCardsQuery(folderId?: string, includeDeleted = false) {
  return useQuery({
    queryKey: [...queryKeys.cards.list(folderId), includeDeleted] as const,
    queryFn: () => getCards({ folderId, includeDeleted }),
  });
}

export function useCardQuery(id?: string) {
  return useQuery({
    queryKey: queryKeys.cards.detail(id ?? ''),
    queryFn: () => getCardById(id ?? ''),
    enabled: Boolean(id),
  });
}

export function useUpdateCardMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof updateCard>[1] }) => updateCard(id, input),
    onSuccess: (card: KnowledgeCard) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.cards.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.cards.detail(card.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.home.summary });
      void queryClient.invalidateQueries({ queryKey: queryKeys.home.activity });
      void queryClient.invalidateQueries({ queryKey: queryKeys.calendar.days });
    },
  });
}

export function useDeleteCardMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteCard,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.cards.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.home.summary });
      void queryClient.invalidateQueries({ queryKey: queryKeys.home.activity });
      void queryClient.invalidateQueries({ queryKey: queryKeys.calendar.days });
    },
  });
}

export function useRestoreCardMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: restoreCard,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.cards.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.home.summary });
      void queryClient.invalidateQueries({ queryKey: queryKeys.home.activity });
      void queryClient.invalidateQueries({ queryKey: queryKeys.calendar.days });
    },
  });
}

export function usePermanentlyDeleteCardMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: permanentlyDeleteCard,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.cards.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.home.summary });
      void queryClient.invalidateQueries({ queryKey: queryKeys.home.activity });
      void queryClient.invalidateQueries({ queryKey: queryKeys.calendar.days });
    },
  });
}

export function useRefreshCardMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: refreshCard,
    onSuccess: (task) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.cards.all });
      if (task.targetCardId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.cards.detail(task.targetCardId) });
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.imports.recent });
      void queryClient.invalidateQueries({ queryKey: queryKeys.home.activity });
      void queryClient.invalidateQueries({ queryKey: queryKeys.calendar.days });
    },
  });
}

export function useRegenerateCardMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: regenerateCard,
    onSuccess: (card: KnowledgeCard) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.cards.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.cards.detail(card.id) });
    },
  });
}

export function useArchiveAnswerMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ cardId, input }: { cardId: string; input: Parameters<typeof archiveAnswer>[1] }) => archiveAnswer(cardId, input),
    onSuccess: (_archive, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.cards.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.cards.detail(variables.cardId) });
    },
  });
}
