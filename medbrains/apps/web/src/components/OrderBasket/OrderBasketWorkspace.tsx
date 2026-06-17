/**
 * OrderBasketWorkspace — slide-in drawer hosting the order basket.
 *
 * See `RFCs/sprints/SPRINT-order-basket.md` §5 (Frontend changes).
 */
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Divider,
  Drawer,
  Group,
  Modal,
  ScrollArea,
  Select,
  Stack,
  Tabs,
  Text,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useHasPermission, useOrderBasketStore } from "@medbrains/stores";
import { type BasketItem, P } from "@medbrains/types";
import {
  IconAlertTriangle,
  IconCheck,
  IconClock,
  IconCurrencyRupee,
  IconStack2,
} from "@tabler/icons-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "@/components/ui";
import { orderBasketService } from "@/services/orderBasket.service";
import { BasketItemRow } from "./BasketItemRow";
import { DrugPickerForm } from "./pickers/DrugPickerForm";
import { LabPickerForm } from "./pickers/LabPickerForm";
import { RadiologyPickerForm } from "./pickers/RadiologyPickerForm";
import { WarningsPanel } from "./WarningsPanel";

export type OrderBasketTab = "drug" | "lab" | "radiology";

interface OrderBasketWorkspaceProps {
  opened: boolean;
  onClose: () => void;
  encounterId: string;
  patientId: string;
  activeTab?: OrderBasketTab;
  onActiveTabChange?: (tab: OrderBasketTab) => void;
  onSigned?: () => void;
}

