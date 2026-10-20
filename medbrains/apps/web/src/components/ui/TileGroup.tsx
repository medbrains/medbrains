import {
  Box,
  Group,
  Radio,
  type RadioGroupProps,
  SimpleGrid,
  type SimpleGridProps,
  Text,
} from "@mantine/core";
import { useHotkeys } from "@mantine/hooks";
import { type CSSProperties, forwardRef, type ReactNode } from "react";
import styles from "./tile-group.module.scss";

/** One choice in a `TileGroup`. */
export interface TileOption {
  value: string;
  label: string;
  icon?: ReactNode;
  /** A line under the label: what the tile does, or why it cannot be picked. */
  hint?: ReactNode;
  disabled?: boolean;
  /** The number key (1–9) that picks it; its position by default. */
  hotkey?: number;
}

export type TileGroupStylesNames = "root" | "grid" | "tile" | "key" | "label" | "hint";

export interface TileGroupProps
  extends Omit<
    RadioGroupProps,
    "children" | "onChange" | "value" | "classNames" | "styles" | "label"
  > {
  /** Names the group (its radiogroup is labelled by it). */
  label: string;
  data: TileOption[];
  value: string | null;
  onChange: (value: string) => void;
  /** Number keys pick a tile while focus is not in a text field. On by default. */
  hotkeys?: boolean;
  cols?: SimpleGridProps["cols"];
  classNames?: Partial<Record<TileGroupStylesNames, string>>;
  styles?: Partial<Record<TileGroupStylesNames, CSSProperties>>;
}

/** The number key each tile answers to. */
export function tileHotkeys(data: TileOption[]): Array<{ key: number; value: string }> {
  return data
    .map((tile, index) => ({ key: tile.hotkey ?? index + 1, value: tile.value, tile }))
    .filter(({ key, tile }) => key >= 1 && key <= 9 && !tile.disabled)
    .map(({ key, value }) => ({ key, value }));
}

const cx = (...names: Array<string | undefined>) => names.filter(Boolean).join(" ");

/**
 * A keyboard-first single choice laid out as tiles — a `Radio.Group` of
 * `Radio.Card`s. Each tile names its number key; pressing it picks the tile
 * (text fields keep their digits). Colour comes from the theme's radio card.
 */
export const TileGroup = forwardRef<HTMLDivElement, TileGroupProps>(function TileGroup(
  {
    data,
    value,
    onChange,
    hotkeys = true,
    cols = { base: 2, sm: 4 },
    classNames,
    styles: css,
    ...rest
  },
  ref,
) {
  const keys = tileHotkeys(data);
  useHotkeys(hotkeys ? keys.map(({ key, value: v }) => [String(key), () => onChange(v)]) : []);
  const keyOf = new Map(keys.map(({ key, value: v }) => [v, key]));
  return (
    <Radio.Group
      ref={ref}
      value={value}
      onChange={onChange}
      className={classNames?.root}
      style={css?.root}
      {...rest}
    >
      <SimpleGrid cols={cols} spacing="xs" className={classNames?.grid} style={css?.grid}>
        {data.map((tile) => {
          const key = keyOf.get(tile.value);
          return (
            <Radio.Card
              key={tile.value}
              value={tile.value}
              disabled={tile.disabled}
              aria-keyshortcuts={key ? String(key) : undefined}
              className={cx(styles.tile, classNames?.tile)}
              style={css?.tile}
              data-testid={`tile-${tile.value}`}
            >
              <Group gap="xs" wrap="nowrap" align="flex-start">
                {key && (
                  <Text
                    span
                    ff="monospace"
                    size="xs"
                    c="dimmed"
                    aria-hidden="true"
                    className={classNames?.key}
                    style={css?.key}
                  >
                    {key}
                  </Text>
                )}
                {tile.icon && <Box aria-hidden="true">{tile.icon}</Box>}
                <Box className={styles.text}>
                  <Text size="sm" fw={600} className={classNames?.label} style={css?.label}>
                    {tile.label}
                  </Text>
                  {tile.hint && (
                    <Text size="xs" c="dimmed" className={classNames?.hint} style={css?.hint}>
                      {tile.hint}
                    </Text>
                  )}
                </Box>
              </Group>
            </Radio.Card>
          );
        })}
      </SimpleGrid>
    </Radio.Group>
  );
});
TileGroup.displayName = "TileGroup";
