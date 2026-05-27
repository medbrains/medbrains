import { Button, Combobox, InputBase, Modal, Stack, Text, useCombobox } from "@mantine/core";
import { IconPlus, IconSearch } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { useState } from "react";

interface CreateFormContext<T> {
  searchText: string;
  close: () => void;
  selectItem: (item: T) => void;
}

interface SearchOrCreateProps<T> {
  value: string;
  label: string;
  placeholder: string;
  items: T[];
  getItemValue: (item: T) => string;
  getItemDisplay: (item: T) => string;
  selectedDisplay?: string;
  renderItem: (item: T) => ReactNode;
  onSelect: (item: T) => void;
  onClear: () => void;
  onSearchChange: (search: string) => void;
  searchText: string;
  minSearchLength?: number;
  required?: boolean;
  size?: string;
  error?: string;
  leftSection?: ReactNode;
  emptyLabel: string;
  typeToSearchLabel?: string;
  canCreate?: boolean;
  createButtonLabel?: string;
  createModalTitle?: string;
  createModalSize?: string;
  createButtonIcon?: ReactNode;
  renderCreateForm?: (context: CreateFormContext<T>) => ReactNode;
}

export function SearchOrCreate<T>({
  value,
  label,
  placeholder,
  items,
  getItemValue,
  getItemDisplay,
  selectedDisplay,
  renderItem,
  onSelect,
  onClear,
  onSearchChange,
  searchText,
  minSearchLength = 2,
  required,
  size = "sm",
  error,
  leftSection = <IconSearch size={14} />,
  emptyLabel,
  typeToSearchLabel = "Type at least 2 characters...",
  canCreate = false,
  createButtonLabel = "Create new",
  createModalTitle = "Create new",
  createModalSize = "lg",
  createButtonIcon = <IconPlus size={14} />,
  renderCreateForm,
}: SearchOrCreateProps<T>) {
  const combobox = useCombobox({ onDropdownClose: () => combobox.resetSelectedOption() });
  const [displayValue, setDisplayValue] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const inputValue = searchText || displayValue || selectedDisplay || "";
  const canShowCreate = Boolean(
    canCreate && renderCreateForm && searchText.length >= minSearchLength,
  );

  const selectItem = (item: T) => {
    onSelect(item);
    const display = getItemDisplay(item);
    setDisplayValue(display);
    onSearchChange(display);
    combobox.closeDropdown();
  };

  const handleSelect = (itemId: string) => {
    const item = items.find((candidate) => getItemValue(candidate) === itemId);
    if (item) {
      selectItem(item);
    }
  };

  return (
    <>
      <Combobox
        store={combobox}
        onOptionSubmit={handleSelect}
        middlewares={{ flip: true, shift: true, size: true }}
        position="bottom-start"
        shadow="lg"
        withinPortal
        zIndex={3000}
      >
        <Combobox.Target>
          <InputBase
            label={label}
            placeholder={placeholder}
            required={required}
            size={size}
            error={error}
            leftSection={leftSection}
            value={inputValue}
            onChange={(event) => {
              const next = event.currentTarget.value;
              onSearchChange(next);
              if (!next) {
                onClear();
                setDisplayValue("");
              }
              combobox.openDropdown();
              combobox.updateSelectedOptionIndex();
            }}
            onFocus={() => {
              if (searchText.length >= minSearchLength) {
                combobox.openDropdown();
              }
            }}
            onBlur={() => {
              combobox.closeDropdown();
              if (!value) {
                onSearchChange("");
              } else {
                onSearchChange(displayValue || selectedDisplay || "");
              }
            }}
            rightSectionPointerEvents="none"
          />
        </Combobox.Target>
        <Combobox.Dropdown>
          <Combobox.Options mah={280} style={{ overflowY: "auto" }}>
            {items.length > 0 ? (
              items.map((item) => (
                <Combobox.Option key={getItemValue(item)} value={getItemValue(item)}>
                  {renderItem(item)}
                </Combobox.Option>
              ))
            ) : searchText.length >= minSearchLength ? (
              <Combobox.Empty>
                <Stack gap={8} p="xs">
                  <Text size="sm" c="dimmed">
                    {emptyLabel}
                  </Text>
                  {canShowCreate && (
                    <Button
                      size="xs"
                      variant="light"
                      leftSection={createButtonIcon}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        combobox.closeDropdown();
                        setCreateOpen(true);
                      }}
                    >
                      {createButtonLabel}
                    </Button>
                  )}
                </Stack>
              </Combobox.Empty>
            ) : (
              <Combobox.Empty>{typeToSearchLabel}</Combobox.Empty>
            )}
          </Combobox.Options>
        </Combobox.Dropdown>
      </Combobox>

      {renderCreateForm && (
        <Modal
          opened={createOpen}
          onClose={() => setCreateOpen(false)}
          title={createModalTitle}
          size={createModalSize}
          centered
        >
          {createOpen &&
            renderCreateForm({
              searchText,
              close: () => setCreateOpen(false),
              selectItem: (item) => {
                selectItem(item);
                setCreateOpen(false);
              },
            })}
        </Modal>
      )}
    </>
  );
}
