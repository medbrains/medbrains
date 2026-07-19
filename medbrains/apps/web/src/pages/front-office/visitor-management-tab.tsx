// IPD VisitorManagementTab — split from front-office.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Drawer,
  Group,
  NumberInput,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import type { VisitorLog, VisitorPass, VisitorRegistration } from "@medbrains/types";
import { IconCheck, IconClock, IconPlus, IconQrcode, IconX } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { DataTable, TableValueBadge } from "@/components";
import { Button, IconButton } from "@/components/ui";
import type {
  FrontOfficeVisitorFormInput,
  FrontOfficeVisitorPassFormInput,
} from "@/forms/front-office.form";
import {
  DEFAULT_VISITOR_FORM_VALUES,
  DEFAULT_VISITOR_PASS_FORM_VALUES,
  frontOfficeVisitorFormSchema,
  frontOfficeVisitorPassFormSchema,
  toCreateVisitorPassRequest,
  toCreateVisitorRequest,
  VISITOR_CATEGORY_OPTIONS,
  VISITOR_ID_TYPE_OPTIONS,
} from "@/forms/front-office.form";
import { frontOfficeService } from "@/services/frontOffice.service";

const passStatusColors: Record<string, string> = {
  active: "success",
  expired: "slate",
  revoked: "danger",
};

