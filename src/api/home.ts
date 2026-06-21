import { fetchJson, resolveDataSource } from './client';
import * as mockSource from './mockSource';
import type { DailyActivity, DashboardStats } from '../types';

export function getHomeSummary(): Promise<DashboardStats> {
  if (resolveDataSource() === 'mock') {
    return mockSource.getHomeSummary();
  }

  return fetchJson<DashboardStats>('/api/home/summary');
}

export function getDailyActivity(): Promise<DailyActivity[]> {
  if (resolveDataSource() === 'mock') {
    return mockSource.getDailyActivity();
  }

  return fetchJson<DailyActivity[]>('/api/home/activity');
}
