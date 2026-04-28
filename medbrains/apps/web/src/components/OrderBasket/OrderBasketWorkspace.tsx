/**
 * OrderBasketWorkspace — slide-in drawer hosting the order basket.
 *
 * Phase 1 uses Mantine `Drawer` as a placeholder. When the
 * `useWorkspace()` primitive ships from the other chat, swap the host.
 *
 * See `RFCs/sprints/SPRINT-order-basket.md` §5 (Frontend changes).
 */
import {
  Alert,
  Badge,
  Button,
  Divider,
  Drawer,
  Group,
  Stack,
  Tabs,
  Text,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconAlertTriangle, IconCheck } from "@tabler/icons-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@medbrains/api";
import { useOrderBasketStore } from "@medbrains/stores";
import type { BasketItem } from "@medbrains/types";
import { BasketItemRow } from "./BasketItemRow";
import { WarningsPanel } from "./WarningsPanel";
import { DrugPickerForm } from "./pickers/DrugPickerForm";
import { LabPickerForm } from "./pickers/LabPickerForm";
import { RadiologyPickerForm } from "./pickers/RadiologyPickerForm";

interface OrderBasketWorkspaceProps {
  opened: boolean;
  onClose: () => void;
  encounterId: string;
  patientId: string;
}

export function OrderBasketWorkspace({
  opened,
  onClose,
  encounterId,
  patientId,
}: OrderBasketWorkspaceProps) {
  const basket = useOrderBasketStore();

  // Sync context whenever drawer opens for a (potentially new) encounter
  useEffect(() => {
    if (opened) {
      basket.setContext(encounterId, patientId);
    }
  }, [opened, encounterId, patientId, basket.setContext]);

  // Debounced server-side check on every items change
  const checkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!opened) return;
    if (basket.items.length === 0) {
      basket.setWarnings([]);
      return;
    }
    if (checkTimer.current) clearTimeout(checkTimer.current);
    checkTimer.current = setTimeout(async () => {
      basket.setChecking(true);
      try {
        const res = await api.checkBasket({
          encounter_id: encounterId,
          patient_id: patientId,
          items: basket.items,
        });
        basket.setWarnings(res.warnings);
      } catch (err) {
        notifications.show({
          title: "Check failed",
          message: (err as Error).message,
          color: "danger",
        });
      } finally {
        basket.setChecking(false);
      }
    }, 500);
    return () => {
      if (checkTimer.current) clearTimeout(checkTimer.current);
    };
  }, [
    opened,
    basket.items,
    encounterId,
    patientId,
    basket.setChecking,
    basket.setWarnings,
  ]);

  // Load draft on open (if any)
  useEffect(() => {
    if (!opened || basket.items.length > 0) return;
    let cancelled = false;
    void (async () => {
      try {
        const draft = await api.getBasketDraft(encounterId);
        if (!cancelled && draft && Array.isArray(draft.items) && draft.items.length > 0) {
          basket.loadDraft(draft.items as BasketItem[]);
          notifications.show({
            title: "Draft loaded",
            message: `${draft.items.length} item(s) loaded from saved draft`,
            color: "info",
          });
        }
      } catch {
        // no draft is fine
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [opened, encounterId, basket.items.length, basket.loadDraft]);

  const hasBlocks = basket.hasUnacknowledgedBlocks();
  const canSign = basket.items.length > 0 && !hasBlocks && !basket.isSigning;

  const handleSign = async () => {
    basket.setSigning(true);
    try {
      const res = await api.signBasket({
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
    try {
      await api.saveBasketDraft(encounterId, {
        items: basket.items,
      });
      notifications.show({
        title: "Draft saved",
        message: "Basket saved — resume later from any device",
        color: "info",
      });
    } catch (err) {
      notifications.show({
        title: "Save failed",
        message: (err as Error).message,
        color: "danger",
      });
    }
  };

  const handleClear = () => {
    basket.clear();
  };

  const warningsForItem = useMemo(
    () => (idx: number) => basket.warnings.filter((w) => w.refs.includes(idx)),
    [basket.warnings],
  );

  const [activeTab, setActiveTab] = useState<string | null>("drug");

  return (
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
        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List>
            <Tabs.Tab value="drug">Drug</Tabs.Tab>
            <Tabs.Tab value="lab">Lab</Tabs.Tab>
            <Tabs.Tab value="radiology">Radiology</Tabs.Tab>
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
          <Tabs.Panel value="drug" pt="xs">
            <DrugPickerForm onAdd={basket.addItem} />
          </Tabs.Panel>
          <Tabs.Panel value="lab" pt="xs">
            <LabPickerForm onAdd={basket.addItem} />
          </Tabs.Panel>
          <Tabs.Panel value="radiology" pt="xs">
            <RadiologyPickerForm onAdd={basket.addItem} />
          </Tabs.Panel>
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
                key={`${item.kind}-${idx}`}
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

        <Divider />

        <Group justify="space-between">
          <Group gap="xs">
            <Button
              variant="subtle"
              size="sm"
              onClick={handleSaveDraft}
              disabled={basket.items.length === 0}
            >
              Save draft
            </Button>
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
  );
}
