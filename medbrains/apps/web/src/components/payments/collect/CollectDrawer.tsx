import { Group, Skeleton, Stack, Text } from "@mantine/core";
import { PATIENT_NAME_FIELD_ACCESS_KEYS, PATIENT_UHID_FIELD_ACCESS_KEY } from "@medbrains/types";
import { useProtectedFieldValue } from "@/components/PermissionedFieldValue";
import { Alert, Button, Drawer } from "@/components/ui";
import { usePatientContext } from "@/hooks/usePatientContext";
import { CollectBody } from "./CollectBody";
import { type CollectTarget, useCollect } from "./collect-store";
import { useDues } from "./use-dues";

/** Who is paying: name and UHID, as this user may see them. */
function CollectPatient({ patientId }: { patientId: string }) {
  const context = usePatientContext(patientId).data;
  const name = useProtectedFieldValue({
    fieldCodes: PATIENT_NAME_FIELD_ACCESS_KEYS,
    value: context?.full_name ?? "",
    kind: "name",
  });
  const uhid = useProtectedFieldValue({
    fieldCode: PATIENT_UHID_FIELD_ACCESS_KEY,
    value: context?.uhid ?? "",
    kind: "identifier",
  });
  if (!context) return null;
  return (
    <Group gap="xs">
      <Text fw={600}>{name.displayValue}</Text>
      <Text size="sm" ff="monospace" c="dimmed">
        {uhid.displayValue}
      </Text>
    </Group>
  );
}

function DuesState({ target, onClose }: { target: CollectTarget; onClose: () => void }) {
  const dues = useDues(target.patientId, !target.sale);
  if (target.sale) return <CollectBody target={target} dues={null} onClose={onClose} />;
  if (dues.isError) {
    return (
      <Alert tone="danger" title="What is due could not be read">
        <Stack gap="xs">
          <Text size="sm">{dues.error.message}</Text>
          <Button tone="secondary" size="xs" onClick={() => void dues.refetch()}>
            Try again
          </Button>
        </Stack>
      </Alert>
    );
  }
  if (!dues.data) return <Skeleton height={240} aria-label="Reading what is due" />;
  if (dues.data.amounts_hidden) {
    return (
      <Alert tone="warning" title="Amount hidden">
        Your access hides bill amounts, so you cannot collect here.
      </Alert>
    );
  }
  return <CollectBody target={target} dues={dues.data} onClose={onClose} />;
}

/** The one Collect drawer, opened by `useCollect().open(...)` from any screen. */
export function CollectDrawer() {
  const target = useCollect((s) => s.target);
  const session = useCollect((s) => s.session);
  const close = useCollect((s) => s.close);
  return (
    <Drawer opened={target !== null} onClose={close} title="Collect payment" size={480}>
      {target && (
        <Stack gap="md">
          {target.patientId && <CollectPatient patientId={target.patientId} />}
          <DuesState key={session} target={target} onClose={close} />
        </Stack>
      )}
    </Drawer>
  );
}
