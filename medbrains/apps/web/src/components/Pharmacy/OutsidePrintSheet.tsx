import { Group, Stack, Text } from "@mantine/core";
import type { OutsidePrint } from "@medbrains/types";
import { IconPrinter } from "@tabler/icons-react";
import { Alert, Button, Divider, Modal, Table } from "@/components/ui";

interface OutsidePrintSheetProps {
  print: OutsidePrint | null;
  onClose: () => void;
}

/**
 * The prescription lines a patient takes to a pharmacy of their choice.
 * It names no pharmacy unless the hospital has a disclosed partner, and
 * then only with the disclosure beside it (owner decision 4b).
 */
export function OutsidePrintSheet({ print, onClose }: OutsidePrintSheetProps) {
  return (
    <Modal
      opened={print !== null}
      onClose={onClose}
      title="Prescription for another pharmacy"
      size="lg"
    >
      {print && (
        <Stack gap="sm">
          <Text fw={600}>{print.hospital_name}</Text>
          <Text size="sm">
            {print.patient_name}
            {print.uhid ? ` · UHID ${print.uhid}` : ""}
          </Text>
          {print.doctor_name && (
            <Text size="sm">
              Prescribed by {print.doctor_name}
              {print.doctor_registration ? ` (reg. ${print.doctor_registration})` : ""}
              {print.prescribed_on
                ? ` on ${new Date(print.prescribed_on).toLocaleDateString()}`
                : ""}
            </Text>
          )}
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Medicine</Table.Th>
                <Table.Th>Strength and form</Table.Th>
                <Table.Th>Quantity</Table.Th>
                <Table.Th>How to take</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {print.items.map((i) => (
                <Table.Tr key={i.name}>
                  <Table.Td>
                    {i.name}
                    {i.generic_name ? ` (${i.generic_name})` : ""}
                  </Table.Td>
                  <Table.Td>{[i.strength, i.form].filter(Boolean).join(" ")}</Table.Td>
                  <Table.Td>{i.quantity}</Table.Td>
                  <Table.Td>{i.directions ?? ""}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
          <Text size="sm" fw={600}>
            {print.any_pharmacy}
          </Text>
          {print.partner && (
            <Alert tone="info" title={`The hospital's partner pharmacy: ${print.partner.name}`}>
              <Stack gap={2}>
                <Text size="sm">
                  {print.partner.address} · {print.partner.phone}
                </Text>
                <Text size="sm">{print.partner.disclosure}</Text>
              </Stack>
            </Alert>
          )}
          <Divider />
          <Group justify="space-between">
            <Text size="xs" c="dimmed">
              Printed {new Date(print.printed_at).toLocaleString()}
            </Text>
            <Button
              tone="primary"
              leftSection={<IconPrinter size={16} />}
              onClick={() => window.print()}
            >
              Print
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}
