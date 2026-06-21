import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getHotArticles, importHotArticle } from '../api/hot';
import { queryKeys } from './keys';
import type { HotArticle } from '../types';

export function useHotArticlesQuery() {
  return useQuery({
    queryKey: queryKeys.hot.articles,
    queryFn: getHotArticles,
  });
}

export function useImportHotArticleMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: importHotArticle,
    onSuccess: (task, variables) => {
      queryClient.setQueryData<HotArticle[]>(queryKeys.hot.articles, (articles) =>
        articles?.map((article) =>
          article.id === variables.articleId
            ? { ...article, importTaskId: task.id, status: task.status === 'failed' ? 'failed' : 'running' }
            : article,
        ),
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys.hot.articles });
      void queryClient.invalidateQueries({ queryKey: queryKeys.imports.recent });
    },
  });
}
