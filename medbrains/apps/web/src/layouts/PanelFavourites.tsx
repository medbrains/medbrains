import { Box, Divider, Text } from "@mantine/core";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import classes from "./AppLayout.module.scss";

interface PanelFavouritesGroupProps<T> {
  /** The starred entries the person can still open, already filtered. */
  items: T[];
  isError: boolean;
  renderItem: (item: T) => ReactNode;
}

/**
 * The Favourites group at the top of the expanded side panel. A failed read
 * says so instead of showing no group, which would read as "no favourites".
 */
export function PanelFavouritesGroup<T>({
  items,
  isError,
  renderItem,
}: PanelFavouritesGroupProps<T>) {
  const { t } = useTranslation("nav");
  return (
    <>
      {isError && (
        <Text className={classes.navGroupLabel} role="alert">
          {t("favouritesLoadFailed")}
        </Text>
      )}
      {items.length > 0 && (
        <Box>
          <Text className={classes.navGroupLabel}>{t("groupFavorites")}</Text>
          {items.map(renderItem)}
          <Divider my={4} className={classes.railDivider} />
        </Box>
      )}
    </>
  );
}
