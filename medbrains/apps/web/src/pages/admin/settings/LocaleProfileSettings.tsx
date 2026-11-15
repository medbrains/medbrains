/**
 * Settings → Locale profile (RFC-WORLD-READY §2). What formats money, dates
 * and times for you now, and the profile at each scope — the hospital and
 * each facility — with a request to change one. Changes are change sets: a
 * second person approves them on Admin → Knowledge changes.
 */
import { Group, Stack, Text } from "@mantine/core";
import {
  useHasAllPermissions,
  useHasPermission,
  useLocaleProfile,
  useLocaleProfileStatus,
} from "@medbrains/stores";
import { type KnowledgeLiveRow, type LocaleProfile, P } from "@medbrains/types";
import { IconExternalLink, IconPencil } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Alert, Badge, Button, Card, IconButton, Table } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { knowledgeChangesService as svc } from "@/services/knowledgeChanges.service";
import {
  cellText,
  PROFILE_FIELDS,
  type ProfileForm,
  type ProfileKey,
  toFormText,
} from "./locale-profile/fields";
import { RequestChangeModal, type ScopeRow } from "./locale-profile/RequestChangeModal";

/** Whether `scope` sets `key` itself, or only the hospital does. */
const settableAt = (key: ProfileKey, scope: ScopeRow["scope"]) =>
  PROFILE_FIELDS.some((f) => f.key === key && f.scopes.includes(scope));

const TABLE_KEYS: ProfileKey[] = [
  "country",
  "region",
  "currency",
  "timezone",
  "locale",
  "languages",
];
const SOURCE_LABEL = {
  user: "your choice",
  facility: "facility",
  hospital: "hospital",
  pack: "country pack",
};

/** A live change-set row as the table's scope row. */
function toScopeRow(row: KnowledgeLiveRow, hospitalId: string | undefined): ScopeRow {
  const fields = row.fields as Record<string, unknown>;
  const form = Object.fromEntries(
    PROFILE_FIELDS.map((f) => [f.key, toFormText(f.key, fields[f.key])]),
  ) as ProfileForm;
  return {
    id: row.id,
    name: String(fields.scope_name ?? row.id),
    scope: row.id === hospitalId ? "hospital" : "facility",
    form,
  };
}

