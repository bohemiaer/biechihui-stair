import { fetchJson, resolveDataSource } from './client';
import * as mockSource from './mockSource';
import type { HotArticle, ImportTask } from '../types';

type ImportHotArticleInput = Parameters<typeof mockSource.importHotArticle>[0];

export function getHotArticles(): Promise<HotArticle[]> {
  if (resolveDataSource() === 'mock') {
    return mockSource.getHotArticles();
  }

  return fetchJson<HotArticle[]>('/api/hot/articles');
}

export function importHotArticle(input: ImportHotArticleInput): Promise<ImportTask> {
  if (resolveDataSource() === 'mock') {
    return mockSource.importHotArticle(input);
  }

  return fetchJson<ImportTask>(`/api/hot/articles/${input.articleId}/import`, {
    body: JSON.stringify({ folderId: input.folderId }),
    method: 'POST',
  });
}
