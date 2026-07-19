// HR RosterTab — split from hr.tsx (pure move).

import {
  Drawer,
  Group,
  NumberInput,
  Select,
  Stack,
  Switch,
  Tabs,
  Text,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type { DutyRoster, OnCallSchedule, ShiftDefinition } from "@medbrains/types";
import { IconCheck, IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import { EmployeeSearchSelect } from "@/components/EmployeeSearchSelect";
import { Badge, Button, IconButton, toast } from "@/components/ui";
import { hrService } from "@/services/hr.service";

export function RosterTab({
  canManage,
  canManageOnCall,
}: {
  canManage: boolean;
  canManageOnCall: boolean;
}) {
  const qc = useQueryClient();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [rosterOpen, { open: openRoster, close: closeRoster }] = useDisclosure(false);
  const [onCallOpen, { open: openOnCall, close: closeOnCall }] = useDisclosure(false);
  const [subTab, setSubTab] = useState<string | null>("roster");

  const { data: shifts = [] } = useQuery({
    queryKey: ["hr-shifts"],
    queryFn: hrService.listShifts,
  });
  const { data: rosters = [], isLoading: rostersLoading } = useQuery({
    queryKey: ["hr-rosters", dateFrom, dateTo],
    queryFn: () =>
      hrService.listRosters({ date_from: dateFrom || undefined, date_to: dateTo || undefined }),
  });
  const { data: onCallList = [], isLoading: onCallLoading } = useQuery({
    queryKey: ["hr-on-call"],
    queryFn: () => hrService.listOnCall({}),
  });

  // ── Shift management ──
  const [shiftOpen, { open: openShift, close: closeShift }] = useDisclosure(false);
  const [shiftForm, setShiftForm] = useState({
    code: "",
    name: "",
    shift_type: "general",
    start_time: "09:00",
    end_time: "17:00",
    break_minutes: 30,
    is_night: false,
  });
  const shiftMut = useMutation({
    mutationFn: () =>
      hrService.createShift({
        code: shiftForm.code,
        name: shiftForm.name,
        shift_type: shiftForm.shift_type,
        start_time: shiftForm.start_time,
        end_time: shiftForm.end_time,
        break_minutes: shiftForm.break_minutes,
        is_night: shiftForm.is_night,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["hr-shifts"] });
      closeShift();
      toast.success("Shift definition added", { title: "Shift Created" });
    },
  });

  // ── Create roster entry ──
  const [rosterForm, setRosterForm] = useState({
    employee_id: "",
    shift_id: "",
    roster_date: "",
    is_on_call: false,
  });
  const rosterMut = useMutation({
    mutationFn: () =>
      hrService.createRoster({
        employee_id: rosterForm.employee_id,
        shift_id: rosterForm.shift_id,
        roster_date: rosterForm.roster_date,
        is_on_call: rosterForm.is_on_call,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["hr-rosters"] });
      closeRoster();
      setRosterForm({ employee_id: "", shift_id: "", roster_date: "", is_on_call: false });
      toast.success("Duty roster updated", { title: "Roster Entry Added" });
    },
    onError: () => toast.error("Failed to create roster entry", { title: "Error" }),
  });

  // ── Create on-call ──
  const [onCallForm, setOnCallForm] = useState({
    employee_id: "",
    schedule_date: "",
    start_time: "18:00",
    end_time: "06:00",
    is_primary: true,
    contact_number: "",
  });
  const onCallMut = useMutation({
    mutationFn: () =>
      hrService.createOnCall({
        employee_id: onCallForm.employee_id,
        schedule_date: onCallForm.schedule_date,
        start_time: onCallForm.start_time,
        end_time: onCallForm.end_time,
        is_primary: onCallForm.is_primary,
        contact_number: onCallForm.contact_number || undefined,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["hr-on-call"] });
      closeOnCall();
      setOnCallForm({
        employee_id: "",
        schedule_date: "",
        start_time: "18:00",
        end_time: "06:00",
        is_primary: true,
        contact_number: "",
      });
      toast.success("On-call schedule added", { title: "On-Call Scheduled" });
    },
    onError: () => toast.error("Failed to create on-call entry", { title: "Error" }),
  });

  const swapMut = useMutation({
    mutationFn: (id: string) => hrService.approveSwap(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["hr-rosters"] });
      toast.success("Shift swap approved", { title: "Swap Approved" });
    },
  });

  return (
    <>
      <Tabs value={subTab} onChange={setSubTab}>
        <Tabs.List mb="md">
          <Tabs.Tab value="roster">Duty Roster</Tabs.Tab>
          <Tabs.Tab value="shifts">Shift Definitions</Tabs.Tab>
          <Tabs.Tab value="on-call">On-Call Schedules</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="roster">
          <Group justify="space-between" mb="md">
            <Group>
              <TextInput
                placeholder="From (YYYY-MM-DD)"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.currentTarget.value)}
                style={{ width: 160 }}
              />
              <TextInput
                placeholder="To (YYYY-MM-DD)"
                value={dateTo}
                onChange={(e) => setDateTo(e.currentTarget.value)}
                style={{ width: 160 }}
              />
            </Group>
            {canManage && (
              <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={openRoster}>
                Add Roster Entry
              </Button>
            )}
          </Group>
          <DataTable
            data={rosters}
            loading={rostersLoading}
            rowKey={(r: DutyRoster) => r.id}
            columns={[
              {
                key: "date",
                label: "Date",
                render: (r: DutyRoster) => <Text size="sm">{r.roster_date}</Text>,
              },
              {
                key: "employee",
                label: "Employee",
                render: (r: DutyRoster) => (
                  <Text size="sm" ff="monospace">
                    {r.employee_id.slice(0, 8)}
                  </Text>
                ),
              },
              {
                key: "shift",
                label: "Shift",
                render: (r: DutyRoster) => (
                  <Text size="sm" ff="monospace">
                    {r.shift_id.slice(0, 8)}
                  </Text>
                ),
              },
              {
                key: "on_call",
                label: "On-Call",
                render: (r: DutyRoster) =>
                  r.is_on_call ? (
                    <Badge tone="warning" size="sm">
                      Yes
                    </Badge>
                  ) : (
                    <Text size="sm" c="dimmed">
                      No
                    </Text>
                  ),
              },
              {
                key: "swap",
                label: "Swap",
                render: (r: DutyRoster) =>
                  r.swap_with ? (
                    r.swap_approved ? (
                      <Badge tone="success" size="sm">
                        Approved
                      </Badge>
                    ) : (
                      <Badge tone="warning" size="sm">
                        Pending
                      </Badge>
                    )
                  ) : (
                    <Text size="sm" c="dimmed">
                      —
                    </Text>
                  ),
              },
              {
                key: "actions",
                label: "",
                render: (r: DutyRoster) =>
                  canManage && r.swap_with && !r.swap_approved ? (
                    <Tooltip label="Approve Swap">
                      <IconButton
                        tone="success"
                        onClick={() => swapMut.mutate(r.id)}
                        aria-label="Confirm"
                      >
                        <IconCheck size={16} />
                      </IconButton>
                    </Tooltip>
                  ) : null,
              },
            ]}
          />
        </Tabs.Panel>

        <Tabs.Panel value="shifts">
          <Group justify="flex-end" mb="md">
            {canManage && (
              <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={openShift}>
                Add Shift
              </Button>
            )}
          </Group>
          <DataTable
            data={shifts}
            rowKey={(r: ShiftDefinition) => r.id}
            columns={[
              {
                key: "code",
                label: "Code",
                render: (r: ShiftDefinition) => (
                  <Text size="sm" fw={500}>
                    {r.code}
                  </Text>
                ),
              },
              {
                key: "name",
                label: "Name",
                render: (r: ShiftDefinition) => <Text size="sm">{r.name}</Text>,
              },
              {
                key: "type",
                label: "Type",
                render: (r: ShiftDefinition) => (
                  <Badge size="sm">{r.shift_type.replace(/_/g, " ")}</Badge>
                ),
              },
              {
                key: "time",
                label: "Time",
                render: (r: ShiftDefinition) => (
                  <Text size="sm">
                    {r.start_time} - {r.end_time}
                  </Text>
                ),
              },
              {
                key: "break",
                label: "Break",
                render: (r: ShiftDefinition) => <Text size="sm">{r.break_minutes}m</Text>,
              },
              {
                key: "night",
                label: "Night",
                render: (r: ShiftDefinition) =>
                  r.is_night ? (
                    <Badge tone="primary" size="sm">
                      Night
                    </Badge>
                  ) : (
                    <Text size="sm" c="dimmed">
                      Day
                    </Text>
                  ),
              },
              {
                key: "active",
                label: "Active",
                render: (r: ShiftDefinition) =>
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
            ]}
          />
        </Tabs.Panel>

        <Tabs.Panel value="on-call">
          <Group justify="flex-end" mb="md">
            {canManageOnCall && (
              <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={openOnCall}>
                Add On-Call
              </Button>
            )}
          </Group>
          <DataTable
            data={onCallList}
            loading={onCallLoading}
            rowKey={(r: OnCallSchedule) => r.id}
            columns={[
              {
                key: "date",
                label: "Date",
                render: (r: OnCallSchedule) => <Text size="sm">{r.schedule_date}</Text>,
              },
              {
                key: "employee",
                label: "Employee",
                render: (r: OnCallSchedule) => (
                  <Text size="sm" ff="monospace">
                    {r.employee_id.slice(0, 8)}
                  </Text>
                ),
              },
              {
                key: "time",
                label: "Time",
                render: (r: OnCallSchedule) => (
                  <Text size="sm">
                    {r.start_time} - {r.end_time}
                  </Text>
                ),
              },
              {
                key: "primary",
                label: "Primary",
                render: (r: OnCallSchedule) =>
                  r.is_primary ? (
                    <Badge tone="success" size="sm">
                      Primary
                    </Badge>
                  ) : (
                    <Badge size="sm">Backup</Badge>
                  ),
              },
              {
                key: "contact",
                label: "Contact",
                render: (r: OnCallSchedule) => <Text size="sm">{r.contact_number || "—"}</Text>,
              },
            ]}
          />
        </Tabs.Panel>
      </Tabs>

      {/* Create Roster Drawer */}
      <Drawer
        opened={rosterOpen}
        onClose={closeRoster}
        title="Add Roster Entry"
        position="right"
        size="xl"
      >
        <Stack gap="sm">
          <EmployeeSearchSelect
            value={rosterForm.employee_id}
            onChange={(id) => setRosterForm({ ...rosterForm, employee_id: id })}
            required
          />
          <Select
            label="Shift"
            required
            value={rosterForm.shift_id}
            onChange={(v) => setRosterForm({ ...rosterForm, shift_id: v || "" })}
            data={shifts.map((s: ShiftDefinition) => ({
              value: s.id,
              label: `${s.name} (${s.start_time}-${s.end_time})`,
            }))}
          />
          <TextInput
            label="Date"
            required
            placeholder="YYYY-MM-DD"
            value={rosterForm.roster_date}
            onChange={(e) => setRosterForm({ ...rosterForm, roster_date: e.currentTarget.value })}
          />
          <Switch
            label="On-Call"
            checked={rosterForm.is_on_call}
            onChange={(e) => setRosterForm({ ...rosterForm, is_on_call: e.currentTarget.checked })}
          />
          <Button
            tone="primary"
            onClick={() => rosterMut.mutate()}
            loading={rosterMut.isPending}
            disabled={!rosterForm.employee_id || !rosterForm.shift_id || !rosterForm.roster_date}
          >
            Add to Roster
          </Button>
        </Stack>
      </Drawer>

      {/* Create Shift Drawer */}
      <Drawer
        opened={shiftOpen}
        onClose={closeShift}
        title="Add Shift Definition"
        position="right"
        size="sm"
      >
        <Stack gap="sm">
          <TextInput
            label="Code"
            required
            value={shiftForm.code}
            onChange={(e) => setShiftForm({ ...shiftForm, code: e.currentTarget.value })}
          />
          <TextInput
            label="Name"
            required
            value={shiftForm.name}
            onChange={(e) => setShiftForm({ ...shiftForm, name: e.currentTarget.value })}
          />
          <Select
            label="Type"
            value={shiftForm.shift_type}
            onChange={(v) => setShiftForm({ ...shiftForm, shift_type: v || "general" })}
            data={[
              { value: "morning", label: "Morning" },
              { value: "afternoon", label: "Afternoon" },
              { value: "evening", label: "Evening" },
              { value: "night", label: "Night" },
              { value: "general", label: "General" },
              { value: "split", label: "Split" },
              { value: "on_call", label: "On Call" },
              { value: "custom", label: "Custom" },
            ]}
          />
          <TextInput
            label="Start Time"
            required
            placeholder="HH:MM"
            value={shiftForm.start_time}
            onChange={(e) => setShiftForm({ ...shiftForm, start_time: e.currentTarget.value })}
          />
          <TextInput
            label="End Time"
            required
            placeholder="HH:MM"
            value={shiftForm.end_time}
            onChange={(e) => setShiftForm({ ...shiftForm, end_time: e.currentTarget.value })}
          />
          <NumberInput
            label="Break (minutes)"
            value={shiftForm.break_minutes}
            onChange={(v) =>
              setShiftForm({ ...shiftForm, break_minutes: typeof v === "number" ? v : 30 })
            }
          />
          <Switch
            label="Night Shift"
            checked={shiftForm.is_night}
            onChange={(e) => setShiftForm({ ...shiftForm, is_night: e.currentTarget.checked })}
          />
          <Button
            tone="primary"
            onClick={() => shiftMut.mutate()}
            loading={shiftMut.isPending}
            disabled={!shiftForm.code || !shiftForm.name}
          >
            Create Shift
          </Button>
        </Stack>
      </Drawer>

      {/* Create On-Call Drawer */}
      <Drawer
        opened={onCallOpen}
        onClose={closeOnCall}
        title="Add On-Call Schedule"
        position="right"
        size="xl"
      >
        <Stack gap="sm">
          <EmployeeSearchSelect
            value={onCallForm.employee_id}
            onChange={(id) => setOnCallForm({ ...onCallForm, employee_id: id })}
            required
          />
          <TextInput
            label="Date"
            required
            placeholder="YYYY-MM-DD"
            value={onCallForm.schedule_date}
            onChange={(e) => setOnCallForm({ ...onCallForm, schedule_date: e.currentTarget.value })}
          />
          <TextInput
            label="Start Time"
            required
            placeholder="HH:MM"
            value={onCallForm.start_time}
            onChange={(e) => setOnCallForm({ ...onCallForm, start_time: e.currentTarget.value })}
          />
          <TextInput
            label="End Time"
            required
            placeholder="HH:MM"
            value={onCallForm.end_time}
            onChange={(e) => setOnCallForm({ ...onCallForm, end_time: e.currentTarget.value })}
          />
          <Switch
            label="Primary On-Call"
            checked={onCallForm.is_primary}
            onChange={(e) => setOnCallForm({ ...onCallForm, is_primary: e.currentTarget.checked })}
          />
          <TextInput
            label="Contact Number"
            value={onCallForm.contact_number}
            onChange={(e) =>
              setOnCallForm({ ...onCallForm, contact_number: e.currentTarget.value })
            }
          />
          <Button
            tone="primary"
            onClick={() => onCallMut.mutate()}
            loading={onCallMut.isPending}
            disabled={!onCallForm.employee_id || !onCallForm.schedule_date}
          >
            Schedule On-Call
          </Button>
        </Stack>
      </Drawer>
    </>
  );
}

// ══════════════════════════════════════════════════════════
//  Training Tab
// ══════════════════════════════════════════════════════════
