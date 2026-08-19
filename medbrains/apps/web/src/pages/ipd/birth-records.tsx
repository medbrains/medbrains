// IPD Birth Records tab — split from ipd.tsx (pure move).

import {
  Card,
  Checkbox,
  Group,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useHasPermission } from "@medbrains/stores";
import type { CreateBirthRecordRequest, IpdBirthRecord } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, Button, Table, toast } from "@/components/ui";
import { ipdService } from "@/services/ipd.service";

export function BirthRecordsTab({
  admissionId,
  motherPatientId,
}: {
  admissionId: string;
  motherPatientId: string;
}) {
  const canCreate = useHasPermission(P.IPD.CLINICAL_DOCS_CREATE);
  // The birth register has its own code — `ipd.clinical_docs.create` is not it.
  const canManageBirthRecords = useHasPermission(P.IPD.BIRTH_RECORDS_MANAGE);
  const queryClient = useQueryClient();
  const [formOpened, formHandlers] = useDisclosure(false);
  const [dob, setDob] = useState("");
  const [tob, setTob] = useState("");
  const [gender, setGender] = useState<string | null>(null);
  const [weightGrams, setWeightGrams] = useState<number | string>("");
  const [lengthCm, setLengthCm] = useState<number | string>("");
  const [headCirc, setHeadCirc] = useState<number | string>("");
  const [apgar1, setApgar1] = useState<number | string>("");
  const [apgar5, setApgar5] = useState<number | string>("");
  const [deliveryType, setDeliveryType] = useState<string | null>(null);
  const [isLiveBirth, setIsLiveBirth] = useState(true);
  const [certNumber, setCertNumber] = useState("");
  const [complications, setComplications] = useState("");
  const [brNotes, setBrNotes] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["ipd-birth-records", admissionId],
    queryFn: () => ipdService.listBirthRecords(admissionId),
    enabled: canManageBirthRecords,
  });

  const createMutation = useMutation({
    mutationFn: (d: CreateBirthRecordRequest) => ipdService.createBirthRecord(admissionId, d),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ipd-birth-records", admissionId] });
      toast.success("Birth record saved", { title: "Created" });
      formHandlers.close();
      setDob("");
      setTob("");
      setGender(null);
      setWeightGrams("");
      setLengthCm("");
      setHeadCirc("");
      setApgar1("");
      setApgar5("");
      setDeliveryType(null);
      setCertNumber("");
      setComplications("");
      setBrNotes("");
    },
  });

  const records = (data ?? []) as IpdBirthRecord[];

  return (
    <Stack>
      <Group justify="space-between">
        <Text fw={600}>Birth Records</Text>
        {canCreate && (
          <Button
            tone="primary"
            size="sm"
            leftSection={<IconPlus size={16} />}
            onClick={() => formHandlers.open()}
          >
            Add Birth Record
          </Button>
        )}
      </Group>

      {formOpened && (
        <Card withBorder p="sm">
          <Stack gap="xs">
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <TextInput
                label="Date of Birth"
                type="date"
                value={dob}
                onChange={(e) => setDob(e.currentTarget.value)}
                required
              />
              <TextInput
                label="Time of Birth"
                type="time"
                value={tob}
                onChange={(e) => setTob(e.currentTarget.value)}
                required
              />
              <Select
                label="Gender"
                data={[
                  { value: "male", label: "Male" },
                  { value: "female", label: "Female" },
                  { value: "indeterminate", label: "Indeterminate" },
                ]}
                value={gender}
                onChange={setGender}
              />
              <Select
                label="Delivery Type"
                data={[
                  { value: "vaginal", label: "Normal Vaginal" },
                  { value: "lscs", label: "LSCS (C-Section)" },
                  { value: "assisted", label: "Assisted (Forceps/Vacuum)" },
                  { value: "breech", label: "Breech" },
                ]}
                value={deliveryType}
                onChange={setDeliveryType}
              />
              <NumberInput
                label="Weight (grams)"
                value={weightGrams}
                onChange={setWeightGrams}
                min={0}
              />
              <NumberInput label="Length (cm)" value={lengthCm} onChange={setLengthCm} min={0} />
              <NumberInput
                label="Head Circumference (cm)"
                value={headCirc}
                onChange={setHeadCirc}
                min={0}
              />
              <Group>
                <NumberInput
                  label="Apgar 1 min"
                  value={apgar1}
                  onChange={setApgar1}
                  min={0}
                  max={10}
                  w={100}
                />
                <NumberInput
                  label="Apgar 5 min"
                  value={apgar5}
                  onChange={setApgar5}
                  min={0}
                  max={10}
                  w={100}
                />
              </Group>
            </SimpleGrid>
            <Checkbox
              label="Live Birth"
              checked={isLiveBirth}
              onChange={(e) => setIsLiveBirth(e.currentTarget.checked)}
            />
            <TextInput
              label="Birth Certificate Number"
              value={certNumber}
              onChange={(e) => setCertNumber(e.currentTarget.value)}
            />
            <Textarea
              label="Complications"
              value={complications}
              onChange={(e) => setComplications(e.currentTarget.value)}
            />
            <Textarea
              label="Notes"
              value={brNotes}
              onChange={(e) => setBrNotes(e.currentTarget.value)}
            />
            <Group>
              <Button
                tone="primary"
                size="sm"
                onClick={() =>
                  createMutation.mutate({
                    mother_patient_id: motherPatientId,
                    date_of_birth: dob,
                    time_of_birth: tob,
                    gender: gender ?? undefined,
                    weight_grams: weightGrams ? Number(weightGrams) : undefined,
                    length_cm: lengthCm ? Number(lengthCm) : undefined,
                    head_circumference_cm: headCirc ? Number(headCirc) : undefined,
                    apgar_1min: apgar1 ? Number(apgar1) : undefined,
                    apgar_5min: apgar5 ? Number(apgar5) : undefined,
                    delivery_type: deliveryType ?? undefined,
                    is_live_birth: isLiveBirth,
                    birth_certificate_number: certNumber || undefined,
                    complications: complications || undefined,
                    notes: brNotes || undefined,
                  })
                }
                loading={createMutation.isPending}
                disabled={!dob || !tob}
              >
                Save
              </Button>
              <Button tone="ghost" size="sm" onClick={() => formHandlers.close()}>
                Cancel
              </Button>
            </Group>
          </Stack>
        </Card>
      )}

      {isLoading ? (
        <Text c="dimmed">Loading...</Text>
      ) : records.length === 0 ? (
        <Text c="dimmed" size="sm">
          No birth records for this admission.
        </Text>
      ) : (
        <Table striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Date/Time</Table.Th>
              <Table.Th>Gender</Table.Th>
              <Table.Th>Weight (g)</Table.Th>
              <Table.Th>Delivery</Table.Th>
              <Table.Th>Apgar</Table.Th>
              <Table.Th>Live Birth</Table.Th>
              <Table.Th>Cert #</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {records.map((r: IpdBirthRecord) => (
              <Table.Tr key={r.id}>
                <Table.Td>
                  <Text size="sm">
                    {r.date_of_birth} {r.time_of_birth}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Badge
                    size="sm"
                    tone={
                      r.gender === "male" ? "primary" : r.gender === "female" ? "danger" : "neutral"
                    }
                  >
                    {r.gender ?? "—"}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{r.weight_grams ?? "—"}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{r.delivery_type ?? "—"}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">
                    {r.apgar_1min != null ? `${r.apgar_1min}/${r.apgar_5min}` : "—"}
                  </Text>
                </Table.Td>
                <Table.Td>
                  {r.is_live_birth ? (
                    <Badge tone="success" size="xs">
                      Yes
                    </Badge>
                  ) : (
                    <Badge tone="danger" size="xs">
                      No
                    </Badge>
                  )}
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{r.birth_certificate_number ?? "—"}</Text>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Phase 3b — OT Analytics Reports
// ══════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════
// ── Generate Discharge Summary Modal ──────────────────────
// ═══════════════════════════════════════════════════════════
