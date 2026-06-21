import { fetchJson, resolveDataSource } from './client';
import * as mockSource from './mockSource';
import type { DailyActivity, DailyReport } from '../types';

export function getCalendarDays(): Promise<DailyActivity[]> {
  if (resolveDataSource() === 'mock') {
    return mockSource.getCalendarDays();
  }

  return fetchJson<DailyActivity[]>('/api/calendar/days');
}

export function getDailyReport(date: string): Promise<DailyReport | null> {
  if (resolveDataSource() === 'mock') {
    return mockSource.getDailyReport(date);
  }

  return fetchJson<DailyReport | null>(`/api/calendar/days/${date}`);
}

export function createDailyReport(date: string): Promise<DailyReport> {
  if (resolveDataSource() === 'mock') {
    return mockSource.createDailyReport(date);
  }

  return fetchJson<DailyReport>(`/api/calendar/days/${date}/daily-report`, { method: 'POST' });
}
