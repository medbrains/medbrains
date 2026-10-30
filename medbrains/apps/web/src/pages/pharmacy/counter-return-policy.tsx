import { Text } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { Alert } from "@/components/ui";
import { storefrontService } from "@/services/storefront.service";

/**
 * The counter's return policy, shown before a sale is rung so it can be
 * told to the customer (Consumer Protection Act 2019).
 */
export function CounterReturnPolicy({ enabled }: { enabled: boolean }) {
  const policy = useQuery({
    queryKey: ["pos-return-policy"],
    queryFn: () => storefrontService.getPosReturnPolicy(),
    enabled,
    staleTime: 10 * 60_000,
  });
  if (!enabled || !policy.data) return null;
  return (
    <Alert tone="info" title="Return policy: tell the customer">
      <Text size="sm">{policy.data.text}</Text>
    </Alert>
  );
}
