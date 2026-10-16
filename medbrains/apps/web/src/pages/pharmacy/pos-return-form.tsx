/**
 * What comes back and where the money goes, for one counter sale — every
 * number from the server's returnable view, the refund worked the way the
 * server works it, so what the cashier confirms is what is recorded.
 */
import { Group, Stack, Text } from "@mantine/core";
import { useFieldAccess } from "@medbrains/stores";
import type { Returnable, ReturnableLine, ReturnPosItemsRequest } from "@medbrains/types";
import { useMemo, useState } from "react";
import { Alert, Badge, Button, Input, NumberField, Table, TextArea } from "@/components/ui";
import { fromPaisa, lineRefundPaisa, needsReference, splitRefund } from "./return-refund";
import { formatInr, renderPharmacySensitiveValue } from "./shared";

const REASON_MIN = 5;

interface PosReturnFormProps {
  returnable: Returnable;
  submitting: boolean;
  serverError: string | null;
  onSubmit: (request: ReturnPosItemsRequest) => void;
  onCancel: () => void;
}

/** Whether this user may take the line back at all. */
function lineOpen(line: ReturnableLine, canTakeControlled: boolean): boolean {
  if (line.returnable_qty <= 0 || line.block?.kind === "refused") return false;
  return line.block?.kind !== "needs_controlled_right" || canTakeControlled;
}

