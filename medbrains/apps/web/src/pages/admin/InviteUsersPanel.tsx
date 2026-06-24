import { zodResolver } from "@hookform/resolvers/zod";
import { Group, Stack, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { api } from "@medbrains/api";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { IconMailForward, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Badge, Button, IconButton, Input, Modal, Panel, Select, Table } from "@/components/ui";
import { toast } from "@/components/ui/toast";

// Invites assign a built-in role (the user_role enum); super_admin is excluded.
const ROLE_OPTIONS = [
  { value: "hospital_admin", label: "Hospital Admin" },
  { value: "doctor", label: "Doctor" },
  { value: "nurse", label: "Nurse" },
  { value: "receptionist", label: "Receptionist" },
  { value: "lab_technician", label: "Lab Technician" },
  { value: "pharmacist", label: "Pharmacist" },
  { value: "billing_clerk", label: "Billing Clerk" },
  { value: "housekeeping_staff", label: "Housekeeping Staff" },
  { value: "facilities_manager", label: "Facilities Manager" },
  { value: "audit_officer", label: "Audit Officer" },
];

const ROLE_LABEL = new Map(ROLE_OPTIONS.map((r) => [r.value, r.label]));

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  role: z.string().min(1, "Pick a role"),
  full_name: z.string(),
});
type FormInput = z.infer<typeof schema>;

export function InviteUsersPanel() {
  const canInvite = useHasPermission(P.ADMIN.USERS.CREATE);
  const queryClient = useQueryClient();
  const [opened, { open, close }] = useDisclosure(false);

  const { data: invites = [] } = useQuery({
    queryKey: ["invitations"],
    queryFn: () => api.listInvitations(),
  });

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormInput>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", role: "doctor", full_name: "" },
  });

  const create = useMutation({
    mutationFn: (data: FormInput) =>
      api.createInvitation({ email: data.email, role: data.role, full_name: data.full_name }),
    onSuccess: () => {
      toast.success("Invitation sent.", { title: "Invited" });
      void queryClient.invalidateQueries({ queryKey: ["invitations"] });
      reset();
      close();
    },
    onError: (err: Error) => toast.error(err.message, { title: "Could not send invite" }),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => api.revokeInvitation(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["invitations"] }),
  });

  if (!canInvite) return null;

  return (
    <Panel
      title="Team invitations"
      description="Invite colleagues by email — they set their own password."
      actions={
        <Button tone="primary" size="sm" leftSection={<IconMailForward size={14} />} onClick={open}>
          Invite user
        </Button>
      }
    >
      {invites.length > 0 ? (
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Email</Table.Th>
              <Table.Th>Role</Table.Th>
              <Table.Th>Expires</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {invites.map((inv) => (
              <Table.Tr key={inv.id}>
                <Table.Td>{inv.email}</Table.Td>
                <Table.Td>
                  <Badge tone="neutral" size="sm">
                    {ROLE_LABEL.get(inv.role) ?? inv.role}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" c="dimmed">
                    {new Date(inv.expires_at).toLocaleDateString()}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <IconButton
                    tone="danger"
                    aria-label="Revoke invitation"
                    onClick={() => revoke.mutate(inv.id)}
                    loading={revoke.isPending}
                  >
                    <IconTrash size={16} />
                  </IconButton>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      ) : (
        <Text size="sm" c="dimmed">
          No pending invitations.
        </Text>
      )}

      <Modal opened={opened} onClose={close} title="Invite a colleague" size="md">
        <Stack gap="sm">
          <Input
            label="Email"
            placeholder="colleague@hospital.example"
            error={errors.email?.message}
            {...register("email")}
          />
          <Input
            label="Full name (optional)"
            placeholder="They can change this"
            {...register("full_name")}
          />
          <Controller
            control={control}
            name="role"
            render={({ field }) => (
              <Select
                label="Role"
                data={ROLE_OPTIONS}
                value={field.value}
                onChange={(v) => field.onChange(v ?? "doctor")}
                error={errors.role?.message}
                allowDeselect={false}
              />
            )}
          />
          <Group justify="flex-end" mt="sm">
            <Button tone="secondary" onClick={close}>
              Cancel
            </Button>
            <Button
              tone="primary"
              loading={create.isPending}
              onClick={() => void handleSubmit((data) => create.mutate(data))()}
            >
              Send invite
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Panel>
  );
}
