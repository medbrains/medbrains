/**
 * Sign Workspace — slide-in for signing a single pending record.
 *
 * Mantine Drawer placeholder until useWorkspace() ships.
 * Per RFCs/sprints/SPRINT-doctor-activities.md §5.3.
 */
import {
  Accordion,
  Alert,
  Badge,
  Button,
  Checkbox,
  Code,
  Divider,
  Drawer,
  Group,
  Loader,
  Paper,
  ScrollArea,
  Stack,
  Text,
  Textarea,
  ThemeIcon,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { api } from "@medbrains/api";
import type { PendingSignoffEntry, SignPreviewResponse } from "@medbrains/types";
import {
  IconAlertTriangle,
  IconCheck,
  IconFileText,
  IconHash,
  IconKey,
  IconShield,
  IconSignature,
  IconUser,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

interface SignWorkspaceProps {
  opened: boolean;
  target: PendingSignoffEntry;
  onClose: () => void;
  onSigned: () => void;
}

function legalClassFor(recordType: string): string {
  if (recordType.startsWith("mlc") || recordType.includes("death")) return "medico_legal";
  if (recordType.includes("certificate")) return "medico_legal";
  return "clinical";
}

export function SignWorkspace({ opened, target, onClose, onSigned }: SignWorkspaceProps) {
  const [notes, setNotes] = useState("");
  const [attested, setAttested] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const legalClass = legalClassFor(target.record_type);

  const {
    data: preview,
    isLoading: previewLoading,
    error: previewError,
    refetch: refetchPreview,
  } = useQuery({
    queryKey: ["signature-preview", target.record_type, target.record_id, legalClass],
    queryFn: () =>
      api.previewSignature({
        record_type: target.record_type,
        record_id: target.record_id,
        signer_role: "primary",
        legal_class: legalClass,
      }),
    enabled: opened,
    staleTime: 0,
  });
  const { data: credentials = [], isLoading: credentialsLoading } = useQuery({
    queryKey: ["my-signature-credentials"],
    queryFn: () => api.getMySignatureCredentials(),
    enabled: opened,
    staleTime: 30_000,
  });
  const previewPatient = preview ? getRecord(preview.payload_snapshot, "patient") : undefined;
  const defaultCredential = credentials.find((credential) => credential.is_default);
  const canSign = Boolean(preview && previewPatient && defaultCredential && attested);

  const handleSign = async () => {
    if (!canSign) return;
    setIsSigning(true);
    try {
      const res = await api.signRecord({
        record_type: target.record_type,
        record_id: target.record_id,
        signer_role: "primary",
        legal_class: legalClass,
        notes: notes.trim() || undefined,
      });
      notifications.show({
        title: "Signed",
        message: `Signature ${res.signature_hex.slice(0, 12)}… recorded`,
        color: "success",
        icon: <IconCheck size={16} />,
      });
      onSigned();
    } catch (err) {
      notifications.show({
        title: "Sign failed",
        message: (err as Error).message,
        color: "danger",
      });
    } finally {
      setIsSigning(false);
    }
  };

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconSignature size={18} />
          <Text fw={600}>Sign record</Text>
        </Group>
      }
      position="right"
      size="md"
      padding="md"
    >
      <Stack gap="md">
        <Alert color="primary" icon={<IconShield size={16} />} variant="light">
          <Stack gap={4}>
            <Text size="sm" fw={500}>
              Review required before signature
            </Text>
            <Text size="xs" c="dimmed">
              Ed25519 over the server-resolved canonical record snapshot + scanned signature image
              stamped onto the printed PDF. The system can prepare the signoff, but it will not
              auto-sign on behalf of the doctor.
            </Text>
          </Stack>
        </Alert>

        <Stack gap={4}>
          <Group gap="xs">
            <Badge size="sm" variant="light">
              {target.record_type}
            </Badge>
            <Badge size="sm" color={legalColor(legalClassFor(target.record_type))}>
              {legalClassFor(target.record_type).replace("_", " ")}
            </Badge>
          </Group>
          <Text size="sm" fw={600}>
            {target.patient_name || target.summary || target.record_type.replace("_", " ")}
          </Text>
          {target.uhid && (
            <Text size="xs" c="dimmed">
              UHID {target.uhid}
            </Text>
          )}
          <Text size="xs" c="dimmed">
            Created {new Date(target.created_at).toLocaleString()}
          </Text>
        </Stack>

        <Divider />

        {previewLoading && (
          <Paper withBorder p="md" radius="sm">
            <Group gap="sm">
              <Loader size="sm" />
              <Text size="sm">Loading signable record snapshot…</Text>
            </Group>
          </Paper>
        )}

        {previewError && (
          <Alert
            color="danger"
            icon={<IconAlertTriangle size={16} />}
            title="Cannot load signoff details"
          >
            <Stack gap="xs">
              <Text size="sm">{(previewError as Error).message}</Text>
              <Button size="xs" variant="light" onClick={() => void refetchPreview()}>
                Retry
              </Button>
            </Stack>
          </Alert>
        )}

        {preview && <SignoffDossier preview={preview} />}

        {!credentialsLoading && !defaultCredential && (
          <Alert color="warning" icon={<IconKey size={16} />} variant="light">
            <Stack gap={4}>
              <Text size="sm" fw={600}>
                Signing credential required
              </Text>
              <Text size="xs">
                An administrator must issue a default signature credential for this doctor before
                records can be signed. Go to Admin → Doctors → Signature credentials → Generate
                Ed25519 keypair.
              </Text>
            </Stack>
          </Alert>
        )}

        <Divider />

        <Textarea
          label="Notes (optional)"
          placeholder="e.g., reviewed and approved per ward protocol"
          value={notes}
          onChange={(e) => setNotes(e.currentTarget.value)}
          autosize
          minRows={2}
          maxRows={6}
        />

        <Checkbox
          checked={attested}
          onChange={(e) => setAttested(e.currentTarget.checked)}
          disabled={!preview}
          label="I have reviewed the patient identity and signoff details, and I am signing this record as the responsible doctor."
        />

        <Alert color="warning" variant="light">
          <Text size="xs">
            Signing creates an immutable cryptographic record. Any correction after signing must
            happen through an amended record, not silent overwrite.
          </Text>
        </Alert>

        <Group justify="flex-end">
          <Button variant="subtle" onClick={onClose} disabled={isSigning}>
            Cancel
          </Button>
          <Button
            color="primary"
            loading={isSigning}
            leftSection={<IconSignature size={14} />}
            disabled={!canSign}
            onClick={handleSign}
          >
            Sign
          </Button>
        </Group>
      </Stack>
    </Drawer>
  );
}

