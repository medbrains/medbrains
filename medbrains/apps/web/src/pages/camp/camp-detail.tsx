// CAMP CampDetail — split from camp.tsx (pure move).

import {
  Card,
  Group,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useHasPermission } from "@medbrains/stores";
import type { Camp, CampIncident, CampSupplyItem, CampTeamMember } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconDownload, IconPlus, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router";
import { DataTable } from "@/components";
import type { Column } from "@/components/DataTable";
import { Badge, Button, IconButton } from "@/components/ui";
import { campService } from "@/services/camp.service";
import { CAMP_TEAM_ROLES, StatCard } from "./shared";

export function CampDetail({ camp }: { camp: Camp }) {
  const navigate = useNavigate();
  const canUpdate = useHasPermission(P.CAMP.UPDATE);
  const canListRegistrations = useHasPermission(P.CAMP.REGISTRATIONS_LIST);
  const canListScreenings = useHasPermission(P.CAMP.SCREENINGS_LIST);
  const canListLab = useHasPermission(P.CAMP.LAB_LIST);
  const qc = useQueryClient();
  const [supplyForm, setSupplyForm] = useState<{
    category: CampSupplyItem["category"];
    item_name: string;
    unit: string;
    planned_qty: number;
    is_critical: boolean;
  }>({
    category: "consumable",
    item_name: "",
    unit: "pcs",
    planned_qty: 0,
    is_critical: false,
  });
  const [incidentForm, setIncidentForm] = useState<{
    incident_type: CampIncident["incident_type"];
    severity: CampIncident["severity"];
    description: string;
  }>({
    incident_type: "patient_safety",
    severity: "low",
    description: "",
  });
  const canDownloadPacket = canListRegistrations && canListScreenings && canListLab;

  const { data: team = [] } = useQuery({
    queryKey: ["camp-team", camp.id],
    queryFn: () => campService.listCampTeamMembers(camp.id),
  });

  const { data: stats } = useQuery({
    queryKey: ["camp-stats", camp.id],
    queryFn: () => campService.getCampStats(camp.id),
  });

  const { data: remoteOps } = useQuery({
    queryKey: ["camp-remote-operations", camp.id],
    queryFn: () => campService.getCampRemoteOperations(camp.id),
  });

  const removeMut = useMutation({
    mutationFn: (memberId: string) => campService.removeCampTeamMember(camp.id, memberId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["camp-team", camp.id] }),
  });

  const packetMut = useMutation({
    mutationFn: () => campService.getCampPacket(camp.id, { device_id: "web-admin-preview" }),
    onSuccess: (packet) => {
      notifications.show({
        title: "Packet ready",
        message: `${packet.registrations.length} registrations, ${packet.screenings.length} screenings, ${packet.lab_samples.length} samples, ${packet.patient_summaries.length} linked patients`,
        color: "success",
      });
    },
  });

  const checklistMut = useMutation({
    mutationFn: (input: { id: string; status: "ok" | "issue" | "not_applicable" }) =>
      campService.updateCampRemoteChecklistItem(input.id, { status: input.status }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["camp-remote-operations", camp.id] });
    },
  });

  const supplyMut = useMutation({
    mutationFn: () =>
      campService.createCampSupplyItem(camp.id, {
        category: supplyForm.category,
        item_name: supplyForm.item_name,
        unit: supplyForm.unit || undefined,
        planned_qty: supplyForm.planned_qty,
        is_critical: supplyForm.is_critical,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["camp-remote-operations", camp.id] });
      setSupplyForm({
        category: "consumable",
        item_name: "",
        unit: "pcs",
        planned_qty: 0,
        is_critical: false,
      });
    },
  });

  const incidentMut = useMutation({
    mutationFn: () =>
      campService.createCampIncident(camp.id, {
        incident_type: incidentForm.incident_type,
        severity: incidentForm.severity,
        description: incidentForm.description,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["camp-remote-operations", camp.id] });
      setIncidentForm({
        incident_type: "patient_safety",
        severity: "low",
        description: "",
      });
    },
  });

  const teamCols: Column<CampTeamMember>[] = [
    { key: "employee_id", label: "Employee ID", render: (r) => r.employee_id.slice(0, 8) },
    {
      key: "role_in_camp",
      label: "Role",
      render: (r) =>
        CAMP_TEAM_ROLES.find((role) => role.value === r.role_in_camp)?.label ?? r.role_in_camp,
    },
    {
      key: "is_confirmed",
      label: "Confirmed",
      render: (r) =>
        r.is_confirmed ? (
          <Badge tone="success" size="xs">
            Yes
          </Badge>
        ) : (
          <Badge tone="neutral" size="xs">
            No
          </Badge>
        ),
    },
    {
      key: "actions",
      label: "",
      render: (r) =>
        canUpdate ? (
          <IconButton
            tone="danger"
            size="sm"
            onClick={() => removeMut.mutate(r.id)}
            aria-label="Delete"
          >
            <IconTrash size={14} />
          </IconButton>
        ) : null,
    },
  ];

  return (
    <Stack>
      <Group justify="space-between" align="flex-end">
        <Stack gap={2}>
          <Text fw={600}>Camp Packet</Text>
          <Text size="sm" c="dimmed">
            Segmented camp data for offline intake, screening, vitals, and sample collection.
          </Text>
        </Stack>
        {canDownloadPacket && (
          <Button
            tone="secondary"
            size="xs"
            leftSection={<IconDownload size={14} />}
            loading={packetMut.isPending}
            onClick={() => packetMut.mutate()}
          >
            Check Packet
          </Button>
        )}
      </Group>

      {stats && (
        <SimpleGrid cols={4}>
          <StatCard label="Registrations" value={stats.total_registrations} />
          <StatCard label="Screened" value={stats.screened} />
          <StatCard label="Referred" value={stats.referred} />
          <StatCard label="Converted" value={stats.converted} />
          <StatCard label="Lab Samples" value={stats.lab_samples} />
          <StatCard label="Follow-ups" value={stats.followups_scheduled} />
          <StatCard label="FU Completed" value={stats.followups_completed} />
          <StatCard label="Billing Total" value={stats.billing_total} prefix="₹" />
        </SimpleGrid>
      )}

      {remoteOps && (
        <Card withBorder>
          <Group justify="space-between" mb="sm">
            <Stack gap={2}>
              <Text fw={600}>Remote Village Readiness</Text>
              <Text size="sm" c="dimmed">
                NABH mapped controls for site safety, IPC/BMW, privacy, referral, staff briefing,
                and offline records.
              </Text>
            </Stack>
            <Badge
              tone={remoteOps.readiness.ready ? "success" : "warning"}
              variant="filled"
              size="lg"
            >
              {remoteOps.readiness.score}% ready
            </Badge>
          </Group>

          <SimpleGrid cols={4} mb="sm">
            <StatCard label="Required Done" value={remoteOps.readiness.required_done} />
            <StatCard label="Required Total" value={remoteOps.readiness.required_total} />
            <StatCard label="Issues" value={remoteOps.readiness.issue_count} />
            <StatCard label="Supplies" value={remoteOps.supplies.length} />
          </SimpleGrid>

          <Stack gap="xs">
            {remoteOps.checklist.map((item) => (
              <Group key={item.id} justify="space-between" align="flex-start" wrap="nowrap">
                <Stack gap={2} style={{ flex: 1 }}>
                  <Group gap="xs">
                    <Badge tone="neutral" size="xs" variant="light">
                      {item.nabh_chapter}
                    </Badge>
                    <Badge
                      size="xs"
                      tone={
                        item.status === "ok" || item.status === "not_applicable"
                          ? "success"
                          : item.status === "issue"
                            ? "danger"
                            : "neutral"
                      }
                    >
                      {item.status.replace("_", " ")}
                    </Badge>
                  </Group>
                  <Text size="sm">{item.label}</Text>
                </Stack>
                {canUpdate && (
                  <Group gap={4} wrap="nowrap">
                    <Button
                      tone="primary"
                      size="compact-xs"
                      onClick={() => checklistMut.mutate({ id: item.id, status: "ok" })}
                    >
                      OK
                    </Button>
                    <Button
                      tone="subtle-danger"
                      size="compact-xs"
                      onClick={() => checklistMut.mutate({ id: item.id, status: "issue" })}
                    >
                      Issue
                    </Button>
                    <Button
                      tone="ghost"
                      size="compact-xs"
                      onClick={() => checklistMut.mutate({ id: item.id, status: "not_applicable" })}
                    >
                      N/A
                    </Button>
                  </Group>
                )}
              </Group>
            ))}
          </Stack>

          <SimpleGrid cols={2} mt="md">
            <Stack gap="xs">
              <Group justify="space-between">
                <Text fw={600}>Supplies</Text>
                <Badge tone="neutral" variant="light">
                  {remoteOps.supplies.length}
                </Badge>
              </Group>
              {remoteOps.supplies.slice(0, 6).map((item) => (
                <Group key={item.id} justify="space-between" wrap="nowrap">
                  <Stack gap={0}>
                    <Text size="sm" fw={500}>
                      {item.item_name}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {item.category} · packed {item.packed_qty}/{item.planned_qty}{" "}
                      {item.unit ?? ""}
                    </Text>
                  </Stack>
                  {item.is_critical && (
                    <Badge size="xs" tone="danger">
                      Critical
                    </Badge>
                  )}
                </Group>
              ))}
              {canUpdate && (
                <Stack gap="xs">
                  <Select
                    label="Category"
                    size="xs"
                    value={supplyForm.category}
                    data={[
                      "equipment",
                      "consumable",
                      "medicine",
                      "ppe",
                      "biomedical_waste",
                      "document",
                      "it",
                      "other",
                    ]}
                    onChange={(value) =>
                      value &&
                      setSupplyForm((current) => ({
                        ...current,
                        category: value as CampSupplyItem["category"],
                      }))
                    }
                  />
                  <TextInput
                    label="Item"
                    size="xs"
                    value={supplyForm.item_name}
                    onChange={(event) =>
                      setSupplyForm((current) => ({
                        ...current,
                        item_name: event.currentTarget.value,
                      }))
                    }
                  />
                  <Group grow align="flex-end">
                    <NumberInput
                      label="Planned"
                      size="xs"
                      min={0}
                      value={supplyForm.planned_qty}
                      onChange={(value) =>
                        setSupplyForm((current) => ({
                          ...current,
                          planned_qty: typeof value === "number" ? value : 0,
                        }))
                      }
                    />
                    <TextInput
                      label="Unit"
                      size="xs"
                      value={supplyForm.unit}
                      onChange={(event) =>
                        setSupplyForm((current) => ({
                          ...current,
                          unit: event.currentTarget.value,
                        }))
                      }
                    />
                  </Group>
                  <Switch
                    size="xs"
                    label="Critical item"
                    checked={supplyForm.is_critical}
                    onChange={(event) =>
                      setSupplyForm((current) => ({
                        ...current,
                        is_critical: event.currentTarget.checked,
                      }))
                    }
                  />
                  <Button
                    tone="secondary"
                    size="xs"
                    leftSection={<IconPlus size={14} />}
                    disabled={!supplyForm.item_name}
                    loading={supplyMut.isPending}
                    onClick={() => supplyMut.mutate()}
                  >
                    Add Supply
                  </Button>
                </Stack>
              )}
            </Stack>

            <Stack gap="xs">
              <Group justify="space-between">
                <Text fw={600}>Incidents / Near Miss</Text>
                <Badge variant="light" tone={remoteOps.incidents.length > 0 ? "danger" : "neutral"}>
                  {remoteOps.incidents.length}
                </Badge>
              </Group>
              {remoteOps.incidents.slice(0, 6).map((item) => (
                <Group key={item.id} justify="space-between" align="flex-start" wrap="nowrap">
                  <Stack gap={0}>
                    <Text size="sm" fw={500}>
                      {item.incident_type.replace("_", " ")}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {item.description}
                    </Text>
                  </Stack>
                  <Badge size="xs" tone={item.severity === "critical" ? "danger" : "warning"}>
                    {item.severity}
                  </Badge>
                </Group>
              ))}
              {canUpdate && (
                <Stack gap="xs">
                  <Group grow>
                    <Select
                      label="Type"
                      size="xs"
                      value={incidentForm.incident_type}
                      data={[
                        "patient_safety",
                        "infection_control",
                        "biomedical_waste",
                        "facility_safety",
                        "staff_safety",
                        "data_privacy",
                        "equipment",
                        "network",
                        "crowd_control",
                        "other",
                      ]}
                      onChange={(value) =>
                        value &&
                        setIncidentForm((current) => ({
                          ...current,
                          incident_type: value as CampIncident["incident_type"],
                        }))
                      }
                    />
                    <Select
                      label="Severity"
                      size="xs"
                      value={incidentForm.severity}
                      data={["low", "moderate", "high", "critical"]}
                      onChange={(value) =>
                        value &&
                        setIncidentForm((current) => ({
                          ...current,
                          severity: value as CampIncident["severity"],
                        }))
                      }
                    />
                  </Group>
                  <Textarea
                    label="Description"
                    size="xs"
                    minRows={2}
                    value={incidentForm.description}
                    onChange={(event) =>
                      setIncidentForm((current) => ({
                        ...current,
                        description: event.currentTarget.value,
                      }))
                    }
                  />
                  <Button
                    tone="subtle-danger"
                    size="xs"
                    leftSection={<IconPlus size={14} />}
                    disabled={!incidentForm.description}
                    loading={incidentMut.isPending}
                    onClick={() => incidentMut.mutate()}
                  >
                    Record Incident
                  </Button>
                </Stack>
              )}
            </Stack>
          </SimpleGrid>
        </Card>
      )}

      <Group justify="space-between">
        <Text fw={600}>Team Members ({team.length})</Text>
        {canUpdate && (
          <Button
            tone="primary"
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={() => navigate(`/camp/${camp.id}/work/team/new`)}
          >
            Add Member
          </Button>
        )}
      </Group>

      <DataTable columns={teamCols} data={team} rowKey={(r) => r.id} />
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Registrations Tab
// ══════════════════════════════════════════════════════════
