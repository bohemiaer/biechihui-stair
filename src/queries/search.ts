import { useMutation, useQuery } from '@tanstack/react-query';

import { answerQuestion, searchCards } from '../api/search';
import { queryKeys } from './keys';

export function useSearchCardsQuery(query: string) {
  return useQuery({
    queryKey: queryKeys.search.results(query),
    queryFn: () => searchCards(query),
    enabled: query.trim().length > 0,
  });
}

export function useAnswerQuestionMutation() {
  return useMutation({
    mutationFn: answerQuestion,
  });
}
