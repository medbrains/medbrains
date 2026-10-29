// One of the hospital's codes on a public-health portal -- the Ni-kshay
// Health Establishment code, the IHIP reporting-unit ID -- which heads every
// sheet made for that portal. Read by anyone who works the list; set by a
// manager.

import { Group, Text } from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button, Input, toast } from "@/components/ui";
import { ckbService } from "@/services/ckb.service";

const KEY = ["ckb-facility-codes"];

type CodeField = "nikshay_he_code" | "ihip_unit_id";

const LABELS: Record<CodeField, { label: string; description: string }> = {
  nikshay_he_code: {
    label: "Ni-kshay Health Establishment code",
    description: "From the District TB Officer, when the hospital registered on Ni-kshay.",
  },
  ihip_unit_id: {
    label: "IHIP reporting unit ID",
    description: "From the District Surveillance Unit, when the hospital became a reporting unit.",
  },
};

interface FacilityCodeFieldProps {
  field: CodeField;
  canManage: boolean;
}

export function FacilityCodeField({ field, canManage }: FacilityCodeFieldProps) {
  const qc = useQueryClient();
  const facility = useQuery({ queryKey: KEY, queryFn: () => ckbService.getPublicHealthFacility() });
  const [draft, setDraft] = useState<string | null>(null);
  const save = useMutation({
    // Both codes are sent as they should now read, so setting one keeps the other.
    mutationFn: (code: string) =>
      ckbService.setPublicHealthFacilityCodes({
        nikshay_he_code: facility.data?.nikshay_he_code ?? null,
        ihip_unit_id: facility.data?.ihip_unit_id ?? null,
        [field]: code.trim() || null,
      }),
    onSuccess: (f) => {
      qc.setQueryData(KEY, f);
      setDraft(null);
      toast.success(`${LABELS[field].label} saved`);
    },
    onError: (e: Error) => toast.error(e.message, { title: "Not saved" }),
  });
  const current = facility.data?.[field] ?? "";
  const { label, description } = LABELS[field];

  if (!canManage || draft === null) {
    return (
      <Group gap="xs">
        <Text size="sm">
          {label}:{" "}
          <Text span fw={600} ff="var(--mb-font-mono)">
            {current || "not set"}
          </Text>
        </Text>
        {canManage && (
          <Button size="xs" tone="ghost" onClick={() => setDraft(current)}>
            {current ? "Change" : "Set"}
          </Button>
        )}
      </Group>
    );
  }
  return (
    <Group gap="xs" align="flex-end">
      <Input
        label={label}
        description={description}
        value={draft}
        onChange={(e) => setDraft(e.currentTarget.value)}
        maxLength={40}
      />
      <Button size="xs" tone="primary" loading={save.isPending} onClick={() => save.mutate(draft)}>
        Save
      </Button>
      <Button size="xs" tone="ghost" onClick={() => setDraft(null)}>
        Cancel
      </Button>
    </Group>
  );
}
