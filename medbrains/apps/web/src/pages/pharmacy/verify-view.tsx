/**
 * Checking a pack against the order, line by line.
 *
 * The gate the whole flow exists for. An order cannot be called until every
 * line here has been checked, and the check is recorded rather than trusted:
 * the server resolves each scan against the catalogue itself, because a client
 * that could stamp `verified` could skip the check.
 *
 * What a scan proves is narrower than it looks. A pack's barcode identifies the
 * *product*, not the batch — so a green tick says "this is the right drug" and
 * says nothing about which batch is in your hand. The batch is confirmed
 * against the pick list.
 */

import { Group, Loader, Stack, Text, TextInput, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useHasPermission } from "@medbrains/stores";
import type { PickLine } from "@medbrains/types";
import { P } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Alert, Badge, Button, Modal, Table } from "@/components/ui";
import { pharmacyService } from "@/services/pharmacy.service";

export function VerifyPackPage() {
  const { orderId = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canVerify = useHasPermission(P.PHARMACY.FULFILMENT.VERIFY);

  const scanRef = useRef<HTMLInputElement>(null);
  const [scan, setScan] = useState("");
  const [manualFor, setManualFor] = useState<PickLine | null>(null);
  const [manualNote, setManualNote] = useState("");

  const { data: lines = [], isLoading } = useQuery({
    queryKey: ["pharmacy-pick-list", orderId],
    queryFn: () => pharmacyService.getFulfilmentPickList(orderId),
    enabled: canVerify && Boolean(orderId),
  });

  // A short-dated line still gets picked and dispensed — FEFO put it on this
  // order precisely so somebody uses it in time — but the checker should look
  // twice while they have it in hand.
  const NEAR_EXPIRY_DAYS = 90;
  function isShortDated(line: PickLine): boolean {
    if (!line.expiry_date) return false;
    const expiry = new Date(line.expiry_date).getTime();
    if (Number.isNaN(expiry)) return false;
    return expiry < Date.now() + NEAR_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
  }

  const outstanding = lines.filter((line) => !line.verified_at).length;

  const verify = useMutation({
    mutationFn: (data: { order_item_id: string; scanned_code?: string; note?: string }) =>
      pharmacyService.verifyFulfilmentLine(orderId, data),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-pick-list", orderId] });
      notifications.show({
        title: result.method === "scan" ? "Scanned" : "Checked by eye",
        message:
          result.outstanding_lines === 0
            ? "Every line checked"
            : `${result.outstanding_lines} line(s) still to check`,
        color: "green",
      });
      setScan("");
      setManualFor(null);
      setManualNote("");
      scanRef.current?.focus();
    },
    onError: (error: Error) => {
      // A wrong-drug refusal is the single most valuable thing this screen can
      // say, so it is shown as-is and the field is left alone for a retry.
      notifications.show({ title: "Not checked", message: error.message, color: "red" });
      scanRef.current?.select();
    },
  });

  const complete = useMutation({
    mutationFn: () => pharmacyService.markFulfilmentVerified(orderId),
    onSuccess: () => {
      notifications.show({ title: "Pack checked", message: "Ready to be called", color: "green" });
      navigate("/pharmacy/fulfilment");
    },
    onError: (error: Error) =>
      notifications.show({ title: "Cannot finish", message: error.message, color: "red" }),
  });

  if (!canVerify) {
    return (
      <Alert tone="warning" variant="light">
        Checking a pack requires `pharmacy.fulfilment.verify`.
      </Alert>
    );
  }

  /**
   * A scanner is a keyboard that types fast and presses Enter. The server works
   * out which line the code belongs to only insofar as it checks the code
   * against the line we send — so the first unchecked line is offered, and a
   * mismatch comes back as a refusal rather than silently ticking the wrong row.
   */
  function submitScan() {
    const code = scan.trim();
    if (!code) return;
    const target = lines.find((line) => !line.verified_at);
    if (!target) return;
    verify.mutate({ order_item_id: target.order_item_id, scanned_code: code });
  }

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={4}>Check the pack</Title>
        {isLoading && <Loader size="xs" />}
      </Group>

      <Group>
        <TextInput
          ref={scanRef}
          autoFocus
          flex={1}
          label="Scan a pack"
          placeholder="Scan or type a barcode, then Enter"
          value={scan}
          onChange={(event) => setScan(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              submitScan();
            }
          }}
          disabled={verify.isPending || outstanding === 0}
        />
      </Group>

      <Table striped withTableBorder>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Drug</Table.Th>
            <Table.Th>Qty</Table.Th>
            <Table.Th>Batch</Table.Th>
            <Table.Th>Location</Table.Th>
            <Table.Th>Checked</Table.Th>
            <Table.Th />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {lines.map((line) => (
            <Table.Tr key={line.order_item_id}>
              <Table.Td>{line.drug_name}</Table.Td>
              <Table.Td>{line.quantity}</Table.Td>
              <Table.Td>
                <Text size="sm" ff="monospace">
                  {line.batch_number ?? "—"}
                </Text>
                {line.expiry_date && (
                  <Text size="xs" c={isShortDated(line) ? "orange" : "dimmed"}>
                    exp {line.expiry_date}
                    {isShortDated(line) && " · short-dated"}
                  </Text>
                )}
              </Table.Td>
              <Table.Td>
                <Text size="sm">
                  {[line.rack, line.shelf, line.bin].filter(Boolean).join(" · ") || "—"}
                </Text>
              </Table.Td>
              <Table.Td>
                {line.verified_at ? (
                  <Badge tone="success">checked</Badge>
                ) : (
                  <Badge tone="neutral">waiting</Badge>
                )}
              </Table.Td>
              <Table.Td>
                {!line.verified_at && (
                  <Button size="compact-xs" tone="ghost" onClick={() => setManualFor(line)}>
                    Check by eye
                  </Button>
                )}
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      <Group justify="space-between">
        <Text size="sm" c={outstanding > 0 ? "orange" : "green"}>
          {outstanding > 0 ? `${outstanding} line(s) still to check` : "Every line checked"}
        </Text>
        <Button disabled={outstanding > 0 || complete.isPending} onClick={() => complete.mutate()}>
          Pack is checked
        </Button>
      </Group>

      <Modal
        opened={manualFor !== null}
        onClose={() => setManualFor(null)}
        title={`Check ${manualFor?.drug_name ?? ""} by eye`}
      >
        <Stack>
          <Text size="sm" c="dimmed">
            A reason is kept with the check. A pharmacy that finds it is ticking everything by eye
            has learned something about its barcodes.
          </Text>
          <TextInput
            label="Why was this not scanned?"
            placeholder="No barcode on the pack, damaged label, …"
            value={manualNote}
            onChange={(event) => setManualNote(event.currentTarget.value)}
          />
          <Group justify="flex-end">
            <Button tone="ghost" onClick={() => setManualFor(null)}>
              Cancel
            </Button>
            <Button
              disabled={!manualNote.trim() || verify.isPending}
              onClick={() =>
                manualFor &&
                verify.mutate({ order_item_id: manualFor.order_item_id, note: manualNote.trim() })
              }
            >
              Check line
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
