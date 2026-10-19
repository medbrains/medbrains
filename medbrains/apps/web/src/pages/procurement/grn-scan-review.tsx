// The scanned bill beside the draft the reader made of it (#4861). The reviewer
// corrects the draft, matches each line to the catalogue, and commits: that
// one action writes and posts the GRN, so stock moves only then.

import { zodResolver } from "@hookform/resolvers/zod";
import { Anchor, Box, Group, SimpleGrid, Stack, Text } from "@mantine/core";
import type { GrnScanDraftFormInput } from "@medbrains/schemas";
import { grnScanDraftFormSchema } from "@medbrains/schemas";
import type { GrnScanReview } from "@medbrains/types";
import { ValidationError } from "@medbrains/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { Alert, Button, Card, Checkbox, Image, Input, Select, toast } from "@/components/ui";
import { grnScanService } from "@/services/grnScan.service";
import { procurementService } from "@/services/procurement.service";
import { ScanLineCard } from "./grn-scan-line";
import { fromForm, groupIssues, parseLinePath, suggestionsFor, toForm } from "./grn-scan-logic";

const RECEIVABLE = new Set(["sent_to_vendor", "partially_received"]);

function BillImage({ review }: { review: GrnScanReview }) {
  if (!review.image_url) {
    return (
      <Alert tone="warning">
        The bill image is not available: this server has no file storage configured. Do not commit a
        bill you cannot check against the original.
      </Alert>
    );
  }
  if (review.scan.mime_type === "application/pdf") {
    return (
      <Stack gap="xs">
        <Anchor href={review.image_url} target="_blank" rel="noreferrer">
          Open the bill (PDF) in a new tab
        </Anchor>
        <Box component="iframe" src={review.image_url} title="Supplier bill" h={720} w="100%" />
      </Stack>
    );
  }
  return <Image src={review.image_url} alt="Scanned supplier bill" fit="contain" mah={760} />;
}

function Findings({ review, headerMessages }: { review: GrnScanReview; headerMessages: string[] }) {
  return (
    <Stack gap="xs">
      {review.duplicate_grn && (
        <Alert tone="danger" title="Already entered">
          This invoice is already on GRN {review.duplicate_grn}. Committing it would be refused;
          discard this scan.
        </Alert>
      )}
      {review.near_duplicates.length > 0 && (
        <Alert tone="warning" title="A similar bill was entered">
          {review.near_duplicates
            .map(
              (d) => `${d.grn_number} (${d.invoice_number ?? "no number"}, ₹${d.invoice_amount})`,
            )
            .join("; ")}
          . Check this is not the same bill.
        </Alert>
      )}
      {review.qr_mismatches.length > 0 && (
        <Alert tone="warning" title="The e-invoice QR disagrees with what was read">
          {review.qr_mismatches.join(". ")}
        </Alert>
      )}
      {headerMessages.map((m) => (
        <Alert key={m} tone="danger">
          {m}
        </Alert>
      ))}
    </Stack>
  );
}

interface ReviewFormProps {
  review: GrnScanReview;
  canPost: boolean;
  onCommitted: () => void;
}

