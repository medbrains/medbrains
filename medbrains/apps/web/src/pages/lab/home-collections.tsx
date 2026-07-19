// Lab HomeCollectionsSection — split from lab.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import { Group, Stack, Text, Textarea, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type { LabHomeCollectionFormInput } from "@medbrains/schemas";
import { labHomeCollectionFormSchema } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type {
  CreateHomeCollectionRequest,
  HomeCollectionStatsRow,
  LabHomeCollection,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { DataTable } from "@/components";
import { PatientNameCell } from "@/components/PatientNameCell";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { Badge, type BadgeTone, Button } from "@/components/ui";
import { labOptionalText } from "@/forms/lab.form";
import { labService } from "@/services/lab.service";

const homeCollectionStatusColors: Record<string, BadgeTone> = {
  scheduled: "primary",
  assigned: "info",
  in_transit: "warning",
  arrived: "warning",
  collected: "success",
  returned_to_lab: "success",
  cancelled: "danger",
};

export function HomeCollectionsSection() {
  const { t } = useTranslation("lab");
  const canManage = useHasPermission(P.LAB.SAMPLES_MANAGE);
  const queryClient = useQueryClient();
  const [formOpen, formHandlers] = useDisclosure(false);
  const homeCollectionDefaults: LabHomeCollectionFormInput = {
    order_id: "",
    patient_id: "",
    scheduled_date: "",
    scheduled_time_slot: "",
    address_line: "",
    city: "",
    pincode: "",
    contact_phone: "",
    special_instructions: "",
  };
  const {
    control,
    register,
    reset,
    handleSubmit,
    formState: { errors },
  } = useForm<LabHomeCollectionFormInput>({
    resolver: zodResolver(labHomeCollectionFormSchema),
    defaultValues: homeCollectionDefaults,
  });

  const { data: collections = [], isLoading } = useQuery({
    queryKey: ["lab-home-collections"],
    queryFn: () => labService.listHomeCollections(),
  });

  const { data: stats = [] } = useQuery({
    queryKey: ["lab-home-collection-stats"],
    queryFn: () => labService.getHomeCollectionStats(),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateHomeCollectionRequest) => labService.createHomeCollection(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["lab-home-collections"] });
      void queryClient.invalidateQueries({ queryKey: ["lab-home-collection-stats"] });
      formHandlers.close();
      reset(homeCollectionDefaults);
    },
  });

  const handleCreateHomeCollection = (values: LabHomeCollectionFormInput) => {
    createMutation.mutate({
      order_id: labOptionalText(values.order_id),
      patient_id: values.patient_id.trim(),
      scheduled_date: values.scheduled_date.trim(),
      scheduled_time_slot: labOptionalText(values.scheduled_time_slot),
      address_line: labOptionalText(values.address_line),
      city: labOptionalText(values.city),
      pincode: labOptionalText(values.pincode),
      contact_phone: labOptionalText(values.contact_phone),
      special_instructions: labOptionalText(values.special_instructions),
    });
  };

  const columns = [
    {
      key: "patient_id",
      label: "Patient",
      render: (row: LabHomeCollection) => (
        <PatientNameCell patientId={row.patient_id} showUhid={false} />
      ),
    },
    {
      key: "scheduled_date",
      label: "Date",
      render: (row: LabHomeCollection) => <Text size="sm">{row.scheduled_date}</Text>,
    },
    {
      key: "scheduled_time_slot",
      label: "Time",
      render: (row: LabHomeCollection) => <Text size="sm">{row.scheduled_time_slot ?? "—"}</Text>,
    },
    {
      key: "city",
      label: "City",
      render: (row: LabHomeCollection) => <Text size="sm">{row.city ?? "—"}</Text>,
    },
    {
      key: "status",
      label: "Status",
      render: (row: LabHomeCollection) => (
        <Badge tone={homeCollectionStatusColors[row.status] ?? "neutral"} size="sm">
          {row.status.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      key: "assigned",
      label: "Phlebotomist",
      render: (row: LabHomeCollection) => (
        <Text size="sm">{row.assigned_phlebotomist?.slice(0, 8) ?? "Unassigned"}</Text>
      ),
    },
  ];

  return (
    <Stack>
      {stats.length > 0 && (
        <Group gap="md" mb="xs">
          {stats.map((s: HomeCollectionStatsRow) => (
            <Badge key={s.status} tone={homeCollectionStatusColors[s.status] ?? "neutral"}>
              {s.status.replace(/_/g, " ")}: {s.count}
            </Badge>
          ))}
        </Group>
      )}
      {canManage && (
        <Group>
          <Button
            tone="primary"
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={() => {
              formHandlers.toggle();
              if (formOpen) reset(homeCollectionDefaults);
            }}
          >
            {t("scheduleCollection")}
          </Button>
        </Group>
      )}
      {formOpen && (
        <Stack component="form" gap="xs" onSubmit={handleSubmit(handleCreateHomeCollection)}>
          <Group grow>
            <Controller
              control={control}
              name="patient_id"
              render={({ field }) => (
                <PatientSearchSelect
                  value={field.value}
                  onChange={(id) => field.onChange(id)}
                  error={errors.patient_id?.message}
                  required
                />
              )}
            />
            <TextInput
              label={t("label.scheduledDate")}
              type="date"
              required
              error={errors.scheduled_date?.message}
              {...register("scheduled_date")}
            />
            <TextInput
              label={t("label.timeSlot")}
              placeholder={t("placeholder.e.g.9:0011:00Am")}
              error={errors.scheduled_time_slot?.message}
              {...register("scheduled_time_slot")}
            />
          </Group>
          <Group grow>
            <TextInput
              label={t("label.address")}
              error={errors.address_line?.message}
              {...register("address_line")}
            />
            <TextInput label={t("label.city")} error={errors.city?.message} {...register("city")} />
            <TextInput
              label={t("label.pincode")}
              error={errors.pincode?.message}
              {...register("pincode")}
            />
          </Group>
          <TextInput
            label={t("label.contactPhone")}
            error={errors.contact_phone?.message}
            {...register("contact_phone")}
            w={200}
          />
          <Textarea
            label={t("specialInstructions")}
            error={errors.special_instructions?.message}
            {...register("special_instructions")}
          />
          <Button tone="primary" size="xs" type="submit" loading={createMutation.isPending}>
            Save
          </Button>
        </Stack>
      )}
      <DataTable
        columns={columns}
        data={collections}
        loading={isLoading}
        rowKey={(row) => row.id}
      />
    </Stack>
  );
}
