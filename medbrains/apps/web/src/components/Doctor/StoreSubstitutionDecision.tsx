import { Group, Stack, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useHasPermission } from "@medbrains/stores";
import { P, type PendingSignoffEntry } from "@medbrains/types";
import { IconReplace } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Button, Modal, Select, TextArea, toast } from "@/components/ui";
import { storefrontService } from "@/services/storefront.service";

interface StoreSubstitutionDecisionProps {
  item: PendingSignoffEntry;
}

/**
 * A substitute the pharmacy proposed for a medicine this doctor prescribed
 * on an online order. The doctor approves it, picks another match, or
 * declines; one agreed by phone is confirmed here within 24 hours.
 */
export function StoreSubstitutionDecision({ item }: StoreSubstitutionDecisionProps) {
  const canDecide = useHasPermission(P.DOCTOR.STORE_SUBSTITUTIONS.DECIDE);
  const [opened, modal] = useDisclosure(false);
  if (!canDecide) return null;
  return (
    <>
      <Button size="xs" tone="primary" leftSection={<IconReplace size={14} />} onClick={modal.open}>
        Decide substitute
      </Button>
      <Modal opened={opened} onClose={modal.close} title="Substitute on an online order" size="md">
        {opened && <DecisionBody id={item.record_id} onDone={modal.close} />}
      </Modal>
    </>
  );
}

function DecisionBody({ id, onDone }: { id: string; onDone: () => void }) {
  const queryClient = useQueryClient();
  const request = useQuery({
    queryKey: ["store-substitution", id],
    queryFn: () => storefrontService.getStoreSubstitutionRequest(id),
  });
  const [pick, setPick] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const decide = useMutation({
    mutationFn: (approve: boolean) =>
      storefrontService.decideStoreSubstitution(id, {
        approve,
        ...(approve && pick ? { substitute_item_id: pick } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      }),
    onSuccess: (r) => {
      toast.success(
        r.status === "approved"
          ? "The patient is asked next."
          : "The pharmacy will offer another way.",
        {
          title: r.status === "approved" ? "Substitute approved" : "Substitute declined",
        },
      );
      void queryClient.invalidateQueries({ queryKey: ["my-pending-signoffs"] });
      onDone();
    },
    onError: (e: Error) => toast.error(e.message, { title: "Not decided" }),
  });
  if (request.isError) {
    return (
      <Alert tone="danger" title="This request could not be loaded">
        Try again in a moment.
      </Alert>
    );
  }
  const r = request.data;
  if (!r) return null;
  const options = (r.options?.candidates ?? []).map((c) => ({
    value: c.id,
    label: `${c.name}${c.price ? ` · ₹${c.price}` : ""}`,
  }));
  return (
    <Stack gap="sm">
      <Text size="sm">
        You prescribed {r.original_name}. The pharmacy proposes {r.substitute_name}: {r.reason}.
      </Text>
      {r.method === "phone" && (
        <Alert tone="warning" title="Agreed by phone">
          {r.phone_note}
          {r.confirm_due_at ? ` · confirm by ${new Date(r.confirm_due_at).toLocaleString()}` : ""}
        </Alert>
      )}
      <Select
        label="Substitute"
        description="Same salt, strength, form and release type"
        data={options}
        value={pick ?? r.substitute_item_id}
        onChange={setPick}
      />
      <TextArea label="Note" value={note} onChange={(e) => setNote(e.currentTarget.value)} />
      <Group justify="flex-end">
        <Button tone="secondary" loading={decide.isPending} onClick={() => decide.mutate(false)}>
          Decline
        </Button>
        <Button tone="primary" loading={decide.isPending} onClick={() => decide.mutate(true)}>
          {r.method === "phone" ? "Confirm" : "Approve"}
        </Button>
      </Group>
    </Stack>
  );
}
