import { Button, Combobox, InputBase, Modal, Stack, Text, useCombobox } from "@mantine/core";
import { IconPlus, IconSearch } from "@tabler/icons-react";
import type { ReactNode, Ref } from "react";
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
  disabled?: boolean;
  size?: string;
  error?: string;
  leftSection?: ReactNode;
  emptyLabel: string;
  typeToSearchLabel?: string;
  /** True while a search is debouncing or in flight — never reads as "none found". */
  loading?: boolean;
  /** The lookup failed. Shown instead of the empty label: a fault is not "no results". */
  fetchError?: string | null;
  canCreate?: boolean;
  createButtonLabel?: string;
  createModalTitle?: string;
  createModalSize?: string;
  createButtonIcon?: ReactNode;
  renderCreateForm?: (context: CreateFormContext<T>) => ReactNode;
  /** Empty the box after each pick — a counter adding line after line. */
  clearOnSelect?: boolean;
  inputRef?: Ref<HTMLInputElement>;
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
  disabled,
  size = "sm",
  error,
  leftSection = <IconSearch size={14} />,
  emptyLabel,
  typeToSearchLabel,
  loading = false,
  fetchError = null,
  canCreate = false,
  createButtonLabel = "Create new",
  createModalTitle = "Create new",
  createModalSize = "lg",
  createButtonIcon = <IconPlus size={14} />,
  renderCreateForm,
  clearOnSelect = false,
  inputRef,
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
    const display = clearOnSelect ? "" : getItemDisplay(item);
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
            ref={inputRef}
            label={label}
            placeholder={placeholder}
            required={required}
            disabled={disabled}
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
            {fetchError ? (
              <Combobox.Empty>
                <Text size="sm" c="danger" role="alert">
                  {fetchError}
                </Text>
              </Combobox.Empty>
            ) : items.length > 0 ? (
              items.map((item) => (
                <Combobox.Option key={getItemValue(item)} value={getItemValue(item)}>
                  {renderItem(item)}
                </Combobox.Option>
              ))
            ) : loading && searchText.length >= minSearchLength ? (
              <Combobox.Empty>Searching…</Combobox.Empty>
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
              <Combobox.Empty>
                {typeToSearchLabel ?? `Type at least ${minSearchLength} characters…`}
              </Combobox.Empty>
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
