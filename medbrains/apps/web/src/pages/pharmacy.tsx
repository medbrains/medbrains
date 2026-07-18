import { Group, Stack, Tabs, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useHasPermission } from "@medbrains/stores";
import type { ComplianceSettings, TenantSettingsRow } from "@medbrains/types";
import { P } from "@medbrains/types";
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconCashRegister,
  IconPackage,
  IconPill,
  IconPlus,
  IconPrescription,
  IconReceipt,
  IconShieldCheck,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { ClinicalEventProvider, PageHeader } from "@/components";
import { StoreIndentsTab } from "@/components/Pharmacy/StoreIndentsTab";
import { Alert, Button } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { pharmacyService } from "@/services/pharmacy.service";
import { AnalyticsTab } from "./pharmacy/analytics";
import { BatchExpiryTab } from "./pharmacy/batch-expiry";
import { PharmacyCatalogTab } from "./pharmacy/catalog";
import { DrugInteractionModal } from "./pharmacy/drug-interaction-modal";
import { FormularyCheckModal } from "./pharmacy/formulary-check-modal";
import { NdpsRegisterTab } from "./pharmacy/ndps-register";
import { PharmacyOrderDetail } from "./pharmacy/order-detail";
import { PharmacyOrderForm } from "./pharmacy/order-form";
import { PharmacyOrdersTab } from "./pharmacy/orders";
import { PosCounterTab } from "./pharmacy/pos-counter";
import { PharmacyReturnsWorkspace } from "./pharmacy/returns-workspace";
import { RxQueueTab } from "./pharmacy/rx-queue";
import { StockTab } from "./pharmacy/stock";
import { StoresTransfersTab } from "./pharmacy/stores-transfers";

// Dropdown options for categorical fields - aligned with ATC classification
const PHARMACY_PAGE_PERMISSIONS = [
  P.PHARMACY.PRESCRIPTIONS_LIST,
  P.PHARMACY.PRESCRIPTIONS_VIEW,
  P.PHARMACY.DISPENSING_CREATE,
  P.PHARMACY.DISPENSING_PARTIAL,
  P.PHARMACY.DISPENSING_CANCEL,
  P.PHARMACY.DISPENSING_VOID,
  P.PHARMACY.RX_QUEUE_LIST,
  P.PHARMACY.RX_QUEUE_REVIEW,
  P.PHARMACY.POS_VIEW,
  P.PHARMACY.POS_CREATE,
  P.PHARMACY.POS_CANCEL,
  P.PHARMACY.POS_RETURN,
  P.PHARMACY.STOCK_MANAGE,
  P.PHARMACY.NDPS_LIST,
  P.PHARMACY.NDPS_MANAGE,
  P.PHARMACY.STORES_LIST,
  P.PHARMACY.STORES_MANAGE,
  P.PHARMACY.ANALYTICS_VIEW,
  P.PHARMACY.RETURNS_LIST,
  P.PHARMACY.RETURNS_REQUEST,
  P.PHARMACY.RETURNS_APPROVE,
  P.PHARMACY.RETURNS_RESTOCK,
  P.PHARMACY.RETURNS_DESTROY,
  P.PHARMACY.RETURNS_REJECT,
  P.PHARMACY.SAFETY_VIEW,
] as const;

export function PharmacyPage() {
  useRequirePermission(PHARMACY_PAGE_PERMISSIONS);

  return (
    <ClinicalEventProvider moduleCode="pharmacy" contextCode="pharmacy-orders">
      <PharmacyPageInner />
    </ClinicalEventProvider>
  );
}

