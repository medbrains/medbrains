/**
 * Group flat options into the shape Mantine v7 expects.
 *
 * Mantine v6 accepted a `group` property on each option and did the grouping
 * itself. v7 does not: grouped data is `{ group, items: [...] }`, and its
 * parser reads a flat option carrying `group` as a group whose `items` it then
 * maps —
 *
 *     if (typeof item === "object" && "group" in item)
 *       return { group: item.group, items: item.items.map(...) };
 *
 * — so `{ value, label, group }` crashes the component with
 * `Cannot read properties of undefined (reading 'map')`. It is not a type
 * error, because `group` is a legal key on a Mantine option; the failure only
 * appears when somebody opens the screen.
 *
 * Building the options flat and grouping here keeps the call site reading like
 * the data it came from, and keeps the v6-shaped object from ever reaching a
 * Select.
 */

export interface FlatSelectOption {
  value: string;
  label: string;
  /** Heading to file this option under. Ungrouped when absent or blank. */
  group?: string | null;
  disabled?: boolean;
}

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectOptionGroup {
  group: string;
  items: SelectOption[];
}

export type GroupedSelectData = Array<SelectOption | SelectOptionGroup>;

function bare(option: FlatSelectOption): SelectOption {
  return option.disabled === undefined
    ? { value: option.value, label: option.label }
    : { value: option.value, label: option.label, disabled: option.disabled };
}

/**
 * Groups are emitted in the order their first option appears, and ungrouped
 * options keep their position among them.
 *
 * Sorting alphabetically instead would reorder a list the caller had already
 * put in a deliberate order — a store list sorted by proximity, a catalogue
 * sorted by how often something is picked.
 */
export function groupedSelectData(options: ReadonlyArray<FlatSelectOption>): GroupedSelectData {
  const data: GroupedSelectData = [];
  const groups = new Map<string, SelectOptionGroup>();

  for (const option of options) {
    const name = option.group?.trim();
    if (!name) {
      data.push(bare(option));
      continue;
    }
    const existing = groups.get(name);
    if (existing) {
      existing.items.push(bare(option));
      continue;
    }
    const created: SelectOptionGroup = { group: name, items: [bare(option)] };
    groups.set(name, created);
    data.push(created);
  }

  return data;
}
