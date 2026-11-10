import { Group } from "@mantine/core";
import type { OutsidePrint, StoreOrder } from "@medbrains/types";
import { IconArrowBackUp, IconPrinter, IconX } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, toast } from "@/components/ui";
import { portalService } from "@/services/portal.service";
import { canCancel, canReturn, printableLines } from "./storefront-p2";

interface StoreOrderActionsProps {
  token: string;
  order: StoreOrder;
  onReturn: (order: StoreOrder) => void;
  onPrinted: (print: OutsidePrint) => void;
}

/** What the patient may do with an order now: cancel, return, or take it elsewhere. */
export function StoreOrderActions({ token, order, onReturn, onPrinted }: StoreOrderActionsProps) {
  const queryClient = useQueryClient();
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["store-orders"] });
  const cancel = useMutation({
    mutationFn: () => portalService.cancelStoreOrder(token, order.id),
    onSuccess: () => {
      toast.success("Anything you paid goes back the way you paid.", { title: "Order cancelled" });
      refresh();
    },
    onError: (e: Error) => toast.error(e.message, { title: "Not cancelled" }),
  });
  const outside = printableLines(order);
  const print = useMutation({
    mutationFn: () => portalService.printStoreOutside(token, order.id, outside),
    onSuccess: (printed) => {
      refresh();
      onPrinted(printed);
    },
    onError: (e: Error) => toast.error(e.message, { title: "Not printed" }),
  });
  return (
    <Group gap="xs">
      {canCancel(order) && (
        <Button
          size="xs"
          tone="secondary"
          leftSection={<IconX size={14} />}
          loading={cancel.isPending}
          onClick={() => cancel.mutate()}
        >
          Cancel order
        </Button>
      )}
      {outside.length > 0 && (
        <Button
          size="xs"
          tone="tertiary"
          leftSection={<IconPrinter size={14} />}
          loading={print.isPending}
          onClick={() => print.mutate()}
        >
          Buy elsewhere: print my prescription
        </Button>
      )}
      {canReturn(order) && (
        <Button
          size="xs"
          tone="secondary"
          leftSection={<IconArrowBackUp size={14} />}
          onClick={() => onReturn(order)}
        >
          Return medicines
        </Button>
      )}
    </Group>
  );
}
