import { Box, Group, Progress, SimpleGrid, Stack, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useHasPermission } from "@medbrains/stores";
import type { InfusionStatus, IvFluidOrder, UpdateInfusionInput } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconDroplet, IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Alert, Badge, type BadgeTone, Button, Card, Input, Modal, toast } from "@/components/ui";
import { NumberField } from "@/components/ui/Input";
import { ipdService } from "@/services/ipd.service";

interface Props {
  admissionId: string;
}

const STATUS_TONE: Record<InfusionStatus, BadgeTone> = {
  ordered: "info",
  running: "success",
  paused: "warning",
  completed: "neutral",
  discontinued: "danger",
};

const isLive = (s: InfusionStatus) => s === "running" || s === "paused";

/** Percentage of planned duration elapsed, for a running infusion. */
function progressPct(infusion: IvFluidOrder): number | null {
  if (!infusion.started_at || !infusion.planned_end_time) return null;
  const start = new Date(infusion.started_at).getTime();
  const end = new Date(infusion.planned_end_time).getTime();
  if (end <= start) return null;
  const pct = ((Date.now() - start) / (end - start)) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

/**
 * Running IV infusions for an admission — set up the pump, titrate the rate,
 * pause/resume, complete or discontinue, alongside the live fluid balance.
 */
export function InfusionsPanel({ admissionId }: Props) {
  const qc = useQueryClient();
  const canManage = useHasPermission(P.IPD.IO_CHART_CREATE);
  const [formOpen, form] = useDisclosure(false);
  const [discontinuing, setDiscontinuing] = useState<IvFluidOrder | null>(null);

  const { data: infusions = [], isLoading } = useQuery({
    queryKey: ["infusions", admissionId],
    queryFn: () => ipdService.listInfusions(admissionId),
  });
  const { data: balance } = useQuery({
    queryKey: ["io-balance", admissionId],
    queryFn: () => ipdService.getIoBalance(admissionId),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["infusions", admissionId] });

  const update = useMutation({
    mutationFn: ({ id, ...data }: { id: string } & UpdateInfusionInput) =>
      ipdService.updateInfusion(admissionId, id, data),
    onSuccess: () => {
      setDiscontinuing(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message, { title: "Infusion update failed" }),
  });

  const live = useMemo(() => infusions.filter((i) => isLive(i.status)), [infusions]);
  const past = useMemo(() => infusions.filter((i) => !isLive(i.status)), [infusions]);

  return (
    <Stack>
      <Group justify="space-between">
        <Group gap="xs">
          <IconDroplet size={18} />
          <Text fw={600}>IV infusions</Text>
        </Group>
        {canManage && (
          <Button size="xs" tone="primary" leftSection={<IconPlus size={14} />} onClick={form.open}>
            New infusion
          </Button>
        )}
      </Group>

      {balance && (
        <SimpleGrid cols={3} spacing="xs">
          <BalanceStat label="Intake" value={balance.total_intake_ml} />
          <BalanceStat label="Output" value={balance.total_output_ml} />
          <BalanceStat label="Balance" value={balance.balance_ml} highlight />
        </SimpleGrid>
      )}

      {isLoading && <Text c="dimmed">Loading…</Text>}
      {!isLoading && live.length === 0 && <Text c="dimmed">No running infusions.</Text>}

      <Stack gap="xs">
        {live.map((inf) => (
          <InfusionCard
            key={inf.id}
            infusion={inf}
            canManage={canManage}
            busy={update.isPending}
            onStatus={(status) => update.mutate({ id: inf.id, status })}
            onRate={(rate_ml_per_hr) => update.mutate({ id: inf.id, rate_ml_per_hr })}
            onDiscontinue={() => setDiscontinuing(inf)}
          />
        ))}
      </Stack>

      {past.length > 0 && (
        <Stack gap="xs">
          <Text size="xs" fw={700} c="dimmed" tt="uppercase">
            History
          </Text>
          {past.map((inf) => (
            <Card key={inf.id} padding="sm">
              <Group justify="space-between">
                <Text size="sm">
                  {inf.fluid_name} · {inf.volume_ml} ml
                </Text>
                <Badge tone={STATUS_TONE[inf.status]} size="sm">
                  {inf.status}
                </Badge>
              </Group>
              {inf.discontinued_reason && (
                <Text size="xs" c="dimmed">
                  {inf.discontinued_reason}
                </Text>
              )}
            </Card>
          ))}
        </Stack>
      )}

      <NewInfusionModal
        opened={formOpen}
        onClose={form.close}
        admissionId={admissionId}
        onCreated={() => {
          form.close();
          invalidate();
        }}
      />

      <DiscontinueModal
        infusion={discontinuing}
        busy={update.isPending}
        onClose={() => setDiscontinuing(null)}
        onConfirm={(reason) =>
          discontinuing &&
          update.mutate({
            id: discontinuing.id,
            status: "discontinued",
            discontinued_reason: reason,
          })
        }
      />
    </Stack>
  );
}

function BalanceStat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <Card padding="sm">
      <Text size="xs" c="dimmed" tt="uppercase">
        {label}
      </Text>
      <Text fw={700} c={highlight ? (value < 0 ? "red" : "teal") : undefined}>
        {value} ml
      </Text>
    </Card>
  );
}

