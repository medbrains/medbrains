import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

interface UseCreateInlineOptions {
  queryKey: string[];
}

export function useCreateInline<T>({ queryKey }: UseCreateInlineOptions) {
  const queryClient = useQueryClient();
  const [createModalOpened, setCreateModalOpened] = useState(false);
  const [pendingSelect, setPendingSelect] = useState<T | null>(null);

  const openCreateModal = useCallback(() => {
    setCreateModalOpened(true);
  }, []);

  const closeCreateModal = useCallback(() => {
    setCreateModalOpened(false);
  }, []);

  const onCreated = useCallback(
    (entity: T) => {
      void queryClient.invalidateQueries({ queryKey });
      setPendingSelect(entity);
      setCreateModalOpened(false);
    },
    [queryClient, queryKey],
  );

  const clearPendingSelect = useCallback(() => {
    setPendingSelect(null);
  }, []);

  return {
    createModalOpened,
    openCreateModal,
    closeCreateModal,
    onCreated,
    pendingSelect,
    clearPendingSelect,
  };
}
