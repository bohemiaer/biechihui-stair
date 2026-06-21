import { fetchJson, resolveDataSource } from './client';
import * as mockSource from './mockSource';
import type { Folder } from '../types';

type CreateFolderInput = Parameters<typeof mockSource.createFolder>[0];
type UpdateFolderInput = Parameters<typeof mockSource.updateFolder>[1];

export function getFolders(): Promise<Folder[]> {
  if (resolveDataSource() === 'mock') {
    return mockSource.getFolders();
  }

  return fetchJson<Folder[]>('/api/folders');
}

export function createFolder(input: CreateFolderInput): Promise<Folder> {
  if (resolveDataSource() === 'mock') {
    return mockSource.createFolder(input);
  }

  return fetchJson<Folder>('/api/folders', {
    body: JSON.stringify(input),
    method: 'POST',
  });
}

export function updateFolder(id: string, input: UpdateFolderInput): Promise<Folder> {
  if (resolveDataSource() === 'mock') {
    return mockSource.updateFolder(id, input);
  }

  return fetchJson<Folder>(`/api/folders/${id}`, {
    body: JSON.stringify(input),
    method: 'PATCH',
  });
}

export function deleteFolder(id: string): Promise<{ id: string; movedCardCount: number }> {
  if (resolveDataSource() === 'mock') {
    return mockSource.deleteFolder(id);
  }

  return fetchJson<{ id: string; movedCardCount: number }>(`/api/folders/${id}`, {
    method: 'DELETE',
  });
}
