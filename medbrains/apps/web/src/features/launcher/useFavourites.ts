import type { LauncherResponse } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { describeLoadError } from "@/components/QueryError";
import { toast } from "@/components/ui";
import { launcherService } from "@/services/launcher.service";

/** The launcher query: my starred screens and every app's name. */
export const LAUNCHER_QUERY_KEY = ["launcher"] as const;

/** My starred screens and the app names, loaded once for the launcher and the side panel. */
export function useLauncherData() {
  return useQuery({
    queryKey: LAUNCHER_QUERY_KEY,
    queryFn: launcherService.getLauncher,
    staleTime: 60_000,
  });
}

/**
 * Star or unstar a screen. The server answers my list after the change, which
 * replaces the cached one, so the side panel and the launcher move together.
 */
export function useToggleFavourite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ path, starred }: { path: string; starred: boolean }) =>
      launcherService.setFavourite(path, starred),
    onSuccess: ({ favourites }) =>
      queryClient.setQueryData<LauncherResponse>(LAUNCHER_QUERY_KEY, (old) =>
        old ? { ...old, favourites } : old,
      ),
    onError: (error) => toast.error(describeLoadError(error), { title: "The star was not saved" }),
  });
}
