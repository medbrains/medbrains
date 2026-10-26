// The hospital's Ni-kshay Health Establishment code, which heads every TB
// notification sheet. Read by anyone who works the list; set by a manager.

import { Group, Text } from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button, Input, toast } from "@/components/ui";
import { ckbService } from "@/services/ckb.service";

const KEY = ["ckb-facility-codes"];

export function FacilityCodeField({ canManage }: { canManage: boolean }) {
  const qc = useQueryClient();
  const facility = useQuery({ queryKey: KEY, queryFn: () => ckbService.getPublicHealthFacility() });
  const [draft, setDraft] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (code: string) =>
      ckbService.setPublicHealthFacilityCodes({ nikshay_he_code: code.trim() || null }),
    onSuccess: (f) => {
      qc.setQueryData(KEY, f);
      setDraft(null);
      toast.success("Health Establishment code saved");
    },
    onError: (e: Error) => toast.error(e.message, { title: "Not saved" }),
  });
  const current = facility.data?.nikshay_he_code ?? "";

  if (!canManage || draft === null) {
    return (
      <Group gap="xs">
        <Text size="sm">
          Ni-kshay Health Establishment code:{" "}
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
        label="Ni-kshay Health Establishment code"
        description="From the District TB Officer, when the hospital registered on Ni-kshay."
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
