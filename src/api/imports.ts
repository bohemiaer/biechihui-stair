import { fetchJson, resolveDataSource } from './client';
import * as mockSource from './mockSource';
import type { ImportTask } from '../types';

type CreateImportTaskInput = Parameters<typeof mockSource.createImportTask>[0];

export function getRecentImportTasks(): Promise<ImportTask[]> {
  if (resolveDataSource() === 'mock') {
    return mockSource.getRecentImportTasks();
  }

  return fetchJson<ImportTask[]>('/api/import-tasks/recent');
}

export function createImportTask(input: CreateImportTaskInput): Promise<ImportTask> {
  if (resolveDataSource() === 'mock') {
    return mockSource.createImportTask(input);
  }

  return fetchJson<ImportTask>('/api/import-tasks', {
    body: JSON.stringify(input),
    method: 'POST',
  });
}

export function retryImportTask(id: string): Promise<ImportTask> {
  if (resolveDataSource() === 'mock') {
    return mockSource.retryImportTask(id);
  }

  return fetchJson<ImportTask>(`/api/import-tasks/${id}/retry`, {
    method: 'POST',
  });
}
