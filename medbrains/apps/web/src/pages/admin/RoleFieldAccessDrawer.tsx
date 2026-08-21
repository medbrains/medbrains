/**
 * Per-role field redaction.
 *
 * The machinery for this has existed for some time — a middleware resolves
 * `roles.field_access_defaults`, thirteen crates honour the result, and 49
 * fields are wired to be redactable. Not one of 33 roles had a single rule
 * configured, because there was no way to write one short of SQL.
 *
 * So this screen is not new capability; it is the switch for capability that
 * was already shipped and switched off. That is worth knowing when reading it:
 * every control here maps to a `const *_FIELD` a handler already looks up.
 */

import { Accordion, Group, SegmentedControl, Stack, Text, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { api } from "@medbrains/api";
import type { CustomRole, FieldAccessLevel } from "@medbrains/types";
import { REDACTABLE_FIELDS } from "@medbrains/types";
import { IconSearch } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Alert, Badge, Button, Drawer } from "@/components/ui";

/** `edit` is the default and is never stored — only exceptions are persisted. */
const DEFAULT_LEVEL: FieldAccessLevel = "edit";

const LEVELS: { value: FieldAccessLevel; label: string }[] = [
  { value: "edit", label: "Edit" },
  { value: "view", label: "Read only" },
  { value: "mask", label: "Masked" },
  { value: "hidden", label: "Hidden" },
];

interface Props {
  role: CustomRole;
  opened: boolean;
  onClose: () => void;
}

export function RoleFieldAccessDrawer({ role, opened, onClose }: Props) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [rules, setRules] = useState<Record<string, FieldAccessLevel>>(
    () => (role.field_access_defaults as Record<string, FieldAccessLevel>) ?? {},
  );

  const save = useMutation({
    mutationFn: () =>
      // Only the exceptions go to the server. Sending `edit` for all 49 would
      // store 49 rows saying "no restriction", and the next reader would have
      // to work out that they mean nothing.
      api.updateRoleFieldAccess(
        role.id,
        Object.fromEntries(Object.entries(rules).filter(([, level]) => level !== DEFAULT_LEVEL)),
      ),
    onSuccess: () => {
      notifications.show({
        title: "Field access saved",
        message: `${restrictedCount} field${restrictedCount === 1 ? "" : "s"} restricted for ${role.name}`,
      });
      void queryClient.invalidateQueries({ queryKey: ["roles"] });
      onClose();
    },
    onError: (error: Error) =>
      notifications.show({
        color: "red",
        title: "Could not save field access",
        message: error.message,
      }),
  });

  const restrictedCount = useMemo(
    () => Object.values(rules).filter((level) => level !== DEFAULT_LEVEL).length,
    [rules],
  );

  const groups = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return REDACTABLE_FIELDS;
    return REDACTABLE_FIELDS.map((group) => ({
      ...group,
      fields: group.fields.filter(
        (field) =>
          field.key.toLowerCase().includes(needle) || field.label.toLowerCase().includes(needle),
      ),
    })).filter((group) => group.fields.length > 0);
  }, [search]);

  const setLevel = (key: string, level: FieldAccessLevel) =>
    setRules((current) => ({ ...current, [key]: level }));

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size="xl"
      title={`Field access — ${role.name}`}
    >
      <Stack gap="md">
        <Alert tone="info" title="What this controls">
          <Text size="sm">
            Every field left as <strong>Edit</strong> behaves normally. Anything else is enforced by
            the server on every response — a masked field arrives masked, a hidden one does not
            arrive at all. Nothing here relies on the browser respecting it.
          </Text>
        </Alert>

        <Group justify="space-between">
          <TextInput
            placeholder="Search fields"
            leftSection={<IconSearch size={14} />}
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
            style={{ flex: 1 }}
            aria-label="Search redactable fields"
          />
          <Badge tone={restrictedCount > 0 ? "warning" : "neutral"}>
            {restrictedCount} restricted
          </Badge>
        </Group>

        <Accordion multiple defaultValue={[]}>
          {groups.map((group) => {
            const groupRestricted = group.fields.filter(
              (field) => (rules[field.key] ?? DEFAULT_LEVEL) !== DEFAULT_LEVEL,
            ).length;
            return (
              <Accordion.Item key={group.module} value={group.module}>
                <Accordion.Control>
                  <Group justify="space-between" pr="md">
                    <Text size="sm" fw={600}>
                      {group.label}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {groupRestricted > 0
                        ? `${groupRestricted} of ${group.fields.length} restricted`
                        : `${group.fields.length} fields`}
                    </Text>
                  </Group>
                </Accordion.Control>
                <Accordion.Panel>
                  <Stack gap="sm">
                    {group.fields.map((field) => (
                      <Group key={field.key} justify="space-between" wrap="nowrap" gap="md">
                        <Stack gap={0} style={{ minWidth: 0 }}>
                          <Text size="sm">{field.label}</Text>
                          {field.note ? (
                            // Surfaced because loosening one of these is a
                            // regulatory decision, not a preference, and the
                            // person clicking should know which is which.
                            <Text size="xs" c="orange">
                              {field.note}
                            </Text>
                          ) : (
                            <Text size="xs" c="dimmed">
                              {field.key}
                            </Text>
                          )}
                        </Stack>
                        <SegmentedControl
                          size="xs"
                          value={rules[field.key] ?? DEFAULT_LEVEL}
                          onChange={(value) => setLevel(field.key, value as FieldAccessLevel)}
                          data={LEVELS}
                          aria-label={`Access level for ${field.label}`}
                        />
                      </Group>
                    ))}
                  </Stack>
                </Accordion.Panel>
              </Accordion.Item>
            );
          })}
        </Accordion>

        {groups.length === 0 ? (
          <Text size="sm" c="dimmed">
            No field matches “{search}”.
          </Text>
        ) : null}

        <Group justify="flex-end">
          <Button tone="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button tone="primary" loading={save.isPending} onClick={() => save.mutate()}>
            Save field access
          </Button>
        </Group>
      </Stack>
    </Drawer>
  );
}