export function PharmacyOrderCreatePage() {
  useRequirePermission(P.PHARMACY.DISPENSING_CREATE);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialPatientId = searchParams.get("patient_id") ?? "";
  const canViewPatientRecord = useHasPermission(P.PATIENTS.VIEW);

  function ordersPath() {
    const params = new URLSearchParams({ tab: "orders" });
    if (initialPatientId) {
      params.set("patient_id", initialPatientId);
    }
    return `/pharmacy?${params.toString()}`;
  }

  return (
    <ClinicalEventProvider moduleCode="pharmacy" contextCode="pharmacy-order-create">
      <Stack>
        <PageHeader
          title="New Pharmacy Order"
          subtitle="Create a patient-linked medicine order with safety and billing synchronization."
          icon={<IconPill size={20} stroke={1.5} />}
          color="success"
          actions={
            <Button
              tone="secondary"
              leftSection={<IconArrowLeft size={14} />}
              onClick={() => navigate(ordersPath())}
            >
              Orders
            </Button>
          }
        />
        <PharmacyOrderForm
          initialPatientId={initialPatientId}
          canViewPatientRecord={canViewPatientRecord}
          onCancel={() => navigate(ordersPath())}
          onSuccess={(detail) => navigate(`/pharmacy/orders/${detail.order.id}`)}
        />
      </Stack>
    </ClinicalEventProvider>
  );
}

export function PharmacyOrderDetailPage() {
  useRequirePermission(P.PHARMACY.PRESCRIPTIONS_VIEW);
  const navigate = useNavigate();
  const { orderId } = useParams();
  const canAdjustPartialDispense = useHasPermission(P.PHARMACY.DISPENSING_PARTIAL);
  const canViewReturns = useHasPermission(P.PHARMACY.RETURNS_LIST);
  const canViewPatientRecord = useHasPermission(P.PATIENTS.VIEW);
  const canDispense = useHasPermission(P.PHARMACY.DISPENSING_CREATE);

  return (
    <ClinicalEventProvider moduleCode="pharmacy" contextCode="pharmacy-order-detail">
      <Stack>
        <PageHeader
          title="Pharmacy Order"
          subtitle="Dispensing detail, FEFO hints, labels, and synchronized billing lines."
          icon={<IconPill size={20} stroke={1.5} />}
          color="success"
          actions={
            <Group gap="xs">
              <Button
                tone="secondary"
                leftSection={<IconArrowLeft size={14} />}
                onClick={() => navigate("/pharmacy?tab=orders")}
              >
                Orders
              </Button>
              {canDispense && (
                <Button
                  tone="primary"
                  leftSection={<IconPlus size={14} />}
                  onClick={() => navigate("/pharmacy/orders/new")}
                >
                  New Order
                </Button>
              )}
            </Group>
          }
        />
        {orderId ? (
          <PharmacyOrderDetail
            orderId={orderId}
            canEditItems={canAdjustPartialDispense}
            canDispense={canDispense}
            canViewReturns={canViewReturns}
            canViewPatientRecord={canViewPatientRecord}
          />
        ) : (
          <Alert tone="warning">Pharmacy order id is missing from the route.</Alert>
        )}
      </Stack>
    </ClinicalEventProvider>
  );
}

