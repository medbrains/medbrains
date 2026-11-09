import { Group, Stack, Text } from "@mantine/core";
import type { MrdFileRequest, MrdFileScanStep } from "@medbrains/types";
import { IconAlertTriangle, IconArrowBackUp, IconMapPin, IconScan } from "@tabler/icons-react";
import { Badge, Button, Card } from "@/components/ui";
import { dueLabel, holderText, STATUS_LABEL, STATUS_TONE } from "./fileRequestTime";

interface FileRequestCardProps {
  request: MrdFileRequest;
  now: number;
  canFulfil: boolean;
  onScan: (request: MrdFileRequest, step: MrdFileScanStep) => void;
  onNotFound: (request: MrdFileRequest) => void;
  onReturn: (request: MrdFileRequest) => void;
  /** This card's return to the shelf is in flight. */
  isReturning: boolean;
}

/**
 * One errand: whose file, where it is shelved, where it goes, how long is
 * left, and the runner's next action. A card rather than a table row, so it
 * reads on a phone carried between the shelves and the clinics.
 */
export function FileRequestCard({
  request,
  now,
  canFulfil,
  onScan,
  onNotFound,
  onReturn,
  isReturning,
}: FileRequestCardProps) {
  const due = dueLabel(request.due_at, now);
  const isOpen = request.status === "requested" || request.status === "picked";
  const holder = request.status === "requested" ? holderText(request) : null;
  const isReturnable = request.status === "picked" && request.visit_cancelled;
  const destination = [request.doctor_name, request.department_name].filter(Boolean).join(", ");

  return (
    <Card padding="sm" pattern={false} data-testid="mrd-file-request">
      <Stack gap={6}>
        <Group justify="space-between" wrap="wrap" gap="xs">
          <Text fw={600}>{request.patient_name}</Text>
          <Group gap="xs">
            <Badge tone={STATUS_TONE[request.status]}>{STATUS_LABEL[request.status]}</Badge>
            {isOpen && (
              <Badge tone={due.isLate ? "danger" : "neutral"} variant="outline">
                {due.text}
              </Badge>
            )}
          </Group>
        </Group>
        <Text size="sm" ff="monospace">
          {request.uhid} · File {request.record_number}
        </Text>
        <Group gap={4} wrap="nowrap">
          <IconMapPin size={16} aria-hidden />
          <Text size="sm">{request.location_label ?? "Shelf not recorded"}</Text>
        </Group>
        {isReturnable ? (
          <Text size="sm" fw={600}>
            Visit cancelled — return the file to its shelf
          </Text>
        ) : (
          <Text size="sm">To {destination || "the clinic"}</Text>
        )}
        {holder && (
          <Group gap={4} wrap="nowrap">
            <IconAlertTriangle size={16} aria-hidden />
            <Text size="sm" fw={600}>
              {holder} — ask them to return it to MRD first
            </Text>
          </Group>
        )}
        {canFulfil && (
          <Group gap="xs" wrap="wrap">
            {(request.status === "requested" || request.status === "not_found") && (
              <Button
                tone="primary"
                leftSection={<IconScan size={16} />}
                onClick={() => onScan(request, "picked")}
              >
                Scan at shelf
              </Button>
            )}
            {isReturnable && (
              <Button
                tone="primary"
                leftSection={<IconArrowBackUp size={16} />}
                loading={isReturning}
                onClick={() => onReturn(request)}
              >
                Return to shelf
              </Button>
            )}
            {request.status === "picked" && !isReturnable && (
              <Button
                tone="primary"
                leftSection={<IconScan size={16} />}
                onClick={() => onScan(request, "delivered")}
              >
                Scan at clinic
              </Button>
            )}
            {request.status === "requested" && (
              <Button tone="danger-tertiary" onClick={() => onNotFound(request)}>
                Not found
              </Button>
            )}
          </Group>
        )}
      </Stack>
    </Card>
  );
}
