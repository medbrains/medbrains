// IPD ContractsTab — split from bme.tsx (pure move).

import {
  Card,
  Drawer,
  Group,
  NumberInput,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useHasPermission } from "@medbrains/stores";
import type {
  BmeContract,
  BmeVendorEvaluation,
  CreateBmeContractRequest,
  CreateBmeVendorEvaluationRequest,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconAlertTriangle, IconClock, IconPlus, IconStarFilled } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { DataTable } from "@/components";
import type { Column } from "@/components/DataTable";
import { Alert, Badge, type BadgeTone, Button } from "@/components/ui";
import { VendorSearchSelect } from "@/components/VendorSearchSelect";
import { bmeService } from "@/services/bme.service";
import { daysUntil, fmtDate } from "./shared";

const CONTRACT_TYPES = [
  { value: "amc", label: "AMC" },
  { value: "cmc", label: "CMC" },
  { value: "warranty", label: "Warranty" },
  { value: "camc", label: "CAMC" },
];

function contractTypeBadge(t: string) {
  const map: Record<string, BadgeTone> = {
    amc: "primary",
    cmc: "accent",
    warranty: "success",
    camc: "success",
  };
  return (
    <Badge tone={map[t] ?? "neutral"} variant="light" size="sm">
      {t.toUpperCase()}
    </Badge>
  );
}

