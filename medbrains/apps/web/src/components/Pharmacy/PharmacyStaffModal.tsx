import { Group, Stack, Switch, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Badge, Button, IconButton, Modal, Select } from "@/components/ui";
import { pharmacyService } from "@/services/pharmacy.service";
import { IconTrash } from "@tabler/icons-react";

/** Assign / unassign staff to a single pharmacy (MP3). */
export function PharmacyStaffModal({
  pharmacyId,
  pharmacyName,
  opened,
  onClose,
}: {
  pharmacyId: string | null;
  pharmacyName: string;
  opened: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [isDefault, setIsDefault] = useState(false);

  const { data: users = [] } = useQuery({
    queryKey: ["setup-users"],
    queryFn: () => pharmacyService.listSetupUsers(),
    enabled: opened,
  });
  const { data: staff = [] } = useQuery({
    queryKey: ["pharmacy-staff", pharmacyId],
    queryFn: () => pharmacyService.listPharmacyStaff({ store_location_id: pharmacyId ?? "" }),
    enabled: opened && !!pharmacyId,
  });

  const userName = useMemo(
    () => new Map(users.map((u) => [u.id, u.full_name || u.username])),
    [users],
  );
  const invalidate = () => qc.invalidateQueries({ queryKey: ["pharmacy-staff", pharmacyId] });

  const assign = useMutation({
    mutationFn: () =>
      pharmacyService.assignPharmacyStaff({
        user_id: userId ?? "",
        store_location_id: pharmacyId ?? "",
        is_default: isDefault,
      }),
    onSuccess: () => {
      invalidate();
      setUserId(null);
      setIsDefault(false);
      notifications.show({ title: "Assigned", message: "Staff added", color: "success" });
    },
    onError: () =>
      notifications.show({ title: "Error", message: "Could not assign", color: "danger" }),
  });
  const remove = useMutation({
    mutationFn: (id: string) => pharmacyService.removePharmacyStaff(id),
    onSuccess: invalidate,
  });

  return (
    <Modal opened={opened} onClose={onClose} title={`Staff — ${pharmacyName}`} size="md">
      <Stack gap="md">
        <Group align="flex-end">
          <Select
            label="Add staff"
            placeholder="Select a user"
            searchable
            data={users.map((u) => ({ value: u.id, label: u.full_name || u.username }))}
            value={userId}
            onChange={setUserId}
            style={{ flex: 1 }}
          />
          <Switch
            label="Home"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.currentTarget.checked)}
          />
          <Button
            tone="primary"
            disabled={!userId}
            loading={assign.isPending}
            onClick={() => assign.mutate()}
          >
            Assign
          </Button>
        </Group>

        <Stack gap="xs">
          {staff.length === 0 ? (
            <Text size="sm" c="dimmed">
              No staff assigned yet.
            </Text>
          ) : (
            staff.map((s) => (
              <Group key={s.id} justify="space-between">
                <Group gap="xs">
                  <Text size="sm">{userName.get(s.user_id) ?? s.user_id.slice(0, 8)}</Text>
                  {s.is_default && <Badge tone="primary">Home</Badge>}
                </Group>
                <IconButton tone="danger" aria-label="Unassign" onClick={() => remove.mutate(s.id)}>
                  <IconTrash size={14} />
                </IconButton>
              </Group>
            ))
          )}
        </Stack>
      </Stack>
    </Modal>
  );
}