function ReviewForm({ review, canPost, onCommitted }: ReviewFormProps) {
  const qc = useQueryClient();
  const form = useForm<GrnScanDraftFormInput>({
    resolver: zodResolver(grnScanDraftFormSchema),
    defaultValues: toForm(review.draft),
  });
  const { control, handleSubmit, setError, formState } = form;
  const lines = useFieldArray({ control, name: "lines" });
  const vendorId = useWatch({ control, name: "vendor_id" });
  const issues = useMemo(() => groupIssues(review.issues), [review.issues]);
  const repeats = useMemo(
    () => new Map(review.repeated_lines.map((r) => [r.line, r.repeats])),
    [review.repeated_lines],
  );

  const pos = useQuery({
    queryKey: ["purchase-orders", "receivable-all"],
    queryFn: () => procurementService.listPurchaseOrders({ per_page: "100" }),
  });
  const stores = useQuery({
    queryKey: ["store-locations"],
    queryFn: () => procurementService.listStoreLocations(),
  });
  const poOptions = (pos.data?.purchase_orders ?? [])
    .filter((po) => RECEIVABLE.has(po.status) && (!vendorId || po.vendor_id === vendorId))
    .map((po) => ({ value: po.id, label: `${po.po_number} · ₹${po.total_amount}` }));

  const applyServerErrors = (e: unknown) => {
    if (!(e instanceof ValidationError)) return false;
    for (const [path, messages] of Object.entries(e.fields)) {
      const at = parseLinePath(path);
      const message = messages.join(" ");
      if (at)
        setError(`lines.${at.line}.${at.field}` as `lines.${number}.batch_number`, { message });
      else toast.error(message, { title: "Check the bill" });
    }
    return true;
  };

  const save = useMutation({
    mutationFn: (values: GrnScanDraftFormInput) =>
      grnScanService.saveDraft(review.scan.id, fromForm(values, review.draft)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["grn-scan-review", review.scan.id] });
      toast.success("Corrections saved", { title: "Bill review" });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Not saved" }),
  });
  const commit = useMutation({
    mutationFn: async (values: GrnScanDraftFormInput) => {
      await grnScanService.saveDraft(review.scan.id, fromForm(values, review.draft));
      return grnScanService.commitScan(review.scan.id, {
        remember_matches: values.remember_matches,
      });
    },
    onSuccess: (result) => {
      toast.success(`Posted as GRN ${result.grn.grn_number}. The stock is in the store.`, {
        title: "Bill committed",
      });
      for (const key of [["grns"], ["grn-scan-accuracy"], ["purchase-orders"]]) {
        void qc.invalidateQueries({ queryKey: key });
      }
      onCommitted();
    },
    onError: (e: Error) => {
      if (!applyServerErrors(e)) toast.error(e.message, { title: "Not committed" });
      void qc.invalidateQueries({ queryKey: ["grn-scan-review", review.scan.id] });
    },
  });

  const h = review.draft.header;
  const busy = save.isPending || commit.isPending;
  const headerMessages = (issues.get("header") ?? []).map((m) => m.message);

  return (
    <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
      <Card withBorder padding="sm">
        <BillImage review={review} />
      </Card>
      <Stack component="form" gap="sm" onSubmit={handleSubmit((v) => commit.mutate(v))}>
        <Findings review={review} headerMessages={headerMessages} />
        <Text size="sm">
          Supplier on the bill: {h.supplier_name ?? "not read"}
          {h.supplier_gstin ? ` · GSTIN ${h.supplier_gstin}` : ""}
          {vendorId ? "" : " — not matched to a supplier; choose its purchase order"}
        </Text>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
          <Controller
            control={control}
            name="po_id"
            render={({ field }) => (
              <Select
                label="Purchase order"
                data={poOptions}
                value={field.value || null}
                onChange={(v) => {
                  field.onChange(v ?? "");
                  const po = pos.data?.purchase_orders.find((p) => p.id === v);
                  if (po) form.setValue("vendor_id", po.vendor_id);
                }}
                searchable
                error={formState.errors.po_id?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="store_location_id"
            render={({ field }) => (
              <Select
                label="Receive into store"
                data={(stores.data ?? [])
                  .filter((s) => s.is_active)
                  .map((s) => ({ value: s.id, label: s.name }))}
                value={field.value || null}
                onChange={(v) => field.onChange(v ?? "")}
              />
            )}
          />
          {(["invoice_number", "invoice_date", "invoice_amount"] as const).map((name) => (
            <Controller
              key={name}
              control={control}
              name={name}
              render={({ field }) => (
                <Input
                  label={
                    {
                      invoice_number: "Invoice no.",
                      invoice_date: "Invoice date",
                      invoice_amount: "Bill total (₹)",
                    }[name]
                  }
                  type={name === "invoice_date" ? "date" : undefined}
                  value={String(field.value ?? "")}
                  onChange={(e) => field.onChange(e.currentTarget.value)}
                  error={formState.errors[name]?.message}
                />
              )}
            />
          ))}
        </SimpleGrid>
        {lines.fields.map((line, idx) => (
          <ScanLineCard
            key={line.id}
            control={control}
            idx={idx}
            sourceIndex={line.source_index}
            readName={review.draft.lines[line.source_index]?.product_name ?? ""}
            suggestions={suggestionsFor(review.suggestions, idx)}
            messages={issues}
            confidence={review.draft.confidence}
            threshold={review.auto_tick_confidence}
            repeats={repeats.get(idx) ?? null}
            errors={formState.errors}
            disabled={busy}
            onRemove={() => lines.remove(idx)}
          />
        ))}
        <Controller
          control={control}
          name="remember_matches"
          render={({ field }) => (
            <Checkbox
              label="Remember these item matches for this supplier"
              checked={field.value}
              onChange={(e) => field.onChange(e.currentTarget.checked)}
            />
          )}
        />
        <Group justify="flex-end">
          <Button
            tone="secondary"
            loading={save.isPending}
            disabled={busy}
            onClick={handleSubmit((v) => save.mutate(v))}
          >
            Save corrections
          </Button>
          {canPost && (
            <Button
              type="submit"
              tone="primary"
              loading={commit.isPending}
              disabled={busy || !review.image_url || Boolean(review.duplicate_grn)}
            >
              Commit and post to stock
            </Button>
          )}
        </Group>
      </Stack>
    </SimpleGrid>
  );
}

interface GrnScanReviewPanelProps {
  scanId: string;
  canPost: boolean;
  onCommitted: () => void;
}

export function GrnScanReviewPanel({ scanId, canPost, onCommitted }: GrnScanReviewPanelProps) {
  const { data, error, isLoading } = useQuery({
    queryKey: ["grn-scan-review", scanId],
    queryFn: () => grnScanService.getReview(scanId),
  });
  if (error) return <Alert tone="danger">The bill could not be loaded: {error.message}</Alert>;
  if (isLoading || !data) return <Text>Loading the bill…</Text>;
  // A saved draft is a new starting point for the form.
  return (
    <ReviewForm
      key={data.scan.updated_at}
      review={data}
      canPost={canPost}
      onCommitted={onCommitted}
    />
  );
}