export function ContractsTab() {
  const canManage = useHasPermission(P.BME.CONTRACTS_MANAGE);
  const canEval = useHasPermission(P.BME.EVALUATIONS_MANAGE);
  const qc = useQueryClient();
  const [contractOpened, { open: openContract, close: closeContract }] = useDisclosure(false);
  const [evalOpened, { open: openEval, close: closeEval }] = useDisclosure(false);
  const [contractForm, setContractForm] = useState<CreateBmeContractRequest>({
    contract_number: "",
    equipment_id: "",
    contract_type: "amc",
    vendor_id: "",
    start_date: "",
    end_date: "",
  });
  const [evalForm, setEvalForm] = useState<CreateBmeVendorEvaluationRequest>({
    vendor_id: "",
    evaluation_date: "",
  });

  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ["bme-contracts"],
    queryFn: () => bmeService.listBmeContracts(),
  });

  const { data: evaluations = [], isLoading: loadingEvals } = useQuery({
    queryKey: ["bme-vendor-evaluations"],
    queryFn: () => bmeService.listBmeVendorEvaluations(),
  });

  const { data: equipment = [] } = useQuery({
    queryKey: ["bme-equipment"],
    queryFn: () => bmeService.listBmeEquipment(),
  });
  const equipOptions = equipment.map((e) => ({
    value: e.id,
    label: `${e.name} (${e.asset_tag ?? "—"})`,
  }));

  const createContractMut = useMutation({
    mutationFn: (body: CreateBmeContractRequest) => bmeService.createBmeContract(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["bme-contracts"] });
      closeContract();
      notifications.show({ message: "Contract created" });
    },
  });

  const createEvalMut = useMutation({
    mutationFn: (body: CreateBmeVendorEvaluationRequest) =>
      bmeService.createBmeVendorEvaluation(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["bme-vendor-evaluations"] });
      closeEval();
      notifications.show({ message: "Evaluation saved" });
    },
  });

  const { data: workOrders = [] } = useQuery({
    queryKey: ["bme-work-orders"],
    queryFn: () => bmeService.listBmeWorkOrders(),
  });

  const contractRenewalAlerts = useMemo(() => {
    return contracts
      .filter((c) => c.is_active)
      .map((c) => {
        const days = daysUntil(c.end_date);
        const alertThreshold = c.renewal_alert_days > 0 ? c.renewal_alert_days : 60;
        return {
          ...c,
          daysLeft: days,
          alertThreshold,
          equipName: equipment.find((e) => e.id === c.equipment_id)?.name ?? c.equipment_id,
        };
      })
      .filter((c) => c.daysLeft <= c.alertThreshold)
      .sort((a, b) => a.daysLeft - b.daysLeft);
  }, [contracts, equipment]);

  const costAnalysis = useMemo(() => {
    return contracts
      .filter((c) => c.contract_value && c.contract_value > 0)
      .map((c) => {
        const equipName = equipment.find((e) => e.id === c.equipment_id)?.name ?? "—";
        const contractValue = Number(c.contract_value);
        const totalWoCost = workOrders
          .filter((wo) => wo.equipment_id === c.equipment_id && wo.total_cost)
          .reduce((sum, wo) => sum + Number(wo.total_cost), 0);
        const utilization = contractValue > 0 ? Math.round((totalWoCost / contractValue) * 100) : 0;
        return {
          id: c.id,
          equipName,
          contractNumber: c.contract_number,
          contractType: c.contract_type,
          contractValue,
          totalWoCost,
          utilization,
        };
      });
  }, [contracts, equipment, workOrders]);

  const contractColumns: Column<BmeContract>[] = [
    {
      key: "number",
      label: "Contract #",
      render: (r) => (
        <Text fw={500} size="sm">
          {r.contract_number}
        </Text>
      ),
    },
    {
      key: "equipment",
      label: "Equipment",
      render: (r) => (
        <Text size="sm">{equipment.find((e) => e.id === r.equipment_id)?.name ?? "—"}</Text>
      ),
    },
    { key: "type", label: "Type", render: (r) => contractTypeBadge(r.contract_type) },
    {
      key: "validity",
      label: "Validity",
      render: (r) => (
        <Text size="sm">
          {fmtDate(r.start_date)} — {fmtDate(r.end_date)}
        </Text>
      ),
    },
    {
      key: "value",
      label: "Value",
      render: (r) => (
        <Text size="sm">
          {r.contract_value ? `₹${Number(r.contract_value).toLocaleString()}` : "—"}
        </Text>
      ),
    },
    {
      key: "expiry",
      label: "Expiry",
      render: (r) => {
        const daysLeft = Math.ceil((new Date(r.end_date).getTime() - Date.now()) / 86400000);
        if (daysLeft < 0)
          return (
            <Badge tone="danger" size="sm">
              Expired
            </Badge>
          );
        if (daysLeft <= 30)
          return (
            <Badge tone="danger" size="sm">
              {daysLeft}d left
            </Badge>
          );
        if (daysLeft <= 90)
          return (
            <Badge tone="warning" size="sm">
              {daysLeft}d left
            </Badge>
          );
        return (
          <Badge tone="success" size="sm">
            {daysLeft}d left
          </Badge>
        );
      },
    },
    {
      key: "active",
      label: "Active",
      render: (r) =>
        r.is_active ? (
          <Badge tone="success" size="sm">
            Yes
          </Badge>
        ) : (
          <Badge tone="neutral" size="sm">
            No
          </Badge>
        ),
    },
  ];

  const evalColumns: Column<BmeVendorEvaluation>[] = [
    {
      key: "date",
      label: "Date",
      render: (r) => <Text size="sm">{fmtDate(r.evaluation_date)}</Text>,
    },
    {
      key: "period",
      label: "Period",
      render: (r) => (
        <Text size="sm">
          {fmtDate(r.period_from)} — {fmtDate(r.period_to)}
        </Text>
      ),
    },
    {
      key: "overall",
      label: "Overall Score",
      render: (r) =>
        r.overall_score ? (
          <Group gap={4}>
            <IconStarFilled size={14} color="orange" />
            <Text size="sm" fw={600}>
              {Number(r.overall_score).toFixed(1)}/5
            </Text>
          </Group>
        ) : (
          <Text size="sm">—</Text>
        ),
    },
    {
      key: "sla",
      label: "SLA Compliance",
      render: (r) =>
        r.total_calls ? (
          <Text size="sm">
            {r.calls_within_sla ?? 0}/{r.total_calls} (
            {Math.round(((r.calls_within_sla ?? 0) / r.total_calls) * 100)}%)
          </Text>
        ) : (
          <Text size="sm">—</Text>
        ),
    },
    {
      key: "comments",
      label: "Comments",
      render: (r) => (
        <Text size="sm" lineClamp={1}>
          {r.comments ?? "—"}
        </Text>
      ),
    },
  ];

  return (
    <Stack>
      {contractRenewalAlerts.length > 0 && (
        <Alert
          tone={contractRenewalAlerts.some((c) => c.daysLeft < 0) ? "danger" : "warning"}
          title={`${contractRenewalAlerts.length} Contract${contractRenewalAlerts.length > 1 ? "s" : ""} Expiring Soon`}
          icon={<IconAlertTriangle size={20} />}
        >
          <Stack gap={4}>
            {contractRenewalAlerts.map((c) => (
              <Group key={c.id} gap="xs">
                <Text size="sm" fw={500}>
                  {c.equipName}
                </Text>
                <Badge tone="neutral" variant="light" size="sm">
                  {c.contract_type.toUpperCase()}
                </Badge>
                <Text size="xs" c="dimmed">
                  #{c.contract_number}
                </Text>
                {c.daysLeft < 0 ? (
                  <Badge tone="danger" size="sm" variant="filled">
                    EXPIRED {Math.abs(c.daysLeft)}d ago
                  </Badge>
                ) : (
                  <Badge tone="warning" size="sm" leftSection={<IconClock size={12} />}>
                    Expires in {c.daysLeft}d
                  </Badge>
                )}
              </Group>
            ))}
          </Stack>
        </Alert>
      )}

      {costAnalysis.length > 0 && (
        <Card withBorder p="md">
          <Text fw={600} size="lg" mb="sm">
            Cost vs Contract Value Analysis
          </Text>
          <DataTable
            columns={[
              {
                key: "equipment",
                label: "Equipment",
                render: (row: (typeof costAnalysis)[number]) => (
                  <Text size="sm" fw={500}>
                    {row.equipName}
                  </Text>
                ),
              },
              {
                key: "contractNumber",
                label: "Contract #",
                render: (row: (typeof costAnalysis)[number]) => (
                  <Text size="sm">{row.contractNumber}</Text>
                ),
              },
              {
                key: "type",
                label: "Type",
                render: (row: (typeof costAnalysis)[number]) => contractTypeBadge(row.contractType),
              },
              {
                key: "contractValue",
                label: "Contract Value",
                render: (row: (typeof costAnalysis)[number]) => (
                  <Text size="sm" ta="right">{`\u20B9${row.contractValue.toLocaleString()}`}</Text>
                ),
              },
              {
                key: "totalWoCost",
                label: "Total WO Cost",
                render: (row: (typeof costAnalysis)[number]) => (
                  <Text size="sm" ta="right">{`\u20B9${row.totalWoCost.toLocaleString()}`}</Text>
                ),
              },
              {
                key: "utilization",
                label: "Utilization",
                render: (row: (typeof costAnalysis)[number]) => (
                  <Group justify="flex-end">
                    <Badge
                      tone={
                        row.utilization > 100
                          ? "danger"
                          : row.utilization > 80
                            ? "warning"
                            : "success"
                      }
                      variant="light"
                      size="sm"
                    >
                      {row.utilization}%
                    </Badge>
                  </Group>
                ),
              },
            ]}
            data={costAnalysis}
            rowKey={(row) => row.id}
          />
        </Card>
      )}

      <Text fw={600} size="lg">
        Service Contracts
      </Text>
      <Group justify="flex-end">
        {canManage && (
          <Button
            tone="primary"
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={() => {
              setContractForm({
                contract_number: "",
                equipment_id: "",
                contract_type: "amc",
                vendor_id: "",
                start_date: "",
                end_date: "",
              });
              openContract();
            }}
          >
            Add Contract
          </Button>
        )}
      </Group>
      <DataTable
        columns={contractColumns}
        data={contracts}
        loading={isLoading}
        rowKey={(r) => r.id}
      />

      <Text fw={600} size="lg" mt="md">
        Vendor Evaluations
      </Text>
      <Group justify="flex-end">
        {canEval && (
          <Button
            tone="primary"
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={() => {
              setEvalForm({ vendor_id: "", evaluation_date: "" });
              openEval();
            }}
          >
            Add Evaluation
          </Button>
        )}
      </Group>
      <DataTable
        columns={evalColumns}
        data={evaluations}
        loading={loadingEvals}
        rowKey={(r) => r.id}
      />

      <Drawer
        opened={contractOpened}
        onClose={closeContract}
        title="Add Contract"
        position="right"
        size="lg"
      >
        <Stack>
          <TextInput
            label="Contract Number"
            required
            value={contractForm.contract_number}
            onChange={(e) => setContractForm({ ...contractForm, contract_number: e.target.value })}
          />
          <Select
            label="Equipment"
            required
            data={equipOptions}
            value={contractForm.equipment_id}
            onChange={(v) => setContractForm({ ...contractForm, equipment_id: v ?? "" })}
            searchable
          />
          <Select
            label="Contract Type"
            required
            data={CONTRACT_TYPES}
            value={contractForm.contract_type}
            onChange={(v) =>
              setContractForm({
                ...contractForm,
                contract_type: (v ?? "amc") as CreateBmeContractRequest["contract_type"],
              })
            }
          />
          <VendorSearchSelect
            label="Vendor"
            required
            value={contractForm.vendor_id}
            onChange={(vendorId) => setContractForm({ ...contractForm, vendor_id: vendorId })}
          />
          <Group grow>
            <DateInput
              label="Start Date"
              required
              value={contractForm.start_date || null}
              onChange={(d) =>
                setContractForm({ ...contractForm, start_date: d?.slice(0, 10) ?? "" })
              }
            />
            <DateInput
              label="End Date"
              required
              value={contractForm.end_date || null}
              onChange={(d) =>
                setContractForm({ ...contractForm, end_date: d?.slice(0, 10) ?? "" })
              }
            />
          </Group>
          <NumberInput
            label="Contract Value (₹)"
            value={contractForm.contract_value ?? ""}
            onChange={(v) =>
              setContractForm({
                ...contractForm,
                contract_value: typeof v === "number" ? v : undefined,
              })
            }
          />
          <Textarea
            label="Coverage Details"
            value={contractForm.coverage_details ?? ""}
            onChange={(e) => setContractForm({ ...contractForm, coverage_details: e.target.value })}
          />
          <Textarea
            label="Exclusions"
            value={contractForm.exclusions ?? ""}
            onChange={(e) => setContractForm({ ...contractForm, exclusions: e.target.value })}
          />
          <Group grow>
            <NumberInput
              label="SLA Response (hrs)"
              value={contractForm.sla_response_hours ?? ""}
              onChange={(v) =>
                setContractForm({
                  ...contractForm,
                  sla_response_hours: typeof v === "number" ? v : undefined,
                })
              }
            />
            <NumberInput
              label="SLA Resolution (hrs)"
              value={contractForm.sla_resolution_hours ?? ""}
              onChange={(v) =>
                setContractForm({
                  ...contractForm,
                  sla_resolution_hours: typeof v === "number" ? v : undefined,
                })
              }
            />
          </Group>
          <Button
            tone="primary"
            onClick={() => createContractMut.mutate(contractForm)}
            loading={createContractMut.isPending}
          >
            Create
          </Button>
        </Stack>
      </Drawer>

      <Drawer
        opened={evalOpened}
        onClose={closeEval}
        title="Vendor Evaluation"
        position="right"
        size="xl"
      >
        <Stack>
          <VendorSearchSelect
            label="Vendor"
            required
            value={evalForm.vendor_id}
            onChange={(vendorId) => setEvalForm({ ...evalForm, vendor_id: vendorId })}
          />
          <DateInput
            label="Evaluation Date"
            required
            value={evalForm.evaluation_date || null}
            onChange={(d) => setEvalForm({ ...evalForm, evaluation_date: d?.slice(0, 10) ?? "" })}
          />
          <Group grow>
            <NumberInput
              label="Response Time (1-5)"
              min={1}
              max={5}
              value={evalForm.response_time_score ?? ""}
              onChange={(v) =>
                setEvalForm({
                  ...evalForm,
                  response_time_score: typeof v === "number" ? v : undefined,
                })
              }
            />
            <NumberInput
              label="Resolution Quality (1-5)"
              min={1}
              max={5}
              value={evalForm.resolution_quality_score ?? ""}
              onChange={(v) =>
                setEvalForm({
                  ...evalForm,
                  resolution_quality_score: typeof v === "number" ? v : undefined,
                })
              }
            />
          </Group>
          <Group grow>
            <NumberInput
              label="Spare Parts (1-5)"
              min={1}
              max={5}
              value={evalForm.spare_parts_availability_score ?? ""}
              onChange={(v) =>
                setEvalForm({
                  ...evalForm,
                  spare_parts_availability_score: typeof v === "number" ? v : undefined,
                })
              }
            />
            <NumberInput
              label="Professionalism (1-5)"
              min={1}
              max={5}
              value={evalForm.professionalism_score ?? ""}
              onChange={(v) =>
                setEvalForm({
                  ...evalForm,
                  professionalism_score: typeof v === "number" ? v : undefined,
                })
              }
            />
          </Group>
          <NumberInput
            label="Overall Score"
            min={1}
            max={5}
            decimalScale={1}
            value={evalForm.overall_score ?? ""}
            onChange={(v) =>
              setEvalForm({ ...evalForm, overall_score: typeof v === "number" ? v : undefined })
            }
          />
          <Group grow>
            <NumberInput
              label="Total Calls"
              value={evalForm.total_calls ?? ""}
              onChange={(v) =>
                setEvalForm({ ...evalForm, total_calls: typeof v === "number" ? v : undefined })
              }
            />
            <NumberInput
              label="Calls within SLA"
              value={evalForm.calls_within_sla ?? ""}
              onChange={(v) =>
                setEvalForm({
                  ...evalForm,
                  calls_within_sla: typeof v === "number" ? v : undefined,
                })
              }
            />
          </Group>
          <Textarea
            label="Comments"
            value={evalForm.comments ?? ""}
            onChange={(e) => setEvalForm({ ...evalForm, comments: e.target.value })}
          />
          <Button
            tone="primary"
            onClick={() => createEvalMut.mutate(evalForm)}
            loading={createEvalMut.isPending}
          >
            Save
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Breakdowns Tab
// ══════════════════════════════════════════════════════════
