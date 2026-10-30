import { Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P, type StoreRefund } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DataTable } from "@/components";
import { Alert, Badge, Button, toast } from "@/components/ui";
import { storefrontService } from "@/services/storefront.service";

/**
 * Refunds owed on online orders, oldest due first: back to the online
 * payment, or cash against the bill. Issued within 24 hours; issuing twice
 * pays once.
 */
export function OnlineRefunds() {
  const canIssue = useHasPermission(P.PHARMACY.STOREFRONT.RETURNS);
  const queryClient = useQueryClient();
  const refunds = useQuery({
    queryKey: ["storefront-refunds"],
    queryFn: () => storefrontService.listStorefrontRefunds(),
    enabled: canIssue,
  });
  const issue = useMutation({
    mutationFn: (id: string) => storefrontService.issueStorefrontRefund(id),
    onSuccess: (r) => {
      toast.success(`Reference ${r.refund_reference ?? ""}`, { title: "Refund issued" });
      void queryClient.invalidateQueries({ queryKey: ["storefront-refunds"] });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Not issued" }),
  });
  if (!canIssue) return null;
  if (refunds.isError) {
    return (
      <Alert tone="danger" title="Refunds could not be loaded">
        This is not an empty list. Try again in a moment.
      </Alert>
    );
  }
  const columns = [
    {
      key: "why",
      label: "For",
      render: (r: StoreRefund) => (
        <Text size="sm">{r.cause === "cancelled" ? "Cancelled order" : "Returned medicines"}</Text>
      ),
    },
    {
      key: "amount",
      label: "Amount",
      render: (r: StoreRefund) => <Text size="sm">₹{r.amount}</Text>,
    },
    {
      key: "how",
      label: "Back to",
      render: (r: StoreRefund) => (
        <Text size="sm">
          {r.method === "online" ? "The online payment" : "Cash at the pharmacy"}
        </Text>
      ),
    },
    {
      key: "due",
      label: "Due",
      render: (r: StoreRefund) => {
        const late = r.status === "pending" && new Date(r.due_by).getTime() < Date.now();
        return (
          <Badge size="sm" tone={r.status === "issued" ? "success" : late ? "danger" : "warning"}>
            {r.status === "issued"
              ? `Issued · ${r.refund_reference ?? ""}`
              : `Due ${new Date(r.due_by).toLocaleString()}`}
          </Badge>
        );
      },
    },
    {
      key: "actions",
      label: "",
      render: (r: StoreRefund) =>
        r.status === "pending" ? (
          <Button
            size="xs"
            tone="primary"
            loading={issue.isPending}
            onClick={() => issue.mutate(r.id)}
          >
            Issue refund
          </Button>
        ) : null,
    },
  ];
  return (
    <DataTable
      columns={columns}
      data={refunds.data ?? []}
      loading={refunds.isLoading}
      rowKey={(r) => r.id}
      emptyTitle="No refunds owed"
    />
  );
}
