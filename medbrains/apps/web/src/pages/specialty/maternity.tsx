import { Drawer, Group, NumberInput, Select, Stack, Tabs, Text, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useHasPermission } from "@medbrains/stores";
import type {
  AncRiskCategory,
  AncVisit,
  CreateMaternityRegistrationRequest,
  LaborRecord,
  MaternityRegistration,
  NewbornRecord,
  PostnatalRecord,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPencil, IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable, PageHeader } from "@/components";
import type { Column } from "@/components/DataTable";
import { PatientNameCell } from "@/components/PatientNameCell";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { Badge, type BadgeTone, Button, IconButton } from "@/components/ui";
import { usePatientScope } from "@/hooks/usePatientScope";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { statusColor } from "@/lib/status-colors";
import { specialtyService } from "@/services/specialty.service";

const STATUS_TONE: Record<string, BadgeTone> = {
  success: "success",
  warning: "warning",
  danger: "danger",
  info: "info",
  primary: "primary",
  blue: "info",
  teal: "success",
  green: "success",
  orange: "warning",
  violet: "accent",
  grape: "accent",
  red: "danger",
  gray: "neutral",
  slate: "neutral",
};

function statusTone(status: string): BadgeTone {
  return STATUS_TONE[statusColor(status) ?? "slate"] ?? "neutral";
}

const RISK_CATEGORIES: { value: AncRiskCategory; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "moderate", label: "Moderate" },
  { value: "high", label: "High" },
  { value: "very_high", label: "Very High" },
];

function toAncRiskCategory(value: string | null): AncRiskCategory | undefined {
  switch (value) {
    case "low":
    case "moderate":
    case "high":
    case "very_high":
      return value;
    default:
      return undefined;
  }
}

function NewbornVerifyDrawer({
  newbornId,
  onClose,
}: {
  newbornId: string | null;
  onClose: () => void;
}) {
  const [uhid, setUhid] = useState("");
  const [band, setBand] = useState("");
  const verify = useMutation({
    mutationFn: () =>
      specialtyService.verifyNewbornIdentity(newbornId ?? "", {
        scanned_mother_uhid: uhid.trim(),
        scanned_band: band.trim() || undefined,
      }),
    onError: (e: Error) =>
      notifications.show({ title: "Could not verify identity", message: e.message, color: "red" }),
  });
  const result = verify.data;
  return (
    <Drawer
      opened={newbornId !== null}
      onClose={() => {
        setUhid("");
        setBand("");
        verify.reset();
        onClose();
      }}
      title="Verify newborn identity"
      position="right"
    >
      <Stack gap="sm">
        <Text size="sm" c="dimmed">
          Scan the mother's wristband UHID (and optionally the baby's ID band) to confirm the baby
          matches the mother before feeding, handover or discharge.
        </Text>
        <TextInput
          label="Mother UHID"
          value={uhid}
          onChange={(e) => setUhid(e.currentTarget.value)}
        />
        <TextInput
          label="Baby ID band (optional)"
          value={band}
          onChange={(e) => setBand(e.currentTarget.value)}
        />
        <Button
          tone="primary"
          loading={verify.isPending}
          disabled={uhid.trim() === ""}
          onClick={() => verify.mutate()}
        >
          Verify
        </Button>
        {result && (
          <Group>
            <Badge tone={result.verified ? "success" : "danger"}>
              {result.verified ? "MATCH — safe to proceed" : "MISMATCH — do not proceed"}
            </Badge>
            {result.band_match === false && <Badge tone="danger">Band mismatch</Badge>}
          </Group>
        )}
      </Stack>
    </Drawer>
  );
}

