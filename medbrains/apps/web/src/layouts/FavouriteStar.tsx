import { ActionIcon, Tooltip } from "@mantine/core";
import { IconStar } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import type { PanelFavourites } from "@/features/launcher/usePanelFavourites";
import classes from "./AppLayout.module.scss";

interface FavouriteStarProps {
  path: string;
  favourites: PanelFavourites;
}

/**
 * The star beside a side-panel entry: adds the screen to the person's
 * favourites or takes it off. It sits inside the entry's link, so the click
 * stops there rather than navigating.
 */
export function FavouriteStar({ path, favourites }: FavouriteStarProps) {
  const { t } = useTranslation("nav");
  const pinned = favourites.isStarred(path);
  const label = pinned ? t("favouriteUnpin") : t("favouritePin");
  return (
    <Tooltip label={label} withArrow openDelay={400}>
      <ActionIcon
        component="div"
        role="button"
        tabIndex={-1}
        size="sm"
        variant="subtle"
        color={pinned ? "warning" : "gray"}
        className={pinned ? classes.favStarOn : classes.favStar}
        aria-label={label}
        aria-disabled={favourites.isPending || undefined}
        onClick={(event) => {
          event.stopPropagation();
          event.preventDefault();
          favourites.toggle(path);
        }}
      >
        <IconStar size={13} fill={pinned ? "currentColor" : "none"} />
      </ActionIcon>
    </Tooltip>
  );
}
