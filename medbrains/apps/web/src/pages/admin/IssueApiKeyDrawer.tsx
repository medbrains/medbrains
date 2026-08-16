/**
 * Issuing a machine credential.
 *
 * Two things here are not ordinary form work.
 *
 * **The permission list is filtered to what the issuer holds.** The server
 * refuses to mint a key carrying permissions its creator lacks, so offering
 * the full catalogue would let someone build a key, submit it, and be told no.
 * Showing only what they can actually grant turns a 403 into an absence.
 * Bypass roles see everything, because they hold everything.
 *
 * **The secret is shown once.** There is no endpoint that returns it again —
 * only a hash is stored. So the reveal is a separate step that does not close
 * on a stray click, and it says plainly that this is the only time.
 */

import { Accordion, Group, NumberInput, Stack, Text, Textarea, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { api } from "@medbrains/api";
import { usePermissionStore } from "@medbrains/stores";
import type { CreatedApiKey } from "@medbrains/types";
import { PERMISSIONS } from "@medbrains/types";
import { IconAlertTriangle, IconCopy, IconKey, IconSearch } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Alert, Badge, Button, Checkbox, Drawer } from "@/components/ui";

const BYPASS_ROLES = new Set(["super_admin", "hospital_admin"]);

/** Refused by the server whoever asks, so never offered. */
const NEVER_ON_A_KEY = new Set(["*", "admin.*", "super_admin", "hospital_admin"]);

interface Props {
  opened: boolean;
  onClose: () => void;
}

