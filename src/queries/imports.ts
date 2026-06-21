import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { createImportTask, getRecentImportTasks, retryImportTask } from '../api/imports';
import type { ImportTask } from '../types';
import { queryKeys } from './keys';

export function useRecentImportTasksQuery() {
  return useQuery({
    queryKey: queryKeys.imports.recent,
    queryFn: getRecentImportTasks,
    refetchInterval: (query) => {
      const tasks = query.state.data as ImportTask[] | undefined;
      const hasRunningTask = tasks?.some((task) => task.status === 'pending' || task.status === 'running');

      return hasRunningTask ? 2500 : false;
    },
  });
}

export function useCreateImportTaskMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createImportTask,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.imports.recent });
      void queryClient.invalidateQueries({ queryKey: queryKeys.home.summary });
      void queryClient.invalidateQueries({ queryKey: queryKeys.home.activity });
      void queryClient.invalidateQueries({ queryKey: queryKeys.calendar.days });
    },
  });
}

export function useRetryImportTaskMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: retryImportTask,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.imports.recent });
    },
  });
}
