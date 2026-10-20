import { Box, Group, Stack, Text } from "@mantine/core";
import { useHotkeys } from "@mantine/hooks";
import { useHasPermission } from "@medbrains/stores";
import type { CollectRequest, CollectResult, PatientDues } from "@medbrains/types";
import { P } from "@medbrains/types";
import {
  IconCash,
  IconCreditCard,
  IconLink,
  IconPlus,
  IconQrcode,
  IconShieldCheck,
  IconWallet,
  IconWorld,
  IconX,
} from "@tabler/icons-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { type ReactNode, useRef, useState } from "react";
import { useClinicalEmit } from "@/components/ClinicalEventProvider";
import { Alert, Badge, Button, NumberField, TileGroup } from "@/components/ui";
import { useCounterStation } from "@/hooks/useCounterStation";
import { usePatientContext } from "@/hooks/usePatientContext";
import { billingService } from "@/services/billing.service";
import { paymentsService } from "@/services/payments.service";
import { CollectDone, useReceiptPrinter } from "./CollectDone";
import { CollectScope } from "./CollectScope";
import { CustomerDisplayBar } from "./CustomerDisplayBar";
import {
  billsDue,
  buildCollectRequest,
  type CollectScopeChoice,
  cashChange,
  currentPart,
  focusBills,
  outcomeOf,
  remainingAfter,
  rupees,
  type TenderPart,
  tendersOf,
  toPaise,
} from "./collect-math";
import type { CollectTarget } from "./collect-store";
import { displayLines, useDisplayFeed, useMirrorToDisplay } from "./customer-display";
import { TenderBody } from "./TenderBody";
import {
  CHECKOUT_PROVIDERS,
  readLastTile,
  rememberTile,
  startTile,
  type TenderTile,
  TILE_KEY,
  TILE_LABEL,
  usableTiles,
} from "./tender-tiles";
import { LANE_LABEL, useInvalidateDues, useStillOpenBills } from "./use-dues";

const TILE_ICON: Record<TenderTile, ReactNode> = {
  cash: <IconCash size={20} />,
  card: <IconCreditCard size={20} />,
  upi: <IconQrcode size={20} />,
  link: <IconLink size={20} />,
  online: <IconWorld size={20} />,
  advance: <IconWallet size={20} />,
  credit: <IconShieldCheck size={20} />,
};

const newKey = () => crypto.randomUUID();

/** The counter's free-text label, which day close still tallies by. */
function counterLabel(): string | undefined {
  try {
    return localStorage.getItem("billing.counter")?.trim() || undefined;
  } catch {
    return undefined;
  }
}

export interface BodyProps {
  target: CollectTarget;
  dues: PatientDues | null;
  onClose: () => void;
}

