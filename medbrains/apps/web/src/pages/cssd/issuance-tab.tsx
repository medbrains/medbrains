// CSSD IssuanceTab — split from cssd.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import { Drawer, Group, Stack, Text, Textarea, TextInput, Tooltip } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import type { CssdIssuanceFormInput } from "@medbrains/schemas";
import { cssdIssuanceFormSchema } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type { CreateCssdIssuanceRequest, CssdIssuance } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconAlertTriangle, IconArrowBack, IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { DataTable } from "@/components";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { Badge, Button, IconButton } from "@/components/ui";
import { cssdOptionalText } from "@/forms/cssd.form";
import { cssdService } from "@/services/cssd.service";

export function IssuanceTab() {
  const canCreate = useHasPermission(P.CSSD.ISSUANCE_CREATE);
  // Issuing a set is not reading the issuance log — an empty log reads as
  // "nothing was issued to theatre".
  const canListIssuance = useHasPermission(P.CSSD.ISSUANCE_LIST);
  const qc = useQueryClient();
  const [opened, { open, close }] = useDisclosure(false);

  const { data: issuances = [], isLoading } = useQuery({
    queryKey: ["cssd-issuances"],
    queryFn: () => cssdService.listCssdIssuances(),
    enabled: canListIssuance,
  });

  const issuanceForm = useForm<CssdIssuanceFormInput>({
    resolver: zodResolver(cssdIssuanceFormSchema),
    defaultValues: {
      issued_to_department: "",
      issued_to_patient_id: "",
      notes: "",
    },
  });
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = issuanceForm;
  const createMut = useMutation({
    mutationFn: (data: CreateCssdIssuanceRequest) => cssdService.createCssdIssuance(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["cssd-issuances"] });
      notifications.show({ title: "Pack issued", message: "", color: "success" });
      close();
      reset();
    },
  });

  const submitIssuance = (values: CssdIssuanceFormInput) => {
    createMut.mutate({
      issued_to_department: values.issued_to_department.trim(),
      issued_to_patient_id: cssdOptionalText(values.issued_to_patient_id),
      notes: cssdOptionalText(values.notes),
    });
  };

  const returnMut = useMutation({
    mutationFn: (id: string) => cssdService.returnCssdIssuance(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["cssd-issuances"] });
      notifications.show({ title: "Pack returned", message: "", color: "primary" });
    },
  });

  const recallMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      cssdService.recallCssdIssuance(id, reason),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["cssd-issuances"] });
      notifications.show({ title: "Pack recalled", message: "", color: "orange" });
    },
  });

  const columns = [
    {
      key: "issued_to_department" as const,
      label: "Department",
      render: (i: CssdIssuance) => i.issued_to_department,
    },
    {
      key: "issued_at" as const,
      label: "Issued At",
      render: (i: CssdIssuance) => new Date(i.issued_at).toLocaleString(),
    },
    {
      key: "returned_at" as const,
      label: "Returned",
      render: (i: CssdIssuance) => (i.returned_at ? new Date(i.returned_at).toLocaleString() : "—"),
    },
    {
      key: "is_recalled" as const,
      label: "Status",
      render: (i: CssdIssuance) => {
        if (i.is_recalled) return <Badge tone="danger">Recalled</Badge>;
        if (i.returned_at) return <Badge tone="neutral">Returned</Badge>;
        return <Badge tone="success">Issued</Badge>;
      },
    },
    {
      key: "id" as const,
      label: "Actions",
      render: (i: CssdIssuance) => (
        <Group gap="xs">
          {canCreate && !i.returned_at && !i.is_recalled && (
            <>
              <Tooltip label="Return">
                <IconButton
                  tone="primary"
                  onClick={() => returnMut.mutate(i.id)}
                  aria-label="Arrow Back"
                >
                  <IconArrowBack size={16} />
                </IconButton>
              </Tooltip>
              <Tooltip label="Recall">
                <IconButton
                  tone="danger"
                  onClick={() => recallMut.mutate({ id: i.id, reason: "Quality concern" })}
                  aria-label="Warning"
                >
                  <IconAlertTriangle size={16} />
                </IconButton>
              </Tooltip>
            </>
          )}
        </Group>
      ),
    },
  ];

  return (
    <Stack>
      <Group justify="flex-end">
        {canCreate && (
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={open}>
            Issue Pack
          </Button>
        )}
      </Group>

      <DataTable
        columns={columns}
        data={issuances}
        loading={isLoading}
        rowKey={(i) => i.id}
        emptyTitle="No issuances"
      />

      <Drawer opened={opened} onClose={close} title="Issue Sterile Pack" position="right" size="sm">
        <Stack component="form" onSubmit={handleSubmit(submitIssuance)}>
          <Controller
            name="issued_to_department"
            control={control}
            render={({ field }) => (
              <TextInput
                label="Department"
                required
                {...field}
                error={errors.issued_to_department?.message}
              />
            )}
          />
          <Controller
            name="issued_to_patient_id"
            control={control}
            render={({ field }) => (
              <PatientSearchSelect
                value={field.value}
                onChange={field.onChange}
                label="Patient (optional)"
              />
            )}
          />
          {errors.issued_to_patient_id?.message && (
            <Text size="xs" c="danger">
              {errors.issued_to_patient_id.message}
            </Text>
          )}
          <Controller
            name="notes"
            control={control}
            render={({ field }) => (
              <Textarea label="Notes" {...field} error={errors.notes?.message} />
            )}
          />
          <Button tone="primary" loading={createMut.isPending} type="submit">
            Issue
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ── Equipment Tab ───────────────────────────────────────