function SignoffDossier({ preview }: { preview: SignPreviewResponse }) {
  const payload = preview.payload_snapshot;
  const patient = getRecord(payload, "patient");
  const order = getRecord(payload, "order");
  const encounter = getRecord(payload, "encounter");
  const admission = getRecord(payload, "admission");
  const items = Array.isArray(payload.items) ? payload.items : [];
  const flags = riskFlags(payload, order, admission, patient);

  return (
    <Stack gap="sm">
      <Paper withBorder p="sm" radius="sm">
        <Group align="flex-start" wrap="nowrap">
          <ThemeIcon variant="light" color="primary" size="lg">
            <IconUser size={18} />
          </ThemeIcon>
          <Stack gap={4} style={{ minWidth: 0 }}>
            <Text size="sm" fw={600}>
              {getString(patient, "name") || "Patient details unavailable"}
            </Text>
            <Group gap="xs">
              <Badge size="xs" variant="light">
                UHID {getString(patient, "uhid") || "—"}
              </Badge>
              <Badge size="xs" variant="light">
                {getString(patient, "gender") || "gender —"}
              </Badge>
              <Badge size="xs" variant="light">
                DOB {formatValue(patient?.date_of_birth)}
              </Badge>
            </Group>
            {getString(patient, "abha_id") && (
              <Text size="xs" c="dimmed">
                ABHA {getString(patient, "abha_id")}
              </Text>
            )}
          </Stack>
        </Group>
      </Paper>

      {!patient && (
        <Alert color="danger" icon={<IconAlertTriangle size={16} />} variant="light">
          Patient identity is missing from this signable record. Do not sign until the record is
          linked to the correct patient.
        </Alert>
      )}

      <Paper withBorder p="sm" radius="sm">
        <Group align="flex-start" wrap="nowrap">
          <ThemeIcon variant="light" color="blue" size="lg">
            <IconFileText size={18} />
          </ThemeIcon>
          <Stack gap={6} style={{ minWidth: 0, flex: 1 }}>
            <Group gap="xs">
              <Badge size="xs" color={legalColor(preview.legal_class)}>
                {preview.legal_class.replace("_", " ")}
              </Badge>
              <Badge size="xs" variant="light">
                {preview.signer_role.replace("_", " ")}
              </Badge>
              <Badge size="xs" variant="light">
                {getString(payload, "schema") || "schema —"}
              </Badge>
            </Group>
            {summaryRows(payload, order, encounter, admission).map(([label, value]) => (
              <Group key={label} justify="space-between" gap="md" wrap="nowrap">
                <Text size="xs" c="dimmed">
                  {label}
                </Text>
                <Text size="xs" fw={500} ta="right" lineClamp={2}>
                  {value}
                </Text>
              </Group>
            ))}
          </Stack>
        </Group>
      </Paper>

      {items.length > 0 && (
        <Paper withBorder p="sm" radius="sm">
          <Text size="xs" fw={600} mb={6}>
            Prescription items
          </Text>
          <Stack gap={4}>
            {items.slice(0, 8).map((item, index) => {
              const row = asRecord(item);
              return (
                <Text key={`${getString(row, "id") || index}`} size="xs">
                  {index + 1}. {getString(row, "drug_name") || "Drug"}{" "}
                  <Text span c="dimmed">
                    {compact([
                      getString(row, "dosage"),
                      getString(row, "frequency"),
                      getString(row, "duration"),
                      getString(row, "route"),
                    ])}
                  </Text>
                </Text>
              );
            })}
          </Stack>
        </Paper>
      )}

      {flags.length > 0 && (
        <Alert color="warning" icon={<IconAlertTriangle size={16} />} variant="light">
          <Stack gap={4}>
            {flags.map((flag) => (
              <Text key={flag} size="xs">
                {flag}
              </Text>
            ))}
          </Stack>
        </Alert>
      )}

      <Paper withBorder p="sm" radius="sm">
        <Group gap="xs" mb={6}>
          <IconHash size={14} />
          <Text size="xs" fw={600}>
            Canonical payload hash
          </Text>
        </Group>
        <Code block>{preview.payload_hash_hex}</Code>
        <Text size="xs" c="dimmed" mt={6}>
          Preview generated {new Date(preview.generated_at).toLocaleString()}. The server rebuilds
          the snapshot again at signing time.
        </Text>
      </Paper>

      <Accordion variant="contained">
        <Accordion.Item value="technical-payload">
          <Accordion.Control>
            <Text size="sm" fw={600}>
              Technical audit payload
            </Text>
          </Accordion.Control>
          <Accordion.Panel>
            <Text size="xs" c="dimmed" mb="xs">
              For IT, audit, and legal verification only. Doctors should review the clinical
              sections above.
            </Text>
            <ScrollArea.Autosize mah={220}>
              <Code block>{JSON.stringify(payload, null, 2)}</Code>
            </ScrollArea.Autosize>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </Stack>
  );
}

