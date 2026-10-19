import { SimpleGrid, Stack, Text } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import type { StoreItem } from "@medbrains/types";
import { IconSearch } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Input, Select, toast } from "@/components/ui";
import { portalService } from "@/services/portal.service";
import { StoreItemCard } from "./store-item-card";
import { StoreItemModal } from "./store-item-modal";

/** Wait this long after typing before searching. */
const SEARCH_DEBOUNCE_MS = 300;

interface StoreBrowseProps {
  tenantCode: string;
  /** Signed in: items can go in the cart. */
  token?: string;
}

/** Search what the pharmacy sells online by brand or generic name, in a category. */
export function StoreBrowse({ tenantCode, token }: StoreBrowseProps) {
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [open, setOpen] = useState<StoreItem | null>(null);
  const [debounced] = useDebouncedValue(q.trim(), SEARCH_DEBOUNCE_MS);
  const results = useQuery({
    queryKey: ["store-search", tenantCode, debounced, category],
    queryFn: () => portalService.searchStore(tenantCode, debounced, category ?? undefined),
  });
  const add = useMutation({
    mutationFn: (item: StoreItem) => portalService.setStoreCartQuantity(token ?? "", item.id, 1),
    onSuccess: (_cart, item) => {
      toast.success(`${item.name} is in your cart`);
      void queryClient.invalidateQueries({ queryKey: ["store-cart"] });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Not added" }),
  });
  const onAdd = token ? (item: StoreItem) => add.mutate(item) : undefined;

  return (
    <Stack gap="md">
      <Input
        label="Search medicines"
        placeholder="Brand or generic name"
        leftSection={<IconSearch size={16} />}
        value={q}
        onChange={(e) => setQ(e.currentTarget.value)}
      />
      <Select
        label="Category"
        placeholder="All"
        clearable
        data={results.data?.categories ?? []}
        value={category}
        onChange={setCategory}
      />
      {results.isError && (
        <Alert tone="warning" title="The pharmacy isn't taking orders online right now">
          Try again later, or visit the pharmacy counter.
        </Alert>
      )}
      {results.data && results.data.items.length === 0 && (
        <Text size="sm" c="dimmed">
          Nothing found. Try the generic name.
        </Text>
      )}
      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        {(results.data?.items ?? []).map((item) => (
          <StoreItemCard
            key={item.id}
            item={item}
            onOpen={setOpen}
            onAdd={onAdd}
            adding={add.isPending && add.variables?.id === item.id}
          />
        ))}
      </SimpleGrid>
      <StoreItemModal
        tenantCode={tenantCode}
        item={open}
        onClose={() => setOpen(null)}
        onOpen={setOpen}
        onAdd={onAdd}
      />
    </Stack>
  );
}
