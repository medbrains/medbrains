import { useMemo } from "react";
import { useLauncherData, useToggleFavourite } from "./useFavourites";

/** The side panel's view of the person's stars: the launcher's list, on the server. */
export interface PanelFavourites {
  isStarred: (path: string) => boolean;
  /** Stars or unstars `path`; ignored while a change is in flight. */
  toggle: (path: string) => void;
  isPending: boolean;
  isError: boolean;
}

/**
 * The person's starred screens for the side panel, shared with the launcher
 * through one query. One change at a time, so a double click cannot send
 * "star" twice.
 */
export function usePanelFavourites(): PanelFavourites {
  const launcher = useLauncherData();
  const mutation = useToggleFavourite();
  const starred = useMemo(() => new Set(launcher.data?.favourites), [launcher.data]);
  const { isPending, mutate } = mutation;
  return useMemo(
    () => ({
      isStarred: (path: string) => starred.has(path),
      toggle: (path: string) => {
        if (isPending) return;
        mutate({ path, starred: !starred.has(path) });
      },
      isPending,
      isError: launcher.isError,
    }),
    [starred, isPending, mutate, launcher.isError],
  );
}
