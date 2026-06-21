import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { createFolder, deleteFolder, getFolders, updateFolder } from '../api/folders';
import { queryKeys } from './keys';

export function useFoldersQuery() {
  return useQuery({
    queryKey: queryKeys.folders.all,
    queryFn: getFolders,
  });
}

export function useCreateFolderMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createFolder,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.folders.all });
    },
  });
}

export function useUpdateFolderMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof updateFolder>[1] }) => updateFolder(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.folders.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.cards.all });
    },
  });
}

export function useDeleteFolderMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteFolder,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.folders.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.cards.all });
    },
  });
}
