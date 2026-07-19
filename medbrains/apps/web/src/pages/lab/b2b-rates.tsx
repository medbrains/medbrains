// Lab B2bRatesSection — split from lab.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import { Group, NumberInput, Select, Stack, Text, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type { LabB2bRateFormInput } from "@medbrains/schemas";
import { labB2bRateFormSchema } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type { CreateB2bRateRequest, LabB2bClient, LabB2bRate } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { DataTable } from "@/components";
import { LabTestSearchSelect } from "@/components/LabTestSearchSelect";
import { Button } from "@/components/ui";
import { labOptionalNumber, labOptionalText } from "@/forms/lab.form";
import { labService } from "@/services/lab.service";

export function B2bRatesSection() {
  const { t } = useTranslation("lab");
  const canManage = useHasPermission(P.LAB.B2B_MANAGE);
  const queryClient = useQueryClient();
  const [selectedClientId, setSelectedClientId] = useState("");
  const [formOpen, formHandlers] = useDisclosure(false);
  const b2bRateDefaults: LabB2bRateFormInput = {
    test_id: "",
    agreed_price: "",
    discount_percent: "",
    effective_from: "",
    effective_to: "",
  };
  const {
    control,
    register,
    reset,
    handleSubmit,
    formState: { errors },
  } = useForm<LabB2bRateFormInput>({
    resolver: zodResolver(labB2bRateFormSchema),
    defaultValues: b2bRateDefaults,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["lab-b2b-clients"],
    queryFn: () => labService.listB2bClients(),
  });

  const { data: rates = [], isLoading } = useQuery({
    queryKey: ["lab-b2b-rates", selectedClientId],
    queryFn: () => labService.listB2bRates(selectedClientId),
    enabled: !!selectedClientId,
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateB2bRateRequest) => labService.createB2bRate(selectedClientId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["lab-b2b-rates", selectedClientId] });
      formHandlers.close();
      reset(b2bRateDefaults);
    },
  });

  const handleCreateB2bRate = (values: LabB2bRateFormInput) => {
    createMutation.mutate({
      test_id: values.test_id.trim(),
      agreed_price: labOptionalNumber(values.agreed_price),
      discount_percent: labOptionalNumber(values.discount_percent),
      effective_from: labOptionalText(values.effective_from),
      effective_to: labOptionalText(values.effective_to),
    });
  };

  const columns = [
    {
      key: "test_id",
      label: "Test",
      render: (row: LabB2bRate) => <Text size="sm">{row.test_id.slice(0, 8)}...</Text>,
    },
    {
      key: "agreed_price",
      label: "Agreed Price",
      render: (row: LabB2bRate) => (
        <Text size="sm">{row.agreed_price != null ? `₹${row.agreed_price}` : "—"}</Text>
      ),
    },
    {
      key: "discount_percent",
      label: "Discount",
      render: (row: LabB2bRate) => (
        <Text size="sm">{row.discount_percent != null ? `${row.discount_percent}%` : "—"}</Text>
      ),
    },
    {
      key: "effective_from",
      label: "From",
      render: (row: LabB2bRate) => <Text size="sm">{row.effective_from ?? "—"}</Text>,
    },
    {
      key: "effective_to",
      label: "To",
      render: (row: LabB2bRate) => <Text size="sm">{row.effective_to ?? "—"}</Text>,
    },
  ];

  return (
    <Stack>
      <Select
        label={t("label.selectClient")}
        placeholder={t("placeholder.chooseAB2bClient")}
        data={clients.map((c: LabB2bClient) => ({ value: c.id, label: `${c.code} — ${c.name}` }))}
        value={selectedClientId}
        onChange={(v) => setSelectedClientId(v ?? "")}
        w={400}
      />

      {selectedClientId && (
        <>
          {canManage && (
            <Group>
              <Button
                tone="primary"
                size="xs"
                leftSection={<IconPlus size={14} />}
                onClick={() => {
                  formHandlers.toggle();
                  if (formOpen) reset(b2bRateDefaults);
                }}
              >
                {t("addRate")}
              </Button>
            </Group>
          )}
          {formOpen && (
            <Stack component="form" gap="xs" onSubmit={handleSubmit(handleCreateB2bRate)}>
              <Group grow>
                <Controller
                  control={control}
                  name="test_id"
                  render={({ field }) => (
                    <LabTestSearchSelect
                      value={field.value}
                      onChange={(id) => field.onChange(id)}
                      error={errors.test_id?.message}
                      required
                    />
                  )}
                />
                <Controller
                  control={control}
                  name="agreed_price"
                  render={({ field }) => (
                    <NumberInput
                      label={t("label.agreedPrice")}
                      min={0}
                      decimalScale={2}
                      value={field.value}
                      onChange={field.onChange}
                      error={errors.agreed_price?.message}
                    />
                  )}
                />
                <Controller
                  control={control}
                  name="discount_percent"
                  render={({ field }) => (
                    <NumberInput
                      label={t("label.discount%")}
                      min={0}
                      max={100}
                      decimalScale={2}
                      value={field.value}
                      onChange={field.onChange}
                      error={errors.discount_percent?.message}
                    />
                  )}
                />
              </Group>
              <Group grow>
                <TextInput
                  label={t("label.effectiveFrom")}
                  type="date"
                  error={errors.effective_from?.message}
                  {...register("effective_from")}
                />
                <TextInput
                  label={t("label.effectiveTo")}
                  type="date"
                  error={errors.effective_to?.message}
                  {...register("effective_to")}
                />
              </Group>
              <Button tone="primary" size="xs" type="submit" loading={createMutation.isPending}>
                Save
              </Button>
            </Stack>
          )}
          <DataTable columns={columns} data={rates} loading={isLoading} rowKey={(row) => row.id} />
        </>
      )}
    </Stack>
  );
}
