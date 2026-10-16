/**
 * A customer brings back medicine with the printed receipt. Today's sales
 * list cannot reach last week's sale, so the counter finds it by number.
 */
import { Group } from "@mantine/core";
import { ApiError } from "@medbrains/api";
import { IconReceiptRefund } from "@tabler/icons-react";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Button, Input } from "@/components/ui";
import { pharmacyService } from "@/services/pharmacy.service";

interface ReceiptReturnLookupProps {
  onFound: (saleId: string) => void;
}

export function ReceiptReturnLookup({ onFound }: ReceiptReturnLookupProps) {
  const [number, setNumber] = useState("");
  const find = useMutation({
    mutationFn: (value: string) => pharmacyService.lookupPosReceipt(value),
    onSuccess: (sale) => {
      setNumber("");
      onFound(sale.id);
    },
  });
  const notFound = find.error instanceof ApiError && find.error.status === 404;

  return (
    <Group
      component="form"
      align="flex-end"
      gap="sm"
      onSubmit={(e) => {
        e.preventDefault();
        if (number.trim()) find.mutate(number.trim());
      }}
    >
      <Input
        label="Return against a receipt"
        placeholder="Receipt or sale number"
        value={number}
        onChange={(e) => {
          setNumber(e.currentTarget.value);
          find.reset();
        }}
        error={
          find.isError
            ? notFound
              ? "No sale has that number"
              : `Could not look it up: ${find.error.message}`
            : undefined
        }
      />
      <Button
        type="submit"
        tone="secondary"
        loading={find.isPending}
        leftSection={<IconReceiptRefund size={16} />}
      >
        Find sale
      </Button>
    </Group>
  );
}
