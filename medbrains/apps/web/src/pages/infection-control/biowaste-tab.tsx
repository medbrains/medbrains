// IPD BiowasteTab — split from infection-control.tsx (pure move).

import {
  Drawer,
  Group,
  NumberInput,
  Paper,
  SegmentedControl,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useHasPermission } from "@medbrains/stores";
import type {
  BiowasteRecord,
  CreateBiowasteRecordRequest,
  WasteCategoryType,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { DataTable } from "@/components";
import { DepartmentSelect } from "@/components/DepartmentSelect";
import { Badge, Button, Table } from "@/components/ui";
import { infectionControlService } from "@/services/infectionControl.service";
import { statusColorTone } from "./shared";

export function BiowasteTab() {
  const canCreate = useHasPermission(P.INFECTION_CONTROL.BIOWASTE_CREATE);
  const qc = useQueryClient();
  const [opened, { open, close }] = useDisclosure(false);
  const [catFilter, setCatFilter] = useState<string | null>(null);
  const [subView, setSubView] = useState<string>("records");
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["ic-biowaste", catFilter],
    queryFn: () =>
      infectionControlService.listBiowasteRecords({ waste_category: catFilter ?? undefined }),
  });

  // Feature 7: BMW monthly report
  const monthlyReport = useMemo(() => {
    const filtered = records.filter((r) => r.record_date.startsWith(selectedMonth));
    const byCategory: Record<string, { weight: number; containers: number; count: number }> = {};
    filtered.forEach((r) => {
      const cat = r.waste_category;
      if (!byCategory[cat]) byCategory[cat] = { weight: 0, containers: 0, count: 0 };
      byCategory[cat].weight += Number(r.weight_kg);
      byCategory[cat].containers += r.container_count;
      byCategory[cat].count++;
    });
    return byCategory;
  }, [records, selectedMonth]);

  const monthOptions = useMemo(() => {
    const months = new Set<string>();
    records.forEach((r) => {
      const ym = r.record_date.substring(0, 7);
      months.add(ym);
    });
    return Array.from(months)
      .sort()
      .reverse()
      .map((m) => ({
        value: m,
        label: new Date(`${m}-01`).toLocaleDateString("en-US", { month: "short", year: "numeric" }),
      }));
  }, [records]);

  const [form, setForm] = useState<CreateBiowasteRecordRequest>({
    department_id: "",
    waste_category: "yellow" as WasteCategoryType,
    weight_kg: 0,
    record_date: "",
    container_count: 1,
  });

  const createMut = useMutation({
    mutationFn: (data: CreateBiowasteRecordRequest) =>
      infectionControlService.createBiowasteRecord(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["ic-biowaste"] });
      notifications.show({ title: "Record added", message: "", color: "success" });
      close();
    },
  });

  const columns = [
    {
      key: "waste_category" as const,
      label: "Category",
      render: (r: BiowasteRecord) => (
        <Badge tone={statusColorTone(r.waste_category)}>
          {r.waste_category.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      key: "weight_kg" as const,
      label: "Weight (kg)",
      render: (r: BiowasteRecord) => String(r.weight_kg),
    },
    {
      key: "container_count" as const,
      label: "Containers",
      render: (r: BiowasteRecord) => String(r.container_count),
    },
    {
      key: "record_date" as const,
      label: "Date",
      render: (r: BiowasteRecord) => new Date(r.record_date).toLocaleDateString(),
    },
    {
      key: "disposal_vendor" as const,
      label: "Vendor",
      render: (r: BiowasteRecord) => r.disposal_vendor ?? "---",
    },
    {
      key: "manifest_number" as const,
      label: "Manifest #",
      render: (r: BiowasteRecord) => r.manifest_number ?? "---",
    },
  ];

  return (
    <Stack>
      <Group justify="space-between">
        <Group>
          <SegmentedControl
            value={subView}
            onChange={setSubView}
            data={[
              { value: "records", label: "Records" },
              { value: "monthly", label: "Monthly Report" },
            ]}
          />
          {subView === "records" && (
            <Select
              placeholder="Category"
              data={[
                "yellow",
                "red",
                "white_translucent",
                "blue",
                "cytotoxic",
                "chemical",
                "radioactive",
              ]}
              value={catFilter}
              onChange={setCatFilter}
              clearable
              w={180}
            />
          )}
          {subView === "monthly" && monthOptions.length > 0 && (
            <Select
              value={selectedMonth}
              onChange={(v) => setSelectedMonth(v ?? selectedMonth)}
              data={monthOptions}
              w={200}
            />
          )}
          {subView === "records" && (
            <Text c="dimmed" size="sm">
              {records.length} record(s)
            </Text>
          )}
        </Group>
        {canCreate && subView === "records" && (
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={open}>
            Add Record
          </Button>
        )}
      </Group>

      {subView === "records" ? (
        <DataTable
          columns={columns}
          data={records}
          loading={isLoading}
          rowKey={(r) => r.id}
          emptyTitle="No bio-waste records"
        />
      ) : (
        <Paper p="md" withBorder>
          <Title order={5} mb="md">
            Monthly BMW Summary:{" "}
            {new Date(`${selectedMonth}-01`).toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
            })}
          </Title>
          {Object.keys(monthlyReport).length === 0 ? (
            <Text c="dimmed">No records for this month</Text>
          ) : (
            <Table striped withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Category</Table.Th>
                  <Table.Th>Total Weight (kg)</Table.Th>
                  <Table.Th>Total Containers</Table.Th>
                  <Table.Th>Record Count</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {Object.entries(monthlyReport).map(([cat, data]) => (
                  <Table.Tr key={cat}>
                    <Table.Td>
                      <Badge tone={statusColorTone(cat)}>{cat.replace(/_/g, " ")}</Badge>
                    </Table.Td>
                    <Table.Td>{data.weight.toFixed(2)}</Table.Td>
                    <Table.Td>{data.containers}</Table.Td>
                    <Table.Td>{data.count}</Table.Td>
                  </Table.Tr>
                ))}
                <Table.Tr style={{ fontWeight: 600 }}>
                  <Table.Td>Total</Table.Td>
                  <Table.Td>
                    {Object.values(monthlyReport)
                      .reduce((sum, d) => sum + d.weight, 0)
                      .toFixed(2)}
                  </Table.Td>
                  <Table.Td>
                    {Object.values(monthlyReport).reduce((sum, d) => sum + d.containers, 0)}
                  </Table.Td>
                  <Table.Td>
                    {Object.values(monthlyReport).reduce((sum, d) => sum + d.count, 0)}
                  </Table.Td>
                </Table.Tr>
              </Table.Tbody>
            </Table>
          )}
        </Paper>
      )}

      <Drawer opened={opened} onClose={close} title="Bio-waste Record" position="right" size="xl">
        <Stack>
          <DepartmentSelect
            value={form.department_id}
            onChange={(id) => setForm({ ...form, department_id: id })}
            required
          />
          <Select
            label="Waste Category"
            required
            data={[
              "yellow",
              "red",
              "white_translucent",
              "blue",
              "cytotoxic",
              "chemical",
              "radioactive",
            ]}
            value={form.waste_category}
            onChange={(v) =>
              setForm({ ...form, waste_category: (v ?? "yellow") as WasteCategoryType })
            }
          />
          <NumberInput
            label="Weight (kg)"
            required
            decimalScale={3}
            value={form.weight_kg}
            onChange={(v) => setForm({ ...form, weight_kg: Number(v) })}
          />
          <TextInput
            label="Record Date"
            type="date"
            required
            value={form.record_date}
            onChange={(e) => setForm({ ...form, record_date: e.currentTarget.value })}
          />
          <NumberInput
            label="Container Count"
            value={form.container_count}
            onChange={(v) => setForm({ ...form, container_count: Number(v) })}
          />
          <TextInput
            label="Disposal Vendor"
            value={form.disposal_vendor ?? ""}
            onChange={(e) =>
              setForm({ ...form, disposal_vendor: e.currentTarget.value || undefined })
            }
          />
          <TextInput
            label="Manifest Number"
            value={form.manifest_number ?? ""}
            onChange={(e) =>
              setForm({ ...form, manifest_number: e.currentTarget.value || undefined })
            }
          />
          <Button
            tone="primary"
            loading={createMut.isPending}
            onClick={() => createMut.mutate(form)}
          >
            Save
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ── Hand Hygiene Tab ────────────────────────────────────