function summaryRows(
  payload: Record<string, unknown>,
  order?: Record<string, unknown>,
  encounter?: Record<string, unknown>,
  admission?: Record<string, unknown>,
): Array<[string, string]> {
  switch (getString(payload, "record_type")) {
    case "prescription":
      return [
        [
          "Visit",
          compact([getString(encounter, "encounter_type"), getString(encounter, "visit_type")]) ||
            "—",
        ],
        ["Date", formatValue(encounter?.encounter_date || payload.created_at)],
        ["Notes", getString(payload, "notes") || "—"],
        ["Items", String(Array.isArray(payload.items) ? payload.items.length : 0)],
      ];
    case "lab_report":
      return [
        ["Parameter", getString(payload, "parameter_name") || "—"],
        ["Result", compact([formatValue(payload.value), getString(payload, "unit")]) || "—"],
        ["Range", getString(payload, "normal_range") || "—"],
        ["Flag", getString(payload, "flag") || "none"],
        ["Sample", getString(order, "sample_barcode") || "—"],
      ];
    case "radiology_report":
      return [
        ["Body part", getString(order, "body_part") || "—"],
        ["Indication", getString(order, "clinical_indication") || "—"],
        ["Findings", getString(payload, "findings") || "—"],
        ["Impression", getString(payload, "impression") || "—"],
        ["Critical", formatValue(payload.is_critical)],
      ];
    case "discharge_summary":
      return [
        ["Admission", getString(payload, "admission_id") || "—"],
        ["Status", getString(payload, "status") || "—"],
        ["IP type", getString(admission, "ip_type") || "—"],
        ["Final diagnosis", getString(payload, "final_diagnosis") || "—"],
        ["Follow-up", formatValue(payload.follow_up_date)],
      ];
    default:
      return [
        ["Record", getString(payload, "record_id") || "—"],
        ["Created", formatValue(payload.created_at)],
      ];
  }
}

function riskFlags(
  payload: Record<string, unknown>,
  order?: Record<string, unknown>,
  admission?: Record<string, unknown>,
  patient?: Record<string, unknown>,
): string[] {
  const flags: string[] = [];
  if (patient?.is_medico_legal === true) flags.push("Patient is marked medico-legal.");
  if (payload.flag && payload.flag !== "normal")
    flags.push(`Lab result flag: ${formatValue(payload.flag)}.`);
  if (payload.is_critical === true) flags.push("Radiology report is marked critical.");
  if (order?.is_stat === true) flags.push("STAT investigation.");
  if (order?.contrast_required === true) flags.push("Contrast study.");
  if (order?.pregnancy_checked === false) flags.push("Pregnancy check is not documented.");
  if (order?.allergy_flagged === true) flags.push("Allergy flag present on order.");
  if (admission?.is_critical === true) flags.push("Admission marked critical.");
  if (admission?.isolation_required === true) flags.push("Isolation precautions required.");
  return flags;
}

function getRecord(
  value: Record<string, unknown>,
  key: string,
): Record<string, unknown> | undefined {
  return asRecord(value[key]);
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function getString(value: Record<string, unknown> | undefined, key: string): string | undefined {
  const raw = value?.[key];
  return typeof raw === "string" && raw.trim() ? raw : undefined;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function compact(values: Array<string | undefined>): string {
  return values.filter(Boolean).join(" ");
}

function legalColor(legalClass: string): string {
  switch (legalClass) {
    case "medico_legal":
      return "red";
    case "statutory_export":
      return "orange";
    case "clinical":
      return "blue";
    default:
      return "gray";
  }
}
