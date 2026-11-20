import { NavLink } from "@mantine/core";
import { useLocalStorage } from "@mantine/hooks";
import { useAuthStore } from "@medbrains/stores";
import { IconAdjustmentsHorizontal } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router";
import classes from "./AppLayout.module.scss";

interface PanelPage {
  path: string;
  isAdvanced?: boolean;
}

interface PanelPagesProps<T extends PanelPage> {
  /** The section's pages the viewer may open, in panel order. */
  pages: readonly T[];
  renderPage: (page: T) => ReactNode;
}

/** The browser key holding whether this person left "Advanced" open. */
export function advancedOpenKey(userId: string | undefined): string {
  return `mb-nav-advanced-open:${userId ?? "anonymous"}`;
}

/**
 * A menu section's pages: the usual ones, then the Advanced ones in a group that stays closed
 * until the person opens it, so a small hospital's Administration shows what it uses. The choice
 * is kept per person in this browser; the group also shows open while one of its pages is open.
 */
export function PanelPages<T extends PanelPage>({ pages, renderPage }: PanelPagesProps<T>) {
  const { t } = useTranslation("nav");
  const { pathname } = useLocation();
  const userId = useAuthStore((s) => s.user?.id);
  const [isOpen, setOpen] = useLocalStorage({
    key: advancedOpenKey(userId),
    defaultValue: false,
    getInitialValueInEffect: false,
  });
  const advanced = pages.filter((page) => page.isAdvanced);
  const isHere = advanced.some((p) => pathname === p.path || pathname.startsWith(`${p.path}/`));
  return (
    <>
      {pages.filter((page) => !page.isAdvanced).map(renderPage)}
      {advanced.length > 0 && (
        <NavLink
          component="button"
          type="button"
          label={t("advanced")}
          leftSection={
            <span className={classes.navIcon}>
              <IconAdjustmentsHorizontal size={20} stroke={1.5} />
            </span>
          }
          opened={isOpen || isHere}
          onChange={setOpen}
          aria-expanded={isOpen || isHere}
          className={classes.expandedChild}
        >
          {advanced.map(renderPage)}
        </NavLink>
      )}
    </>
  );
}
