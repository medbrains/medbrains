import { Group, NumberInput, Select, Stack, Tabs, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useHasPermission } from "@medbrains/stores";
import type { PayrollRun, Payslip, SalaryStructure } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconCash, IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable, PageHeader } from "@/components";
import type { Column } from "@/components/DataTable";
import { EmployeeSearchSelect } from "@/components/EmployeeSearchSelect";
import { Badge, Button, Drawer, toast } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { hrService } from "@/services/hr.service";

const MONTHS = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1),
  label: new Date(2000, i, 1).toLocaleString("en", { month: "long" }),
}));

const inr = (v: string | number) => `₹${Number(v).toLocaleString("en-IN")}`;

export function PayrollPage() {
  useRequirePermission(P.HR.PAYROLL_STRUCTURES_LIST);
  const canManage = useHasPermission(P.HR.PAYROLL_STRUCTURES_MANAGE);
  const canRun = useHasPermission(P.HR.PAYROLL_RUNS_CREATE);
  const qc = useQueryClient();
  const now = new Date();

  const [structOpen, structHandlers] = useDisclosure(false);
  const [detailRun, setDetailRun] = useState<PayrollRun | null>(null);
  const [sForm, setSForm] = useState({
    employee_id: "",
    basic: 0,
    hra: 0,
    other_allowances: 0,
    monthly_tds: 0,
  });
  const [runMonth, setRunMonth] = useState(String(now.getMonth() + 1));
  const [runYear, setRunYear] = useState(now.getFullYear());

  const { data: structures = [] } = useQuery({
    queryKey: ["salary-structures"],
    queryFn: () => hrService.listSalaryStructures(),
  });
  const { data: runs = [] } = useQuery({
    queryKey: ["payroll-runs"],
    queryFn: () => hrService.listPayrollRuns(),
  });
  const { data: payslips = [] } = useQuery({
    queryKey: ["payslips", detailRun?.id],
    queryFn: () => hrService.listPayslips(detailRun?.id ?? ""),
    enabled: !!detailRun,
  });

  const upsertStruct = useMutation({
    mutationFn: () =>
      hrService.upsertSalaryStructure({
        employee_id: sForm.employee_id,
        basic: sForm.basic,
        hra: sForm.hra,
        other_allowances: sForm.other_allowances,
        monthly_tds: sForm.monthly_tds,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["salary-structures"] });
      toast.success("Salary structure saved", { title: "Payroll" });
      structHandlers.close();
      setSForm({ employee_id: "", basic: 0, hra: 0, other_allowances: 0, monthly_tds: 0 });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Could not save structure" }),
  });

  const generateRun = useMutation({
    mutationFn: () =>
      hrService.createPayrollRun({ period_month: Number(runMonth), period_year: runYear }),
    onSuccess: (run: PayrollRun) => {
      void qc.invalidateQueries({ queryKey: ["payroll-runs"] });
      toast.success(`Generated ${run.employee_count} payslips`, { title: "Payroll run" });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Could not run payroll" }),
  });

  const finalize = useMutation({
    mutationFn: (id: string) => hrService.finalizePayrollRun(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["payroll-runs"] });
      toast.success("Payroll finalized", { title: "Payroll" });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Could not finalize" }),
  });

  const structCols: Column<SalaryStructure>[] = [
    { key: "employee_id", label: "Employee", render: (r) => r.employee_id.slice(0, 8) },
    { key: "basic", label: "Basic", render: (r) => inr(r.basic) },
    { key: "hra", label: "HRA", render: (r) => inr(r.hra) },
    { key: "other_allowances", label: "Allowances", render: (r) => inr(r.other_allowances) },
    {
      key: "gross",
      label: "Gross",
      render: (r) => inr(Number(r.basic) + Number(r.hra) + Number(r.other_allowances)),
    },
  ];

  const runCols: Column<PayrollRun>[] = [
    {
      key: "period",
      label: "Period",
      render: (r) => `${MONTHS[r.period_month - 1]?.label ?? r.period_month} ${r.period_year}`,
    },
    { key: "employee_count", label: "Employees", render: (r) => r.employee_count },
    { key: "total_net_pay", label: "Total net", render: (r) => inr(r.total_net_pay) },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <Badge tone={r.status === "finalized" ? "success" : "neutral"}>{r.status}</Badge>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (r) =>
        r.status === "draft" && canRun ? (
          <Button
            size="xs"
            tone="secondary"
            onClick={(e) => {
              e.stopPropagation();
              finalize.mutate(r.id);
            }}
          >
            Finalize
          </Button>
        ) : null,
    },
  ];

  const payslipCols: Column<Payslip>[] = [
    { key: "employee_id", label: "Employee", render: (r) => r.employee_id.slice(0, 8) },
    { key: "paid_days", label: "Paid days", render: (r) => r.paid_days },
    { key: "earned_gross", label: "Earned gross", render: (r) => inr(r.earned_gross) },
    { key: "total_deductions", label: "Deductions", render: (r) => inr(r.total_deductions) },
    {
      key: "net_pay",
      label: "Net pay",
      render: (r) => <Text fw={600}>{inr(r.net_pay)}</Text>,
    },
  ];

  return (
    <Stack gap="md">
      <PageHeader title="Payroll" subtitle="Salary structures, payroll runs, payslips" />

      <Tabs defaultValue="structures">
        <Tabs.List>
          <Tabs.Tab value="structures">Salary structures</Tabs.Tab>
          <Tabs.Tab value="runs">Payroll runs</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="structures" pt="md">
          {canManage && (
            <Group justify="flex-end" mb="sm">
              <Button leftSection={<IconPlus size={16} />} onClick={structHandlers.open}>
                Set structure
              </Button>
            </Group>
          )}
          <DataTable
            columns={structCols}
            data={structures}
            rowKey={(r) => r.id}
            emptyTitle="No salary structures yet."
          />
        </Tabs.Panel>

        <Tabs.Panel value="runs" pt="md">
          {canRun && (
            <Group align="flex-end" mb="sm" gap="sm">
              <Select
                label="Month"
                data={MONTHS}
                value={runMonth}
                onChange={(v) => setRunMonth(v ?? runMonth)}
                style={{ width: 140 }}
              />
              <NumberInput
                label="Year"
                value={runYear}
                onChange={(v) => setRunYear(typeof v === "number" ? v : runYear)}
                style={{ width: 110 }}
              />
              <Button
                leftSection={<IconCash size={16} />}
                onClick={() => generateRun.mutate()}
                loading={generateRun.isPending}
              >
                Generate
              </Button>
            </Group>
          )}
          <DataTable
            columns={runCols}
            data={runs}
            rowKey={(r) => r.id}
            onRowClick={(r) => setDetailRun(r)}
            emptyTitle="No payroll runs yet."
          />
        </Tabs.Panel>
      </Tabs>

      <Drawer opened={structOpen} onClose={structHandlers.close} title="Salary structure" size="md">
        <Stack gap="sm">
          <EmployeeSearchSelect
            label="Employee"
            value={sForm.employee_id}
            onChange={(id) => setSForm({ ...sForm, employee_id: id })}
          />
          <NumberInput
            label="Basic"
            value={sForm.basic}
            onChange={(v) => setSForm({ ...sForm, basic: typeof v === "number" ? v : 0 })}
            min={0}
          />
          <NumberInput
            label="HRA"
            value={sForm.hra}
            onChange={(v) => setSForm({ ...sForm, hra: typeof v === "number" ? v : 0 })}
            min={0}
          />
          <NumberInput
            label="Other allowances"
            value={sForm.other_allowances}
            onChange={(v) =>
              setSForm({ ...sForm, other_allowances: typeof v === "number" ? v : 0 })
            }
            min={0}
          />
          <NumberInput
            label="Monthly TDS"
            value={sForm.monthly_tds}
            onChange={(v) => setSForm({ ...sForm, monthly_tds: typeof v === "number" ? v : 0 })}
            min={0}
          />
          <Button
            onClick={() => upsertStruct.mutate()}
            loading={upsertStruct.isPending}
            disabled={!sForm.employee_id}
          >
            Save structure
          </Button>
        </Stack>
      </Drawer>

      <Drawer
        opened={!!detailRun}
        onClose={() => setDetailRun(null)}
        title="Payslips"
        position="right"
        size="xl"
      >
        {detailRun && (
          <Stack gap="sm">
            <Text size="sm" c="dimmed">
              {MONTHS[detailRun.period_month - 1]?.label} {detailRun.period_year} ·{" "}
              {detailRun.employee_count} employees · {inr(detailRun.total_net_pay)} total
            </Text>
            <DataTable
              columns={payslipCols}
              data={payslips}
              rowKey={(r) => r.id}
              emptyTitle="No payslips."
            />
          </Stack>
        )}
      </Drawer>
    </Stack>
  );
}
