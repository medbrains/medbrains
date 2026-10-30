import { FileInput, Group, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { type NppaCeilingRow, P } from "@medbrains/types";
import { IconReceiptTax, IconUpload } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import { PageHeader } from "@/components/PageHeader";
import { Alert, Input, NumberField, toast } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { storefrontService } from "@/services/storefront.service";
import { parseNppaSheet } from "../store/storefront-p2";

/**
 * NPPA ceiling prices (DPCO 2013): no sale, at the counter or online, goes
 * above them. NPPA publishes notifications, not a feed, so each value is
 * typed in or imported from a sheet (code, ceiling, notification).
 */
export function NppaCeilingsPage() {
  useRequirePermission(P.PHARMACY.NPPA.MANAGE);
  const canManage = useHasPermission(P.PHARMACY.NPPA.MANAGE);
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const list = useQuery({
    queryKey: ["nppa-ceilings", q],
    queryFn: () => storefrontService.listNppaCeilings(q || undefined),
    enabled: canManage,
  });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["nppa-ceilings"] });
  const set = useMutation({
    mutationFn: ({ id, price }: { id: string; price: number | null }) =>
      storefrontService.setNppaCeiling(id, { ceiling_price: price }),
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message, { title: "Ceiling not saved" }),
  });
  const upload = useMutation({
    mutationFn: async (file: File) => {
      const { rows, problems } = parseNppaSheet(await file.text());
      if (problems.length > 0) throw new Error(problems.slice(0, 3).join("; "));
      return storefrontService.importNppaCeilings(rows);
    },
    onSuccess: (r) => {
      toast.success(
        r.unmatched.length
          ? `No item with code: ${r.unmatched.slice(0, 10).join(", ")}`
          : "All matched",
        { title: `${r.updated} ceilings imported` },
      );
      refresh();
    },
    onError: (e: Error) => toast.error(e.message, { title: "Not imported" }),
  });
  const columns = [
    {
      key: "item",
      label: "Item",
      render: (r: NppaCeilingRow) => (
        <Text size="sm">
          {r.name} {r.strength ?? ""} · {r.code}
        </Text>
      ),
    },
    {
      key: "mrp",
      label: "MRP",
      render: (r: NppaCeilingRow) => <Text size="sm">{r.mrp ? `₹${r.mrp}` : "—"}</Text>,
    },
    {
      key: "ceiling",
      label: "NPPA ceiling (₹)",
      render: (r: NppaCeilingRow) => (
        <NumberField
          aria-label={`NPPA ceiling for ${r.name}`}
          w={120}
          min={0}
          decimalScale={2}
          value={r.nppa_ceiling_price ? Number(r.nppa_ceiling_price) : ""}
          onBlur={(e) => {
            const raw = e.currentTarget.value.trim();
            const price = raw === "" ? null : Number(raw);
            if (price !== null && (!Number.isFinite(price) || price <= 0)) return;
            if (
              String(price ?? "") !==
              String(r.nppa_ceiling_price ? Number(r.nppa_ceiling_price) : "")
            ) {
              set.mutate({ id: r.id, price });
            }
          }}
        />
      ),
    },
    {
      key: "source",
      label: "From",
      render: (r: NppaCeilingRow) => (
        <Text size="xs">
          {[r.nppa_ceiling_source, r.nppa_notification].filter(Boolean).join(" · ")}
        </Text>
      ),
    },
  ];
  return (
    <Stack>
      <PageHeader
        title="NPPA ceiling prices"
        subtitle="Nothing is sold above the notified ceiling"
        icon={<IconReceiptTax size={20} stroke={1.5} />}
      />
      {list.data && (
        <Alert tone="info" title="Transcribed, not a live feed">
          {list.data.source_note}
        </Alert>
      )}
      <Group align="flex-end">
        <Input label="Search" value={q} onChange={(e) => setQ(e.currentTarget.value)} />
        <FileInput
          label="Import a sheet"
          description="CSV: code, ceiling price, notification"
          accept=".csv,text/csv"
          leftSection={<IconUpload size={16} />}
          onChange={(f) => f && upload.mutate(f)}
        />
      </Group>
      {list.isError ? (
        <Alert tone="danger" title="Ceilings could not be loaded">
          This is not an empty list. Try again in a moment.
        </Alert>
      ) : (
        <DataTable
          columns={columns}
          data={list.data?.rows ?? []}
          loading={list.isLoading}
          rowKey={(r) => r.id}
          emptyTitle="No items"
        />
      )}
    </Stack>
  );
}
