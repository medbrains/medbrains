import { zodResolver } from "@hookform/resolvers/zod";
import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Loader,
  Modal,
  NumberInput,
  Select,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { type ServiceSettingsFormInput, serviceSettingsFormSchema } from "@medbrains/schemas";
import type { DepartmentRow, ServiceRow } from "@medbrains/types";
import { IconCheck, IconPencil, IconPlus, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { settingsSetupService } from "@/services/settingsSetup.service";

const SERVICE_TYPE_OPTIONS = [
  { value: "consultation", label: "Consultation" },
  { value: "procedure", label: "Procedure" },
  { value: "investigation", label: "Investigation" },
  { value: "nursing", label: "Nursing" },
  { value: "diet", label: "Diet" },
  { value: "other", label: "Other" },
];

const SERVICE_TYPE_COLORS: Record<string, string> = {
  consultation: "primary",
  procedure: "violet",
  investigation: "orange",
  nursing: "teal",
  diet: "success",
  other: "slate",
};

const EMPTY_FORM: ServiceSettingsFormInput = {
  code: "",
  name: "",
  service_type: "consultation",
  base_price: 0,
  department_id: null,
  description: "",
};

function ServiceModal({
  opened,
  onClose,
  editingService,
}: {
  opened: boolean;
  onClose: () => void;
  editingService: ServiceRow | null;
}) {
  const queryClient = useQueryClient();
  const isEdit = !!editingService;

  const {
    control,
    handleSubmit,
    reset,
    register,
    formState: { errors },
  } = useForm<ServiceSettingsFormInput>({
    resolver: zodResolver(serviceSettingsFormSchema),
    defaultValues: EMPTY_FORM,
  });

  const { data: departments } = useQuery({
    queryKey: ["setup-departments"],
    queryFn: settingsSetupService.listDepartments,
  });

  const departmentOptions = (departments ?? []).map((d: DepartmentRow) => ({
    value: d.id,
    label: d.name,
  }));

  const handleOpen = () => {
    if (editingService) {
      reset({
        code: editingService.code,
        name: editingService.name,
        service_type: editingService.service_type,
        base_price: editingService.base_price ?? 0,
        department_id: editingService.department_id ?? null,
        description: editingService.description ?? "",
      });
    } else {
      reset(EMPTY_FORM);
    }
  };

  const createMutation = useMutation({
    mutationFn: settingsSetupService.createService,
    onSuccess: () => {
      notifications.show({
        title: "Service created",
        message: "New service has been added successfully.",
        color: "success",
        icon: <IconCheck size={16} />,
      });
      void queryClient.invalidateQueries({ queryKey: ["setup-services"] });
      onClose();
    },
    onError: (err: Error) => {
      notifications.show({
        title: "Create failed",
        message: err.message,
        color: "danger",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: Parameters<typeof settingsSetupService.updateService>[1]) => {
      if (!editingService) throw new Error("No service selected");
      return settingsSetupService.updateService(editingService.id, data);
    },
    onSuccess: () => {
      notifications.show({
        title: "Service updated",
        message: "Service has been updated successfully.",
        color: "success",
        icon: <IconCheck size={16} />,
      });
      void queryClient.invalidateQueries({ queryKey: ["setup-services"] });
      onClose();
    },
    onError: (err: Error) => {
      notifications.show({
        title: "Update failed",
        message: err.message,
        color: "danger",
      });
    },
  });

  const submitService = handleSubmit((form) => {
    const payload = {
      code: form.code.trim(),
      name: form.name.trim(),
      service_type: form.service_type,
      base_price: Number(form.base_price),
      department_id: form.department_id || null,
      description: form.description.trim() || undefined,
    };

    if (isEdit) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  });

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={isEdit ? "Edit Service" : "Add Service"}
      size="md"
      onTransitionEnd={handleOpen}
    >
      <Stack gap="sm">
        <TextInput
          label="Code"
          placeholder="SVC-001"
          {...register("code")}
          error={errors.code?.message}
          required
        />
        <TextInput
          label="Name"
          placeholder="General Consultation"
          {...register("name")}
          error={errors.name?.message}
          required
        />
        <Controller
          control={control}
          name="service_type"
          render={({ field }) => (
            <Select
              label="Service Type"
              data={SERVICE_TYPE_OPTIONS}
              value={field.value}
              onChange={(value) => field.onChange(value ?? "consultation")}
              error={errors.service_type?.message}
              allowDeselect={false}
              required
            />
          )}
        />
        <Controller
          control={control}
          name="base_price"
          render={({ field }) => (
            <NumberInput
              label="Base Price"
              placeholder="0.00"
              value={field.value}
              onChange={(value) => field.onChange(typeof value === "number" ? value : 0)}
              min={0}
              decimalScale={2}
              fixedDecimalScale
              thousandSeparator=","
              prefix="₹ "
              error={errors.base_price?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="department_id"
          render={({ field }) => (
            <Select
              label="Department"
              placeholder="Select department (optional)"
              data={departmentOptions}
              value={field.value}
              onChange={field.onChange}
              error={errors.department_id?.message}
              clearable
              searchable
            />
          )}
        />
        <Textarea
          label="Description"
          placeholder="Optional description of this service"
          {...register("description")}
          error={errors.description?.message}
          minRows={3}
        />
        <Group justify="flex-end" mt="md">
          <Button variant="light" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => void submitService()}
            loading={createMutation.isPending || updateMutation.isPending}
          >
            {isEdit ? "Save" : "Create"}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

export function ServicesSettings() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<ServiceRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ServiceRow | null>(null);

  const {
    data: services,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["setup-services"],
    queryFn: settingsSetupService.listServices,
  });

  const { data: departments } = useQuery({
    queryKey: ["setup-departments"],
    queryFn: settingsSetupService.listDepartments,
  });

  const deptMap = new Map((departments ?? []).map((d: DepartmentRow) => [d.id, d.name]));

  const deleteMutation = useMutation({
    mutationFn: settingsSetupService.deleteService,
    onSuccess: () => {
      notifications.show({
        title: "Service deleted",
        message: "Service has been removed successfully.",
        color: "success",
        icon: <IconCheck size={16} />,
      });
      void queryClient.invalidateQueries({ queryKey: ["setup-services"] });
      setDeleteTarget(null);
    },
    onError: (err: Error) => {
      notifications.show({
        title: "Delete failed",
        message: err.message,
        color: "danger",
      });
    },
  });

  const openCreate = () => {
    setEditingService(null);
    setModalOpen(true);
  };

  const openEdit = (service: ServiceRow) => {
    setEditingService(service);
    setModalOpen(true);
  };

  const confirmDelete = () => {
    if (deleteTarget) {
      deleteMutation.mutate(deleteTarget.id);
    }
  };

  if (isLoading) {
    return (
      <Stack align="center" py="xl">
        <Loader size="lg" />
        <Text c="dimmed">Loading services...</Text>
      </Stack>
    );
  }

  if (isError) {
    return (
      <Stack align="center" py="xl">
        <Text c="danger">
          Failed to load services: {error instanceof Error ? error.message : "Unknown error"}
        </Text>
      </Stack>
    );
  }

  return (
    <>
      <Group justify="space-between" mb="md">
        <Text fw={600} size="lg">
          Services
        </Text>
        <Button size="sm" leftSection={<IconPlus size={14} />} onClick={openCreate}>
          Add Service
        </Button>
      </Group>

      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Code</Table.Th>
            <Table.Th>Name</Table.Th>
            <Table.Th>Type</Table.Th>
            <Table.Th>Price</Table.Th>
            <Table.Th>Department</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {services && services.length > 0 ? (
            services.map((service: ServiceRow) => (
              <Table.Tr key={service.id}>
                <Table.Td>
                  <Text size="sm" ff="monospace">
                    {service.code}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{service.name}</Text>
                </Table.Td>
                <Table.Td>
                  <Badge
                    color={SERVICE_TYPE_COLORS[service.service_type] ?? "slate"}
                    variant="light"
                    size="sm"
                  >
                    {service.service_type}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" ff="monospace">
                    {service.base_price > 0
                      ? `₹ ${Number(service.base_price).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
                      : "-"}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" c={service.department_id ? undefined : "dimmed"}>
                    {service.department_id ? (deptMap.get(service.department_id) ?? "-") : "-"}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Badge color={service.is_active ? "success" : "danger"} variant="light" size="sm">
                    {service.is_active ? "Active" : "Inactive"}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Group gap="xs" wrap="nowrap">
                    <ActionIcon
                      variant="subtle"
                      color="primary"
                      onClick={() => openEdit(service)}
                      aria-label="Edit"
                    >
                      <IconPencil size={16} />
                    </ActionIcon>
                    <ActionIcon
                      variant="subtle"
                      color="danger"
                      onClick={() => setDeleteTarget(service)}
                      aria-label="Delete"
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))
          ) : (
            <Table.Tr>
              <Table.Td colSpan={7}>
                <Text c="dimmed" ta="center" py="lg">
                  No services configured yet. Click "Add Service" to create one.
                </Text>
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>

      <ServiceModal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        editingService={editingService}
      />

      <Modal
        opened={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Service"
        size="sm"
      >
        <Stack gap="md">
          <Text size="sm">
            Are you sure you want to delete the service{" "}
            <Text span fw={600}>
              {deleteTarget?.name}
            </Text>{" "}
            ({deleteTarget?.code})? This action cannot be undone.
          </Text>
          <Group justify="flex-end">
            <Button variant="light" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button color="danger" onClick={confirmDelete} loading={deleteMutation.isPending}>
              Delete
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
