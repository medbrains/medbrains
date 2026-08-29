// Lab B2bClientsSection — split from lab.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import { Group, NumberInput, Select, Stack, Text, Textarea, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type { LabB2bClientFormInput } from "@medbrains/schemas";
import { labB2bClientFormSchema } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type {
  CreateB2bClientRequest,
  LabB2bClient,
  UpdateB2bClientRequest,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconCheck, IconPencil, IconPlus, IconX } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { DataTable } from "@/components";
import { Button, IconButton } from "@/components/ui";
import {
  labB2bClientTypeOptions,
  labOptionalInteger,
  labOptionalNumber,
  labOptionalText,
} from "@/forms/lab.form";
import { labService } from "@/services/lab.service";

export function B2bClientsSection() {
  const { t } = useTranslation("lab");
  const canManage = useHasPermission(P.LAB.B2B_MANAGE);
  const queryClient = useQueryClient();
  const [formOpen, formHandlers] = useDisclosure(false);
  const b2bClientDefaults: LabB2bClientFormInput = {
    code: "",
    name: "",
    client_type: "",
    address: "",
    city: "",
    phone: "",
    email: "",
    contact_person: "",
    credit_limit: "",
    payment_terms_days: 30,
  };
  const {
    control,
    register,
    reset,
    handleSubmit,
    formState: { errors },
  } = useForm<LabB2bClientFormInput>({
    resolver: zodResolver(labB2bClientFormSchema),
    defaultValues: b2bClientDefaults,
  });

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["lab-b2b-clients"],
    queryFn: () => labService.listB2bClients(),
  });

  // A referring client's credit limit and payment terms are billing terms; entering them wrongly and being unable to correct them is an invoice dispute.
  // `updateB2bClient` existed in the client with no caller and there is
  // no delete route, so a wrong value stayed wrong.
  const [editing, setEditing] = useState<LabB2bClient | null>(null);

  const closeForm = () => {
    formHandlers.close();
    setEditing(null);
    reset(b2bClientDefaults);
  };

  const openEdit = (row: LabB2bClient) => {
    setEditing(row);
    reset({
      code: row.code,
      name: row.name,
      client_type: (row.client_type ?? "") as LabB2bClientFormInput["client_type"],
      address: row.address ?? "",
      city: row.city ?? "",
      phone: row.phone ?? "",
      email: row.email ?? "",
      contact_person: row.contact_person ?? "",
      credit_limit: row.credit_limit ?? "",
      payment_terms_days: row.payment_terms_days ?? 30,
    });
    formHandlers.open();
  };

  const createMutation = useMutation({
    mutationFn: (data: CreateB2bClientRequest) => {
      if (!editing) return labService.createB2bClient(data);
      // Only what the update endpoint accepts: code identifies
      // the record and is not among its fields.
      const patch: UpdateB2bClientRequest = {
        name: data.name,
        client_type: data.client_type,
        address: data.address,
        city: data.city,
        phone: data.phone,
        email: data.email,
        contact_person: data.contact_person,
        credit_limit: data.credit_limit,
        payment_terms_days: data.payment_terms_days,
      };
      return labService.updateB2bClient(editing.id, patch);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["lab-b2b-clients"] });
      closeForm();
    },
  });

  const handleCreateB2bClient = (values: LabB2bClientFormInput) => {
    createMutation.mutate({
      code: values.code.trim(),
      name: values.name.trim(),
      client_type: labOptionalText(values.client_type),
      address: labOptionalText(values.address),
      city: labOptionalText(values.city),
      phone: labOptionalText(values.phone),
      email: labOptionalText(values.email),
      contact_person: labOptionalText(values.contact_person),
      credit_limit: labOptionalNumber(values.credit_limit),
      payment_terms_days: labOptionalInteger(values.payment_terms_days),
    });
  };

  const columns = [
    { key: "code", label: "Code", render: (row: LabB2bClient) => <Text fw={500}>{row.code}</Text> },
    {
      key: "name",
      label: "Name",
      render: (row: LabB2bClient) => <Text size="sm">{row.name}</Text>,
    },
    {
      key: "client_type",
      label: "Type",
      render: (row: LabB2bClient) => <Text size="sm">{row.client_type ?? "—"}</Text>,
    },
    {
      key: "city",
      label: "City",
      render: (row: LabB2bClient) => <Text size="sm">{row.city ?? "—"}</Text>,
    },
    {
      key: "contact_person",
      label: "Contact",
      render: (row: LabB2bClient) => <Text size="sm">{row.contact_person ?? "—"}</Text>,
    },
    {
      key: "credit_limit",
      label: "Credit Limit",
      render: (row: LabB2bClient) => (
        <Text size="sm">{row.credit_limit != null ? `₹${row.credit_limit}` : "—"}</Text>
      ),
    },
    {
      key: "payment_terms_days",
      label: "Terms",
      render: (row: LabB2bClient) => <Text size="sm">{row.payment_terms_days} days</Text>,
    },
    {
      key: "is_active",
      label: "Active",
      render: (row: LabB2bClient) =>
        row.is_active ? (
          <IconCheck size={14} color="success" />
        ) : (
          <IconX size={14} color="danger" />
        ),
    },
    ...(canManage
      ? [
          {
            key: "actions",
            label: "",
            render: (row: LabB2bClient) => (
              <IconButton
                tone="default"
                aria-label={`Edit ${row.name}`}
                onClick={() => openEdit(row)}
              >
                <IconPencil size={14} />
              </IconButton>
            ),
          },
        ]
      : []),
  ];

  return (
    <Stack>
      {canManage && (
        <Group>
          <Button
            tone="primary"
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={() => {
              formHandlers.toggle();
              if (formOpen) reset(b2bClientDefaults);
            }}
          >
            {t("addClient")}
          </Button>
        </Group>
      )}
      {formOpen && (
        <Stack component="form" gap="xs" onSubmit={handleSubmit(handleCreateB2bClient)}>
          <Group grow>
            <TextInput
              label={t("label.code")}
              required
              // The code identifies the record and the update endpoint does
              // not accept it. Shown and locked rather than looking editable
              // and silently discarding the change.
              disabled={editing !== null}
              description={editing ? "Fixed once created" : undefined}
              error={errors.code?.message}
              {...register("code")}
            />
            <TextInput
              label={t("label.name")}
              required
              error={errors.name?.message}
              {...register("name")}
            />
            <Controller
              control={control}
              name="client_type"
              render={({ field }) => (
                <Select
                  label={t("label.type")}
                  data={labB2bClientTypeOptions}
                  placeholder={t("placeholder.selectType")}
                  value={field.value || null}
                  onChange={(value) => field.onChange(value ?? "")}
                  error={errors.client_type?.message}
                  clearable
                  searchable
                />
              )}
            />
          </Group>
          <Textarea
            label={t("label.address")}
            error={errors.address?.message}
            {...register("address")}
          />
          <Group grow>
            <TextInput label={t("label.city")} error={errors.city?.message} {...register("city")} />
            <TextInput
              label={t("label.phone")}
              error={errors.phone?.message}
              {...register("phone")}
            />
            <TextInput
              label={t("label.email")}
              error={errors.email?.message}
              {...register("email")}
            />
            <TextInput
              label={t("label.contactPerson")}
              error={errors.contact_person?.message}
              {...register("contact_person")}
            />
          </Group>
          <Group grow>
            <Controller
              control={control}
              name="credit_limit"
              render={({ field }) => (
                <NumberInput
                  label={t("label.creditLimit")}
                  min={0}
                  decimalScale={2}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.credit_limit?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="payment_terms_days"
              render={({ field }) => (
                <NumberInput
                  label={t("label.paymentTerms(days)")}
                  min={0}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.payment_terms_days?.message}
                />
              )}
            />
          </Group>
          <Button tone="primary" size="xs" type="submit" loading={createMutation.isPending}>
            Save
          </Button>
        </Stack>
      )}
      <DataTable columns={columns} data={clients} loading={isLoading} rowKey={(row) => row.id} />
    </Stack>
  );
}
