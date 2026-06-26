import { ActionIcon, Tooltip, useMantineColorScheme } from "@mantine/core";
import { Moon, Sun } from "lucide-react";
import classes from "./theme-toggle.module.scss";

type DocWithViewTransition = Document & {
  startViewTransition?: (callback: () => void) => void;
};

/**
 * Light/dark theme toggle with a smooth animated sun↔moon swap. The scheme
 * change is wrapped in the View Transitions API for a crossfade where
 * supported (graceful instant fallback otherwise). Honours
 * prefers-reduced-motion via the SCSS.
 */
export function ThemeToggle() {
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const isDark = colorScheme === "dark";

  const toggle = () => {
    const next = isDark ? "light" : "dark";
    const doc = document as DocWithViewTransition;
    if (typeof doc.startViewTransition === "function") {
      doc.startViewTransition(() => setColorScheme(next));
    } else {
      setColorScheme(next);
    }
  };

  return (
    <Tooltip label={isDark ? "Light mode" : "Dark mode"} withArrow>
      <ActionIcon
        size="md"
        color="slate"
        variant="subtle"
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        onClick={toggle}
      >
        <span className={classes.iconWrap} data-dark={isDark}>
          <Sun size={18} className={classes.sun} aria-hidden />
          <Moon size={18} className={classes.moon} aria-hidden />
        </span>
      </ActionIcon>
    </Tooltip>
  );
}
