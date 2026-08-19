// HR ComplianceTab — split from hr.tsx (pure move).

import {
  Drawer,
  Group,
  NumberInput,
  Select,
  Stack,
  Tabs,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useHasPermission } from "@medbrains/stores";
import type { Appraisal, Employee, StatutoryRecord } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconCertificate, IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import type { Column } from "@/components/DataTable";
import { EmployeeSearchSelect } from "@/components/EmployeeSearchSelect";
import { Badge, type BadgeTone, Button, toast } from "@/components/ui";
import { hrService } from "@/services/hr.service";
import { statusBadgeTone } from "./shared";

function statutoryStatus(expiry?: string): { label: string; tone: BadgeTone } {
  if (!expiry) return { label: "No expiry", tone: "neutral" };
  const days = Math.ceil((new Date(expiry).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return { label: "Expired", tone: "danger" };
  if (days <= 30) return { label: `Expiring (${days}d)`, tone: "warning" };
  return { label: "Valid", tone: "success" };
}

export function ComplianceTab({
  canManageCredentials,
  canManageAppraisal,
}: {
  canManageCredentials: boolean;
  canManageAppraisal: boolean;
}) {
  // Statutory employment records are `hr.credentials.list` — a clinician's
  // registration and licence history, not general HR data.
  const canListCredentials = useHasPermission(P.HR.CREDENTIALS_LIST);

  const [subTab, setSubTab] = useState<string | null>("credentials");
  const [appraisalOpen, { open: openAppraisal, close: closeAppraisal }] = useDisclosure(false);
  const [statOpen, { open: openStat, close: closeStat }] = useDisclosure(false);

  // For credentials we reuse the employees query and show a summary view
  const { data: employees = [] } = useQuery({
    queryKey: ["hr-employees"],
    queryFn: () => hrService.listEmployees({}),
  });

  const qc = useQueryClient();
  const [appraisalEmpId, setAppraisalEmpId] = useState("");
  const [statutoryEmpId, setStatutoryEmpId] = useState("");

  const { data: appraisals = [], isLoading: appraisalsLoading } = useQuery({
    queryKey: ["hr-appraisals", appraisalEmpId],
    queryFn: () => hrService.listAppraisals(appraisalEmpId),
    enabled: appraisalEmpId.length > 0,
  });
  const { data: statutoryRecords = [], isLoading: statutoryLoading } = useQuery({
    queryKey: ["hr-statutory", statutoryEmpId],
    queryFn: () => hrService.listStatutoryRecords(statutoryEmpId),
    enabled: statutoryEmpId.length > 0 && canListCredentials,
  });

  const appraisalColumns: Column<Appraisal>[] = [
    {
      key: "appraisal_year",
      label: "Year",
      render: (r) => <Text size="sm">{r.appraisal_year}</Text>,
    },
    {
      key: "rating",
      label: "Rating",
      render: (r) => <Text size="sm">{r.rating != null ? `${r.rating}/5` : "—"}</Text>,
    },
    {
      key: "strengths",
      label: "Strengths",
      render: (r) => (
        <Text size="sm" lineClamp={2}>
          {r.strengths || "—"}
        </Text>
      ),
    },
    {
      key: "improvements",
      label: "Areas for improvement",
      render: (r) => (
        <Text size="sm" lineClamp={2}>
          {r.improvements || "—"}
        </Text>
      ),
    },
    {
      key: "created_at",
      label: "Recorded",
      render: (r) => <Text size="sm">{new Date(r.created_at).toLocaleDateString()}</Text>,
    },
  ];

  const statutoryColumns: Column<StatutoryRecord>[] = [
    {
      key: "record_type",
      label: "Type",
      render: (r) => (
        <Badge tone="neutral" size="sm">
          {r.record_type}
        </Badge>
      ),
    },
    {
      key: "title",
      label: "Title",
      render: (r) => <Text size="sm">{r.title}</Text>,
    },
    {
      key: "compliance_date",
      label: "Compliant on",
      render: (r) => <Text size="sm">{r.compliance_date || "—"}</Text>,
    },
    {
      key: "expiry_date",
      label: "Expires",
      render: (r) => <Text size="sm">{r.expiry_date || "—"}</Text>,
    },
    {
      key: "status",
      label: "Status",
      render: (r) => {
        const status = statutoryStatus(r.expiry_date);
        return (
          <Badge tone={status.tone} size="sm">
            {status.label}
          </Badge>
        );
      },
    },
  ];

  // ── Appraisal form ──
  const [apprForm, setApprForm] = useState({
    employee_id: "",
    appraisal_year: new Date().getFullYear(),
    rating: 3.0,
    strengths: "",
    improvements: "",
  });
  const apprMut = useMutation({
    mutationFn: () =>
      hrService.createAppraisal({
        employee_id: apprForm.employee_id,
        appraisal_year: apprForm.appraisal_year,
        rating: apprForm.rating,
        strengths: apprForm.strengths || undefined,
        improvements: apprForm.improvements || undefined,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["hr-appraisals"] });
      closeAppraisal();
      setApprForm({
        employee_id: "",
        appraisal_year: new Date().getFullYear(),
        rating: 3.0,
        strengths: "",
        improvements: "",
      });
      toast.success("Appraisal record added", { title: "Appraisal Created" });
    },
  });

  // ── Statutory record form ──
  const [statForm, setStatForm] = useState({
    employee_id: "",
    record_type: "posh",
    title: "",
    compliance_date: "",
    expiry_date: "",
  });
  const statMut = useMutation({
    mutationFn: () =>
      hrService.createStatutoryRecord({
        employee_id: statForm.employee_id,
        record_type: statForm.record_type,
        title: statForm.title,
        compliance_date: statForm.compliance_date || undefined,
        expiry_date: statForm.expiry_date || undefined,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["hr-statutory"] });
      closeStat();
      setStatForm({
        employee_id: "",
        record_type: "posh",
        title: "",
        compliance_date: "",
        expiry_date: "",
      });
      toast.success("Statutory record created", { title: "Record Added" });
    },
  });

  return (
    <Tabs value={subTab} onChange={setSubTab}>
      <Tabs.List mb="md">
        <Tabs.Tab value="credentials" leftSection={<IconCertificate size={16} />}>
          Credential Expiry
        </Tabs.Tab>
        <Tabs.Tab value="appraisals">Appraisals</Tabs.Tab>
        <Tabs.Tab value="statutory">Statutory Records</Tabs.Tab>
      </Tabs.List>

      <Tabs.Panel value="credentials">
        <Text size="sm" c="dimmed" mb="md">
          View credential expiry status by clicking on individual employees in the Employees tab.
          Employees with expiring credentials will be highlighted below.
        </Text>
        <DataTable
          data={employees}
          rowKey={(r: Employee) => r.id}
          columns={[
            {
              key: "code",
              label: "Code",
              render: (r: Employee) => (
                <Text size="sm" fw={500}>
                  {r.employee_code}
                </Text>
              ),
            },
            {
              key: "name",
              label: "Name",
              render: (r: Employee) => (
                <Text size="sm">
                  {r.first_name} {r.last_name || ""}
                </Text>
              ),
            },
            {
              key: "type",
              label: "Type",
              render: (r: Employee) => (
                <Badge size="sm">{r.employment_type.replace(/_/g, " ")}</Badge>
              ),
            },
            {
              key: "status",
              label: "Status",
              render: (r: Employee) => (
                <Badge tone={statusBadgeTone(r.status)} size="sm">
                  {r.status.replace(/_/g, " ")}
                </Badge>
              ),
            },
          ]}
        />
      </Tabs.Panel>

      <Tabs.Panel value="appraisals">
        <Group justify="flex-end" mb="md">
          {canManageAppraisal && (
            <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={openAppraisal}>
              Create Appraisal
            </Button>
          )}
        </Group>
        <Stack gap="sm">
          <EmployeeSearchSelect
            label="Employee"
            value={appraisalEmpId}
            onChange={setAppraisalEmpId}
          />
          {appraisalEmpId ? (
            <DataTable
              columns={appraisalColumns}
              data={appraisals}
              loading={appraisalsLoading}
              rowKey={(r) => r.id}
              emptyTitle="No appraisals"
              emptyDescription="This employee has no recorded appraisals yet."
            />
          ) : (
            <Text size="sm" c="dimmed">
              Select an employee to view their appraisal history.
            </Text>
          )}
        </Stack>

        <Drawer
          opened={appraisalOpen}
          onClose={closeAppraisal}
          title="Create Appraisal"
          position="right"
          size="xl"
        >
          <Stack gap="sm">
            <EmployeeSearchSelect
              value={apprForm.employee_id}
              onChange={(id) => setApprForm({ ...apprForm, employee_id: id })}
              required
            />
            <NumberInput
              label="Year"
              required
              value={apprForm.appraisal_year}
              onChange={(v) =>
                setApprForm({
                  ...apprForm,
                  appraisal_year: typeof v === "number" ? v : new Date().getFullYear(),
                })
              }
            />
            <NumberInput
              label="Rating"
              value={apprForm.rating}
              onChange={(v) =>
                setApprForm({ ...apprForm, rating: typeof v === "number" ? v : 3.0 })
              }
              min={0}
              max={5}
              step={0.5}
              decimalScale={1}
            />
            <Textarea
              label="Strengths"
              value={apprForm.strengths}
              onChange={(e) => setApprForm({ ...apprForm, strengths: e.currentTarget.value })}
            />
            <Textarea
              label="Areas for Improvement"
              value={apprForm.improvements}
              onChange={(e) => setApprForm({ ...apprForm, improvements: e.currentTarget.value })}
            />
            <Button
              tone="primary"
              onClick={() => apprMut.mutate()}
              loading={apprMut.isPending}
              disabled={!apprForm.employee_id}
            >
              Create Appraisal
            </Button>
          </Stack>
        </Drawer>
      </Tabs.Panel>

      <Tabs.Panel value="statutory">
        <Group justify="flex-end" mb="md">
          {canManageCredentials && (
            <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={openStat}>
              Add Statutory Record
            </Button>
          )}
        </Group>
        <Stack gap="sm">
          <EmployeeSearchSelect
            label="Employee"
            value={statutoryEmpId}
            onChange={setStatutoryEmpId}
          />
          {statutoryEmpId ? (
            <DataTable
              columns={statutoryColumns}
              data={statutoryRecords}
              loading={statutoryLoading}
              rowKey={(r) => r.id}
              emptyTitle="No statutory records"
              emptyDescription="No POSH, fire-safety, or other statutory records for this employee yet."
            />
          ) : (
            <Text size="sm" c="dimmed">
              Track POSH training, fire safety, and other statutory compliance. Select an employee
              to view their records and expiry status.
            </Text>
          )}
        </Stack>

        <Drawer
          opened={statOpen}
          onClose={closeStat}
          title="Add Statutory Record"
          position="right"
          size="xl"
        >
          <Stack gap="sm">
            <EmployeeSearchSelect
              value={statForm.employee_id}
              onChange={(id) => setStatForm({ ...statForm, employee_id: id })}
              required
            />
            <Select
              label="Record Type"
              value={statForm.record_type}
              onChange={(v) => setStatForm({ ...statForm, record_type: v || "posh" })}
              data={[
                { value: "posh", label: "POSH Training" },
                { value: "fire_safety", label: "Fire Safety" },
                { value: "bls_certification", label: "BLS Certification" },
                { value: "infection_control", label: "Infection Control" },
                { value: "radiation_safety", label: "Radiation Safety" },
                { value: "nrc_verification", label: "NRC Verification" },
                { value: "police_verification", label: "Police Verification" },
                { value: "other", label: "Other" },
              ]}
            />
            <TextInput
              label="Title"
              required
              value={statForm.title}
              onChange={(e) => setStatForm({ ...statForm, title: e.currentTarget.value })}
            />
            <TextInput
              label="Compliance Date"
              placeholder="YYYY-MM-DD"
              value={statForm.compliance_date}
              onChange={(e) => setStatForm({ ...statForm, compliance_date: e.currentTarget.value })}
            />
            <TextInput
              label="Expiry Date"
              placeholder="YYYY-MM-DD"
              value={statForm.expiry_date}
              onChange={(e) => setStatForm({ ...statForm, expiry_date: e.currentTarget.value })}
            />
            <Button
              tone="primary"
              onClick={() => statMut.mutate()}
              loading={statMut.isPending}
              disabled={!statForm.employee_id || !statForm.title}
            >
              Add Record
            </Button>
          </Stack>
        </Drawer>
      </Tabs.Panel>
    </Tabs>
  );
}