export function PosReturnForm({
  returnable,
  submitting,
  serverError,
  onSubmit,
  onCancel,
}: PosReturnFormProps) {
  const batchAccess = useFieldAccess("pharmacy.batches.batch_number");
  const [qty, setQty] = useState<Record<string, number>>({});
  const [references, setReferences] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const { window: win, can_override_window: canOverride } = returnable;
  const blockedByWindow = win.locked && !canOverride;

  const refundPaisa = useMemo(
    () =>
      returnable.lines.reduce(
        (sum, l) =>
          sum + lineRefundPaisa(l.line_total, l.quantity, l.returned_qty, qty[l.item_id] ?? 0),
        0,
      ),
    [returnable.lines, qty],
  );
  const split = useMemo(
    () => splitRefund(refundPaisa, returnable.tenders),
    [refundPaisa, returnable.tenders],
  );
  const takesControlled = returnable.lines.some(
    (l) => (qty[l.item_id] ?? 0) > 0 && l.block?.kind === "needs_controlled_right",
  );

  const submit = () => {
    const items = returnable.lines
      .filter((l) => (qty[l.item_id] ?? 0) > 0)
      .map((l) => ({ item_id: l.item_id, return_qty: qty[l.item_id] ?? 0 }));
    const missingRef = split.find((p) => needsReference(p.mode) && !references[p.mode]?.trim());
    if (items.length === 0) return setProblem("Enter how many of each medicine is coming back.");
    if (reason.trim().length < REASON_MIN) return setProblem("Give the reason for the return.");
    if (missingRef)
      return setProblem(`Enter the ${missingRef.mode.toUpperCase()} refund reference.`);
    setProblem(null);
    onSubmit({
      items,
      reason: reason.trim(),
      refund_to: split.map((p) => ({
        mode: p.mode,
        amount: fromPaisa(p.paisa).toFixed(2),
        reference: references[p.mode]?.trim() || undefined,
      })),
    });
  };

  return (
    <Stack gap="md">
      <WindowNotice returnable={returnable} />
      <Table aria-label="Medicines on this sale">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Medicine</Table.Th>
            <Table.Th>Sold</Table.Th>
            <Table.Th>Can return</Table.Th>
            <Table.Th>Returning</Table.Th>
            <Table.Th>Refund</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {returnable.lines.map((line) => {
            const n = qty[line.item_id] ?? 0;
            const open = lineOpen(line, returnable.can_take_controlled) && !blockedByWindow;
            return (
              <Table.Tr key={line.item_id}>
                <Table.Td>
                  <Stack gap={2}>
                    <Text size="sm" fw={600}>
                      {line.drug_name}
                    </Text>
                    {line.batch_number && (
                      <Text size="xs" c="dimmed" ff="monospace">
                        Batch {renderPharmacySensitiveValue(batchAccess, line.batch_number)}
                      </Text>
                    )}
                    {line.expired && (
                      <Badge tone="warning" size="xs">
                        Expired batch: goes to the expiry bin
                      </Badge>
                    )}
                    {line.block && (
                      <Text size="xs" c={line.block.kind === "refused" ? "danger" : "warning"}>
                        {line.block.message}
                      </Text>
                    )}
                  </Stack>
                </Table.Td>
                <Table.Td>
                  {line.quantity}
                  {line.returned_qty > 0 && ` (${line.returned_qty} back)`}
                </Table.Td>
                <Table.Td>{line.returnable_qty}</Table.Td>
                <Table.Td>
                  <NumberField
                    aria-label={`Quantity of ${line.drug_name} coming back`}
                    size="xs"
                    w={96}
                    min={0}
                    max={line.returnable_qty}
                    allowDecimal={false}
                    disabled={!open}
                    value={n}
                    onChange={(v) =>
                      setQty((q) => ({
                        ...q,
                        [line.item_id]: Math.min(Number(v) || 0, line.returnable_qty),
                      }))
                    }
                  />
                </Table.Td>
                <Table.Td>
                  {formatInr(
                    fromPaisa(
                      lineRefundPaisa(line.line_total, line.quantity, line.returned_qty, n),
                    ),
                  )}
                </Table.Td>
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>

      {split.length > 0 && (
        <Stack gap="xs">
          <Text size="sm" fw={600}>
            Refund goes back the way the sale was paid
          </Text>
          {split.map((part) => (
            <Group key={part.mode} gap="sm" align="flex-end">
              <Text size="sm" w={140}>
                {part.mode.toUpperCase()} · {formatInr(fromPaisa(part.paisa))}
              </Text>
              {needsReference(part.mode) && (
                <Input
                  label={`${part.mode.toUpperCase()} refund reference`}
                  placeholder="Terminal or UPI app reference"
                  required
                  value={references[part.mode] ?? ""}
                  onChange={(e) => {
                    const value = e.currentTarget.value;
                    setReferences((r) => ({ ...r, [part.mode]: value }));
                  }}
                />
              )}
            </Group>
          ))}
        </Stack>
      )}

      <TextArea
        label={win.locked ? "Why take it after the return window?" : "Reason for the return"}
        description={
          takesControlled ? "A controlled drug is coming back: the reason is recorded." : undefined
        }
        required
        minRows={2}
        value={reason}
        onChange={(e) => setReason(e.currentTarget.value)}
      />

      {(problem || serverError) && (
        <Alert tone="danger" role="alert">
          {problem ?? serverError}
        </Alert>
      )}

      <Group justify="space-between">
        <Text fw={700}>Refund {formatInr(fromPaisa(refundPaisa))}</Text>
        <Group gap="sm">
          <Button tone="secondary" onClick={onCancel}>
            Keep sale
          </Button>
          <Button
            tone="primary"
            loading={submitting}
            disabled={blockedByWindow || refundPaisa <= 0}
            onClick={submit}
          >
            Take return
          </Button>
        </Group>
      </Group>
    </Stack>
  );
}

function WindowNotice({ returnable }: { returnable: Returnable }) {
  const { window: win, can_override_window: canOverride } = returnable;
  if (!win.locked) {
    return (
      <Text size="sm" c="dimmed">
        Sold {win.sale_date}. Returns are open until the end of the day before {win.locks_on} (
        {win.window_days}-day window).
      </Text>
    );
  }
  return (
    <Alert tone={canOverride ? "warning" : "danger"} title={`Returns closed on ${win.locks_on}`}>
      {canOverride
        ? `This sale is past the ${win.window_days}-day window. You may still take it back; the reason is recorded against your name.`
        : `This sale is past the ${win.window_days}-day window. Only a supervisor can take it back.`}
    </Alert>
  );
}