export function CollectBody({ target, dues, onClose }: BodyProps) {
  const sale = target.sale;
  const emit = useClinicalEmit();
  const invalidate = useInvalidateDues();
  const stillOpen = useStillOpenBills();
  const printer = useReceiptPrinter();
  const [stationId] = useCounterStation();
  const canUseGateway = useHasPermission(P.BILLING.PAYMENTS_CREATE);
  const canCross = useHasPermission(P.BILLING.COLLECT_CROSS);
  const canApplyDeposit = useHasPermission(P.BILLING.ADVANCES_ADJUST);
  const context = usePatientContext(target.patientId).data;
  const providers = useQuery({
    queryKey: ["payment-providers"],
    queryFn: paymentsService.listPaymentProviders,
    enabled: canUseGateway,
    staleTime: 300_000,
  });
  const provider = providers.data?.providers.find((p) => p.active);
  const deposits = useQuery({
    queryKey: ["counter-advances", target.patientId],
    queryFn: () => billingService.listAdvances({ patient_id: target.patientId ?? "" }),
    enabled: !sale && canApplyDeposit && Boolean(target.patientId),
  });

  const [scope, setScope] = useState<CollectScopeChoice>("focus");
  // The drawer collects what it showed: a gateway payment posting on a bill
  // mid-collection must not shrink the due it is counted against.
  const [snapshot, setSnapshot] = useState(dues);
  const allBills = snapshot?.bills ?? [];
  const focused = focusBills(allBills, target);
  const bills = scope === "all" ? allBills : focused;
  const due = sale ? sale.amount : billsDue(bills);
  const tiles = usableTiles({
    isSale: Boolean(sale),
    cashAllowed: sale ? sale.cashAllowed : true,
    canUseGateway,
    providerCheckout: Boolean(provider?.has_adapter && CHECKOUT_PROVIDERS.has(provider.provider)),
    billCount: bills.length,
    hasDraft: bills.some((b) => b.status === "draft"),
    canApplyDeposit,
    depositBalance: (deposits.data ?? []).reduce((s, a) => s + Number(a.balance), 0),
    creditAllowed: sale?.creditAllowed ?? false,
    isInsured: Boolean(context?.primary_insurance),
  });
  const [tile, setTile] = useState<TenderTile | null>(() =>
    startTile(tiles, readLastTile(stationId)),
  );
  const [parts, setParts] = useState<TenderPart[]>([]);
  const [override, setOverride] = useState<number | string | null>(null);
  const [tendered, setTendered] = useState<number | string>("");
  const [reference, setReference] = useState("");
  const [key, setKey] = useState(newKey);
  const [result, setResult] = useState<CollectResult | null>(null);
  const [saleError, setSaleError] = useState<string | null>(null);

  const remaining = remainingAfter(due, parts);
  const amount = override === null ? remaining : Number(override) || 0;
  const current = currentPart(tile, amount, tendered, reference, Boolean(sale));
  const toSend = current ? [...parts, current] : parts;
  const total = toSend.reduce((s, p) => s + p.amount, 0);
  const over = !sale && toPaise(total) > toPaise(due);
  const blocked = bills.some((b) => !b.can_collect);
  const cashOk = tiles.some((t) => t.tile === "cash");
  useMirrorToDisplay({
    stationId,
    attempt: key,
    patientName: context?.full_name,
    lines: sale
      ? [{ label: target.focusLabel ?? "Counter sale", amount_paise: toPaise(due) }]
      : displayLines(bills),
    totalDue: due,
    tender: tile,
    amount,
  });
  const showPaid = (total: number) =>
    useDisplayFeed.getState().send({
      type: "paid",
      amount_paise: toPaise(total),
      change_paise: toPaise(cashChange(toSend)),
    });

  const finish = (done: CollectResult) => {
    setResult(done);
    showPaid(Number(done.total_amount));
    if (tile) rememberTile(stationId, tile);
    invalidate(target.patientId);
    for (const p of done.payments) {
      emit("billing.payment.received", {
        amount: Number(p.amount),
        invoice_id: p.invoice_id,
        mode: p.mode,
        patient_id: target.patientId,
        payment_id: p.id,
      });
    }
    if (printer.canPrint && done.receipts.length > 0) printer.print.mutate(done.receipts);
    target.onCollected?.(done);
  };
  // One request per attempt, rebuilt only when what is paid changes: a retry
  // after a lost answer sends the very same body, which the server replays.
  const built = useRef<{ tag: string; body: CollectRequest } | null>(null);
  const requestFor = async (send: TenderPart[]): Promise<CollectRequest> => {
    const tag = `${key}|${JSON.stringify(tendersOf(send))}`;
    if (built.current?.tag === tag) return built.current.body;
    // A gateway or machine payment may already have paid a bill in full;
    // the collection covers the bills still open now.
    const open = send.some((p) => p.gatewayTransactionId)
      ? await stillOpen(target.patientId ?? "", bills)
      : bills;
    const body = {
      ...buildCollectRequest({
        patientId: target.patientId ?? "",
        focus: target,
        scope,
        bills: open,
        parts: send,
        idempotencyKey: key,
        stationId,
      }),
      counter_id: counterLabel(),
    };
    built.current = { tag, body };
    return body;
  };
  const collect = useMutation({
    mutationFn: async (send: TenderPart[]) => billingService.collectPayment(await requestFor(send)),
    onSuccess: finish,
  });
  const paySale = useMutation({
    mutationFn: (send: TenderPart[]) =>
      (sale as NonNullable<typeof sale>).pay(
        tendersOf(send).map((t, i) =>
          t.mode === "cash" ? { ...t, amount: send[i]?.tendered ?? t.amount } : t,
        ),
      ),
    onSuccess: () => {
      if (tile) rememberTile(stationId, tile);
      showPaid(total);
      onClose();
    },
    onError: (e: Error) => setSaleError(e.message),
  });
  const busy = collect.isPending || paySale.isPending;
  const submit = (send: TenderPart[]) => {
    if (busy || send.length === 0 || over || blocked) return;
    setSaleError(null);
    if (sale) paySale.mutate(send);
    else collect.mutate(send);
  };
  const resetEntry = () => {
    setOverride(null);
    setTendered("");
    setReference("");
  };
  const onApproved = (part: TenderPart) => {
    if (part.mode === "card")
      useDisplayFeed
        .getState()
        .send({ type: "card_status", status: "approved", amount_paise: toPaise(part.amount) });
    const next = [...parts, part];
    setParts(next);
    resetEntry();
    if (remainingAfter(due, next) <= 0) submit(next);
    // The rest is usually cash; the machine's panel has done its part.
    else if (cashOk) setTile("cash");
  };
  const exactCash = () => {
    if (!cashOk || remaining <= 0) return;
    setTile("cash");
    submit([...parts, { id: "cash", mode: "cash", amount: remaining, label: "Cash" }]);
  };
  // Shift+Enter anywhere in the drawer, even in a field: the rest, in cash.
  useHotkeys(result ? [] : [["shift+Enter", exactCash, { preventDefault: true }]], []);
  // Focus lands on the amount once, when the dues arrive, so Enter collects.
  const amountFocused = useRef(false);
  const focusAmount = (el: HTMLInputElement | null) => {
    if (el && !amountFocused.current) {
      amountFocused.current = true;
      el.focus();
    }
  };

  if (result) {
    return (
      <CollectDone
        result={result}
        outcome={outcomeOf(due, Number(result.total_amount))}
        change={cashChange(toSend)}
        printer={printer}
        onNext={() => {
          setSnapshot(dues);
          setResult(null);
          setParts([]);
          resetEntry();
          setKey(newKey());
        }}
        onClose={onClose}
      />
    );
  }

  const error = collect.error?.message ?? saleError;
  return (
    <Box
      component="form"
      onSubmit={(e) => {
        e.preventDefault();
        submit(toSend);
      }}
    >
      <Stack gap="md">
        <CustomerDisplayBar stationId={stationId} />
        {provider && canUseGateway && (
          <Group gap="xs">
            <Badge tone="neutral">{provider.label}</Badge>
            {(provider.mode === "sandbox" || provider.mode === "test") && (
              <Badge tone="warning">Test mode</Badge>
            )}
          </Group>
        )}
        {snapshot && (
          <CollectScope
            focusLabel={
              target.focusLabel ?? (target.lane ? LANE_LABEL[target.lane] : "This patient")
            }
            focusBills={focused}
            allBills={allBills}
            canChooseAll={canCross && allBills.length > focused.length}
            scope={scope}
            onScope={(s) => {
              setScope(s);
              setOverride(null);
            }}
            disabled={parts.length > 0}
          />
        )}
        {blocked && (
          <Alert tone="warning" title="Another desk collects some of these bills">
            Your desk collects its own department&apos;s bills. Send the patient to the billing
            counter for the rest.
          </Alert>
        )}
        {due <= 0 ? (
          <Alert tone="success" title="Nothing due">
            Nothing is due {scope === "all" ? "from this patient" : "here"}.
          </Alert>
        ) : (
          <>
            <NumberField
              label={`Amount (due ${rupees(remaining)})`}
              value={amount}
              onChange={setOverride}
              min={0}
              max={sale ? undefined : remaining}
              decimalScale={2}
              prefix="₹"
              size="md"
              ref={focusAmount}
              error={over ? `More than is due, by ${rupees(total - due)}` : undefined}
            />
            <TileGroup
              label="Way of paying"
              data={tiles.map((t) => ({
                value: t.tile,
                label: TILE_LABEL[t.tile],
                hint: t.hint,
                icon: TILE_ICON[t.tile],
                disabled: t.disabled,
                hotkey: TILE_KEY[t.tile],
              }))}
              value={tile}
              onChange={(v) => setTile(v as TenderTile)}
              cols={3}
            />
            {tile && (
              <TenderBody
                tile={tile}
                amount={amount}
                patientId={target.patientId}
                patientName={context?.full_name}
                invoiceId={bills.length === 1 ? bills[0]?.invoice_id : undefined}
                bills={bills}
                isSale={Boolean(sale)}
                canUseGateway={canUseGateway}
                provider={provider}
                tendered={tendered}
                onTendered={setTendered}
                reference={reference}
                onReference={setReference}
                onApproved={onApproved}
                onUseTile={setTile}
                onMoneyPosted={() => invalidate(target.patientId)}
              />
            )}
          </>
        )}
        {parts.length > 0 && (
          <Stack gap={4} aria-live="polite">
            {parts.map((p) => (
              <Group key={p.id} justify="space-between" data-testid="collect-part">
                <Text size="sm">
                  {p.label}
                  {p.gatewayTransactionId ? " · approved" : ""}
                </Text>
                <Group gap={4}>
                  <Text size="sm" ff="monospace">
                    {rupees(p.amount)}
                  </Text>
                  {!p.gatewayTransactionId && (
                    <Button
                      tone="ghost"
                      size="xs"
                      aria-label={`Remove ${p.label} ${rupees(p.amount)}`}
                      onClick={() => setParts(parts.filter((x) => x.id !== p.id))}
                    >
                      <IconX size={14} />
                    </Button>
                  )}
                </Group>
              </Group>
            ))}
          </Stack>
        )}
        <Group justify="space-between">
          <Button
            tone="ghost"
            size="xs"
            leftSection={<IconPlus size={14} />}
            disabled={!current || toPaise(current.amount) >= toPaise(remaining)}
            onClick={() => {
              if (!current) return;
              setParts([...parts, { ...current, id: newKey() }]);
              resetEntry();
            }}
          >
            Add another way
          </Button>
          <Text size="sm" aria-live="polite" data-testid="collect-remaining">
            Remaining {rupees(remaining)}
          </Text>
        </Group>
        {error && (
          <Alert tone="danger" title="Not collected">
            {error} Press Collect again — it will not be charged twice.
          </Alert>
        )}
        <Button
          type="submit"
          tone="primary"
          size="md"
          fullWidth
          loading={busy}
          disabled={toSend.length === 0 || over || blocked || due <= 0}
        >
          Collect {rupees(total)}
        </Button>
        {cashOk && due > 0 && (
          <Text size="xs" c="dimmed" ta="center">
            Enter collects · Shift+Enter takes {rupees(remaining)} in cash
          </Text>
        )}
      </Stack>
    </Box>
  );
}
