// IPD RoomsTab — split from ot.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import { Drawer, Group, Stack, Text, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type { OtRoomFormInput } from "@medbrains/schemas";
import { otRoomFormSchema } from "@medbrains/schemas";
import type { OtRoom } from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { DataTable, StatusDot } from "@/components";
import { Badge, Button, toast } from "@/components/ui";
import { DEFAULT_OT_ROOM_FORM_VALUES, toCreateOtRoomRequest } from "@/forms/ot.form";
import { otService } from "@/services/ot.service";

function CreateRoomDrawer({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<OtRoomFormInput>({
    resolver: zodResolver(otRoomFormSchema),
    defaultValues: DEFAULT_OT_ROOM_FORM_VALUES,
  });

  const mutation = useMutation({
    mutationFn: (values: OtRoomFormInput) => otService.createOtRoom(toCreateOtRoomRequest(values)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ot-rooms"] });
      toast.success("OT room created", { title: "Created" });
      onClose();
      reset(DEFAULT_OT_ROOM_FORM_VALUES);
    },
  });

  return (
    <Drawer opened={opened} onClose={onClose} title="New OT Room" position="right" size="sm">
      <Stack component="form" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        <Controller
          control={control}
          name="name"
          render={({ field }) => (
            <TextInput label="Room Name" required error={errors.name?.message} {...field} />
          )}
        />
        <Controller
          control={control}
          name="code"
          render={({ field }) => (
            <TextInput label="Code" required error={errors.code?.message} {...field} />
          )}
        />
        <Button tone="primary" type="submit" loading={mutation.isPending}>
          Create
        </Button>
      </Stack>
    </Drawer>
  );
}

export function RoomsTab({ canManage }: { canManage: boolean }) {
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);

  const { data = [], isLoading } = useQuery<OtRoom[]>({
    queryKey: ["ot-rooms"],
    queryFn: () => otService.listOtRooms(),
  });

  const roomStatusColors: Record<string, string> = {
    available: "success",
    in_use: "primary",
    cleaning: "warning",
    maintenance: "orange",
    reserved: "violet",
  };

  const columns = [
    {
      key: "name",
      label: "Room",
      render: (r: OtRoom) => (
        <Stack gap={0}>
          <Text size="sm" fw={500}>
            {r.name}
          </Text>
          <Text size="xs" c="dimmed">
            {r.code}
          </Text>
        </Stack>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (r: OtRoom) => (
        <StatusDot color={roomStatusColors[r.status] ?? "slate"} label={r.status} />
      ),
    },
    {
      key: "is_active",
      label: "Active",
      render: (r: OtRoom) => (
        <Badge tone={r.is_active ? "success" : "neutral"}>{r.is_active ? "Yes" : "No"}</Badge>
      ),
    },
  ];

  return (
    <Stack>
      {canManage && (
        <Group>
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={openCreate}>
            Add Room
          </Button>
        </Group>
      )}
      <DataTable columns={columns} data={data} loading={isLoading} rowKey={(r) => r.id} />
      <CreateRoomDrawer opened={createOpened} onClose={closeCreate} />
    </Stack>
  );
}