function InfusionCard({
  infusion,
  canManage,
  busy,
  onStatus,
  onRate,
  onDiscontinue,
}: {
  infusion: IvFluidOrder;
  canManage: boolean;
  busy: boolean;
  onStatus: (status: InfusionStatus) => void;
  onRate: (rate: number) => void;
  onDiscontinue: () => void;
}) {
  const [rate, setRate] = useState<number>(Number(infusion.rate_ml_per_hr ?? 0));
  const pct = progressPct(infusion);

  return (
    <Card padding="md">
      <Group justify="space-between" align="flex-start">
        <Stack gap={2}>
          <Group gap="xs">
            <Text fw={600}>
              {infusion.fluid_name} · {infusion.volume_ml} ml
            </Text>
            <Badge tone={STATUS_TONE[infusion.status]} size="sm">
              {infusion.status}
            </Badge>
          </Group>
          <Text size="xs" c="dimmed">
            {infusion.rate_ml_per_hr ? `${infusion.rate_ml_per_hr} ml/hr` : "rate not set"}
            {infusion.site ? ` · ${infusion.site}` : ""}
            {infusion.pump_serial ? ` · pump ${infusion.pump_serial}` : ""}
          </Text>
        </Stack>
      </Group>

      {pct !== null && (
        <Box mt="xs">
          <Progress value={pct} size="sm" />
          <Text size="10px" c="dimmed" mt={2}>
            {pct}% of planned duration
          </Text>
        </Box>
      )}

      {canManage && (
        <Group mt="sm" gap="xs">
          <NumberField
            aria-label="Rate ml/hr"
            value={rate}
            onChange={(v) => setRate(typeof v === "number" ? v : 0)}
            min={0}
            step={5}
            w={110}
            size="xs"
          />
          <Button size="xs" tone="secondary" disabled={busy} onClick={() => onRate(rate)}>
            Set rate
          </Button>
          {infusion.status === "running" ? (
            <Button size="xs" tone="secondary" disabled={busy} onClick={() => onStatus("paused")}>
              Pause
            </Button>
          ) : (
            <Button size="xs" tone="secondary" disabled={busy} onClick={() => onStatus("running")}>
              Resume
            </Button>
          )}
          <Button size="xs" tone="primary" disabled={busy} onClick={() => onStatus("completed")}>
            Complete
          </Button>
          <Button size="xs" tone="danger" disabled={busy} onClick={onDiscontinue}>
            Discontinue
          </Button>
        </Group>
      )}
    </Card>
  );
}

function NewInfusionModal({
  opened,
  onClose,
  admissionId,
  onCreated,
}: {
  opened: boolean;
  onClose: () => void;
  admissionId: string;
  onCreated: () => void;
}) {
  const [fluidName, setFluidName] = useState("");
  const [volume, setVolume] = useState(500);
  const [rate, setRate] = useState(100);
  const [site, setSite] = useState("");
  const [pump, setPump] = useState("");
  const [hours, setHours] = useState(8);

  const create = useMutation({
    mutationFn: () =>
      ipdService.createInfusion(admissionId, {
        fluid_name: fluidName.trim(),
        volume_ml: volume,
        rate_ml_per_hr: rate || undefined,
        site: site.trim() || undefined,
        pump_serial: pump.trim() || undefined,
        duration_hours: hours || undefined,
      }),
    onSuccess: () => {
      setFluidName("");
      setSite("");
      setPump("");
      onCreated();
    },
    onError: (e: Error) => toast.error(e.message, { title: "Could not start infusion" }),
  });

  return (
    <Modal opened={opened} onClose={onClose} title="Start IV infusion" size="md">
      <Stack gap="sm">
        <Input
          label="Fluid"
          placeholder="e.g. Normal Saline 0.9%"
          value={fluidName}
          onChange={(e) => setFluidName(e.currentTarget.value)}
          required
        />
        <SimpleGrid cols={2} spacing="sm">
          <NumberField
            label="Volume (ml)"
            value={volume}
            onChange={(v) => setVolume(typeof v === "number" ? v : 0)}
            min={1}
          />
          <NumberField
            label="Rate (ml/hr)"
            value={rate}
            onChange={(v) => setRate(typeof v === "number" ? v : 0)}
            min={0}
            step={5}
          />
          <Input label="IV site" value={site} onChange={(e) => setSite(e.currentTarget.value)} />
          <Input
            label="Pump serial"
            value={pump}
            onChange={(e) => setPump(e.currentTarget.value)}
          />
          <NumberField
            label="Duration (hours)"
            value={hours}
            onChange={(v) => setHours(typeof v === "number" ? v : 0)}
            min={0}
            step={1}
          />
        </SimpleGrid>
        {volume > 0 && rate > 0 && (
          <Alert tone="info">
            ≈ {Math.round((volume / rate) * 10) / 10} h to complete at {rate} ml/hr.
          </Alert>
        )}
        <Group justify="flex-end">
          <Button tone="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            tone="primary"
            loading={create.isPending}
            disabled={!fluidName.trim() || volume <= 0}
            onClick={() => create.mutate()}
          >
            Start infusion
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function DiscontinueModal({
  infusion,
  busy,
  onClose,
  onConfirm,
}: {
  infusion: IvFluidOrder | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");

  return (
    <Modal
      opened={infusion !== null}
      onClose={onClose}
      title={`Discontinue ${infusion?.fluid_name ?? "infusion"}`}
      size="sm"
    >
      <Stack gap="sm">
        <Input
          label="Reason"
          placeholder="e.g. infiltration / therapy complete"
          value={reason}
          onChange={(e) => setReason(e.currentTarget.value)}
          required
        />
        <Group justify="flex-end">
          <Button tone="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            tone="danger"
            loading={busy}
            disabled={!reason.trim()}
            onClick={() => onConfirm(reason.trim())}
          >
            Discontinue
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
