import { useState } from "react";
import {
  Badge,
  Button,
  Card,
  Group,
  Modal,
  NumberInput,
  Stack,
  Tabs,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import { P } from "@medbrains/types";
import { PageHeader } from "../components";
import { useRequirePermission } from "../hooks/useRequirePermission";

interface CashDrawerRow {
  id: string;
  pharmacy_location_id: string;
  cashier_user_id: string;
  opened_at: string;
  opening_float: string;
  closed_at?: string | null;
  expected_close_amount?: string | null;
  actual_close_amount?: string | null;
  variance?: string | null;
  status: string;
}

interface PettyCashRow {
  id: string;
  category: string;
  amount: string;
  paid_to: string;
  status: string;
  created_at: string;
}

interface SupplierPaymentRow {
  id: string;
  supplier_id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  gross_amount: string;
  net_payable: string;
  status: string;
  paid_at?: string | null;
}

const drawerStatusColor: Record<string, string> = {
  open: "green",
  closed: "gray",
  variance_pending_signoff: "orange",
  reopened: "blue",
};

export function PharmacyFinancePage() {
  useRequirePermission(P.PHARMACY_FINANCE.CASH_DRAWER_VIEW);
  const [tab, setTab] = useState<string>("cash-drawer");

  return (
    <div>
      <PageHeader
        title="Pharmacy Finance"
        subtitle="Day-end close, petty cash, free dispensings, supplier payments"
      />
      <Tabs value={tab} onChange={(v) => v && setTab(v)} variant="outline">
        <Tabs.List>
          <Tabs.Tab value="cash-drawer">Cash Drawer</Tabs.Tab>
          <Tabs.Tab value="petty-cash">Petty Cash</Tabs.Tab>
          <Tabs.Tab value="supplier-payments">Supplier Payments</Tabs.Tab>
          <Tabs.Tab value="free-dispensing">Free Dispensing</Tabs.Tab>
          <Tabs.Tab value="margins">Margins</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="cash-drawer" pt="md">
          <CashDrawerTab />
        </Tabs.Panel>
        <Tabs.Panel value="petty-cash" pt="md">
          <PettyCashTab />
        </Tabs.Panel>
        <Tabs.Panel value="supplier-payments" pt="md">
          <SupplierPaymentsTab />
        </Tabs.Panel>
        <Tabs.Panel value="free-dispensing" pt="md">
          <Text c="dimmed">Free dispensings audit list — read via /api/pharmacy/free-dispensings.</Text>
        </Tabs.Panel>
        <Tabs.Panel value="margins" pt="md">
          <Text c="dimmed">Daily drug margins — read via /api/pharmacy/drug-margins/daily.</Text>
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}

// ── Cash Drawer Tab ─────────────────────────────────────────────────

function CashDrawerTab() {
  const qc = useQueryClient();
  const [openModal, setOpenModal] = useState(false);
  const [closeFor, setCloseFor] = useState<CashDrawerRow | null>(null);

  const { data: active } = useQuery({
    queryKey: ["cash-drawer", "active"],
    queryFn: () => api.getMyActiveCashDrawer() as Promise<CashDrawerRow | null>,
  });
  const { data: list } = useQuery({
    queryKey: ["cash-drawers"],
    queryFn: () => api.listCashDrawers({ limit: 50 }) as Promise<CashDrawerRow[]>,
  });

  return (
    <Stack>
      {active ? (
        <Card withBorder padding="md">
          <Group justify="space-between">
            <Stack gap={2}>
              <Group gap="xs">
                <Badge color={drawerStatusColor[active.status] ?? "gray"}>{active.status}</Badge>
                <Text fw={600}>Drawer {active.id.slice(0, 8)}</Text>
              </Group>
              <Text size="sm" c="dimmed">
                Opened {new Date(active.opened_at).toLocaleString()} · Float ₹{active.opening_float}
              </Text>
            </Stack>
            <Button color="red" onClick={() => setCloseFor(active)}>
              Close drawer
            </Button>
          </Group>
        </Card>
      ) : (
        <Card withBorder padding="md">
          <Group justify="space-between">
            <Text>No active drawer.</Text>
            <Button onClick={() => setOpenModal(true)}>Open drawer</Button>
          </Group>
        </Card>
      )}

      <Stack gap="xs">
        <Text fw={600}>Recent drawers</Text>
        {list?.map((row) => (
          <Card key={row.id} withBorder padding="sm">
            <Group justify="space-between">
              <Group gap="xs">
                <Badge color={drawerStatusColor[row.status] ?? "gray"}>{row.status}</Badge>
                <Text>Opened {new Date(row.opened_at).toLocaleDateString()}</Text>
              </Group>
              <Text>
                Float ₹{row.opening_float}
                {row.actual_close_amount && ` · Closed ₹${row.actual_close_amount}`}
                {row.variance && ` · Var ₹${row.variance}`}
              </Text>
            </Group>
          </Card>
        ))}
      </Stack>

      <OpenDrawerModal
        opened={openModal}
        onClose={() => setOpenModal(false)}
        onOpened={() => {
          qc.invalidateQueries({ queryKey: ["cash-drawer"] });
          qc.invalidateQueries({ queryKey: ["cash-drawers"] });
        }}
      />
      <CloseDrawerModal
        drawer={closeFor}
        onClose={() => setCloseFor(null)}
        onClosed={() => {
          qc.invalidateQueries({ queryKey: ["cash-drawer"] });
          qc.invalidateQueries({ queryKey: ["cash-drawers"] });
        }}
      />
    </Stack>
  );
}

function OpenDrawerModal({
  opened,
  onClose,
  onOpened,
}: {
  opened: boolean;
  onClose: () => void;
  onOpened: () => void;
}) {
  const [locationId, setLocationId] = useState("");
  const [openingFloat, setOpeningFloat] = useState<number>(0);
  const [notes, setNotes] = useState("");

  const open = useMutation({
    mutationFn: () =>
      api.openCashDrawer({
        pharmacy_location_id: locationId,
        opening_float: openingFloat,
        notes: notes || undefined,
      }),
    onSuccess: () => {
      onOpened();
      onClose();
    },
  });

  return (
    <Modal opened={opened} onClose={onClose} title="Open cash drawer">
      <Stack>
        <TextInput
          label="Pharmacy location ID"
          value={locationId}
          onChange={(e) => setLocationId(e.currentTarget.value)}
          placeholder="UUID"
          required
        />
        <NumberInput
          label="Opening float (₹)"
          value={openingFloat}
          onChange={(v) => setOpeningFloat(typeof v === "number" ? v : 0)}
          min={0}
          step={100}
        />
        <Textarea label="Notes" value={notes} onChange={(e) => setNotes(e.currentTarget.value)} minRows={2} />
        <Group justify="flex-end">
          <Button
            onClick={() => open.mutate()}
            loading={open.isPending}
            disabled={!locationId || openingFloat < 0}
          >
            Open
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function CloseDrawerModal({
  drawer,
  onClose,
  onClosed,
}: {
  drawer: CashDrawerRow | null;
  onClose: () => void;
  onClosed: () => void;
}) {
  const [actual, setActual] = useState<number>(0);
  const [reason, setReason] = useState("");

  const close = useMutation({
    mutationFn: () => {
      if (!drawer) throw new Error("no drawer");
      return api.closeCashDrawer(drawer.id, {
        actual_close_amount: actual,
        variance_reason: reason || undefined,
      });
    },
    onSuccess: () => {
      onClosed();
      onClose();
      setActual(0);
      setReason("");
    },
  });

  return (
    <Modal opened={drawer !== null} onClose={onClose} title="Close cash drawer">
      <Stack>
        <Text size="sm" c="dimmed">
          Opening float: ₹{drawer?.opening_float ?? "0"}. Variance &gt; ₹100 requires sign-off.
        </Text>
        <NumberInput
          label="Actual cash counted (₹)"
          value={actual}
          onChange={(v) => setActual(typeof v === "number" ? v : 0)}
          min={0}
          step={100}
        />
        <Textarea
          label="Variance reason (optional)"
          value={reason}
          onChange={(e) => setReason(e.currentTarget.value)}
          minRows={2}
        />
        <Group justify="flex-end">
          <Button onClick={() => close.mutate()} loading={close.isPending} disabled={actual < 0}>
            Close
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

// ── Petty Cash Tab ──────────────────────────────────────────────────

function PettyCashTab() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["petty-cash"],
    queryFn: () => api.listPettyCash({ limit: 100 }) as Promise<PettyCashRow[]>,
  });
  const decide = useMutation({
    mutationFn: (vars: { id: string; approved: boolean }) =>
      api.decidePettyCash(vars.id, { approved: vars.approved }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["petty-cash"] }),
  });

  return (
    <Stack gap="xs">
      {data?.map((row) => (
        <Card key={row.id} withBorder padding="sm">
          <Group justify="space-between">
            <Group gap="xs">
              <Badge color={row.status === "approved" ? "green" : row.status === "rejected" ? "red" : "yellow"}>
                {row.status}
              </Badge>
              <Text fw={500}>{row.category}</Text>
              <Text>₹{row.amount}</Text>
              <Text c="dimmed">→ {row.paid_to}</Text>
            </Group>
            {row.status === "pending" && (
              <Group>
                <Button size="xs" color="green" onClick={() => decide.mutate({ id: row.id, approved: true })}>
                  Approve
                </Button>
                <Button size="xs" color="red" variant="light" onClick={() => decide.mutate({ id: row.id, approved: false })}>
                  Reject
                </Button>
              </Group>
            )}
          </Group>
        </Card>
      ))}
      {data?.length === 0 && <Text c="dimmed">No vouchers.</Text>}
    </Stack>
  );
}

// ── Supplier Payments Tab ───────────────────────────────────────────

function SupplierPaymentsTab() {
  const [overdueOnly, setOverdueOnly] = useState(false);

  const { data } = useQuery({
    queryKey: ["supplier-payments", overdueOnly],
    queryFn: () =>
      api.listPharmacySupplierPayments({ overdue_only: overdueOnly, limit: 100 }) as Promise<SupplierPaymentRow[]>,
  });

  return (
    <Stack>
      <Group>
        <Button
          variant={overdueOnly ? "filled" : "default"}
          color="orange"
          onClick={() => setOverdueOnly((v) => !v)}
        >
          Overdue only
        </Button>
      </Group>
      <Stack gap="xs">
        {data?.map((row) => (
          <Card key={row.id} withBorder padding="sm">
            <Group justify="space-between">
              <Stack gap={2}>
                <Group gap="xs">
                  <Badge>{row.status}</Badge>
                  <Text fw={500}>{row.invoice_number}</Text>
                </Group>
                <Text size="sm" c="dimmed">
                  Invoice {row.invoice_date} · Due {row.due_date}
                </Text>
              </Stack>
              <Text>
                Net ₹{row.net_payable} (Gross ₹{row.gross_amount})
              </Text>
            </Group>
          </Card>
        ))}
        {data?.length === 0 && <Text c="dimmed">No payments.</Text>}
      </Stack>
    </Stack>
  );
}
