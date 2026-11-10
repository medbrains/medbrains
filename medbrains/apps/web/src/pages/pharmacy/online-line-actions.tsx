import { Group, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { type OutsidePrint, P, type StoreOrderLine } from "@medbrains/types";
import { IconPrinter, IconReplace } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge, Button, toast } from "@/components/ui";
import { storefrontService } from "@/services/storefront.service";
import { SUBSTITUTION_VIEW } from "../store/storefront-p2";

interface OnlineLineActionsProps {
  orderId: string;
  line: StoreOrderLine;
  onSubstitute: (line: StoreOrderLine) => void;
  onPrinted: (print: OutsidePrint) => void;
}

/**
 * What a pharmacist can do with a line the pharmacy can't fill: propose a
 * substitute for the doctor and the patient, or print it for a pharmacy of
 * the patient's choice. Shows where a substitute stands.
 */
export function OnlineLineActions({
  orderId,
  line,
  onSubstitute,
  onPrinted,
}: OnlineLineActionsProps) {
  const canSubstitute = useHasPermission(P.PHARMACY.STOREFRONT.SUBSTITUTE);
  const canPrint = useHasPermission(P.PHARMACY.STOREFRONT.VERIFY);
  const queryClient = useQueryClient();
  const print = useMutation({
    mutationFn: () => storefrontService.printStorefrontOutside(orderId, [line.catalog_item_id]),
    onSuccess: (printed) => {
      void queryClient.invalidateQueries({ queryKey: ["storefront-orders"] });
      onPrinted(printed);
    },
    onError: (e: Error) => toast.error(e.message, { title: "Not printed" }),
  });
  const sub = line.substitution;
  const open = sub !== null && ["with_doctor", "phone_pending", "approved"].includes(sub.status);
  return (
    <Stack gap={4}>
      {sub && (
        <Group gap="xs">
          <Badge size="xs" tone={SUBSTITUTION_VIEW[sub.status].tone}>
            {SUBSTITUTION_VIEW[sub.status].label}
          </Badge>
          <Text size="xs">
            {sub.substitute_name}
            {sub.patient_consent ? ` · patient ${sub.patient_consent}` : " · patient not asked yet"}
          </Text>
        </Group>
      )}
      {line.status === "pending" && (
        <Group gap="xs">
          {canSubstitute && !open && (
            <Button
              size="xs"
              tone="secondary"
              leftSection={<IconReplace size={14} />}
              onClick={() => onSubstitute(line)}
            >
              Find a substitute
            </Button>
          )}
          {canPrint && (
            <Button
              size="xs"
              tone="tertiary"
              leftSection={<IconPrinter size={14} />}
              loading={print.isPending}
              onClick={() => print.mutate()}
            >
              Print for another pharmacy
            </Button>
          )}
        </Group>
      )}
    </Stack>
  );
}
