// Billing CorporateTab — split from billing.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Drawer,
  Group,
  NumberInput,
  Stack,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type { BillingCorporateFormInput } from "@medbrains/schemas";
import { billingCorporateFormSchema } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type { CorporateClient, CreateCorporateRequest } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconCheck, IconEye, IconPlus, IconX } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { DataTable } from "@/components";
import { Button, IconButton, toast } from "@/components/ui";
import {
  billingOptionalInteger,
  billingOptionalNumber,
  billingOptionalText,
} from "@/forms/billing.form";
import { billingService } from "@/services/billing.service";
import { CorporateDetail } from "./corporate-detail";

export function CorporateTab() {
  const canCreate = useHasPermission(P.BILLING.CORPORATE_CREATE);
  const canUpdate = useHasPermission(P.BILLING.CORPORATE_UPDATE);
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpened, { open: openDetail, close: closeDetail }] = useDisclosure(false);
  const corporateDefaults: BillingCorporateFormInput = {
    code: "",
    name: "",
    gst_number: "",
    billing_address: "",
    contact_email: "",
    contact_phone: "",
    credit_limit: "",
    credit_days: 30,
    agreed_discount_percent: "",
  };
  const {
    control,
    register,
    reset,
    handleSubmit,
    formState: { errors },
  } = useForm<BillingCorporateFormInput>({
    resolver: zodResolver(billingCorporateFormSchema),
    defaultValues: corporateDefaults,
  });

  const { data: corporates = [], isLoading } = useQuery({
    queryKey: ["corporates"],
    queryFn: () => billingService.listCorporates(),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateCorporateRequest) => billingService.createCorporate(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["corporates"] });
      toast.success("Corporate client created", { title: "Created" });
      setShowForm(false);
      reset(corporateDefaults);
    },
    onError: () => toast.error("Failed to create corporate client", { title: "Error" }),
  });

  const handleCreateCorporate = (values: BillingCorporateFormInput) => {
    const payload: CreateCorporateRequest = {
      code: values.code.trim(),
      name: values.name.trim(),
      gst_number: billingOptionalText(values.gst_number),
      billing_address: billingOptionalText(values.billing_address),
      contact_email: billingOptionalText(values.contact_email),
      contact_phone: billingOptionalText(values.contact_phone),
      credit_limit: billingOptionalNumber(values.credit_limit),
      credit_days: billingOptionalInteger(values.credit_days),
      agreed_discount_percent: billingOptionalNumber(values.agreed_discount_percent),
    };
    createMutation.mutate(payload);
  };

  const columns = [
    {
      key: "code",
      label: "Code",
      sortable: true,
      searchable: true,
      accessor: (row: CorporateClient) => row.code,
      render: (row: CorporateClient) => <Text fw={600}>{row.code}</Text>,
    },
    {
      key: "name",
      label: "Name",
      sortable: true,
      searchable: true,
      accessor: (row: CorporateClient) => row.name,
      render: (row: CorporateClient) => <Text size="sm">{row.name}</Text>,
    },
    {
      key: "gst_number",
      label: "GSTIN",
      searchable: true,
      accessor: (row: CorporateClient) => row.gst_number ?? "—",
      render: (row: CorporateClient) => <Text size="sm">{row.gst_number ?? "—"}</Text>,
    },
    {
      key: "credit_limit",
      label: "Credit Limit",
      sortable: true,
      sortValue: (row: CorporateClient) => Number(row.credit_limit),
      accessor: (row: CorporateClient) => row.credit_limit,
      render: (row: CorporateClient) => <Text size="sm">₹{row.credit_limit}</Text>,
    },
    {
      key: "credit_days",
      label: "Credit Days",
      render: (row: CorporateClient) => <Text size="sm">{row.credit_days}</Text>,
    },
    {
      key: "discount",
      label: "Discount %",
      render: (row: CorporateClient) => <Text size="sm">{row.agreed_discount_percent}%</Text>,
    },
    {
      key: "is_active",
      label: "Active",
      render: (row: CorporateClient) =>
        row.is_active ? (
          <IconCheck size={14} color="success" />
        ) : (
          <IconX size={14} color="danger" />
        ),
    },
    {
      key: "actions",
      label: "",
      render: (row: CorporateClient) => (
        <Tooltip label="View Details">
          <IconButton
            tone="default"
            aria-label="View Details"
            onClick={() => {
              setSelectedId(row.id);
              openDetail();
            }}
          >
            <IconEye size={16} />
          </IconButton>
        </Tooltip>
      ),
    },
  ];

  return (
    <Stack>
      {canCreate && (
        <Group>
          <Button
            tone="primary"
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={() => {
              setShowForm(!showForm);
              if (showForm) reset(corporateDefaults);
            }}
          >
            Add Corporate Client
          </Button>
        </Group>
      )}
      {showForm && (
        <Stack component="form" gap="xs" onSubmit={handleSubmit(handleCreateCorporate)}>
          <Group grow>
            <TextInput
              label="Code"
              required
              placeholder="e.g. CORP-001"
              error={errors.code?.message}
              {...register("code")}
            />
            <TextInput label="Name" required error={errors.name?.message} {...register("name")} />
          </Group>
          <Group grow>
            <TextInput
              label="GST Number"
              error={errors.gst_number?.message}
              {...register("gst_number")}
            />
            <TextInput
              label="Contact Email"
              error={errors.contact_email?.message}
              {...register("contact_email")}
            />
            <TextInput
              label="Contact Phone"
              error={errors.contact_phone?.message}
              {...register("contact_phone")}
            />
          </Group>
          <Textarea
            label="Billing Address"
            error={errors.billing_address?.message}
            {...register("billing_address")}
          />
          <Group grow>
            <Controller
              control={control}
              name="credit_limit"
              render={({ field }) => (
                <NumberInput
                  label="Credit Limit (₹)"
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
              name="credit_days"
              render={({ field }) => (
                <NumberInput
                  label="Credit Days"
                  min={0}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.credit_days?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="agreed_discount_percent"
              render={({ field }) => (
                <NumberInput
                  label="Agreed Discount %"
                  min={0}
                  max={100}
                  decimalScale={2}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.agreed_discount_percent?.message}
                />
              )}
            />
          </Group>
          <Button tone="primary" size="xs" type="submit" loading={createMutation.isPending}>
            Save Client
          </Button>
        </Stack>
      )}

      <DataTable
        columns={columns}
        data={corporates}
        loading={isLoading}
        rowKey={(row) => row.id}
        searchable
        searchPlaceholder="Search code, name or GSTIN"
        exportable
        exportFileName="corporate-clients"
      />

      <Drawer
        opened={detailOpened}
        onClose={closeDetail}
        title="Corporate Client Detail"
        position="right"
        size="lg"
      >
        {selectedId && <CorporateDetail corporateId={selectedId} canUpdate={canUpdate} />}
      </Drawer>
    </Stack>
  );
}