export function MaternityPage() {
  // Opened from a patient's encounter rather than the navigation: start
  // the form on them instead of making the clinician find them again.
  const { patientId: scopedPatientId } = usePatientScope();
  useRequirePermission(P.SPECIALTY.MATERNITY.REGISTRATIONS_LIST);
  const qc = useQueryClient();
  const canCreate = useHasPermission(P.SPECIALTY.MATERNITY.REGISTRATIONS_CREATE);
  // The page guard is `registrations.list`; each tab reads a different record
  // type behind its own permission. Without these the page fetches all four
  // regardless, so a user who may see registrations still issues requests the
  // server will refuse — and the tab promises data that never arrives.
  const canViewAnc = useHasPermission(P.SPECIALTY.MATERNITY.ANC_LIST);
  const canViewLabor = useHasPermission(P.SPECIALTY.MATERNITY.LABOR_LIST);
  const canViewNewborn = useHasPermission(P.SPECIALTY.MATERNITY.NEWBORN_LIST);
  const canViewPostnatal = useHasPermission(P.SPECIALTY.MATERNITY.POSTNATAL_LIST);

  const [tab, setTab] = useState<string | null>("registrations");
  const [regOpen, regHandlers] = useDisclosure(false);
  const [selectedRegId, setSelectedRegId] = useState<string | null>(null);
  const [selectedLaborId, setSelectedLaborId] = useState<string | null>(null);
  const [verifyNewbornId, setVerifyNewbornId] = useState<string | null>(null);

  const { data: registrations = [], isLoading } = useQuery({
    queryKey: ["maternity-regs"],
    queryFn: () => specialtyService.listMaternityRegistrations(),
  });
  const { data: ancVisits = [] } = useQuery({
    queryKey: ["anc-visits", selectedRegId],
    queryFn: () => specialtyService.listAncVisits(selectedRegId ?? ""),
    enabled: !!selectedRegId && canViewAnc,
  });
  const { data: laborRecords = [] } = useQuery({
    queryKey: ["labor-records", selectedRegId],
    queryFn: () => specialtyService.listLaborRecords(selectedRegId ?? ""),
    enabled: !!selectedRegId && canViewLabor,
  });
  const { data: newborns = [] } = useQuery({
    queryKey: ["newborns", selectedLaborId],
    queryFn: () => specialtyService.listNewborns(selectedLaborId ?? ""),
    enabled: !!selectedLaborId && canViewNewborn,
  });
  const { data: postnatal = [] } = useQuery({
    queryKey: ["postnatal", selectedRegId],
    queryFn: () => specialtyService.listPostnatalRecords(selectedRegId ?? ""),
    enabled: !!selectedRegId && canViewPostnatal,
  });

  const [regForm, setRegForm] = useState<CreateMaternityRegistrationRequest>({
    patient_id: scopedPatientId,
    registration_number: "",
  });

  const createReg = useMutation({
    mutationFn: (data: CreateMaternityRegistrationRequest) =>
      specialtyService.createMaternityRegistration(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["maternity-regs"] });
      regHandlers.close();
      notifications.show({
        title: "Created",
        message: "Maternity registration created",
        color: "success",
      });
    },
    onError: (e: Error) =>
      notifications.show({
        title: "Could not create registration",
        message: e.message,
        color: "red",
      }),
  });

  const regCols: Column<MaternityRegistration>[] = [
    {
      key: "reg_number",
      label: "Reg #",
      render: (r) => (
        <Text size="sm" fw={500}>
          {r.registration_number}
        </Text>
      ),
    },
    {
      key: "patient_id",
      label: "Patient",
      render: (r) => <PatientNameCell patientId={r.patient_id} showUhid={false} />,
    },
    {
      key: "edd",
      label: "EDD",
      render: (r) => (
        <Text size="sm">{r.edd_date ? new Date(r.edd_date).toLocaleDateString() : "—"}</Text>
      ),
    },
    {
      key: "gravida",
      label: "G/P/A/L",
      render: (r) => (
        <Text size="sm">
          {r.gravida}/{r.para}/{r.abortion}/{r.living}
        </Text>
      ),
    },
    {
      key: "risk",
      label: "Risk",
      render: (r) => (
        <Badge tone={statusTone(r.risk_category)}>{r.risk_category.replace(/_/g, " ")}</Badge>
      ),
    },
    {
      key: "high_risk",
      label: "High Risk",
      render: (r) =>
        r.is_high_risk ? <Badge tone="danger">HIGH RISK</Badge> : <Text size="sm">No</Text>,
    },
    {
      key: "blood",
      label: "Blood Group",
      render: (r) => <Text size="sm">{r.blood_group ?? "—"}</Text>,
    },
    {
      key: "actions",
      label: "",
      render: (r) => (
        <IconButton onClick={() => setSelectedRegId(r.id)} aria-label="Edit">
          <IconPencil size={16} />
        </IconButton>
      ),
    },
  ];

  const ancCols: Column<AncVisit>[] = [
    { key: "visit", label: "Visit #", render: (r) => <Text size="sm">{r.visit_number}</Text> },
    {
      key: "weeks",
      label: "Weeks",
      render: (r) => <Text size="sm">{r.gestational_weeks ?? "—"}</Text>,
    },
    {
      key: "weight",
      label: "Weight (kg)",
      render: (r) => <Text size="sm">{r.weight_kg ?? "—"}</Text>,
    },
    {
      key: "bp",
      label: "BP",
      render: (r) => (
        <Text size="sm">
          {r.bp_systolic && r.bp_diastolic ? `${r.bp_systolic}/${r.bp_diastolic}` : "—"}
        </Text>
      ),
    },
    { key: "fhr", label: "FHR", render: (r) => <Text size="sm">{r.fetal_heart_rate ?? "—"}</Text> },
    { key: "hb", label: "Hb", render: (r) => <Text size="sm">{r.hemoglobin ?? "—"}</Text> },
    {
      key: "pcpndt",
      label: "PCPNDT Form F",
      render: (r) =>
        r.pcpndt_form_f_filed ? (
          <Badge tone="success">Filed</Badge>
        ) : (
          <Badge tone="neutral">No</Badge>
        ),
    },
    {
      key: "date",
      label: "Date",
      render: (r) => <Text size="sm">{new Date(r.created_at).toLocaleDateString()}</Text>,
    },
  ];

  const laborCols: Column<LaborRecord>[] = [
    {
      key: "stage",
      label: "Stage",
      render: (r) => <Badge tone="neutral">{r.current_stage.replace(/_/g, " ")}</Badge>,
    },
    {
      key: "delivery",
      label: "Delivery",
      render: (r) => <Text size="sm">{r.delivery_type?.replace(/_/g, " ") ?? "In progress"}</Text>,
    },
    {
      key: "pph",
      label: "PPH",
      render: (r) =>
        r.pph_severity === "severe" ? (
          <Badge tone="danger">Severe PPH</Badge>
        ) : r.pph_severity === "pph" ? (
          <Badge tone="warning">PPH</Badge>
        ) : (
          <Text size="sm" c="dimmed">
            —
          </Text>
        ),
    },
    {
      key: "apgar1",
      label: "Apgar 1m",
      render: (r) => <Text size="sm">{r.apgar_1min ?? "—"}</Text>,
    },
    {
      key: "apgar5",
      label: "Apgar 5m",
      render: (r) => <Text size="sm">{r.apgar_5min ?? "—"}</Text>,
    },
    {
      key: "baby_weight",
      label: "Baby (g)",
      render: (r) => <Text size="sm">{r.baby_weight_gm ?? "—"}</Text>,
    },
    {
      key: "onset",
      label: "Onset",
      render: (r) => (
        <Text size="sm">
          {r.labor_onset_time ? new Date(r.labor_onset_time).toLocaleString() : "—"}
        </Text>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (r) => (
        <IconButton onClick={() => setSelectedLaborId(r.id)} aria-label="Edit">
          <IconPencil size={16} />
        </IconButton>
      ),
    },
  ];

  const newbornCols: Column<NewbornRecord>[] = [
    {
      key: "birth_date",
      label: "Birth Date",
      render: (r) => <Text size="sm">{new Date(r.birth_date).toLocaleDateString()}</Text>,
    },
    { key: "gender", label: "Gender", render: (r) => <Badge tone="neutral">{r.gender}</Badge> },
    { key: "weight", label: "Weight (g)", render: (r) => <Text size="sm">{r.weight_gm}</Text> },
    {
      key: "apgar1",
      label: "Apgar 1m",
      render: (r) => <Text size="sm">{r.apgar_1min ?? "—"}</Text>,
    },
    {
      key: "apgar5",
      label: "Apgar 5m",
      render: (r) => <Text size="sm">{r.apgar_5min ?? "—"}</Text>,
    },
    {
      key: "nicu",
      label: "NICU",
      render: (r) =>
        r.nicu_admission_needed ? <Badge tone="danger">Yes</Badge> : <Text size="sm">No</Text>,
    },
    {
      key: "cert",
      label: "Birth Cert #",
      render: (r) => <Text size="sm">{r.birth_certificate_number ?? "—"}</Text>,
    },
    {
      key: "mother",
      label: "Mother",
      render: (r) =>
        r.mother_id ? (
          <PatientNameCell patientId={r.mother_id} showUhid />
        ) : (
          <Badge tone="danger">Unlinked</Badge>
        ),
    },
    {
      key: "band",
      label: "ID Band",
      render: (r) => <Text size="sm">{r.id_band_number ?? "—"}</Text>,
    },
    {
      key: "verify",
      label: "Identity",
      render: (r) => (
        <Button tone="secondary" size="xs" onClick={() => setVerifyNewbornId(r.id)}>
          Verify
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Maternity & OB-GYN"
        subtitle="Antenatal care, labor & delivery, newborn and postnatal records"
        actions={
          canCreate ? (
            <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={regHandlers.open}>
              New Registration
            </Button>
          ) : undefined
        }
      />
      <Tabs value={tab} onChange={setTab} mt="md">
        <Tabs.List>
          <Tabs.Tab value="registrations">Registrations</Tabs.Tab>
          {canViewAnc && <Tabs.Tab value="anc">ANC Visits</Tabs.Tab>}
          {canViewLabor && <Tabs.Tab value="labor">Labor & Delivery</Tabs.Tab>}
          {(canViewNewborn || canViewPostnatal) && (
            <Tabs.Tab value="newborn">Newborn & Postnatal</Tabs.Tab>
          )}
        </Tabs.List>
        <Tabs.Panel value="registrations" pt="md">
          <DataTable
            columns={regCols}
            data={registrations}
            loading={isLoading}
            rowKey={(r) => r.id}
          />
        </Tabs.Panel>
        <Tabs.Panel value="anc" pt="md">
          {selectedRegId ? (
            <DataTable columns={ancCols} data={ancVisits} loading={false} rowKey={(r) => r.id} />
          ) : (
            <Text c="dimmed">Select a registration to view ANC visits</Text>
          )}
        </Tabs.Panel>
        <Tabs.Panel value="labor" pt="md">
          {selectedRegId ? (
            <DataTable
              columns={laborCols}
              data={laborRecords}
              loading={false}
              rowKey={(r) => r.id}
            />
          ) : (
            <Text c="dimmed">Select a registration to view labor records</Text>
          )}
        </Tabs.Panel>
        <Tabs.Panel value="newborn" pt="md">
          {selectedLaborId ? (
            <Stack>
              <Text fw={600}>Newborn Records</Text>
              <DataTable
                columns={newbornCols}
                data={newborns}
                loading={false}
                rowKey={(r) => r.id}
              />
            </Stack>
          ) : selectedRegId ? (
            <Stack>
              <Text fw={600}>Postnatal Records</Text>
              <DataTable
                columns={[
                  {
                    key: "day",
                    label: "Day PP",
                    render: (r: PostnatalRecord) => <Text size="sm">{r.day_postpartum}</Text>,
                  },
                  {
                    key: "baby_weight",
                    label: "Baby Weight (g)",
                    render: (r: PostnatalRecord) => (
                      <Text size="sm">{r.baby_weight_gm ?? "—"}</Text>
                    ),
                  },
                  {
                    key: "date",
                    label: "Date",
                    render: (r: PostnatalRecord) => (
                      <Text size="sm">{new Date(r.created_at).toLocaleDateString()}</Text>
                    ),
                  },
                ]}
                data={postnatal}
                loading={false}
                rowKey={(r) => r.id}
              />
            </Stack>
          ) : (
            <Text c="dimmed">Select a registration or labor record</Text>
          )}
        </Tabs.Panel>
      </Tabs>
      <Drawer
        opened={regOpen}
        onClose={regHandlers.close}
        title="New Maternity Registration"
        size="lg"
        position="right"
      >
        <Stack>
          <PatientSearchSelect
            value={regForm.patient_id}
            onChange={(patientId) => setRegForm((p) => ({ ...p, patient_id: patientId }))}
          />
          <TextInput
            label="Registration Number"
            required
            value={regForm.registration_number}
            onChange={(e) =>
              setRegForm((p) => ({ ...p, registration_number: e.currentTarget.value }))
            }
          />
          <TextInput
            label="LMP Date"
            placeholder="YYYY-MM-DD"
            value={regForm.lmp_date ?? ""}
            onChange={(e) => setRegForm((p) => ({ ...p, lmp_date: e.currentTarget.value }))}
          />
          <TextInput
            label="EDD Date"
            placeholder="YYYY-MM-DD"
            value={regForm.edd_date ?? ""}
            onChange={(e) => setRegForm((p) => ({ ...p, edd_date: e.currentTarget.value }))}
          />
          <Group grow>
            <NumberInput
              label="Gravida"
              value={regForm.gravida ?? ""}
              onChange={(v) =>
                setRegForm((p) => ({ ...p, gravida: typeof v === "number" ? v : undefined }))
              }
            />
            <NumberInput
              label="Para"
              value={regForm.para ?? ""}
              onChange={(v) =>
                setRegForm((p) => ({ ...p, para: typeof v === "number" ? v : undefined }))
              }
            />
            <NumberInput
              label="Abortion"
              value={regForm.abortion ?? ""}
              onChange={(v) =>
                setRegForm((p) => ({ ...p, abortion: typeof v === "number" ? v : undefined }))
              }
            />
            <NumberInput
              label="Living"
              value={regForm.living ?? ""}
              onChange={(v) =>
                setRegForm((p) => ({ ...p, living: typeof v === "number" ? v : undefined }))
              }
            />
          </Group>
          <Select
            label="Risk Category"
            data={RISK_CATEGORIES}
            value={regForm.risk_category ?? null}
            onChange={(v) => setRegForm((p) => ({ ...p, risk_category: toAncRiskCategory(v) }))}
          />
          <TextInput
            label="Blood Group"
            value={regForm.blood_group ?? ""}
            onChange={(e) => setRegForm((p) => ({ ...p, blood_group: e.currentTarget.value }))}
          />
          <Button
            tone="primary"
            onClick={() => createReg.mutate(regForm)}
            loading={createReg.isPending}
          >
            Register
          </Button>
        </Stack>
      </Drawer>
      <NewbornVerifyDrawer newbornId={verifyNewbornId} onClose={() => setVerifyNewbornId(null)} />
    </div>
  );
}