export function VisitorManagementTab({
  canCreate,
  canManagePasses,
}: {
  canCreate: boolean;
  canManagePasses: boolean;
}) {
  const qc = useQueryClient();
  const [visitorDrawer, visitorDrawerHandlers] = useDisclosure(false);
  const [passDrawer, passDrawerHandlers] = useDisclosure(false);
  const [selectedRegistration, setSelectedRegistration] = useState<string | null>(null);

  const visitorForm = useForm<FrontOfficeVisitorFormInput>({
    resolver: zodResolver(frontOfficeVisitorFormSchema),
    defaultValues: DEFAULT_VISITOR_FORM_VALUES,
  });

  const passForm = useForm<FrontOfficeVisitorPassFormInput>({
    resolver: zodResolver(frontOfficeVisitorPassFormSchema),
    defaultValues: DEFAULT_VISITOR_PASS_FORM_VALUES,
  });

  const { data: visitors, isLoading: loadingVisitors } = useQuery<VisitorRegistration[]>({
    queryKey: ["front-office", "visitors"],
    queryFn: () => frontOfficeService.listVisitors(),
  });

  const { data: passes, isLoading: loadingPasses } = useQuery<VisitorPass[]>({
    queryKey: ["front-office", "passes"],
    queryFn: () => frontOfficeService.listVisitorPasses(),
  });

  const { data: logs } = useQuery<VisitorLog[]>({
    queryKey: ["front-office", "visitor-logs"],
    queryFn: () => frontOfficeService.listVisitorLogs({ active_only: "true" }),
  });

  const createVisitor = useMutation({
    mutationFn: (data: FrontOfficeVisitorFormInput) =>
      frontOfficeService.createVisitor(toCreateVisitorRequest(data)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["front-office", "visitors"] });
      visitorDrawerHandlers.close();
      notifications.show({ message: "Visitor registered", color: "success" });
      visitorForm.reset(DEFAULT_VISITOR_FORM_VALUES);
    },
  });

  const createPass = useMutation({
    mutationFn: (data: FrontOfficeVisitorPassFormInput) =>
      selectedRegistration
        ? frontOfficeService.createVisitorPass(
            toCreateVisitorPassRequest(selectedRegistration, data),
          )
        : Promise.reject(new Error("Select a visitor registration before issuing a pass")),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["front-office", "passes"] });
      passDrawerHandlers.close();
      passForm.reset(DEFAULT_VISITOR_PASS_FORM_VALUES);
      notifications.show({ message: "Pass issued", color: "success" });
    },
  });

  const revokePass = useMutation({
    mutationFn: (id: string) =>
      frontOfficeService.revokeVisitorPass(id, { reason: "Revoked by staff" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["front-office", "passes"] });
      notifications.show({ message: "Pass revoked", color: "orange" });
    },
  });

  const checkIn = useMutation({
    mutationFn: (passId: string) => frontOfficeService.checkInVisitor(passId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["front-office", "visitor-logs"] });
      notifications.show({ message: "Visitor checked in", color: "success" });
    },
  });

  const checkOut = useMutation({
    mutationFn: (passId: string) => frontOfficeService.checkOutVisitor(passId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["front-office", "visitor-logs"] });
      notifications.show({ message: "Visitor checked out", color: "primary" });
    },
  });

  const visitorColumns = [
    { key: "visitor_name", label: "Name", render: (r: VisitorRegistration) => r.visitor_name },
    { key: "phone", label: "Phone", render: (r: VisitorRegistration) => r.phone ?? "—" },
    {
      key: "category",
      label: "Category",
      render: (r: VisitorRegistration) => <TableValueBadge value={r.category} kind="category" />,
    },
    { key: "id_type", label: "ID Type", render: (r: VisitorRegistration) => r.id_type ?? "—" },
    { key: "purpose", label: "Purpose", render: (r: VisitorRegistration) => r.purpose ?? "—" },
    {
      key: "created_at",
      label: "Registered",
      render: (r: VisitorRegistration) => new Date(r.created_at).toLocaleString(),
    },
    {
      key: "actions",
      label: "",
      render: (r: VisitorRegistration) =>
        canManagePasses ? (
          <Tooltip label="Issue Pass">
            <IconButton
              tone="primary"
              onClick={() => {
                setSelectedRegistration(r.id);
                passDrawerHandlers.open();
              }}
              aria-label="Issue Pass"
            >
              <IconQrcode size={16} />
            </IconButton>
          </Tooltip>
        ) : null,
    },
  ];

  const passColumns = [
    { key: "pass_number", label: "Pass #", render: (r: VisitorPass) => r.pass_number },
    {
      key: "status",
      label: "Status",
      render: (r: VisitorPass) => (
        <TableValueBadge
          value={r.status}
          kind="status"
          color={passStatusColors[r.status] ?? "slate"}
          variant="filled"
        />
      ),
    },
    {
      key: "valid_from",
      label: "Valid From",
      render: (r: VisitorPass) => new Date(r.valid_from).toLocaleString(),
    },
    {
      key: "valid_until",
      label: "Valid Until",
      render: (r: VisitorPass) => new Date(r.valid_until).toLocaleString(),
    },
    { key: "bed_number", label: "Bed", render: (r: VisitorPass) => r.bed_number ?? "—" },
    {
      key: "actions",
      label: "",
      render: (r: VisitorPass) => (
        <Group gap="xs">
          {r.status === "active" && canManagePasses && (
            <>
              <Tooltip label="Check In">
                <IconButton
                  tone="success"
                  onClick={() => checkIn.mutate(r.id)}
                  aria-label="Check In"
                >
                  <IconCheck size={16} />
                </IconButton>
              </Tooltip>
              <Tooltip label="Check Out">
                <IconButton
                  tone="primary"
                  onClick={() => checkOut.mutate(r.id)}
                  aria-label="Check Out"
                >
                  <IconClock size={16} />
                </IconButton>
              </Tooltip>
              <Tooltip label="Revoke">
                <IconButton
                  tone="danger"
                  onClick={() => revokePass.mutate(r.id)}
                  aria-label="Revoke"
                >
                  <IconX size={16} />
                </IconButton>
              </Tooltip>
            </>
          )}
        </Group>
      ),
    },
  ];

  return (
    <Stack gap="lg">
      {/* Visitors */}
      <div>
        <Group justify="space-between" mb="sm">
          <Text fw={600}>Visitor Registrations</Text>
          {canCreate && (
            <Button
              tone="primary"
              size="xs"
              leftSection={<IconPlus size={14} />}
              onClick={visitorDrawerHandlers.open}
            >
              Register Visitor
            </Button>
          )}
        </Group>
        <DataTable
          columns={visitorColumns}
          data={visitors ?? []}
          loading={loadingVisitors}
          rowKey={(r: VisitorRegistration) => r.id}
        />
      </div>

      {/* Active Passes */}
      <div>
        <Group justify="space-between" mb="sm">
          <Text fw={600}>
            Visitor Passes ({passes?.filter((p) => p.status === "active").length ?? 0} active)
          </Text>
        </Group>
        <DataTable
          columns={passColumns}
          data={passes ?? []}
          loading={loadingPasses}
          rowKey={(r: VisitorPass) => r.id}
        />
      </div>

      {/* Active visitor count */}
      {logs && logs.length > 0 && (
        <Text size="sm" c="dimmed">
          Currently inside: {logs.length} visitor(s)
        </Text>
      )}

      {/* Register Visitor Drawer */}
      <Drawer
        opened={visitorDrawer}
        onClose={visitorDrawerHandlers.close}
        title="Register Visitor"
        position="right"
        size="xl"
      >
        <Stack
          component="form"
          gap="sm"
          onSubmit={visitorForm.handleSubmit((values) => createVisitor.mutate(values))}
        >
          <TextInput
            label="Visitor Name"
            required
            error={visitorForm.formState.errors.visitor_name?.message}
            {...visitorForm.register("visitor_name")}
          />
          <TextInput
            label="Phone"
            error={visitorForm.formState.errors.phone?.message}
            {...visitorForm.register("phone")}
          />
          <Controller
            control={visitorForm.control}
            name="id_type"
            render={({ field, fieldState }) => (
              <Select
                label="ID Type"
                data={VISITOR_ID_TYPE_OPTIONS}
                value={field.value}
                onChange={field.onChange}
                error={fieldState.error?.message}
                clearable
              />
            )}
          />
          <TextInput
            label="ID Number"
            error={visitorForm.formState.errors.id_number?.message}
            {...visitorForm.register("id_number")}
          />
          <TextInput
            label="Relationship"
            error={visitorForm.formState.errors.relationship?.message}
            {...visitorForm.register("relationship")}
          />
          <Controller
            control={visitorForm.control}
            name="category"
            render={({ field, fieldState }) => (
              <Select
                label="Category"
                data={VISITOR_CATEGORY_OPTIONS}
                value={field.value}
                onChange={field.onChange}
                error={fieldState.error?.message}
              />
            )}
          />
          <Textarea
            label="Purpose"
            error={visitorForm.formState.errors.purpose?.message}
            {...visitorForm.register("purpose")}
          />
          <Button tone="primary" type="submit" loading={createVisitor.isPending}>
            Register
          </Button>
        </Stack>
      </Drawer>

      {/* Issue Pass Drawer */}
      <Drawer
        opened={passDrawer}
        onClose={passDrawerHandlers.close}
        title="Issue Visitor Pass"
        position="right"
        size="sm"
      >
        <Stack
          component="form"
          gap="sm"
          onSubmit={passForm.handleSubmit((values) => createPass.mutate(values))}
        >
          <Text size="sm" c="dimmed">
            Issuing pass for registration: {selectedRegistration?.slice(0, 8)}...
          </Text>
          <Controller
            control={passForm.control}
            name="valid_hours"
            render={({ field, fieldState }) => (
              <NumberInput
                label="Valid Hours"
                value={field.value}
                onChange={field.onChange}
                error={fieldState.error?.message}
                min={1}
                max={24}
              />
            )}
          />
          <Button
            tone="primary"
            type="submit"
            loading={createPass.isPending}
            disabled={!selectedRegistration}
          >
            Issue Pass
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Tab 3 — Queue Configuration
// ══════════════════════════════════════════════════════════