export function IssueApiKeyDrawer({ opened, onClose }: Props) {
  const queryClient = useQueryClient();
  const userPermissions = usePermissionStore((state) => state.userPermissions);
  const userRole = usePermissionStore((state) => state.userRole);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [expiresInDays, setExpiresInDays] = useState<number>(90);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [issued, setIssued] = useState<CreatedApiKey | null>(null);
  const [copied, setCopied] = useState(false);

  const canGrantAnything = userRole !== null && BYPASS_ROLES.has(userRole);

  /** What this issuer is allowed to put on a key — see the module note. */
  const grantable = useMemo(
    () =>
      PERMISSIONS.filter(
        (permission) =>
          !NEVER_ON_A_KEY.has(permission.code) &&
          (canGrantAnything || userPermissions.has(permission.code)),
      ),
    [canGrantAnything, userPermissions],
  );

  const groups = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const byModule = new Map<string, typeof grantable>();
    for (const permission of grantable) {
      if (
        needle &&
        !permission.code.toLowerCase().includes(needle) &&
        !permission.label.toLowerCase().includes(needle)
      ) {
        continue;
      }
      const list = byModule.get(permission.module) ?? [];
      list.push(permission);
      byModule.set(permission.module, list);
    }
    return [...byModule.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [grantable, search]);

  const issue = useMutation({
    mutationFn: () =>
      api.createApiKey({
        name: name.trim(),
        description: description.trim() || undefined,
        permissions: [...selected],
        expires_in_days: expiresInDays,
      }),
    onSuccess: (key) => {
      setIssued(key);
      void queryClient.invalidateQueries({ queryKey: ["api-keys"] });
    },
    onError: (error: Error) =>
      notifications.show({
        color: "red",
        title: "Could not issue the key",
        message: error.message,
      }),
  });

  const reset = () => {
    setName("");
    setDescription("");
    setExpiresInDays(90);
    setSelected(new Set());
    setSearch("");
    setIssued(null);
    setCopied(false);
    onClose();
  };

  const toggle = (code: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });

  const copySecret = async () => {
    if (!issued) return;
    await navigator.clipboard.writeText(issued.secret);
    setCopied(true);
  };

  if (issued) {
    return (
      <Drawer opened={opened} onClose={reset} position="right" size="lg" title="Key issued">
        <Stack gap="md">
          <Alert tone="warning" title="This is the only time you will see this key">
            <Text size="sm">
              Only a hash is stored, so it cannot be shown again or recovered by support. Copy it
              into your integration now — if you lose it, issue a new key and revoke this one.
            </Text>
          </Alert>

          <Stack gap={4}>
            <Text size="xs" c="dimmed">
              Secret
            </Text>
            {/* Read-only rather than plain text so it is selectable, focusable
                and announced as a value — and so a screen-reader user can
                reach it with the keyboard like any other field. */}
            <TextInput
              value={issued.secret}
              readOnly
              aria-label="API key secret"
              styles={{ input: { fontFamily: "var(--mb-font-mono)" } }}
            />
            <Group justify="flex-end">
              <Button
                tone="secondary"
                leftSection={<IconCopy size={14} />}
                onClick={() => void copySecret()}
              >
                {copied ? "Copied" : "Copy secret"}
              </Button>
            </Group>
          </Stack>

          <Stack gap={4}>
            <Text size="xs" c="dimmed">
              Acts as
            </Text>
            <Text size="sm" ff="var(--mb-font-mono)">
              {issued.acts_as}
            </Text>
            <Text size="xs" c="dimmed">
              Anything this key writes will be attributed to this name in audit trails, and back to
              you as the person who issued it.
            </Text>
          </Stack>

          <Group justify="flex-end">
            <Button tone="primary" onClick={reset}>
              Done
            </Button>
          </Group>
        </Stack>
      </Drawer>
    );
  }

  return (
    <Drawer opened={opened} onClose={reset} position="right" size="lg" title="Issue an API key">
      <Stack gap="md">
        {!canGrantAnything && (
          <Alert tone="info" title="You can grant only what you hold">
            <Text size="sm">
              A key cannot be given permissions you do not have yourself, so this list shows your
              own {userPermissions.size} permissions.
            </Text>
          </Alert>
        )}

        <TextInput
          label="Name"
          description="What this key is for. An unnamed key is one nobody dares revoke."
          placeholder="Lab analyser bridge"
          value={name}
          onChange={(event) => setName(event.currentTarget.value)}
          required
        />

        <Textarea
          label="Description"
          placeholder="Optional — who owns this integration, and where it runs"
          value={description}
          onChange={(event) => setDescription(event.currentTarget.value)}
          autosize
          minRows={2}
        />

        <NumberInput
          label="Expires in (days)"
          description="Capped at 365. A credential with no end is one nobody rotates."
          value={expiresInDays}
          onChange={(value) => setExpiresInDays(typeof value === "number" ? value : 90)}
          min={1}
          max={365}
        />

        <Group justify="space-between">
          <TextInput
            placeholder="Search permissions"
            leftSection={<IconSearch size={14} />}
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
            style={{ flex: 1 }}
            aria-label="Search permissions"
          />
          <Badge tone={selected.size > 0 ? "primary" : "neutral"}>{selected.size} selected</Badge>
        </Group>

        <Accordion multiple defaultValue={[]}>
          {groups.map(([module, permissions]) => {
            const chosen = permissions.filter((p) => selected.has(p.code)).length;
            return (
              <Accordion.Item key={module} value={module}>
                <Accordion.Control>
                  <Group justify="space-between" pr="md">
                    <Text size="sm" fw={600}>
                      {module}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {chosen > 0 ? `${chosen} of ${permissions.length}` : `${permissions.length}`}
                    </Text>
                  </Group>
                </Accordion.Control>
                <Accordion.Panel>
                  <Stack gap="xs">
                    {permissions.map((permission) => (
                      <Checkbox
                        key={permission.code}
                        checked={selected.has(permission.code)}
                        onChange={() => toggle(permission.code)}
                        label={permission.label}
                        description={permission.code}
                      />
                    ))}
                  </Stack>
                </Accordion.Panel>
              </Accordion.Item>
            );
          })}
        </Accordion>

        {groups.length === 0 && (
          <Alert tone="warning" title="Nothing to grant">
            <Text size="sm">
              {search.trim()
                ? `No permission you hold matches “${search}”.`
                : "You hold no permissions that can be put on a key."}
            </Text>
          </Alert>
        )}

        {selected.size === 0 && (
          <Group gap="xs">
            <IconAlertTriangle size={14} />
            <Text size="xs" c="dimmed">
              A key must carry at least one permission — one that grants nothing gets widened in a
              hurry by whoever is debugging it.
            </Text>
          </Group>
        )}

        <Group justify="flex-end">
          <Button tone="ghost" onClick={reset}>
            Cancel
          </Button>
          <Button
            tone="primary"
            leftSection={<IconKey size={14} />}
            loading={issue.isPending}
            disabled={name.trim().length === 0 || selected.size === 0}
            onClick={() => issue.mutate()}
          >
            Issue key
          </Button>
        </Group>
      </Stack>
    </Drawer>
  );
}
