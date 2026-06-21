import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { createDailyReport, getCalendarDays, getDailyReport } from '../api/calendar';
import { queryKeys } from './keys';

export function useCalendarDaysQuery() {
  return useQuery({
    queryKey: queryKeys.calendar.days,
    queryFn: getCalendarDays,
  });
}

export function useDailyReportQuery(date: string) {
  return useQuery({
    queryKey: queryKeys.calendar.report(date),
    queryFn: () => getDailyReport(date),
  });
}

export function useCreateDailyReportMutation(date: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => createDailyReport(date),
    onSuccess: (report) => {
      queryClient.setQueryData(queryKeys.calendar.report(date), report);
    },
  });
}
