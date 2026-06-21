import { useQuery } from '@tanstack/react-query';

import { getDailyActivity, getHomeSummary } from '../api/home';
import { queryKeys } from './keys';

export function useHomeSummaryQuery() {
  return useQuery({
    queryKey: queryKeys.home.summary,
    queryFn: getHomeSummary,
  });
}

export function useDailyActivityQuery() {
  return useQuery({
    queryKey: queryKeys.home.activity,
    queryFn: getDailyActivity,
  });
}
