/**
 * Front Office → Scan & Share: patients who scanned a counter's QR with their
 * ABHA app today, with the token they were given. The desk opens the patient
 * the ABHA already belongs to, registers a new one from the shared profile,
 * compares and links, or dismisses the share.
 */

import { Group, Loader, Stack, Text } from "@mantine/core";
import { useHasAllPermissions, useHasPermission } from "@medbrains/stores";
import { type AbdmProfileShare, type AbhaVerificationStep, P } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  ScanShareCompareDrawer,
  type ScanShareCompareTarget,
} from "@/components/abha/ScanShareCompareDrawer";
import { isActionable, shareAge, shareName, shareStatus } from "@/components/abha/scanShare";
import { Alert, Badge, Button, Select, Table, toast } from "@/components/ui";
import { abdmScanShareService } from "@/services/abdmScanShare.service";

/** A patient who just scanned is at the desk within a minute. */
const REFRESH_MS = 15_000;
const QUEUE_KEY = ["abdm", "scan-share", "queue"];

/** Where the registration page picks a share up from. */
export interface ScanShareRegistrationState {
  scanShare: { shareId: string; step: AbhaVerificationStep };
}

type Intent = "register" | "compare";

export function ScanShareTab() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canView = useHasPermission(P.ABDM.SCANSHARE.VIEW);
  const canRegister = useHasAllPermissions([P.PATIENTS.CREATE, P.ABDM.ABHA.MANAGE]);
  const canLink = useHasAllPermissions([P.PATIENTS.UPDATE, P.ABDM.ABHA.MANAGE]);
  const [counter, setCounter] = useState<string | null>(null);
  const [compare, setCompare] = useState<ScanShareCompareTarget | null>(null);
  const { data, isLoading, isError } = useQuery({
    queryKey: QUEUE_KEY,
    queryFn: abdmScanShareService.queue,
    enabled: canView,
    refetchInterval: REFRESH_MS,
  });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: QUEUE_KEY });
  const counters = useMemo(() => {
    const seen = new Map<string, string>();
    for (const s of data ?? []) {
      if (s.station_id) seen.set(s.station_id, s.counter_name ?? "Counter");
    }
    return [...seen].map(([value, label]) => ({ value, label }));
  }, [data]);
  const rows = (data ?? []).filter((s) => !counter || s.station_id === counter);

  const verify = useMutation({
    mutationFn: ({ share }: { share: AbdmProfileShare; intent: Intent }) =>
      abdmScanShareService.verify(share.id),
    onSuccess: (step, { share, intent }) => {
      const owner = share.patient_id ?? step.already_linked?.patient_id;
      if (intent === "compare" || owner) {
        if (owner && intent === "register") {
          toast.info(`This ABHA is already on ${step.already_linked?.uhid}; compare and link.`);
        }
        setCompare(owner ? { shareId: share.id, step, patientId: owner } : null);
        return;
      }
      const state: ScanShareRegistrationState = { scanShare: { shareId: share.id, step } };
      navigate("/patients/register", { state });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Could not use this share" }),
  });
  const open = useMutation({
    mutationFn: (share: AbdmProfileShare) =>
      abdmScanShareService.complete(share.id, { patient_id: share.patient_id ?? "" }),
    onSuccess: (share) => navigate(`/patients/${share.patient_id}`),
    onError: (e: Error) => toast.error(e.message, { title: "Could not open the patient" }),
  });
  const dismiss = useMutation({
    mutationFn: (share: AbdmProfileShare) => abdmScanShareService.dismiss(share.id),
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message, { title: "Could not dismiss" }),
  });

  if (!canView) return null;
  if (isLoading) return <Loader size="sm" />;
  if (isError || !data) {
    return (
      <Alert tone="danger" title="Could not load Scan & Share">
        This does not mean nobody has shared — the queue failed to load.
      </Alert>
    );
  }

  const busy = verify.isPending || open.isPending || dismiss.isPending;
  const actions = (s: AbdmProfileShare) => (
    <Group gap="xs" wrap="nowrap">
      {s.patient_id && (
        <Button tone="primary" size="xs" disabled={busy} onClick={() => open.mutate(s)}>
          Open patient
        </Button>
      )}
      {s.patient_id && canLink && (
        <Button
          tone="secondary"
          size="xs"
          disabled={busy}
          onClick={() => verify.mutate({ share: s, intent: "compare" })}
        >
          Compare
        </Button>
      )}
      {!s.patient_id && canRegister && (
        <Button
          tone="primary"
          size="xs"
          disabled={busy || !s.abha_number}
          onClick={() => verify.mutate({ share: s, intent: "register" })}
        >
          Register
        </Button>
      )}
      <Button tone="ghost" size="xs" disabled={busy} onClick={() => dismiss.mutate(s)}>
        Dismiss
      </Button>
    </Group>
  );

  return (
    <Stack>
      <Group justify="space-between">
        <Text fw={600}>Shared at the counters today</Text>
        {counters.length > 1 && (
          <Select
            aria-label="Counter"
            placeholder="All counters"
            clearable
            value={counter}
            onChange={setCounter}
            data={counters}
          />
        )}
      </Group>
      {rows.length === 0 ? (
        <Text size="sm" c="dimmed">
          Nobody has shared their ABHA at the counters today.
        </Text>
      ) : (
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Token</Table.Th>
              <Table.Th>Name</Table.Th>
              <Table.Th>Age · gender</Table.Th>
              <Table.Th>ABHA</Table.Th>
              <Table.Th>Counter</Table.Th>
              <Table.Th>Patient</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((s) => {
              const age = shareAge(s.profile, new Date());
              const status = shareStatus(s.status);
              return (
                <Table.Tr key={s.id}>
                  <Table.Td>
                    <Text ff="monospace" fw={600}>
                      {s.token_number ?? "—"}
                    </Text>
                  </Table.Td>
                  <Table.Td>{shareName(s.profile)}</Table.Td>
                  <Table.Td>
                    {[age === null ? null : `${age} y`, s.profile.gender]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </Table.Td>
                  <Table.Td>
                    <Stack gap={0}>
                      <Text size="sm">{s.abha_address}</Text>
                      {s.abha_number && (
                        <Text size="xs" ff="monospace">
                          {s.abha_number}
                        </Text>
                      )}
                    </Stack>
                  </Table.Td>
                  <Table.Td>{s.counter_name ?? "—"}</Table.Td>
                  <Table.Td>
                    {s.patient_id ? (
                      <Badge tone="success">{s.patient_uhid ?? "Matched"}</Badge>
                    ) : (
                      <Badge tone="neutral">New</Badge>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </Table.Td>
                  <Table.Td>{isActionable(s.status) ? actions(s) : null}</Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      )}
      <ScanShareCompareDrawer
        target={compare}
        onClose={() => setCompare(null)}
        onDone={(patientId) => {
          setCompare(null);
          refresh();
          toast.success("The ABHA is linked", { title: "Linked" });
          navigate(`/patients/${patientId}`);
        }}
      />
    </Stack>
  );
}
