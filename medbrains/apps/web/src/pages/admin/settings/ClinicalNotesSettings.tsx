import { Card, Loader, NumberInput, Select, Stack, Text, Title } from "@mantine/core";
import { useHasAnyPermission, useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, toast } from "@/components/ui";
import { tenantSettingsService } from "@/services/tenantSettings.service";

const CATEGORY = "clinical_notes";

/** What a hospital gets before it chooses; the server applies the same. */
const DEFAULTS = { grace_minutes: 30, draft_visibility: "care_team", late_entry_hours: 24 };

const VISIBILITY = [
  { value: "care_team", label: "The visit's care team sees drafts, marked 'not signed'" },
  { value: "author_only", label: "Only the author sees a note until it is signed" },
];

/**
 * How notes are signed and corrected in this hospital: the grace period for
 * revising a signed note, who sees unsigned drafts, and when a note counts as
 * a late entry (RFCs/RFC-MODULE-clinical-notes.md).
 */
export function ClinicalNotesSettings() {
  const queryClient = useQueryClient();
  const canRead = useHasAnyPermission([P.ADMIN.SETTINGS_READ, P.ADMIN.SETTINGS_GENERAL_MANAGE]);
  const canManage = useHasPermission(P.ADMIN.SETTINGS_GENERAL_MANAGE);
  const {
    data: rows = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["tenant-settings", CATEGORY],
    queryFn: () => tenantSettingsService.getTenantSettings(CATEGORY),
    enabled: canRead,
  });
  const save = useMutation({
    mutationFn: (data: { key: string; value: number | string }) =>
      tenantSettingsService.updateTenantSetting({ category: CATEGORY, ...data }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tenant-settings", CATEGORY] });
      toast.success("Saved", { title: "Clinical notes" });
    },
    onError: (error: Error) => toast.error(error.message, { title: "Not saved" }),
  });

  if (isLoading) return <Loader size="sm" />;
  // A refused or failed read must not show the defaults as if they were the
  // hospital's own choice.
  if (isError || !canRead) {
    return (
      <Alert tone="danger" title="Clinical notes settings could not be loaded">
        <Text size="sm">Reload the page; if it keeps failing, tell IT.</Text>
      </Alert>
    );
  }
  const value = <K extends keyof typeof DEFAULTS>(key: K): (typeof DEFAULTS)[K] =>
    (rows.find((r) => r.key === key)?.value as (typeof DEFAULTS)[K] | undefined) ?? DEFAULTS[key];

  return (
    <Card withBorder padding="lg">
      <Stack gap="md" maw={560}>
        <Title order={4}>Clinical notes</Title>
        <NumberInput
          label="Grace period after signing (minutes)"
          description="The author may revise a signed note this long; the signed version is kept. After it, only an addendum. 0 means addendum only."
          min={0}
          max={1440}
          defaultValue={value("grace_minutes")}
          disabled={!canManage}
          onBlur={(e) =>
            save.mutate({ key: "grace_minutes", value: Number(e.currentTarget.value) || 0 })
          }
        />
        <Select
          label="Unsigned drafts"
          data={VISIBILITY}
          defaultValue={value("draft_visibility")}
          allowDeselect={false}
          disabled={!canManage}
          onChange={(next) => next && save.mutate({ key: "draft_visibility", value: next })}
        />
        <NumberInput
          label="Late entry after (hours)"
          description="A note signed this long after the care it records must say why."
          min={1}
          max={720}
          defaultValue={value("late_entry_hours")}
          disabled={!canManage}
          onBlur={(e) =>
            save.mutate({ key: "late_entry_hours", value: Number(e.currentTarget.value) || 24 })
          }
        />
      </Stack>
    </Card>
  );
}