/** The profile in force for the person looking, with where each value came from. */
function InForce({ profile }: { profile: LocaleProfile }) {
  return (
    <Card padding="md" withBorder>
      <Stack gap="xs">
        <Group gap="xs">
          <Text fw={600}>In force for you</Text>
          <Badge tone="neutral">pack: {profile.pack}</Badge>
          <Badge tone="info">built for, not certified</Badge>
        </Group>
        <Table aria-label="Locale profile in force">
          <Table.Tbody>
            {PROFILE_FIELDS.map((f) => (
              <Table.Tr key={f.key}>
                <Table.Th scope="row">{f.label}</Table.Th>
                <Table.Td>
                  {profile.missing.includes(f.key)
                    ? "Not set"
                    : cellText(f.key, profile.values[f.key])}
                </Table.Td>
                <Table.Td>
                  <Text size="xs" c="dimmed">
                    {profile.sources[f.key] ? SOURCE_LABEL[profile.sources[f.key] ?? "pack"] : ""}
                  </Text>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Stack>
    </Card>
  );
}

/** One row per scope, with its own values and a request action. */
function Scopes({
  rows,
  canRequest,
  onRequest,
}: {
  rows: ScopeRow[];
  canRequest: boolean;
  onRequest: (r: ScopeRow) => void;
}) {
  return (
    <Card padding="md" withBorder>
      <Table aria-label="Locale profile by scope">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Scope</Table.Th>
            {TABLE_KEYS.map((k) => (
              <Table.Th key={k}>{PROFILE_FIELDS.find((f) => f.key === k)?.label}</Table.Th>
            ))}
            {canRequest && <Table.Th>Change</Table.Th>}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((r) => (
            <Table.Tr key={r.id}>
              <Table.Td>
                <Text size="sm" fw={500}>
                  {r.name}
                </Text>
                <Text size="xs" c="dimmed">
                  {r.scope === "hospital" ? "Whole hospital" : "Facility"}
                </Text>
              </Table.Td>
              {TABLE_KEYS.map((k) => (
                <Table.Td key={k}>
                  {settableAt(k, r.scope) ? cellText(k, r.form[k] || null) : "hospital-wide"}
                </Table.Td>
              ))}
              {canRequest && (
                <Table.Td>
                  <IconButton
                    aria-label={`Request a change for ${r.name}`}
                    onClick={() => onRequest(r)}
                  >
                    <IconPencil size={16} />
                  </IconButton>
                </Table.Td>
              )}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Card>
  );
}

export function LocaleProfileSettings() {
  useRequirePermission(P.ADMIN.LOCALE_PROFILE.UPDATE);
  const canRequest = useHasAllPermissions([
    P.ADMIN.LOCALE_PROFILE.UPDATE,
    P.KNOWLEDGE.CHANGE_SETS.CREATE,
  ]);
  const canList = useHasPermission(P.KNOWLEDGE.CHANGE_SETS.LIST);
  const profile = useLocaleProfile();
  const status = useLocaleProfileStatus();
  const [target, setTarget] = useState<ScopeRow | null>(null);
  const [sentId, setSentId] = useState<string | null>(null);
  const navigate = useNavigate();

  const live = useQuery({
    queryKey: ["knowledge-changes", "rows", "locale_profile"],
    queryFn: () => svc.liveRows("locale_profile"),
    enabled: canRequest,
  });
  const pending = useQuery({
    queryKey: ["knowledge-changes", "list", "locale_profile", "previewed"],
    queryFn: () => svc.list({ area: "locale_profile", status: "previewed" }),
    enabled: canList,
  });
  // The first live row is the hospital; the server lists it before facilities.
  const hospitalId = live.data?.[0]?.id;
  const rows = useMemo(
    () => (live.data ?? []).map((r) => toScopeRow(r, hospitalId)),
    [live.data, hospitalId],
  );

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        One profile decides how every screen and print shows money, dates, times and numbers, and
        which country's rules apply. A change needs a second person's approval and is audited.
      </Text>
      {status === "failed" && (
        <Alert tone="danger" role="alert" title="Hospital settings did not load">
          Screens show dates in UTC and amounts without a currency until they do.
        </Alert>
      )}
      {profile && <InForce profile={profile} />}
      {(pending.data?.length ?? 0) > 0 && (
        <Alert tone="warning" title="A change is waiting for approval">
          <Button
            onClick={() => void navigate("/admin/knowledge-changes")}
            tone="ghost"
            size="compact-sm"
            rightSection={<IconExternalLink size={14} />}
          >
            Open Knowledge changes
          </Button>
        </Alert>
      )}
      {sentId && (
        <Alert tone="success" title="Sent for approval">
          <Button
            onClick={() => void navigate(`/admin/knowledge-changes?open=${sentId}`)}
            tone="ghost"
            size="compact-sm"
            rightSection={<IconExternalLink size={14} />}
          >
            Open the change
          </Button>
        </Alert>
      )}
      {live.error ? (
        <Alert tone="danger" role="alert" title="The profile by scope could not be loaded">
          <Group gap="sm">
            <Text size="sm">{live.error.message}</Text>
            <Button tone="secondary" size="compact-sm" onClick={() => void live.refetch()}>
              Try again
            </Button>
          </Group>
        </Alert>
      ) : live.isLoading ? (
        <Text size="sm" c="dimmed">
          Loading the profile by scope…
        </Text>
      ) : (
        <Scopes rows={rows} canRequest={canRequest} onRequest={setTarget} />
      )}
      <RequestChangeModal
        target={target}
        onClose={() => setTarget(null)}
        onCreated={(id) => {
          setTarget(null);
          setSentId(id);
        }}
      />
    </Stack>
  );
}
