import { Group, Text } from "@mantine/core";
import type { StoreOrderLine } from "@medbrains/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge, Button, toast } from "@/components/ui";
import { portalService } from "@/services/portal.service";
import { awaitsPatient, SUBSTITUTION_VIEW } from "./storefront-p2";

interface StoreSubstituteConsentProps {
  token: string;
  orderId: string;
  line: StoreOrderLine;
}

/** A substitute the pharmacy proposed for one line, and the patient's answer. */
export function StoreSubstituteConsent({ token, orderId, line }: StoreSubstituteConsentProps) {
  const queryClient = useQueryClient();
  const sub = line.substitution;
  const answer = useMutation({
    mutationFn: (accept: boolean) =>
      portalService.consentStoreSubstitution(token, orderId, sub?.id ?? "", accept),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["store-orders"] }),
    onError: (e: Error) => toast.error(e.message, { title: "Not saved" }),
  });
  if (!sub) return null;
  return (
    <Group gap="xs">
      <Badge size="xs" tone={SUBSTITUTION_VIEW[sub.status].tone}>
        {SUBSTITUTION_VIEW[sub.status].label}
      </Badge>
      <Text size="xs">
        {sub.substitute_name} instead: {sub.reason}
      </Text>
      {awaitsPatient(sub) && (
        <>
          <Button
            size="xs"
            tone="secondary"
            loading={answer.isPending}
            onClick={() => answer.mutate(false)}
          >
            No, thanks
          </Button>
          <Button
            size="xs"
            tone="primary"
            loading={answer.isPending}
            onClick={() => answer.mutate(true)}
          >
            Accept substitute
          </Button>
        </>
      )}
    </Group>
  );
}
