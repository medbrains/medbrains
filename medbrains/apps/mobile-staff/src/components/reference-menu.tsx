/**
 * Menu-backed select. Extracted from the patient-registration screen so the
 * work-order form does not grow a second copy of it.
 *
 * A phone cannot show a dozen options as segmented buttons, and RN Paper has no
 * Select, so this is the Menu wrapped as one.
 */

import { COLORS, SPACING } from "@medbrains/ui-mobile";
import type { ReactNode } from "react";
import { useState } from "react";
import { View } from "react-native";
import { Button, Menu, Text } from "react-native-paper";

export function ReferenceMenu<T extends { id: string }>({
  title,
  rows,
  selectedId,
  label,
  placeholder,
  disabled,
  onSelect,
  onClear,
}: {
  title: string;
  rows: T[];
  selectedId: string;
  label: (row: T) => string;
  placeholder: string;
  disabled?: boolean;
  onSelect: (row: T) => void;
  onClear?: () => void;
}): ReactNode {
  const [open, setOpen] = useState(false);
  const selected = rows.find((row) => row.id === selectedId);
  const visibleRows = rows.slice(0, 24);

  return (
    <View style={{ gap: SPACING.xs }}>
      <Text variant="labelMedium" style={{ color: COLORS.ink }}>
        {title}
      </Text>
      <Menu
        visible={open}
        onDismiss={() => setOpen(false)}
        anchor={
          <Button
            mode={selected ? "contained" : "outlined"}
            disabled={disabled}
            onPress={() => setOpen(true)}
            contentStyle={{ justifyContent: "flex-start" }}
          >
            {selected ? label(selected) : placeholder}
          </Button>
        }
      >
        <View style={{ maxHeight: 320 }}>
          {onClear && selected && (
            <Menu.Item
              title="Clear selection"
              onPress={() => {
                setOpen(false);
                onClear();
              }}
            />
          )}
          {visibleRows.length === 0 && <Menu.Item title="No matches" disabled />}
          {visibleRows.map((row) => (
            <Menu.Item
              key={row.id}
              title={label(row)}
              onPress={() => {
                setOpen(false);
                onSelect(row);
              }}
            />
          ))}
          {rows.length > visibleRows.length && (
            <Menu.Item title={`Showing first ${visibleRows.length} of ${rows.length}`} disabled />
          )}
        </View>
      </Menu>
    </View>
  );
}
