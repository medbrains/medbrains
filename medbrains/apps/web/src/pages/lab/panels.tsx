// Lab LabPanelsTab — split from lab.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import { Group, NumberInput, Stack, Text, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type { LabPanelFormInput } from "@medbrains/schemas";
import { labPanelFormSchema } from "@medbrains/schemas";
import type { CreateLabPanelRequest, LabTestPanel } from "@medbrains/types";
import { IconCheck, IconPlus, IconX } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { DataTable } from "@/components";
import { LabTestSearchSelect } from "@/components/LabTestSearchSelect";
import { Alert, Badge, Button, IconButton } from "@/components/ui";
import { labNumberOrFallback, labOptionalText } from "@/forms/lab.form";
import { confirmDestructive } from "@/lib/confirm";
import { labService } from "@/services/lab.service";

export function LabPanelsTab({ canCreate }: { canCreate: boolean }) {
  const { t } = useTranslation("lab");

  const queryClient = useQueryClient();
  const [formOpen, formHandlers] = useDisclosure(false);
  const [testIdInput, setTestIdInput] = useState("");
  const panelDefaults: LabPanelFormInput = {
    code: "",
    name: "",
    description: "",
    price: 0,
    test_ids: [],
  };
  const {
    control,
    register,
    reset,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<LabPanelFormInput>({
    resolver: zodResolver(labPanelFormSchema),
    defaultValues: panelDefaults,
  });
  const selectedTestIds = watch("test_ids");

  const { data: panels = [], isLoading } = useQuery({
    queryKey: ["lab-panels"],
    queryFn: () => labService.listLabPanels(),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateLabPanelRequest) => labService.createLabPanel(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["lab-panels"] });
      formHandlers.close();
      reset(panelDefaults);
      setTestIdInput("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => labService.deleteLabPanel(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["lab-panels"] }),
  });

  const addTestId = () => {
    const testId = testIdInput.trim();
    if (testId && !selectedTestIds.includes(testId)) {
      setValue("test_ids", [...selectedTestIds, testId], {
        shouldDirty: true,
        shouldValidate: true,
      });
      setTestIdInput("");
    }
  };

  const removeTestId = (index: number) => {
    setValue(
      "test_ids",
      selectedTestIds.filter((_, currentIndex) => currentIndex !== index),
      {
        shouldDirty: true,
        shouldValidate: true,
      },
    );
  };

  const handleCreatePanel = (values: LabPanelFormInput) => {
    createMutation.mutate({
      code: values.code.trim(),
      name: values.name.trim(),
      description: labOptionalText(values.description),
      price: labNumberOrFallback(values.price, 0),
      test_ids: values.test_ids,
    });
  };

  const columns = [
    { key: "code", label: "Code", render: (row: LabTestPanel) => <Text fw={500}>{row.code}</Text> },
    {
      key: "name",
      label: "Name",
      render: (row: LabTestPanel) => <Text size="sm">{row.name}</Text>,
    },
    {
      key: "description",
      label: "Description",
      render: (row: LabTestPanel) => <Text size="sm">{row.description ?? "—"}</Text>,
    },
    {
      key: "price",
      label: "Price",
      render: (row: LabTestPanel) => <Text size="sm">₹{row.price}</Text>,
    },
    {
      key: "is_active",
      label: "Active",
      render: (row: LabTestPanel) =>
        row.is_active ? (
          <IconCheck size={14} color="success" />
        ) : (
          <IconX size={14} color="danger" />
        ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (row: LabTestPanel) => (
        <IconButton
          tone="danger"
          onClick={() =>
            confirmDestructive({
              title: "Delete",
              message: "Permanently delete this record? This cannot be undone.",
              onConfirm: () => deleteMutation.mutate(row.id),
            })
          }
          aria-label={t("aria.close")}
        >
          <IconX size={14} />
        </IconButton>
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
              if (formOpen) {
                reset(panelDefaults);
                setTestIdInput("");
              }
              formHandlers.toggle();
            }}
          >
            Add Panel
          </Button>
        </Group>
      )}
      {formOpen && (
        <Stack component="form" gap="xs" onSubmit={handleSubmit(handleCreatePanel)}>
          <Group grow>
            <TextInput
              label={t("label.code")}
              required
              placeholder={t("placeholder.e.g.Cbc")}
              error={errors.code?.message}
              {...register("code")}
            />
            <TextInput
              label={t("label.name")}
              required
              placeholder={t("placeholder.e.g.CompleteBloodCount")}
              error={errors.name?.message}
              {...register("name")}
            />
          </Group>
          <Group grow>
            <TextInput
              label={t("label.description")}
              error={errors.description?.message}
              {...register("description")}
            />
            <Controller
              control={control}
              name="price"
              render={({ field }) => (
                <NumberInput
                  label={t("label.panelPrice")}
                  required
                  min={0}
                  decimalScale={2}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.price?.message}
                />
              )}
            />
          </Group>
          <Group>
            <LabTestSearchSelect
              value={testIdInput}
              onChange={(id) => setTestIdInput(id)}
              label={t("label.addTestId")}
            />
            <Button tone="secondary" size="xs" mt={24} onClick={addTestId}>
              Add
            </Button>
          </Group>
          {errors.test_ids?.message && <Alert tone="danger">{errors.test_ids.message}</Alert>}
          {selectedTestIds.length > 0 && (
            <Group gap="xs">
              {selectedTestIds.map((tid, i) => (
                <Badge
                  key={tid}
                  rightSection={
                    <IconButton
                      size="xs"
                      onClick={() => removeTestId(i)}
                      aria-label={t("aria.close")}
                    >
                      <IconX size={10} />
                    </IconButton>
                  }
                >
                  {tid.slice(0, 8)}...
                </Badge>
              ))}
            </Group>
          )}
          <Button tone="primary" size="xs" type="submit" loading={createMutation.isPending}>
            Save Panel
          </Button>
        </Stack>
      )}
      <DataTable columns={columns} data={panels} loading={isLoading} rowKey={(row) => row.id} />
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Phlebotomy Tab (NEW)
// ══════════════════════════════════════════════════════════