export function OrderBasketWorkspace({
  opened,
  onClose,
  encounterId,
  patientId,
  activeTab = "drug",
  onActiveTabChange,
  onSigned,
}: OrderBasketWorkspaceProps) {
  const basket = useOrderBasketStore();
  const canSignOrders = useHasPermission(P.ORDER_BASKET.SIGN);
  const canUseDraft = useHasPermission(P.ORDER_BASKET.DRAFT);
  const canAddDrug = useHasPermission(P.PHARMACY.DISPENSING_CREATE);
  const canAddLab = useHasPermission(P.LAB.ORDERS_CREATE);
  const canAddRadiology = useHasPermission(P.RADIOLOGY.ORDERS_CREATE);
  const [orderSetOpen, setOrderSetOpen] = useState(false);
  const [carryFwdOpen, setCarryFwdOpen] = useState(false);
  const [costPreview, setCostPreview] = useState<{
    subtotal: string;
    estimated_tax: string;
    estimated_total: string;
    preauth_threshold: string;
    exceeds_preauth: boolean;
  } | null>(null);
  const availableTabs = useMemo(
    () =>
      [
        canAddDrug ? { value: "drug" as const, label: "Drug" } : null,
        canAddLab ? { value: "lab" as const, label: "Lab" } : null,
        canAddRadiology ? { value: "radiology" as const, label: "Radiology" } : null,
      ].filter((tab): tab is { value: OrderBasketTab; label: string } => tab !== null),
    [canAddDrug, canAddLab, canAddRadiology],
  );
  const safeActiveTab = availableTabs.some((tab) => tab.value === activeTab)
    ? activeTab
    : (availableTabs[0]?.value ?? null);
  const allowedBasketKinds = useMemo(
    () =>
      new Set(
        [
          canAddDrug ? "drug" : null,
          canAddLab ? "lab" : null,
          canAddRadiology ? "radiology" : null,
        ].filter((kind): kind is BasketItem["kind"] => kind !== null),
      ),
    [canAddDrug, canAddLab, canAddRadiology],
  );

  // Sync context whenever drawer opens for a (potentially new) encounter
  useEffect(() => {
    if (opened) {
      basket.setContext(encounterId, patientId);
    }
  }, [opened, encounterId, patientId, basket.setContext]);

  // Debounced server-side check on every items change
  const checkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!opened || !canSignOrders) return;
    if (basket.items.length === 0) {
      basket.setWarnings([]);
      setCostPreview(null);
      return;
    }
    if (checkTimer.current) clearTimeout(checkTimer.current);
    checkTimer.current = setTimeout(async () => {
      basket.setChecking(true);
      try {
        const [warnRes, costRes] = await Promise.all([
          orderBasketService.checkBasket({
            encounter_id: encounterId,
            patient_id: patientId,
            items: basket.items,
          }),
          orderBasketService.previewBasketCost({ items: basket.items }),
        ]);
        basket.setWarnings(warnRes.warnings);
        setCostPreview({
          subtotal: costRes.subtotal,
          estimated_tax: costRes.estimated_tax,
          estimated_total: costRes.estimated_total,
          preauth_threshold: costRes.preauth_threshold,
          exceeds_preauth: costRes.exceeds_preauth,
        });
      } catch (err) {
        toast.error((err as Error).message, { title: "Check failed" });
      } finally {
        basket.setChecking(false);
      }
    }, 500);
    return () => {
      if (checkTimer.current) clearTimeout(checkTimer.current);
    };
  }, [
    opened,
    canSignOrders,
    basket.items,
    encounterId,
    patientId,
    basket.setChecking,
    basket.setWarnings,
  ]);

  // Load draft on open (if any)
  useEffect(() => {
    if (!opened || !canUseDraft || basket.items.length > 0) return;
    let cancelled = false;
    void (async () => {
      try {
        const draft = await orderBasketService.getBasketDraft(encounterId);
        if (!cancelled && draft && Array.isArray(draft.items) && draft.items.length > 0) {
          basket.loadDraft(draft.items as BasketItem[]);
          toast.info(`${draft.items.length} item(s) loaded from saved draft`, {
            title: "Draft loaded",
          });
        }
      } catch {
        // no draft is fine
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [opened, canUseDraft, encounterId, basket.items.length, basket.loadDraft]);

  const hasBlocks = basket.hasUnacknowledgedBlocks();
  const canSign = canSignOrders && basket.items.length > 0 && !hasBlocks && !basket.isSigning;

  const handleSign = async () => {
    basket.setSigning(true);
    try {
      const res = await orderBasketService.signBasket({
        encounter_id: encounterId,
        patient_id: patientId,
        items: basket.items,
        warnings_acknowledged: basket.warningsAcknowledged,
      });
      notifications.show({
        title: "Signed",
        message: `${res.created.length} order(s) created atomically`,
        color: "success",
        icon: <IconCheck size={16} />,
      });
      basket.clear();
      onSigned?.();
      onClose();
    } catch (err) {
      notifications.show({
        title: "Sign failed",
        message: (err as Error).message,
        color: "danger",
        icon: <IconAlertTriangle size={16} />,
      });
    } finally {
      basket.setSigning(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!canUseDraft) {
      toast.warning("You do not have permission to save order basket drafts.", {
        title: "Draft blocked",
      });
      return;
    }
    try {
      await orderBasketService.saveBasketDraft(encounterId, {
        items: basket.items,
      });
      toast.info("Basket saved — resume later from any device", { title: "Draft saved" });
    } catch (err) {
      toast.error((err as Error).message, { title: "Save failed" });
    }
  };

  const handleClear = () => {
    basket.clear();
  };

  const warningsForItem = useMemo(
    () => (idx: number) => basket.warnings.filter((w) => w.refs.includes(idx)),
    [basket.warnings],
  );

  const handleTabChange = (value: string | null) => {
    if (isOrderBasketTab(value) && availableTabs.some((tab) => tab.value === value)) {
      onActiveTabChange?.(value);
    }
  };
  const addPermittedItems = (items: BasketItem[]) => {
    const permitted = items.filter((item) => allowedBasketKinds.has(item.kind));
    if (permitted.length < items.length) {
      toast.warning("Your role cannot add every item type from this source.", {
        title: "Some orders skipped",
      });
    }
    permitted.forEach(basket.addItem);
  };

  return (
    <>
      <Drawer
        opened={opened}
        onClose={onClose}
        title={
          <Group gap="xs">
            <Text fw={600}>Order Basket</Text>
            <Badge color="primary" variant="filled">
              {basket.items.length}
            </Badge>
            {basket.isChecking && (
              <Text size="xs" c="dimmed">
                checking…
              </Text>
            )}
          </Group>
        }
        position="right"
        size="lg"
        padding="md"
        keepMounted={false}
      >
        <Stack gap="md">
          <Group gap="xs">
            <Button
              size="xs"
              variant="light"
              leftSection={<IconStack2 size={14} />}
              disabled={availableTabs.length === 0}
              onClick={() => setOrderSetOpen(true)}
            >
              Apply Order Set
            </Button>
            {canUseDraft && (
              <Button
                size="xs"
                variant="light"
                leftSection={<IconClock size={14} />}
                disabled={availableTabs.length === 0}
                onClick={() => setCarryFwdOpen(true)}
              >
                Carry Forward
              </Button>
            )}
          </Group>

          {!canSignOrders && (
            <Alert color="orange" variant="light">
              Signing the order basket requires clinical order-basket sign permission.
            </Alert>
          )}
          {availableTabs.length === 0 && (
            <Alert color="gray" variant="light">
              No order types are available for your role. Drug, lab, and radiology basket items use
              their target module create permissions.
            </Alert>
          )}

          <Tabs value={safeActiveTab} onChange={handleTabChange}>
            <Tabs.List>
              {availableTabs.map((tab) => (
                <Tabs.Tab key={tab.value} value={tab.value}>
                  {tab.label}
                </Tabs.Tab>
              ))}
              <Tabs.Tab value="diet" disabled>
                Diet
              </Tabs.Tab>
              <Tabs.Tab value="procedure" disabled>
                Procedure
              </Tabs.Tab>
              <Tabs.Tab value="referral" disabled>
                Referral
              </Tabs.Tab>
            </Tabs.List>
            {canAddDrug && (
              <Tabs.Panel value="drug" pt="xs">
                <DrugPickerForm onAdd={basket.addItem} />
              </Tabs.Panel>
            )}
            {canAddLab && (
              <Tabs.Panel value="lab" pt="xs">
                <LabPickerForm onAdd={basket.addItem} />
              </Tabs.Panel>
            )}
            {canAddRadiology && (
              <Tabs.Panel value="radiology" pt="xs">
                <RadiologyPickerForm onAdd={basket.addItem} />
              </Tabs.Panel>
            )}
          </Tabs>

          <Divider />

          {basket.items.length === 0 ? (
            <Alert color="gray" variant="light">
              No items in basket. Add a drug, lab, or radiology order to start.
            </Alert>
          ) : (
            <Stack gap="xs">
              {basket.items.map((item, idx) => (
                <BasketItemRow
                  key={basketItemKey(item)}
                  item={item}
                  index={idx}
                  warnings={warningsForItem(idx)}
                  onRemove={() => basket.removeItem(idx)}
                />
              ))}
            </Stack>
          )}

          <WarningsPanel
            warnings={basket.warnings}
            acknowledged={basket.warningsAcknowledged}
            onAcknowledge={basket.acknowledgeWarning}
          />

          {costPreview && basket.items.length > 0 && (
            <Alert
              variant={costPreview.exceeds_preauth ? "filled" : "light"}
              color={costPreview.exceeds_preauth ? "yellow" : "gray"}
              icon={<IconCurrencyRupee size={16} />}
              title={
                <Group gap="xs">
                  <Text fw={600}>Est. ₹{costPreview.estimated_total}</Text>
                  <Text size="xs" c="dimmed">
                    (subtotal ₹{costPreview.subtotal} + tax ₹{costPreview.estimated_tax})
                  </Text>
                </Group>
              }
            >
              {costPreview.exceeds_preauth ? (
                <Text size="sm">
                  Exceeds pre-auth threshold (₹{costPreview.preauth_threshold}). Insurance
                  pre-authorization required before proceeding.
                </Text>
              ) : (
                <Text size="xs" c="dimmed">
                  Estimate only — final billing applies tariff and discounts at invoice time.
                </Text>
              )}
            </Alert>
          )}

          <Divider />

          <Group justify="space-between">
            <Group gap="xs">
              {canUseDraft && (
                <Button
                  variant="subtle"
                  size="sm"
                  onClick={handleSaveDraft}
                  disabled={basket.items.length === 0}
                >
                  Save draft
                </Button>
              )}
              <Button
                variant="default"
                size="sm"
                onClick={handleClear}
                disabled={basket.items.length === 0}
              >
                Clear
              </Button>
            </Group>
            <Button
              color="primary"
              loading={basket.isSigning}
              disabled={!canSign}
              onClick={handleSign}
            >
              Sign all ({basket.items.length})
            </Button>
          </Group>
        </Stack>
      </Drawer>

      <OrderSetPickerModal
        opened={orderSetOpen}
        onClose={() => setOrderSetOpen(false)}
        onAddItems={addPermittedItems}
      />

      <CarryForwardModal
        opened={carryFwdOpen}
        onClose={() => setCarryFwdOpen(false)}
        patientId={patientId}
        encounterId={encounterId}
        onAddItems={addPermittedItems}
      />
    </>
  );
}

function OrderSetPickerModal({
  opened,
  onClose,
  onAddItems,
}: {
  opened: boolean;
  onClose: () => void;
  onAddItems: (items: BasketItem[]) => void;
}) {
  const [templates, setTemplates] = useState<{ id: string; name: string }[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!opened) return;
    void (async () => {
      try {
        const list = await orderBasketService.listOrderSetTemplates({ is_active: true });
        setTemplates(list.map((t) => ({ id: t.id, name: t.name })));
      } catch (err) {
        toast.error((err as Error).message, { title: "Failed to load order sets" });
      }
    })();
  }, [opened]);

  const handleApply = async () => {
    if (!selected) return;
    setLoading(true);
    try {
      const tpl = await orderBasketService.getOrderSetTemplate(selected);
      const items: BasketItem[] = (tpl.items ?? [])
        .map((it) => orderSetItemToBasket(it))
        .filter((x): x is BasketItem => !!x);
      if (items.length === 0) {
        toast.warning("This order set has no convertible items.", { title: "Empty template" });
      } else {
        onAddItems(items);
        toast.success(`${items.length} item(s) added to basket`, { title: "Order set applied" });
      }
      onClose();
    } catch (err) {
      toast.error((err as Error).message, { title: "Apply failed" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Apply Order Set" size="md">
      <Stack gap="sm">
        <Select
          label="Template"
          placeholder="Pick an order set…"
          data={templates.map((t) => ({ value: t.id, label: t.name }))}
          value={selected}
          onChange={setSelected}
          searchable
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleApply} disabled={!selected} loading={loading}>
            Add to basket
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function orderSetItemToBasket(it: {
  item_type: string;
  drug_id?: string | null;
  lab_test_id?: string | null;
  radiology_modality_id?: string | null;
  default_dose?: string | null;
  default_frequency?: string | null;
  default_route?: string | null;
  default_duration_days?: number | null;
  default_quantity?: number | null;
  display_name?: string | null;
}): BasketItem | null {
  if (it.item_type === "drug" && it.drug_id) {
    return {
      kind: "drug",
      drug_id: it.drug_id,
      drug_name: it.display_name ?? "(template drug)",
      dose: it.default_dose ?? "",
      frequency: it.default_frequency ?? "",
      route: it.default_route ?? "",
      duration_days: it.default_duration_days ?? null,
      quantity: it.default_quantity ?? 1,
      unit_price: "0",
    } as BasketItem;
  }
  if (it.item_type === "lab" && it.lab_test_id) {
    return { kind: "lab", test_id: it.lab_test_id } as BasketItem;
  }
  if (it.item_type === "radiology" && it.radiology_modality_id) {
    return { kind: "radiology", modality_id: it.radiology_modality_id } as BasketItem;
  }
  return null;
}

function CarryForwardModal({
  opened,
  onClose,
  patientId,
  encounterId,
  onAddItems,
}: {
  opened: boolean;
  onClose: () => void;
  patientId: string;
  encounterId: string;
  onAddItems: (items: BasketItem[]) => void;
}) {
  const [rows, setRows] = useState<
    { kind: string; label: string; created_at: string; item: unknown; checked: boolean }[]
  >([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!opened) return;
    setLoading(true);
    void (async () => {
      try {
        const list = await orderBasketService.carryForwardBasket(patientId, encounterId);
        setRows(
          list.map((r) => ({
            kind: r.kind,
            label: r.label,
            created_at: r.created_at,
            item: r.item,
            checked: false,
          })),
        );
      } catch (err) {
        toast.error((err as Error).message, { title: "Carry forward failed" });
      } finally {
        setLoading(false);
      }
    })();
  }, [opened, patientId, encounterId]);

  const toggle = (idx: number) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, checked: !r.checked } : r)));
  };

  const handleAdd = () => {
    const picked = rows.filter((r) => r.checked).map((r) => r.item as BasketItem);
    if (picked.length === 0) return;
    onAddItems(picked);
    toast.success(`${picked.length} item(s) added`, { title: "Carried forward" });
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Carry forward from previous encounter"
      size="lg"
    >
      {loading && <Text size="sm">Loading…</Text>}
      {!loading && rows.length === 0 && (
        <Text size="sm" c="dimmed">
          No prior orders found for this patient.
        </Text>
      )}
      {!loading && rows.length > 0 && (
        <Stack gap="xs">
          <ScrollArea.Autosize mah={420}>
            <Stack gap={4}>
              {rows.map((r, idx) => (
                <Group key={`${r.kind}:${r.label}:${r.created_at}`} gap="xs" wrap="nowrap">
                  <Checkbox checked={r.checked} onChange={() => toggle(idx)} />
                  <Badge size="xs" variant="light">
                    {r.kind}
                  </Badge>
                  <Text size="sm" style={{ flex: 1 }}>
                    {r.label}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {new Date(r.created_at).toLocaleDateString()}
                  </Text>
                </Group>
              ))}
            </Stack>
          </ScrollArea.Autosize>
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={!rows.some((r) => r.checked)}>
              Add selected
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}

function basketItemKey(item: BasketItem): string {
  return `${item.kind}:${JSON.stringify(item)}`;
}

function isOrderBasketTab(value: string | null): value is OrderBasketTab {
  return value === "drug" || value === "lab" || value === "radiology";
}