function PharmacyPageInner() {
  const { t } = useTranslation("pharmacy");
  const [searchParams, setSearchParams] = useSearchParams();
  const canViewOrders = useHasPermission(P.PHARMACY.PRESCRIPTIONS_LIST);
  const canViewOrderDetail = useHasPermission(P.PHARMACY.PRESCRIPTIONS_VIEW);
  const canDispense = useHasPermission(P.PHARMACY.DISPENSING_CREATE);
  const canAdjustPartialDispense = useHasPermission(P.PHARMACY.DISPENSING_PARTIAL);
  const canCancelDispensingOrder = useHasPermission(P.PHARMACY.DISPENSING_CANCEL);
  const canVoidDispensing = useHasPermission(P.PHARMACY.DISPENSING_VOID);
  const canManageStock = useHasPermission(P.PHARMACY.STOCK_MANAGE);
  const canViewNdps = useHasPermission(P.PHARMACY.NDPS_LIST);
  const canManageNdps = useHasPermission(P.PHARMACY.NDPS_MANAGE);
  const canViewStores = useHasPermission(P.PHARMACY.STORES_LIST);
  const canManageStores = useHasPermission(P.PHARMACY.STORES_MANAGE);
  const canViewAnalytics = useHasPermission(P.PHARMACY.ANALYTICS_VIEW);
  const canViewReturns = useHasPermission(P.PHARMACY.RETURNS_LIST);
  const canRequestReturn = useHasPermission(P.PHARMACY.RETURNS_REQUEST);
  const canApproveReturn = useHasPermission(P.PHARMACY.RETURNS_APPROVE);
  const canRestockReturn = useHasPermission(P.PHARMACY.RETURNS_RESTOCK);
  const canDestroyReturn = useHasPermission(P.PHARMACY.RETURNS_DESTROY);
  const canRejectReturn = useHasPermission(P.PHARMACY.RETURNS_REJECT);
  const canWorkReturns =
    canViewReturns ||
    canRequestReturn ||
    canApproveReturn ||
    canRestockReturn ||
    canDestroyReturn ||
    canRejectReturn;
  const canViewReturnQueue =
    canViewReturns || canApproveReturn || canRestockReturn || canDestroyReturn || canRejectReturn;
  const canViewCreditNoteQueue = canViewReturns || canApproveReturn || canRejectReturn;
  const canViewRxQueue = useHasPermission(P.PHARMACY.RX_QUEUE_LIST);
  const canReviewRx = useHasPermission(P.PHARMACY.RX_QUEUE_REVIEW);
  const canOpenRxQueue = canViewRxQueue || canReviewRx;
  const canViewSafety = useHasPermission(P.PHARMACY.SAFETY_VIEW);
  const canViewSafetyChecks = canViewSafety || canViewOrderDetail || canReviewRx;
  const canCreatePos = useHasPermission(P.PHARMACY.POS_CREATE);
  const canViewPos = useHasPermission(P.PHARMACY.POS_VIEW);
  const canCancelPos = useHasPermission(P.PHARMACY.POS_CANCEL);
  const canReturnPos = useHasPermission(P.PHARMACY.POS_RETURN);
  const canManageBillingCredit = useHasPermission(P.BILLING.CREDIT_MANAGE);
  const canViewPatientRecord = useHasPermission(P.PATIENTS.VIEW);
  const canOpenOrders =
    canViewOrders ||
    canViewOrderDetail ||
    canDispense ||
    canAdjustPartialDispense ||
    canCancelDispensingOrder ||
    canViewSafety;
  const canViewDrugCatalog =
    canViewOrders ||
    canViewOrderDetail ||
    canDispense ||
    canAdjustPartialDispense ||
    canManageStock ||
    canManageNdps ||
    canManageStores ||
    canRequestReturn ||
    canViewRxQueue ||
    canReviewRx ||
    canCreatePos ||
    canViewSafety;
  const defaultTab = canOpenRxQueue
    ? "rx-queue"
    : canCreatePos || canViewPos || canCancelPos || canReturnPos
      ? "pos"
      : canOpenOrders
        ? "orders"
        : canViewDrugCatalog
          ? "catalog"
          : canManageStock
            ? "stock"
            : canViewNdps || canManageNdps
              ? "ndps"
              : canViewStores
                ? "stores"
                : canManageStores
                  ? "store-requests"
                  : canViewAnalytics
                    ? "analytics"
                    : canWorkReturns
                      ? "returns"
                      : "rx-queue";
  const visiblePharmacyTabs = new Set<string>([
    ...(canOpenRxQueue ? ["rx-queue"] : []),
    ...(canCreatePos || canViewPos || canCancelPos || canReturnPos ? ["pos"] : []),
    ...(canOpenOrders ? ["orders"] : []),
    ...(canViewDrugCatalog ? ["catalog"] : []),
    ...(canManageStock ? ["stock", "batches"] : []),
    ...(canViewNdps || canManageNdps ? ["ndps"] : []),
    ...(canViewStores || canManageStores ? ["stores", "store-requests"] : []),
    ...(canViewAnalytics ? ["analytics"] : []),
    ...(canWorkReturns ? ["returns"] : []),
  ]);
  const requestedTab = searchParams.get("tab");
  const selectedTab =
    requestedTab && visiblePharmacyTabs.has(requestedTab) ? requestedTab : defaultTab;
  const setSelectedTab = (value: string | null) => {
    const params = new URLSearchParams(searchParams);
    params.set("tab", value ?? defaultTab);
    setSearchParams(params, { replace: true });
  };
  const hasVisibleTab =
    canOpenRxQueue ||
    canCreatePos ||
    canViewPos ||
    canCancelPos ||
    canReturnPos ||
    canOpenOrders ||
    canViewDrugCatalog ||
    canManageStock ||
    canViewNdps ||
    canManageNdps ||
    canViewStores ||
    canManageStores ||
    canViewAnalytics ||
    canWorkReturns;

  const { data: complianceRaw = [] } = useQuery<TenantSettingsRow[]>({
    queryKey: ["tenant-settings", "compliance"],
    queryFn: () => pharmacyService.getTenantSettings("compliance"),
    staleTime: 300_000,
  });

  const compliance = useMemo(() => {
    const defaults: ComplianceSettings = {
      enforce_drug_scheduling: false,
      enforce_ndps_tracking: false,
      enforce_formulary: false,
      enforce_drug_interactions: false,
      enforce_antibiotic_stewardship: false,
      enforce_lasa_warnings: false,
      enforce_max_dose_check: false,
      enforce_batch_tracking: false,
      show_schedule_badges: true,
      show_controlled_warnings: true,
      show_formulary_status: true,
      show_aware_category: true,
    };
    for (const row of complianceRaw) {
      const key = row.key as keyof ComplianceSettings;
      if (key in defaults) {
        defaults[key] = row.value === true || row.value === "true";
      }
    }
    return defaults;
  }, [complianceRaw]);

  const [interactionModalOpen, { open: openInteractionModal, close: closeInteractionModal }] =
    useDisclosure(false);
  const [formularyModalOpen, { open: openFormularyModal, close: closeFormularyModal }] =
    useDisclosure(false);

  return (
    <div>
      <PageHeader
        title={t("title.pharmacy")}
        subtitle={t("subtitle.drugInventory&Dispensing")}
        icon={<IconPill size={20} stroke={1.5} />}
        color="success"
      />

      <DrugInteractionModal
        opened={interactionModalOpen}
        onClose={closeInteractionModal}
        canViewPatientRecord={canViewPatientRecord}
      />
      <FormularyCheckModal opened={formularyModalOpen} onClose={closeFormularyModal} />

      {hasVisibleTab ? (
        <Tabs value={selectedTab} onChange={setSelectedTab}>
          <Tabs.List mb="md">
            {canOpenRxQueue && (
              <Tabs.Tab value="rx-queue" leftSection={<IconPrescription size={14} />}>
                {t("rxQueue")}
              </Tabs.Tab>
            )}
            {(canCreatePos || canViewPos || canCancelPos || canReturnPos) && (
              <Tabs.Tab value="pos" leftSection={<IconCashRegister size={14} />}>
                {t("posCounter")}
              </Tabs.Tab>
            )}
            {canOpenOrders && <Tabs.Tab value="orders">{t("orders")}</Tabs.Tab>}
            {canViewDrugCatalog && <Tabs.Tab value="catalog">{t("drugCatalog")}</Tabs.Tab>}
            {canManageStock && <Tabs.Tab value="stock">{t("stock")}</Tabs.Tab>}
            {(canViewNdps || canManageNdps) && (
              <Tabs.Tab value="ndps">{t("ndpsRegister")}</Tabs.Tab>
            )}
            {canManageStock && <Tabs.Tab value="batches">{t("batch&Expiry")}</Tabs.Tab>}
            {(canViewStores || canManageStores) && (
              <Tabs.Tab value="stores">{t("stores&Transfers")}</Tabs.Tab>
            )}
            {canViewAnalytics && <Tabs.Tab value="analytics">{t("analytics&Reports")}</Tabs.Tab>}
            {canWorkReturns && (
              <Tabs.Tab value="returns" leftSection={<IconReceipt size={14} />}>
                Returns
              </Tabs.Tab>
            )}
            {(canViewStores || canManageStores) && (
              <Tabs.Tab value="store-requests" leftSection={<IconPackage size={14} />}>
                Store Requests
              </Tabs.Tab>
            )}
          </Tabs.List>

          {canOpenRxQueue && (
            <Tabs.Panel value="rx-queue">
              <RxQueueTab
                canReview={canReviewRx}
                canViewPatientRecord={canViewPatientRecord}
                canViewQueue={canViewRxQueue}
              />
            </Tabs.Panel>
          )}
          {(canCreatePos || canViewPos || canCancelPos || canReturnPos) && (
            <Tabs.Panel value="pos">
              <PosCounterTab
                canView={canViewPos}
                canCreate={canCreatePos}
                canCancel={canCancelPos}
                canReturn={canReturnPos}
                canViewPatientRecord={canViewPatientRecord}
              />
            </Tabs.Panel>
          )}
          {canOpenOrders && (
            <Tabs.Panel value="orders">
              <PharmacyOrdersTab
                canViewOrders={canViewOrders}
                canDispense={canDispense}
                canCancelOrder={canCancelDispensingOrder}
                canViewOrderDetail={canViewOrderDetail}
                canViewPatientRecord={canViewPatientRecord}
                headerActions={
                  canViewSafetyChecks && (
                    <>
                      <Button
                        size="xs"
                        tone="secondary"
                        leftSection={<IconAlertTriangle size={14} />}
                        onClick={openInteractionModal}
                      >
                        Drug Interactions
                      </Button>
                      <Button
                        size="xs"
                        tone="secondary"
                        leftSection={<IconShieldCheck size={14} />}
                        onClick={openFormularyModal}
                      >
                        Formulary Check
                      </Button>
                    </>
                  )
                }
              />
            </Tabs.Panel>
          )}
          {canViewDrugCatalog && (
            <Tabs.Panel value="catalog">
              <PharmacyCatalogTab canManage={canManageStock} compliance={compliance} />
            </Tabs.Panel>
          )}
          {canManageStock && (
            <Tabs.Panel value="stock">
              <StockTab canManage={canManageStock} />
            </Tabs.Panel>
          )}
          {(canViewNdps || canManageNdps) && (
            <Tabs.Panel value="ndps">
              <NdpsRegisterTab />
            </Tabs.Panel>
          )}
          {canManageStock && (
            <Tabs.Panel value="batches">
              <BatchExpiryTab />
            </Tabs.Panel>
          )}
          {(canViewStores || canManageStores) && (
            <Tabs.Panel value="stores">
              <StoresTransfersTab canViewStores={canViewStores} canManageStores={canManageStores} />
            </Tabs.Panel>
          )}
          {canViewAnalytics && (
            <Tabs.Panel value="analytics">
              <AnalyticsTab />
            </Tabs.Panel>
          )}
          {canWorkReturns && (
            <Tabs.Panel value="returns">
              <PharmacyReturnsWorkspace
                canViewQueue={canViewReturnQueue}
                canViewCreditNoteQueue={canViewCreditNoteQueue}
                canRequest={canRequestReturn}
                canApprove={canApproveReturn}
                canVoidDispensing={canVoidDispensing}
                canRestock={canRestockReturn}
                canDestroy={canDestroyReturn}
                canReject={canRejectReturn}
                canSettleCreditNote={canApproveReturn && canManageBillingCredit}
                canViewPatientRecord={canViewPatientRecord}
              />
            </Tabs.Panel>
          )}
          {(canViewStores || canManageStores) && (
            <Tabs.Panel value="store-requests">
              <StoreIndentsTab
                canViewQueue={canViewStores || canManageStores}
                canManage={canManageStores}
              />
            </Tabs.Panel>
          )}
        </Tabs>
      ) : (
        <Text c="dimmed" size="sm">
          No pharmacy work areas are available for your current role.
        </Text>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  Orders Tab (enhanced)
// ══════════════════════════════════════════════════════════
