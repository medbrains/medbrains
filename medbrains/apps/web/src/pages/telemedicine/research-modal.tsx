// Telemedicine ResearchModal — split from telemedicine.tsx (pure move).

import { Group, Modal, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Badge, Button } from "@/components/ui";
import { telemedicineService } from "@/services/telemedicine.service";
import { acuityTone } from "./shared";

export function ResearchModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const { data } = useQuery({
    queryKey: ["triage-research"],
    queryFn: () => telemedicineService.getTriageResearchSummary(),
    enabled: opened,
  });
  const download = useMutation({
    mutationFn: () => telemedicineService.getTriageResearchDataset(),
    onSuccess: (rows) => {
      const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "tele-triage-research.json";
      a.click();
      URL.revokeObjectURL(url);
      notifications.show({
        title: "Downloaded",
        message: `${rows.length} de-identified rows`,
        color: "success",
      });
    },
    onError: (e: Error) =>
      notifications.show({ title: "Download failed", message: e.message, color: "danger" }),
  });
  const pct = data ? Math.round(data.emergent_escalation_rate * 100) : 0;
  return (
    <Modal opened={opened} onClose={onClose} title="Tele-triage research" size="md">
      <Stack gap="sm">
        <Text size="sm" c="dimmed">
          Aggregate + de-identified — no patient identifiers leave here.
        </Text>
        <Text size="sm">
          Triaged consults: <b>{data?.total ?? 0}</b>
        </Text>
        <Text fw={600} size="sm">
          By acuity
        </Text>
        {(data?.by_acuity ?? []).map((a) => (
          <Group key={a.acuity} gap="xs">
            <Badge tone={acuityTone(a.acuity)} size="xs">
              {a.acuity}
            </Badge>
            <Text size="sm">{a.count}</Text>
          </Group>
        ))}
        <Text fw={600} size="sm">
          Top red flags
        </Text>
        {(data?.red_flag_frequency ?? []).slice(0, 8).map((f) => (
          <Group key={f.flag} gap="xs">
            <Text size="sm">🚩 {f.flag.replace(/_/g, " ")}</Text>
            <Text size="xs" c="dimmed">
              {f.count}
            </Text>
          </Group>
        ))}
        <Text size="sm">
          Emergent → EMR-escalation rate: <b>{pct}%</b>
        </Text>
        <Button onClick={() => download.mutate()} loading={download.isPending}>
          Download de-identified dataset
        </Button>
      </Stack>
    </Modal>
  );
}
