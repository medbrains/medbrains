import { zodResolver } from "@hookform/resolvers/zod";
import {
  Card,
  Group,
  Loader,
  Modal,
  MultiSelect,
  NumberInput,
  SegmentedControl,
  Select,
  Stack,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type {
  PharmacyPosReturnFormInput,
  PharmacyPosSaleFormInput,
  PharmacyReturnRequestFormInput,
} from "@medbrains/schemas";
import {
  pharmacyPosReturnFormSchema,
  pharmacyPosSaleFormSchema,
  pharmacyReturnRequestFormSchema,
} from "@medbrains/schemas";
import { useFieldAccess, useHasPermission } from "@medbrains/stores";
import type {
  ClinicalJourneyContext,
  ComplianceSettings,
  PharmacyOrder,
  PharmacyOrderDetailResponse,
  PharmacyOrderItem,
  PharmacyPosSale,
  PharmacyPosSaleItem,
  PharmacyReturn,
  PharmacyReturnStatusType,
  PrescriptionWithItems,
  TenantSettingsRow,
} from "@medbrains/types";
import { P, PATIENT_BASIC_IDENTITY_FIELD_ACCESS_KEYS } from "@medbrains/types";
import { fieldAccessText } from "@medbrains/utils";
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconCashRegister,
  IconCheck,
  IconClipboardList,
  IconClock,
  IconEye,
  IconLock,
  IconPackage,
  IconPill,
  IconPlus,
  IconPrescription,
  IconReceipt,
  IconReplace,
  IconShieldCheck,
  IconShoppingCart,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams, useSearchParams } from "react-router";
import {
  ClinicalEventProvider,
  type Column,
  DataTable,
  type DataTableFilter,
  PageHeader,
  PrescriptionViews,
  type SortState,
  StatusDot,
  TableValueBadge,
  useClinicalEmit,
} from "@/components";
import { DrugSearchSelect } from "@/components/DrugSearchSelect";
import { PatientFlowNavigator } from "@/components/Patient/PatientFlowNavigator";
import { PatientJourneyActions } from "@/components/Patient/PatientJourneyActions";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { CreditNotesTab } from "@/components/Pharmacy/CreditNotesTab";
import { DispenseModal } from "@/components/Pharmacy/DispenseModal";
import { PharmacyDispensingView } from "@/components/Pharmacy/PharmacyDispensingView";
import { PharmacyLabel } from "@/components/Pharmacy/PharmacyLabel";
import { RepeatPanel } from "@/components/Pharmacy/RepeatPanel";
import { StoreIndentsTab } from "@/components/Pharmacy/StoreIndentsTab";
import { SubstituteModal } from "@/components/Pharmacy/SubstituteModal";
import { Alert, Badge, Button, IconButton, Table, toast } from "@/components/ui";
import {
  formIntegerOrFallback,
  formNumberOrFallback,
  optionalFormText,
  pharmacyPosPaymentModeOptions,
} from "@/forms/pharmacy.form";
import { usePatientName } from "@/hooks/usePatientName";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { confirmDestructive } from "@/lib/confirm-destructive";
import { pharmacyService } from "@/services/pharmacy.service";
import { findAllergyConflicts } from "@/utils/allergyMatch";
import { AnalyticsTab } from "./pharmacy/analytics";
import { BatchExpiryTab } from "./pharmacy/batch-expiry";
import { PharmacyCatalogTab } from "./pharmacy/catalog";
import { DrugInteractionModal } from "./pharmacy/drug-interaction-modal";
import { EditablePharmacyQuantity } from "./pharmacy/editable-quantity";
import { FormularyCheckModal } from "./pharmacy/formulary-check-modal";
import { NdpsRegisterTab } from "./pharmacy/ndps-register";
import { NearExpiryHints } from "./pharmacy/near-expiry-hints";
import { PharmacyOrderForm } from "./pharmacy/order-form";
import { OtcSaleDrawer } from "./pharmacy/otc-sale-drawer";
import { PrescriptionAuditTrail } from "./pharmacy/prescription-audit-trail";
import { RxQueueTab } from "./pharmacy/rx-queue";
import {
  canEditPharmacyField,
  canViewPharmacyField,
  ExpiryCell,
  PharmacyPatientCell,
  PharmacyPatientContext,
  pharmacyOrderEventItems,
  renderPharmacySensitiveCurrency,
  renderPharmacySensitiveValue,
  sharedColorBadgeTone,
} from "./pharmacy/shared";
import { StockTab } from "./pharmacy/stock";
import { StoresTransfersTab } from "./pharmacy/stores-transfers";
import { pharmacyOrderJourneyContext } from "./pharmacy-workspace";

const statusColors: Record<string, string> = {
  completed: "success",
  ordered: "primary",
  dispensed: "success",
  cancelled: "danger",
  partially_cancelled: "warning",
  refunded: "indigo",
  returned: "orange",
};

const dispensingTypeLabels: Record<string, string> = {
  prescription: "Rx",
  otc: "OTC",
  discharge: "Discharge",
  package: "Package",
  emergency: "Emergency",
};

const PHARMACY_ORDER_STATUS_OPTIONS = [
  { value: "ordered", label: "Ordered" },
  { value: "dispensed", label: "Dispensed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "returned", label: "Returned" },
] as const;

type PharmacyPosSaleLine = PharmacyPosSaleFormInput["items"][number];
type PharmacyPosReturnLine = PharmacyPosReturnFormInput["items"][number];

type PatientOrderForReturnLookup = Awaited<
  ReturnType<typeof pharmacyService.listPatientOrdersForReturn>
>[number];

type ReturnableOrderItem = {
  orderId: string;
  orderDate: string;
  orderStatus: string;
  itemId: string;
  drugName: string;
  batchNumber: string | null;
  quantity: number;
  returnedQuantity: number;
  remainingQuantity: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseJsonArray(value: string): unknown[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function unknownString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function unknownNullableString(value: unknown) {
  const parsed = unknownString(value);
  return parsed.length > 0 ? parsed : null;
}

function unknownNumber(value: unknown, fallback: number) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function normalizeReturnableItems(order: PatientOrderForReturnLookup): ReturnableOrderItem[] {
  const rawItems =
    typeof order.items === "string"
      ? parseJsonArray(order.items)
      : Array.isArray(order.items)
        ? order.items
        : [];

  return rawItems
    .filter(isRecord)
    .map((item) => ({
      orderId: order.order_id,
      orderDate: order.order_date,
      orderStatus: order.status,
      itemId: unknownString(item.item_id),
      drugName: unknownString(item.drug_name),
      batchNumber: unknownNullableString(item.batch_number),
      quantity: unknownNumber(item.quantity, 0),
      returnedQuantity: unknownNumber(item.returned_quantity, 0),
      remainingQuantity: unknownNumber(
        item.remaining_quantity,
        unknownNumber(item.quantity, 0) - unknownNumber(item.returned_quantity, 0),
      ),
    }))
    .filter(
      (item) =>
        item.itemId.length > 0 &&
        item.drugName.length > 0 &&
        item.quantity > 0 &&
        item.remainingQuantity > 0,
    );
}

function posSaleLineQuantity(item: PharmacyPosSaleLine) {
  return formIntegerOrFallback(item.quantity, 1);
}

function posSaleLinePrice(item: PharmacyPosSaleLine) {
  return formNumberOrFallback(item.unit_price, 0);
}

function posSaleItemReturnableQuantity(item: PharmacyPosSaleItem) {
  return Math.max(0, Number(item.quantity ?? 0) - Number(item.cancelled_qty ?? 0));
}

function posReturnLineQuantity(item: PharmacyPosReturnLine) {
  return formIntegerOrFallback(item.return_qty, 0);
}

function posReturnLinePrice(item: PharmacyPosReturnLine) {
  return formNumberOrFallback(item.unit_price, 0);
}

function posSalePayloadPatientId(payload: Record<string, unknown>) {
  const patientId = payload.patient_id;
  return typeof patientId === "string" ? patientId : "";
}

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

function PharmacyOrdersTab({
  canViewOrders,
  canDispense,
  canCancelOrder,
  canViewOrderDetail,
  canViewPatientRecord,
  headerActions,
}: {
  canViewOrders: boolean;
  canDispense: boolean;
  canCancelOrder: boolean;
  canViewOrderDetail: boolean;
  canViewPatientRecord: boolean;
  headerActions?: ReactNode;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [orderSort, setOrderSort] = useState<SortState | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [otcOpened, { open: openOtc, close: closeOtc }] = useDisclosure(false);
  const patientIdFilter = searchParams.get("patient_id") ?? "";
  const isDispenseHandoff = searchParams.get("action") === "dispense";
  const effectiveFilterStatus = filterStatus ?? (isDispenseHandoff ? "ordered" : null);
  const clearPharmacyHandoff = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("action");
    setSearchParams(next, { replace: true });
  };
  const setOrderStatusFilter = (value: string | null) => {
    setFilterStatus(value);
    if (isDispenseHandoff) {
      clearPharmacyHandoff();
    }
  };

  const params: Record<string, string> = { page: String(page), per_page: "20" };
  if (effectiveFilterStatus) params.status = effectiveFilterStatus;
  if (patientIdFilter) params.patient_id = patientIdFilter;
  if (orderSort) {
    params.sort = orderSort.key;
    params.order = orderSort.dir;
  }

  const { data, isLoading } = useQuery({
    queryKey: ["pharmacy-orders", params],
    queryFn: () => pharmacyService.listPharmacyOrders(params),
    enabled: canViewOrders,
  });

  const emit = useClinicalEmit();

  const dispenseMutation = useMutation({
    mutationFn: async (id: string) => {
      const detail = await pharmacyService.getPharmacyOrder(id);
      const order = await pharmacyService.dispenseOrder(id);
      return { admissionId: detail.admission_id, items: detail.items, order };
    },
    onSuccess: ({ admissionId, items, order }, id) => {
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-orders"] });
      void queryClient.invalidateQueries({ queryKey: ["invoices"] });
      void queryClient.invalidateQueries({ queryKey: ["invoice"] });
      void queryClient.invalidateQueries({ queryKey: ["patient-invoices", order.patient_id] });
      toast.success("Order dispensed and linked billing charges refreshed", {
        title: "Dispensed",
      });
      emit("pharmacy.order.dispensed", {
        admission_id: admissionId,
        dispensing_type: order.dispensing_type,
        encounter_id: order.encounter_id,
        items: pharmacyOrderEventItems(items),
        order_id: id,
        order_type: "pharmacy",
        patient_id: order.patient_id,
      });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Could not dispense order" }),
  });
  const orders = data?.orders ?? [];
  const firstDispensableOrder = orders.find((order) => order.status === "ordered");

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const detail = await pharmacyService.getPharmacyOrder(id);
      const order = await pharmacyService.cancelPharmacyOrder(id);
      return { admissionId: detail.admission_id, order };
    },
    onSuccess: ({ admissionId, order }, id) => {
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-orders"] });
      void queryClient.invalidateQueries({ queryKey: ["invoices"] });
      void queryClient.invalidateQueries({ queryKey: ["invoice"] });
      void queryClient.invalidateQueries({ queryKey: ["patient-invoices", order.patient_id] });
      emit("order.cancelled", {
        admission_id: admissionId,
        dispensing_type: order.dispensing_type,
        encounter_id: order.encounter_id,
        order_id: id,
        order_type: "pharmacy",
        patient_id: order.patient_id,
        reason: "cancelled_from_pharmacy_queue",
      });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Could not cancel order" }),
  });

  const columns: Column<PharmacyOrder>[] = [
    {
      key: "patient_id",
      label: "Patient",
      requiredPermissions: [P.PHARMACY.PRESCRIPTIONS_LIST],
      fieldAccessKeys: PATIENT_BASIC_IDENTITY_FIELD_ACCESS_KEYS,
      accessor: (row: PharmacyOrder) => row.patient_id,
      fieldKind: "identifier",
      hiddenLabel: "Patient restricted",
      render: (row: PharmacyOrder) => (
        <PharmacyPatientCell
          patientId={row.patient_id}
          canViewPatientRecord={canViewPatientRecord}
        />
      ),
    },
    {
      key: "dispensing_type",
      label: "Type",
      render: (row: PharmacyOrder) => (
        <TableValueBadge
          value={row.dispensing_type}
          kind="pharmacy"
          label={dispensingTypeLabels[row.dispensing_type] ?? row.dispensing_type}
          size="xs"
          color={
            row.dispensing_type === "otc"
              ? "teal"
              : row.dispensing_type === "emergency"
                ? "danger"
                : "primary"
          }
        />
      ),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (row: PharmacyOrder) => (
        <StatusDot color={statusColors[row.status] ?? "gray"} label={row.status} />
      ),
    },
    {
      key: "created_at",
      label: "Date",
      render: (row: PharmacyOrder) => (
        <Text size="sm">{new Date(row.created_at).toLocaleDateString()}</Text>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      requiredPermissions: [
        P.PHARMACY.PRESCRIPTIONS_VIEW,
        P.PHARMACY.DISPENSING_CREATE,
        P.PHARMACY.DISPENSING_CANCEL,
      ],
      permissionMode: "any",
      render: (row: PharmacyOrder) => (
        <Group gap="xs">
          <Tooltip label={canViewOrderDetail ? "View" : "No permission to view order detail"}>
            <IconButton
              tone="primary"
              disabled={!canViewOrderDetail}
              aria-label="View pharmacy order"
              onClick={() => {
                if (!canViewOrderDetail) return;
                navigate(`/pharmacy/orders/${row.id}`);
              }}
            >
              <IconEye size={16} />
            </IconButton>
          </Tooltip>
          {row.status === "ordered" && (
            <Group gap={4} wrap="nowrap">
              {canDispense && (
                <Tooltip label="Dispense">
                  <IconButton
                    tone="success"
                    aria-label="Dispense pharmacy order"
                    onClick={() => dispenseMutation.mutate(row.id)}
                  >
                    <IconCheck size={16} />
                  </IconButton>
                </Tooltip>
              )}
              {canCancelOrder && (
                <Tooltip label="Cancel">
                  <IconButton
                    tone="danger"
                    aria-label="Cancel pharmacy order"
                    onClick={() =>
                      confirmDestructive({
                        title: "Cancel order",
                        message: "Cancel this pharmacy order? This cannot be undone.",
                        confirmLabel: "Cancel order",
                        onConfirm: () => cancelMutation.mutate(row.id),
                      })
                    }
                  >
                    <IconX size={16} />
                  </IconButton>
                </Tooltip>
              )}
            </Group>
          )}
        </Group>
      ),
    },
  ] satisfies Column<PharmacyOrder>[];

  return (
    <Stack>
      <Group justify="space-between" align="flex-end">
        {canViewOrders ? (
          <Select
            placeholder="Status"
            data={PHARMACY_ORDER_STATUS_OPTIONS}
            value={effectiveFilterStatus}
            onChange={setOrderStatusFilter}
            clearable
            w={160}
          />
        ) : (
          <Text size="sm" c="dimmed">
            Order queue requires prescription-list permission.
          </Text>
        )}
        <Group gap="xs">
          {headerActions}
          {canDispense && (
            <>
              <Button
                size="xs"
                tone="primary"
                leftSection={<IconPlus size={14} />}
                onClick={() =>
                  navigate(
                    patientIdFilter
                      ? `/pharmacy/orders/new?patient_id=${patientIdFilter}`
                      : "/pharmacy/orders/new",
                  )
                }
              >
                New Order
              </Button>
              <Button
                size="xs"
                tone="secondary"
                leftSection={<IconShoppingCart size={14} />}
                onClick={openOtc}
              >
                OTC Sale
              </Button>
            </>
          )}
        </Group>
      </Group>

      {canViewOrders ? (
        <Stack>
          {patientIdFilter && (
            <PharmacyPatientContext
              patientId={patientIdFilter}
              canViewPatientRecord={canViewPatientRecord}
            />
          )}
          {isDispenseHandoff && (
            <Alert tone="success" title="Dispense handoff">
              <Group justify="space-between" align="center" gap="sm">
                <Text size="sm">
                  Ordered pharmacy items are filtered for this patient. Review FEFO and safety
                  context before dispensing.
                </Text>
                <Group gap="xs">
                  {firstDispensableOrder && canDispense && (
                    <Button
                      size="xs"
                      tone="primary"
                      leftSection={<IconCheck size={14} />}
                      loading={dispenseMutation.isPending}
                      onClick={() => dispenseMutation.mutate(firstDispensableOrder.id)}
                    >
                      Dispense First Order
                    </Button>
                  )}
                  {firstDispensableOrder && canViewOrderDetail && (
                    <Button
                      size="xs"
                      tone="secondary"
                      leftSection={<IconEye size={14} />}
                      onClick={() => navigate(`/pharmacy/orders/${firstDispensableOrder.id}`)}
                    >
                      Open Order
                    </Button>
                  )}
                  <Button size="xs" tone="ghost" onClick={clearPharmacyHandoff}>
                    Dismiss
                  </Button>
                </Group>
              </Group>
            </Alert>
          )}
          <DataTable
            columns={columns}
            data={orders}
            loading={isLoading}
            page={page}
            totalPages={data ? Math.ceil(data.total / data.per_page) : 1}
            onPageChange={setPage}
            sort={orderSort}
            onSortChange={(next) => {
              setOrderSort(next);
              setPage(1);
            }}
            rowKey={(row) => row.id}
            virtualized="auto"
            virtualizeAt={40}
            virtualRowHeight={58}
            tableMaxHeight="calc(100vh - 360px)"
          />
        </Stack>
      ) : (
        <Alert tone="warning">
          This role can create or process pharmacy orders, but the order queue and patient list stay
          hidden until `pharmacy.prescriptions.list` is granted.
        </Alert>
      )}

      <OtcSaleDrawer opened={otcOpened} onClose={closeOtc} />
    </Stack>
  );
}

type ReturnWorkspaceMode = "medicine-returns" | "credit-notes";
const returnWorkspaceModes: ReturnWorkspaceMode[] = ["medicine-returns", "credit-notes"];

function isReturnWorkspaceMode(value: string): value is ReturnWorkspaceMode {
  return returnWorkspaceModes.some((mode) => mode === value);
}

type ReturnFilterStatus = PharmacyReturnStatusType | "all";
const returnFilterStatuses: ReturnFilterStatus[] = [
  "all",
  "requested",
  "approved",
  "returned_to_stock",
  "destroyed",
  "rejected",
];

function isReturnFilterStatus(value: string): value is ReturnFilterStatus {
  return returnFilterStatuses.some((status) => status === value);
}

function PharmacyReturnsWorkspace({
  canViewQueue,
  canViewCreditNoteQueue,
  canRequest,
  canApprove,
  canVoidDispensing,
  canRestock,
  canDestroy,
  canReject,
  canSettleCreditNote,
  canViewPatientRecord,
}: {
  canViewQueue: boolean;
  canViewCreditNoteQueue: boolean;
  canRequest: boolean;
  canApprove: boolean;
  canVoidDispensing: boolean;
  canRestock: boolean;
  canDestroy: boolean;
  canReject: boolean;
  canSettleCreditNote: boolean;
  canViewPatientRecord: boolean;
}) {
  const [mode, setMode] = useState<ReturnWorkspaceMode>("medicine-returns");

  return (
    <Stack>
      <SegmentedControl
        size="xs"
        value={mode}
        onChange={(value) => {
          if (isReturnWorkspaceMode(value)) setMode(value);
        }}
        data={[
          { value: "medicine-returns", label: "Dispensed item returns" },
          { value: "credit-notes", label: "Custom credit notes" },
        ]}
      />
      {mode === "medicine-returns" ? (
        <PharmacyReturnsTab
          canViewQueue={canViewQueue}
          canRequest={canRequest}
          canApprove={canApprove}
          canVoidDispensing={canVoidDispensing}
          canRestock={canRestock}
          canDestroy={canDestroy}
          canReject={canReject}
          canViewPatientRecord={canViewPatientRecord}
        />
      ) : (
        <CreditNotesTab
          canViewQueue={canViewCreditNoteQueue}
          canCreate={canRequest}
          canApprove={canApprove}
          canSettle={canSettleCreditNote}
          canCancel={canReject}
          canViewPatientRecord={canViewPatientRecord}
        />
      )}
    </Stack>
  );
}

const returnStatusColors: Record<PharmacyReturnStatusType, string> = {
  requested: "yellow",
  approved: "blue",
  returned_to_stock: "green",
  destroyed: "red",
  rejected: "gray",
};

const returnStatusLabels: Record<PharmacyReturnStatusType, string> = {
  requested: "Requested",
  approved: "Approved",
  returned_to_stock: "Returned to stock",
  destroyed: "Destroyed",
  rejected: "Rejected",
};

function PharmacyReturnsTab({
  canViewQueue,
  canRequest,
  canApprove,
  canVoidDispensing,
  canRestock,
  canDestroy,
  canReject,
  canViewPatientRecord,
}: {
  canViewQueue: boolean;
  canRequest: boolean;
  canApprove: boolean;
  canVoidDispensing: boolean;
  canRestock: boolean;
  canDestroy: boolean;
  canReject: boolean;
  canViewPatientRecord: boolean;
}) {
  const queryClient = useQueryClient();
  const [filterStatus, setFilterStatus] = useState<ReturnFilterStatus>("all");
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);

  const { data: returns = [], isLoading } = useQuery({
    queryKey: ["pharmacy-returns"],
    queryFn: () => pharmacyService.listPharmacyReturns(),
    enabled: canViewQueue,
  });

  const processMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: PharmacyReturnStatusType }) =>
      pharmacyService.processPharmacyReturn(id, { status }),
    onSuccess: (_row, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-returns"] });
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-orders"] });
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-order-detail"] });
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-credit-notes"] });
      const returnToastTitle = returnStatusLabels[variables.status];
      const returnToastColor = returnStatusColors[variables.status];
      if (returnToastColor === "green") {
        toast.success("Return queue updated", { title: returnToastTitle });
      } else if (returnToastColor === "red") {
        toast.error("Return queue updated", { title: returnToastTitle });
      } else if (returnToastColor === "yellow") {
        toast.warning("Return queue updated", { title: returnToastTitle });
      } else {
        toast.info("Return queue updated", { title: returnToastTitle });
      }
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to update return", {
        title: "Return action failed",
      });
    },
  });

  const filteredReturns = useMemo(
    () => (filterStatus === "all" ? returns : returns.filter((row) => row.status === filterStatus)),
    [filterStatus, returns],
  );
  const requestReturnAction = canRequest ? (
    canViewPatientRecord ? (
      <Button size="xs" tone="primary" leftSection={<IconPlus size={14} />} onClick={openCreate}>
        Request Return
      </Button>
    ) : (
      <Tooltip label="Patient record access is required to pick the return order">
        <span>
          <Button size="xs" tone="primary" leftSection={<IconLock size={14} />} disabled>
            Request Return
          </Button>
        </span>
      </Tooltip>
    )
  ) : undefined;

  const columns: Column<PharmacyReturn>[] = [
    {
      key: "patient_id",
      label: "Patient",
      searchable: true,
      fieldAccessKeys: PATIENT_BASIC_IDENTITY_FIELD_ACCESS_KEYS,
      accessor: (row: PharmacyReturn) => row.patient_id,
      fieldKind: "identifier",
      hiddenLabel: "Patient restricted",
      render: (row: PharmacyReturn) => (
        <PharmacyPatientCell
          patientId={row.patient_id}
          canViewPatientRecord={canViewPatientRecord}
        />
      ),
    },
    {
      key: "order_item_id",
      label: "Order Item",
      render: (row: PharmacyReturn) => (
        <Text size="sm" ff="JetBrains Mono, monospace">
          {row.order_item_id.slice(0, 8)}
        </Text>
      ),
    },
    {
      key: "quantity_returned",
      label: "Qty",
      sortable: true,
      sortValue: (row: PharmacyReturn) => row.quantity_returned,
      accessor: (row: PharmacyReturn) => row.quantity_returned,
      render: (row: PharmacyReturn) => <Text size="sm">{row.quantity_returned}</Text>,
    },
    {
      key: "reason",
      label: "Reason",
      render: (row: PharmacyReturn) => (
        <Text size="sm" lineClamp={1}>
          {row.reason?.trim() || "—"}
        </Text>
      ),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      accessor: (row: PharmacyReturn) => returnStatusLabels[row.status] ?? row.status,
      render: (row: PharmacyReturn) => (
        <Badge size="xs" tone={sharedColorBadgeTone(returnStatusColors[row.status])}>
          {returnStatusLabels[row.status]}
        </Badge>
      ),
    },
    {
      key: "created_at",
      label: "Requested",
      sortable: true,
      sortValue: (row: PharmacyReturn) => row.created_at,
      accessor: (row: PharmacyReturn) => new Date(row.created_at).toLocaleString(),
      render: (row: PharmacyReturn) => (
        <Text size="sm">{new Date(row.created_at).toLocaleString()}</Text>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (row: PharmacyReturn) => (
        <Group gap={4} wrap="nowrap">
          {row.status === "requested" && (
            <>
              <Tooltip
                label={
                  canApprove && canVoidDispensing
                    ? "Approve post-dispense reversal"
                    : "Return approval and dispensing void permissions required"
                }
              >
                <IconButton
                  size="sm"
                  tone="success"
                  disabled={!canApprove || !canVoidDispensing || processMutation.isPending}
                  onClick={() => processMutation.mutate({ id: row.id, status: "approved" })}
                  aria-label="Approve return"
                >
                  <IconCheck size={14} />
                </IconButton>
              </Tooltip>
              <Tooltip label={canReject ? "Reject return" : "No reject permission"}>
                <IconButton
                  size="sm"
                  tone="danger"
                  disabled={!canReject || processMutation.isPending}
                  onClick={() => processMutation.mutate({ id: row.id, status: "rejected" })}
                  aria-label="Reject return"
                >
                  <IconX size={14} />
                </IconButton>
              </Tooltip>
            </>
          )}
          {row.status === "approved" && (
            <>
              <Tooltip label={canRestock ? "Return usable stock" : "No restock permission"}>
                <IconButton
                  size="sm"
                  tone="success"
                  disabled={!canRestock || processMutation.isPending}
                  onClick={() =>
                    processMutation.mutate({ id: row.id, status: "returned_to_stock" })
                  }
                  aria-label="Return to stock"
                >
                  <IconPackage size={14} />
                </IconButton>
              </Tooltip>
              <Tooltip label={canDestroy ? "Mark as destroyed" : "No destroy permission"}>
                <IconButton
                  size="sm"
                  tone="danger"
                  disabled={!canDestroy || processMutation.isPending}
                  onClick={() => processMutation.mutate({ id: row.id, status: "destroyed" })}
                  aria-label="Destroy returned item"
                >
                  <IconTrash size={14} />
                </IconButton>
              </Tooltip>
            </>
          )}
          {row.status !== "requested" && row.status !== "approved" && (
            <Text size="xs" c="dimmed">
              Closed
            </Text>
          )}
        </Group>
      ),
    },
  ];

  return (
    <Stack>
      <Alert tone="info" icon={<IconReceipt size={16} />}>
        Medicine returns are linked to already dispensed/billed order lines. Use Custom credit notes
        for supplier returns, expiry/damage write-off, or manual financial adjustments.
      </Alert>
      {!canViewQueue && (
        <Alert tone="neutral" icon={<IconLock size={16} />}>
          Return queue access requires a return list, approval, restock, destroy, or rejection role.
          You can still request a return if that action is available.
        </Alert>
      )}
      <DataTable
        columns={columns}
        data={filteredReturns}
        loading={canViewQueue && isLoading}
        rowKey={(row) => row.id}
        searchable
        searchPlaceholder="Search returns"
        exportable
        exportFileName="pharmacy-returns"
        toolbar={
          <SegmentedControl
            size="xs"
            value={filterStatus}
            disabled={!canViewQueue}
            onChange={(value) => {
              if (isReturnFilterStatus(value)) setFilterStatus(value);
            }}
            data={[
              { value: "all", label: "All" },
              { value: "requested", label: "Requested" },
              { value: "approved", label: "Approved" },
              { value: "returned_to_stock", label: "Restocked" },
              { value: "destroyed", label: "Destroyed" },
              { value: "rejected", label: "Rejected" },
            ]}
          />
        }
        tableActions={requestReturnAction}
      />
      <CreatePharmacyReturnModal
        opened={createOpened}
        onClose={closeCreate}
        canViewPatientRecord={canViewPatientRecord}
      />
    </Stack>
  );
}

function CreatePharmacyReturnModal({
  opened,
  onClose,
  canViewPatientRecord,
}: {
  opened: boolean;
  onClose: () => void;
  canViewPatientRecord: boolean;
}) {
  const queryClient = useQueryClient();
  const {
    control,
    handleSubmit,
    reset,
    setValue,
    setError,
    clearErrors,
    watch,
    formState: { errors },
  } = useForm<PharmacyReturnRequestFormInput>({
    resolver: zodResolver(pharmacyReturnRequestFormSchema),
    defaultValues: {
      patient_id: "",
      items: [],
    },
  });
  const {
    fields: selectedReturnFields,
    replace: replaceReturnItems,
    remove: removeReturnItem,
  } = useFieldArray({
    control,
    name: "items",
  });

  const patientId = watch("patient_id");
  const selectedReturnItems = watch("items") ?? [];
  const selectedOrderItemIds = selectedReturnItems.map((item) => item.order_item_id);

  const { data: patientOrders = [], isLoading: patientOrdersLoading } = useQuery({
    queryKey: ["pharmacy", "patient-orders", patientId],
    queryFn: () => pharmacyService.listPatientOrdersForReturn(patientId),
    enabled: canViewPatientRecord && patientId.length > 0,
  });

  const returnableItems = useMemo(
    () =>
      patientOrders
        .filter((order) => order.status === "dispensed")
        .flatMap((order) => normalizeReturnableItems(order)),
    [patientOrders],
  );

  const returnableItemById = useMemo(
    () => new Map(returnableItems.map((item) => [item.itemId, item])),
    [returnableItems],
  );
  const returnableItemOptions = useMemo(
    () =>
      returnableItems.map((item) => ({
        value: item.itemId,
        label: `${item.drugName} · remaining ${item.remainingQuantity}/${item.quantity} · ${new Date(
          item.orderDate,
        ).toLocaleDateString()}`,
      })),
    [returnableItems],
  );

  const createMutation = useMutation({
    mutationFn: (values: PharmacyReturnRequestFormInput) =>
      pharmacyService.createPharmacyReturns({
        patient_id: values.patient_id,
        items: values.items.map((item) => ({
          order_item_id: item.order_item_id,
          quantity_returned: formIntegerOrFallback(item.quantity_returned, 1),
          reason: optionalFormText(item.reason),
        })),
      }),
    onSuccess: (rows) => {
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-returns"] });
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-orders"] });
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-order-detail"] });
      toast.success(
        `${rows.length} return ${rows.length === 1 ? "line is" : "lines are"} waiting for approval`,
        { title: "Return requested" },
      );
      reset({ patient_id: "", items: [] });
      onClose();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to request return", {
        title: "Return request failed",
      });
    },
  });

  function handleClose() {
    reset({ patient_id: "", items: [] });
    onClose();
  }

  function submitReturn(values: PharmacyReturnRequestFormInput) {
    for (const item of values.items) {
      const returnableItem = returnableItemById.get(item.order_item_id);
      const returnQuantity = formIntegerOrFallback(item.quantity_returned, 1);
      if (!returnableItem) {
        setError("items", {
          type: "validate",
          message: "One selected medicine is no longer available for return.",
        });
        return;
      }
      if (returnQuantity > returnableItem.remainingQuantity) {
        setError("items", {
          type: "validate",
          message: `${returnableItem.drugName} can return only ${returnableItem.remainingQuantity} more.`,
        });
        return;
      }
    }
    createMutation.mutate(values);
  }

  function updateSelectedMedicineIds(itemIds: string[]) {
    const currentById = new Map(selectedReturnItems.map((item) => [item.order_item_id, item]));
    replaceReturnItems(
      itemIds.map(
        (itemId) =>
          currentById.get(itemId) ?? {
            order_item_id: itemId,
            quantity_returned: 1,
            reason: "",
          },
      ),
    );
    clearErrors("items");
  }

  return (
    <Modal opened={opened} onClose={handleClose} title="Request Medicine Return" size="xl">
      {!canViewPatientRecord ? (
        <Stack>
          <Alert tone="warning" icon={<IconLock size={16} />}>
            Patient record access is required to select the dispensed medicine for a return.
          </Alert>
          <Group justify="flex-end">
            <Button tone="ghost" onClick={handleClose}>
              Close
            </Button>
          </Group>
        </Stack>
      ) : (
        <Stack component="form" onSubmit={handleSubmit(submitReturn)}>
          <Controller
            control={control}
            name="patient_id"
            render={({ field, fieldState }) => (
              <PatientSearchSelect
                label="Patient"
                value={field.value}
                onChange={(value) => {
                  field.onChange(value);
                  replaceReturnItems([]);
                  setValue("items", []);
                  clearErrors("items");
                }}
                error={fieldState.error?.message}
                required
              />
            )}
          />
          {patientId.length > 0 && (
            <PharmacyPatientContext
              patientId={patientId}
              canViewPatientRecord={canViewPatientRecord}
            />
          )}
          <MultiSelect
            label="Previous billed / dispensed medicines"
            placeholder={
              patientOrdersLoading ? "Loading dispensed medicines..." : "Select medicine lines"
            }
            data={returnableItemOptions}
            value={selectedOrderItemIds}
            onChange={updateSelectedMedicineIds}
            error={typeof errors.items?.message === "string" ? errors.items.message : undefined}
            disabled={!patientId || patientOrdersLoading}
            searchable
            clearable
            required
          />
          {patientId.length > 0 && !patientOrdersLoading && returnableItems.length === 0 && (
            <Alert tone="neutral" icon={<IconClock size={16} />}>
              No dispensed pharmacy medicines are available for return.
            </Alert>
          )}
          {selectedReturnFields.map((field, index) => {
            const selectedLine = selectedReturnItems[index];
            const returnableItem = returnableItemById.get(selectedLine?.order_item_id ?? "");
            return (
              <Card key={field.id} withBorder radius="sm" p="sm">
                <Stack gap="xs">
                  <Group justify="space-between" align="flex-start" wrap="nowrap">
                    <Stack gap={2}>
                      <Text size="sm" fw={700}>
                        {returnableItem?.drugName ?? "Selected medicine"}
                      </Text>
                      <Group gap="xs">
                        <Badge size="xs" tone="info">
                          {returnableItem
                            ? new Date(returnableItem.orderDate).toLocaleDateString()
                            : "Order"}
                        </Badge>
                        <Badge size="xs" tone="neutral">
                          Batch {returnableItem?.batchNumber ?? "not captured"}
                        </Badge>
                        <Badge size="xs" tone="success">
                          Remaining {returnableItem?.remainingQuantity ?? 0}/
                          {returnableItem?.quantity ?? 0}
                        </Badge>
                      </Group>
                    </Stack>
                    <IconButton
                      size="sm"
                      tone="danger"
                      aria-label="Remove return line"
                      onClick={() => removeReturnItem(index)}
                    >
                      <IconTrash size={14} />
                    </IconButton>
                  </Group>
                  <Group grow align="flex-start">
                    <Controller
                      control={control}
                      name={`items.${index}.quantity_returned`}
                      render={({ field: quantityField, fieldState }) => (
                        <NumberInput
                          label="Return quantity"
                          min={1}
                          max={returnableItem?.remainingQuantity}
                          value={quantityField.value}
                          onChange={quantityField.onChange}
                          error={fieldState.error?.message}
                          required
                        />
                      )}
                    />
                    <Controller
                      control={control}
                      name={`items.${index}.reason`}
                      render={({ field: reasonField, fieldState }) => (
                        <Textarea
                          label="Reason"
                          placeholder="Wrong medicine, adverse event, patient refused, damaged strip..."
                          value={reasonField.value}
                          onChange={reasonField.onChange}
                          error={fieldState.error?.message}
                          autosize
                          minRows={1}
                        />
                      )}
                    />
                  </Group>
                </Stack>
              </Card>
            );
          })}
          <Group justify="flex-end">
            <Button tone="ghost" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              tone="primary"
              type="submit"
              loading={createMutation.isPending}
              disabled={selectedReturnItems.length === 0}
            >
              Submit {selectedReturnItems.length > 1 ? "Returns" : "Return"}
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}

function PharmacyOrderDetail({
  orderId,
  canEditItems,
  canDispense,
  canViewReturns,
  canViewPatientRecord,
}: {
  orderId: string;
  canEditItems: boolean;
  canDispense: boolean;
  canViewReturns: boolean;
  canViewPatientRecord: boolean;
}) {
  const { t } = useTranslation("pharmacy");
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showAudit, setShowAudit] = useState(false);
  const [showLabels, setShowLabels] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "schedule">("schedule");
  const emit = useClinicalEmit();
  const batchNumberAccess = useFieldAccess("pharmacy.batches.batch_number");
  const priceAccess = useFieldAccess("pharmacy.pricing.unit_price");
  const { data } = useQuery({
    queryKey: ["pharmacy-order-detail", orderId],
    queryFn: () => pharmacyService.getPharmacyOrder(orderId),
  });

  // Fetch linked prescription for structured timing data
  const detail = data as PharmacyOrderDetailResponse | undefined;
  const prescriptionId = detail?.order.prescription_id;
  const { data: rxData } = useQuery<PrescriptionWithItems>({
    queryKey: ["prescription-detail", prescriptionId],
    queryFn: () => pharmacyService.getPrescription(prescriptionId as string),
    enabled: !!prescriptionId,
  });

  // Patient identity for labels — UUID slice is medically dangerous on a
  // dispensed-medication label, so resolve to real name + UHID.
  const { data: patientName } = usePatientName(
    canViewPatientRecord ? detail?.order.patient_id : undefined,
  );

  const updateItemMutation = useMutation({
    mutationFn: ({ itemId, quantity }: { itemId: string; quantity: number }) =>
      pharmacyService.updatePharmacyOrderItem(orderId, itemId, { quantity }),
    onSuccess: (next) => {
      queryClient.setQueryData(["pharmacy-order-detail", orderId], next);
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-orders"] });
      void queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Order item and draft billing line were updated", {
        title: "Quantity updated",
      });
    },
  });

  const removeItemMutation = useMutation({
    mutationFn: (itemId: string) => pharmacyService.removePharmacyOrderItem(orderId, itemId),
    onSuccess: (next) => {
      queryClient.setQueryData(["pharmacy-order-detail", orderId], next);
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-orders"] });
      void queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Order item was removed and the draft billing line was reversed", {
        title: "Item removed",
      });
    },
  });

  const clearDispenseHandoff = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("action");
    setSearchParams(next, { replace: true });
  };
  const [dispenseOpen, dispenseModal] = useDisclosure(false);
  // Active drug allergens for the dispense-time allergy guard.
  const { data: patientAllergies = [] } = useQuery({
    queryKey: ["patient-allergies", detail?.order.patient_id],
    queryFn: () => pharmacyService.listPatientAllergies(detail?.order.patient_id ?? ""),
    enabled: dispenseOpen && Boolean(detail?.order.patient_id),
  });
  const drugAllergens = patientAllergies
    .filter((a) => a.is_active && a.allergy_type === "drug")
    .map((a) => a.allergen_name);
  const dispenseMutation = useMutation({
    mutationFn: async (payload?: {
      items: { order_item_id: string; batch_stock_id?: string; quantity: number }[];
      witnessed_by?: string;
      allergy_override_reason?: string;
    }) => {
      const currentDetail = await pharmacyService.getPharmacyOrder(orderId);
      const order = await pharmacyService.dispenseOrder(orderId, payload);
      return { admissionId: currentDetail.admission_id, items: currentDetail.items, order };
    },
    onSuccess: ({ admissionId, items, order }) => {
      dispenseModal.close();
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-orders"] });
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-order-detail", orderId] });
      void queryClient.invalidateQueries({ queryKey: ["invoices"] });
      void queryClient.invalidateQueries({ queryKey: ["invoice"] });
      void queryClient.invalidateQueries({ queryKey: ["patient-invoices", order.patient_id] });
      toast.success("Order dispensed and linked billing charges refreshed", {
        title: "Dispensed",
      });
      emit("pharmacy.order.dispensed", {
        admission_id: admissionId,
        dispensing_type: order.dispensing_type,
        encounter_id: order.encounter_id,
        items: pharmacyOrderEventItems(items),
        order_id: orderId,
        order_type: "pharmacy",
        patient_id: order.patient_id,
      });
      clearDispenseHandoff();
    },
    onError: (e: Error) => toast.error(e.message, { title: "Could not dispense order" }),
  });

  const canSubstituteDrug = useHasPermission(P.PHARMACY_IMPROVEMENTS.SUBSTITUTION_RECORD);
  const { data: detailCatalog = [] } = useQuery({
    queryKey: ["pharmacy-catalog"],
    queryFn: () => pharmacyService.listPharmacyCatalog(),
    staleTime: 300_000,
    enabled: canSubstituteDrug,
  });
  const [substituteItem, setSubstituteItem] = useState<PharmacyOrderItem | null>(null);

  if (!detail) return <Text c="dimmed">Loading...</Text>;

  const hasRxItems = rxData && rxData.items.length > 0;
  const canEditOrderItems = canEditItems && detail.order.status === "ordered";
  const canSubstitute =
    canSubstituteDrug &&
    (detail.order.status === "ordered" || detail.order.status === "partially_dispensed");
  const showItemActions = canEditOrderItems || canSubstitute;
  const isDispenseHandoff = searchParams.get("action") === "dispense";
  const isAwaitingDispense = detail.order.status === "ordered";
  const dispenseHandoffMessage = !isAwaitingDispense
    ? t("handoff.dispense.completed")
    : canDispense
      ? t("handoff.dispense.ready")
      : t("handoff.dispense.permissionRequired");
  const canPrintMedicationLabels = canViewPatientRecord && hasRxItems;
  const prescriptionPatientName = canViewPatientRecord
    ? (patientName?.full_name ?? "Linked patient")
    : "Patient restricted";
  const prescriptionUhid = canViewPatientRecord ? (patientName?.uhid ?? "") : "";
  const journeyContext: ClinicalJourneyContext = pharmacyOrderJourneyContext(detail);
  const completedEvents = journeyContext.completedEvents ?? [];

  return (
    <Stack>
      <DispenseModal
        opened={dispenseOpen}
        onClose={dispenseModal.close}
        items={detail.items}
        isDispensing={dispenseMutation.isPending}
        patientAllergens={drugAllergens}
        onDispense={(payload) => dispenseMutation.mutate(payload)}
      />
      {substituteItem && (
        <SubstituteModal
          opened={Boolean(substituteItem)}
          onClose={() => setSubstituteItem(null)}
          item={substituteItem}
          catalog={detailCatalog}
        />
      )}
      <Group justify="space-between">
        <Text fw={700}>Order: {detail.order.id.slice(0, 8)}...</Text>
        <Group gap="xs">
          {canDispense &&
            (detail.order.status === "ordered" ||
              detail.order.status === "partially_dispensed") && (
              <Button
                size="xs"
                tone="primary"
                leftSection={<IconCheck size={14} />}
                loading={dispenseMutation.isPending}
                onClick={dispenseModal.open}
              >
                Dispense
              </Button>
            )}
          <Badge tone={sharedColorBadgeTone(statusColors[detail.order.status])} size="lg">
            {detail.order.status}
          </Badge>
          <Badge variant="outline" size="sm">
            {dispensingTypeLabels[detail.order.dispensing_type] ?? detail.order.dispensing_type}
          </Badge>
        </Group>
      </Group>
      {detail.order.dispensed_at && (
        <Text size="xs" c="dimmed">
          Dispensed: {new Date(detail.order.dispensed_at).toLocaleString()}
        </Text>
      )}
      {detail.order.prescription_id && (
        <RepeatPanel
          prescriptionId={detail.order.prescription_id}
          pharmacyOrderId={detail.order.id}
        />
      )}
      {canEditOrderItems && (
        <Alert tone="info" icon={<IconShieldCheck size={16} />}>
          Edit or remove medicines before dispense. Draft billing lines stay synchronized.
        </Alert>
      )}
      <PharmacyPatientContext
        patientId={detail.order.patient_id}
        canViewPatientRecord={canViewPatientRecord}
      />
      <PatientFlowNavigator
        patientId={detail.order.patient_id}
        active="pharmacy"
        activeEncounterId={detail.order.encounter_id ?? null}
        activeAdmissionId={detail.admission_id}
        activeInvoiceId={detail.billing_invoice_id}
        activePharmacyOrderId={detail.order.id}
        activeOrderContext={detail.admission_id ? "ipd" : detail.order.encounter_id ? "opd" : null}
        completedEvents={completedEvents}
        compact
      />
      {isDispenseHandoff && (
        <Alert tone="success" title={t("handoff.dispense.title")}>
          <Group justify="space-between" align="center" gap="sm">
            <Text size="sm">{dispenseHandoffMessage}</Text>
            <Group gap="xs">
              {isAwaitingDispense && canDispense && (
                <Button
                  size="xs"
                  tone="primary"
                  leftSection={<IconCheck size={14} />}
                  loading={dispenseMutation.isPending}
                  onClick={dispenseModal.open}
                >
                  {t("button.dispenseOrder")}
                </Button>
              )}
              <Button size="xs" tone="ghost" onClick={clearDispenseHandoff}>
                {t("button.dismiss")}
              </Button>
            </Group>
          </Group>
        </Alert>
      )}
      <Card withBorder padding="sm">
        <Group justify="space-between" gap="sm" align="center">
          <Stack gap={2}>
            <Text size="xs" fw={700} c="dimmed" tt="uppercase">
              {t("handoff.patient.title")}
            </Text>
            <Text size="xs" c="dimmed">
              {t("handoff.patient.message")}
            </Text>
          </Stack>
          <PatientJourneyActions
            context={journeyContext}
            hiddenActionIds={["pharmacy.open_patient_queue"]}
            size="xs"
          />
        </Group>
      </Card>

      {/* View mode toggle — show schedule view when prescription data is available */}
      {hasRxItems && (
        <SegmentedControl
          size="xs"
          value={viewMode}
          onChange={(v) => setViewMode(v as "table" | "schedule")}
          data={[
            { value: "schedule", label: "Medication Schedule" },
            { value: "table", label: "Order Table" },
          ]}
        />
      )}

      {/* Schedule view — time-grouped with timing/food instructions */}
      {viewMode === "schedule" && hasRxItems ? (
        <PharmacyDispensingView items={rxData.items} />
      ) : (
        <Table striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Drug</Table.Th>
              <Table.Th>Batch</Table.Th>
              <Table.Th>Expiry</Table.Th>
              <Table.Th>Qty</Table.Th>
              <Table.Th>Unit Price</Table.Th>
              <Table.Th>Total</Table.Th>
              {canViewReturns && <Table.Th>Returned</Table.Th>}
              {showItemActions && <Table.Th>Actions</Table.Th>}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {detail.items.map((item) => (
              <Table.Tr key={item.id}>
                <Table.Td>{item.drug_name}</Table.Td>
                <Table.Td>
                  {renderPharmacySensitiveValue(batchNumberAccess, item.batch_number)}
                </Table.Td>
                <Table.Td>
                  {item.expiry_date ? <ExpiryCell date={item.expiry_date} /> : "\u2014"}
                </Table.Td>
                <Table.Td>
                  {canEditOrderItems ? (
                    <EditablePharmacyQuantity
                      key={`${item.id}-${item.quantity}`}
                      item={item}
                      isSaving={updateItemMutation.isPending}
                      onSave={(quantity) =>
                        updateItemMutation.mutate({ itemId: item.id, quantity })
                      }
                    />
                  ) : (
                    item.quantity
                  )}
                </Table.Td>
                <Table.Td>{renderPharmacySensitiveCurrency(priceAccess, item.unit_price)}</Table.Td>
                <Table.Td>
                  {renderPharmacySensitiveCurrency(priceAccess, item.total_price)}
                </Table.Td>
                {canViewReturns && (
                  <Table.Td>{item.quantity_returned > 0 ? item.quantity_returned : "—"}</Table.Td>
                )}
                {showItemActions && (
                  <Table.Td>
                    <Group gap={4} wrap="nowrap">
                      {canSubstitute && (
                        <Tooltip label="Substitute medication">
                          <IconButton
                            size="sm"
                            tone="default"
                            onClick={() => setSubstituteItem(item)}
                            aria-label={`Substitute ${item.drug_name}`}
                          >
                            <IconReplace size={14} />
                          </IconButton>
                        </Tooltip>
                      )}
                      {canEditOrderItems && (
                        <Tooltip
                          label={
                            detail.items.length <= 1
                              ? "At least one item must remain"
                              : "Remove item before dispense"
                          }
                        >
                          <IconButton
                            size="sm"
                            tone="danger"
                            disabled={detail.items.length <= 1 || removeItemMutation.isPending}
                            onClick={() =>
                              confirmDestructive({
                                title: "Remove drug",
                                message: `Remove ${item.drug_name} from this order?`,
                                confirmLabel: "Remove drug",
                                onConfirm: () => removeItemMutation.mutate(item.id),
                              })
                            }
                            aria-label={`Remove ${item.drug_name}`}
                          >
                            <IconTrash size={14} />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Group>
                  </Table.Td>
                )}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      {/* FEFO assistance: when the order is awaiting dispense, surface
          earliest-expiry batches so the dispenser doesn't need to flip
          to the Batches tab to apply First-Expiry-First-Out. */}
      {detail.order.status === "ordered" && detail.items.length > 0 && (
        <NearExpiryHints drugNames={Array.from(new Set(detail.items.map((i) => i.drug_name)))} />
      )}

      <Group gap="xs">
        <Button
          tone="secondary"
          size="xs"
          leftSection={<IconClipboardList size={14} />}
          onClick={() => setShowAudit(!showAudit)}
        >
          {showAudit ? "Hide" : "Show"} Prescription Audit Trail
        </Button>
        {canPrintMedicationLabels && (
          <Button tone="secondary" size="xs" onClick={() => setShowLabels(!showLabels)}>
            {showLabels ? "Hide" : "Print"} Medication Labels
          </Button>
        )}
      </Group>
      {showAudit && <PrescriptionAuditTrail prescriptionId={orderId} />}
      {showLabels && canPrintMedicationLabels && (
        <PharmacyLabel
          items={rxData.items}
          patientName={prescriptionPatientName}
          uhid={prescriptionUhid}
          date={new Date().toLocaleDateString()}
        />
      )}

      {hasRxItems && (
        <PrescriptionViews
          prescriptions={[rxData]}
          patientName={prescriptionPatientName}
          uhid={prescriptionUhid}
          allergies={[]}
        />
      )}
    </Stack>
  );
}

function PosCounterTab({
  canView,
  canCreate,
  canCancel,
  canReturn,
  canViewPatientRecord,
}: {
  canView: boolean;
  canCreate: boolean;
  canCancel: boolean;
  canReturn: boolean;
  canViewPatientRecord: boolean;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const canViewBillingInvoice = useHasPermission(P.BILLING.INVOICES_VIEW);
  const [drugSelectValue, setDrugSelectValue] = useState("");
  const [saleToCancel, setSaleToCancel] = useState<PharmacyPosSale | null>(null);
  const [saleToReturn, setSaleToReturn] = useState<PharmacyPosSale | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelOpened, { open: openCancelModal, close: closeCancelModal }] = useDisclosure(false);
  const [returnOpened, { open: openReturnModal, close: closeReturnModal }] = useDisclosure(false);
  const [returnItemsLoading, setReturnItemsLoading] = useState(false);
  const walkInNameAccess = useFieldAccess("pharmacy.pos.patient_name");
  const walkInPhoneAccess = useFieldAccess("pharmacy.pos.patient_phone");
  const priceAccess = useFieldAccess("pharmacy.pricing.unit_price");
  const batchNumberAccess = useFieldAccess("pharmacy.batches.batch_number");
  const canViewWalkInName = canViewPharmacyField(walkInNameAccess);
  const canViewWalkInPhone = canViewPharmacyField(walkInPhoneAccess);
  const canEditWalkInName = canEditPharmacyField(walkInNameAccess);
  const canEditWalkInPhone = canEditPharmacyField(walkInPhoneAccess);
  const canEditPosAmounts = canEditPharmacyField(priceAccess);
  const posSaleDefaults: PharmacyPosSaleFormInput = {
    patient_id: "",
    patient_name: "",
    patient_phone: "",
    payment_mode: "cash",
    amount_received: 0,
    discount_percent: 0,
    items: [],
  };
  const {
    control,
    register,
    reset,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<PharmacyPosSaleFormInput>({
    resolver: zodResolver(pharmacyPosSaleFormSchema),
    defaultValues: posSaleDefaults,
  });
  const { fields, append, remove, update } = useFieldArray({
    control,
    name: "items",
  });
  const posReturnDefaults: PharmacyPosReturnFormInput = {
    reason: "",
    items: [],
  };
  const {
    control: returnControl,
    reset: resetReturnForm,
    handleSubmit: handleReturnSubmit,
    watch: watchReturn,
    setError: setReturnError,
    formState: { errors: returnErrors },
  } = useForm<PharmacyPosReturnFormInput>({
    resolver: zodResolver(pharmacyPosReturnFormSchema),
    defaultValues: posReturnDefaults,
  });
  const { fields: returnFields } = useFieldArray({
    control: returnControl,
    name: "items",
  });

  const cart = watch("items");
  const amountReceived = watch("amount_received");
  const discountPercent = watch("discount_percent");
  const registeredPatientId = watch("patient_id");

  // Allergy guard for patient-linked counter sales.
  const [posAllergyReason, setPosAllergyReason] = useState("");
  const { data: posPatientAllergies = [] } = useQuery({
    queryKey: ["patient-allergies", registeredPatientId],
    queryFn: () => pharmacyService.listPatientAllergies(registeredPatientId),
    enabled: Boolean(registeredPatientId),
  });
  const posAllergyConflicts = useMemo(() => {
    const allergens = posPatientAllergies
      .filter((a) => a.is_active && a.allergy_type === "drug")
      .map((a) => a.allergen_name);
    if (allergens.length === 0) return [];
    return findAllergyConflicts(
      (cart ?? []).map((c) => c.drug_name ?? ""),
      allergens,
    );
  }, [cart, posPatientAllergies]);
  const posAllergyBlocked = posAllergyConflicts.length > 0 && posAllergyReason.trim().length < 5;

  const { data: daySummary } = useQuery({
    queryKey: ["pharmacy-pos-day-summary"],
    queryFn: () => pharmacyService.getPosDaySummary(),
    enabled: canView,
    refetchInterval: 60_000,
  });

  const { data: sales = [], isLoading: salesLoading } = useQuery({
    queryKey: ["pharmacy-pos-sales"],
    queryFn: () => pharmacyService.listPosSales(),
    enabled: canView || canCancel || canReturn,
  });

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => pharmacyService.createPosSale(data),
    onSuccess: (sale, variables) => {
      const patientId = posSalePayloadPatientId(variables);
      const billingInvoiceId = sale.billing_invoice_id;
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-pos"] });
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-pos-day-summary"] });
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-pos-sales"] });
      void queryClient.invalidateQueries({ queryKey: ["invoices"] });
      if (billingInvoiceId) {
        void queryClient.invalidateQueries({ queryKey: ["invoice-detail", billingInvoiceId] });
      }
      void queryClient.invalidateQueries({ queryKey: ["patients"] });
      if (patientId) {
        void queryClient.invalidateQueries({ queryKey: ["patient-context", patientId] });
        void queryClient.invalidateQueries({ queryKey: ["patient-invoices", patientId] });
      }
      reset(posSaleDefaults);
      setDrugSelectValue("");
      toast.success(
        patientId && billingInvoiceId
          ? "Pharmacy sale recorded and linked to the Billing invoice workbench"
          : "Walk-in sale recorded in Pharmacy POS",
        { title: "Sale Complete" },
      );
    },
  });

  const cancelSaleMutation = useMutation({
    mutationFn: ({ saleId, reason }: { saleId: string; reason: string }) =>
      pharmacyService.cancelPharmacyPosSale(saleId, { reason }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-pos"] });
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-pos-day-summary"] });
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-pos-sales"] });
      void queryClient.invalidateQueries({ queryKey: ["invoices"] });
      closeCancelSale();
      toast.success("Stock reversal and POS refund entry were recorded", {
        title: "Sale cancelled",
      });
    },
    onError: () => {
      toast.error("The sale may already be cancelled, refunded, or locked by finance controls", {
        title: "Unable to cancel sale",
      });
    },
  });

  const returnItemsMutation = useMutation({
    mutationFn: ({
      saleId,
      data,
    }: {
      saleId: string;
      data: {
        items: Array<{ item_id: string; return_qty: number; reason?: string }>;
        reason?: string;
      };
    }) => pharmacyService.returnPosItems(saleId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-pos"] });
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-pos-day-summary"] });
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-pos-sales"] });
      void queryClient.invalidateQueries({ queryKey: ["invoices"] });
      closeReturnSale();
      toast.success("Partial return, stock reversal, and POS refund entry were recorded", {
        title: "Items returned",
      });
    },
    onError: () => {
      toast.error("The sale may already be refunded, cancelled, or locked by finance controls", {
        title: "Unable to return items",
      });
    },
  });

  const subtotal = cart.reduce(
    (sum, item) => sum + posSaleLineQuantity(item) * posSaleLinePrice(item),
    0,
  );
  const discount = subtotal * (formNumberOrFallback(discountPercent, 0) / 100);
  const gstAmount = (subtotal - discount) * 0.05;
  const totalAmount = subtotal - discount + gstAmount;
  const changeDue = formNumberOrFallback(amountReceived, 0) - totalAmount;

  function addToCart(itemId: string, drugName: string, unitPrice: number) {
    const existingIndex = cart.findIndex((c) => c.catalog_item_id === itemId);
    if (existingIndex >= 0) {
      const existing = cart[existingIndex];
      if (existing) {
        update(existingIndex, { ...existing, quantity: posSaleLineQuantity(existing) + 1 });
      }
      return;
    }
    append({
      catalog_item_id: itemId,
      drug_name: drugName,
      quantity: 1,
      unit_price: unitPrice,
    });
  }

  function updateQuantity(index: number, quantity: number | string) {
    const item = cart[index];
    if (!item) return;
    update(index, { ...item, quantity: formIntegerOrFallback(quantity, 0) });
  }

  function updatePrice(index: number, price: number | string) {
    const item = cart[index];
    if (!item) return;
    update(index, { ...item, unit_price: formNumberOrFallback(price, 0) });
  }

  function handleSubmitSale(values: PharmacyPosSaleFormInput) {
    if (posAllergyBlocked) {
      toast.error("Documented drug allergy — record an override reason to sell.", {
        title: "Allergy conflict",
      });
      return;
    }
    const subtotalValue = values.items.reduce(
      (sum, item) => sum + posSaleLineQuantity(item) * posSaleLinePrice(item),
      0,
    );
    const discountPercentValue = formNumberOrFallback(values.discount_percent, 0);
    const discountValue = subtotalValue * (discountPercentValue / 100);
    createMutation.mutate({
      patient_id: optionalFormText(values.patient_id),
      allergy_override_reason: posAllergyConflicts.length > 0 ? posAllergyReason.trim() : undefined,
      items: values.items.map((c) => ({
        catalog_item_id: c.catalog_item_id,
        drug_name: c.drug_name,
        quantity: posSaleLineQuantity(c),
        mrp: posSaleLinePrice(c),
        selling_price: posSaleLinePrice(c),
        gst_rate: 5,
      })),
      payment_mode: values.payment_mode,
      amount_received: formNumberOrFallback(values.amount_received, 0),
      patient_name: canEditWalkInName ? optionalFormText(values.patient_name) : undefined,
      patient_phone: canEditWalkInPhone ? optionalFormText(values.patient_phone) : undefined,
      discount_percent: discountPercentValue || undefined,
      discount_amount: discountValue > 0 ? discountValue : undefined,
    });
  }

  function openCancelSale(row: PharmacyPosSale) {
    setSaleToCancel(row);
    setCancelReason("");
    openCancelModal();
  }

  function closeCancelSale() {
    closeCancelModal();
    setSaleToCancel(null);
    setCancelReason("");
  }

  async function openReturnSale(row: PharmacyPosSale) {
    setSaleToReturn(row);
    resetReturnForm(posReturnDefaults);
    openReturnModal();
    setReturnItemsLoading(true);
    try {
      const items = await queryClient.fetchQuery<PharmacyPosSaleItem[]>({
        queryKey: ["pharmacy-pos-sale-items", row.id],
        queryFn: () => pharmacyService.listPosSaleItems(row.id),
      });
      resetReturnForm({
        reason: "",
        items: items
          .filter((item) => posSaleItemReturnableQuantity(item) > 0)
          .map((item) => ({
            item_id: item.id,
            drug_name: item.drug_name,
            batch_number: item.batch_number ?? "",
            max_qty: posSaleItemReturnableQuantity(item),
            return_qty: 0,
            unit_price: Number(item.selling_price ?? 0),
          })),
      });
    } catch {
      toast.error("Check POS return permission and try again", {
        title: "Unable to load sale items",
      });
    } finally {
      setReturnItemsLoading(false);
    }
  }

  function closeReturnSale() {
    closeReturnModal();
    setSaleToReturn(null);
    resetReturnForm(posReturnDefaults);
    setReturnItemsLoading(false);
  }

  function submitReturnItems(values: PharmacyPosReturnFormInput) {
    if (!saleToReturn) return;
    const selectedItems = values.items
      .map((item) => ({
        item,
        returnQty: posReturnLineQuantity(item),
      }))
      .filter(({ returnQty }) => returnQty > 0);

    if (selectedItems.length === 0) {
      setReturnError("items", { message: "Select at least one medicine to return" });
      return;
    }

    const invalidIndex = selectedItems.findIndex(
      ({ item, returnQty }) => returnQty > formIntegerOrFallback(item.max_qty, 0),
    );
    if (invalidIndex >= 0) {
      const invalidItem = selectedItems[invalidIndex]?.item;
      const formIndex = values.items.findIndex((item) => item.item_id === invalidItem?.item_id);
      if (formIndex >= 0) {
        setReturnError(`items.${formIndex}.return_qty` as const, {
          message: "Return quantity cannot exceed remaining sale quantity",
        });
      }
      return;
    }

    returnItemsMutation.mutate({
      saleId: saleToReturn.id,
      data: {
        reason: values.reason.trim(),
        items: selectedItems.map(({ item, returnQty }) => ({
          item_id: item.item_id,
          return_qty: returnQty,
        })),
      },
    });
  }

  const returnItems = watchReturn("items");
  const returnRefundTotal = returnItems.reduce(
    (sum, item) => sum + posReturnLineQuantity(item) * posReturnLinePrice(item),
    0,
  );

  const saleColumns = [
    {
      key: "sale_number",
      label: "Sale #",
      sortable: true,
      searchable: true,
      accessor: (row: PharmacyPosSale) => row.sale_number,
      render: (row: PharmacyPosSale) => (
        <Text size="sm" fw={600}>
          {row.sale_number}
        </Text>
      ),
    },
    {
      key: "patient_name",
      label: "Customer",
      searchable: true,
      accessor: (row: PharmacyPosSale) => row.patient_name ?? "",
      render: (row: PharmacyPosSale) =>
        row.patient_id ? (
          <PharmacyPatientCell
            patientId={row.patient_id}
            canViewPatientRecord={canViewPatientRecord}
          />
        ) : (
          <Stack gap={0}>
            <Text size="sm" c={canViewWalkInName ? undefined : "dimmed"}>
              {row.patient_name
                ? fieldAccessText(walkInNameAccess, row.patient_name, "name")
                : "Walk-in"}
            </Text>
            {canViewWalkInPhone && row.patient_phone && (
              <Text size="xs" c="dimmed">
                {fieldAccessText(walkInPhoneAccess, row.patient_phone, "phone")}
              </Text>
            )}
          </Stack>
        ),
    },
    {
      key: "total_amount",
      label: "Total",
      sortable: true,
      sortValue: (row: PharmacyPosSale) => Number(row.total_amount),
      accessor: (row: PharmacyPosSale) => Number(row.total_amount),
      render: (row: PharmacyPosSale) => (
        <Text size="sm" fw={700}>
          {renderPharmacySensitiveCurrency(priceAccess, row.total_amount)}
        </Text>
      ),
    },
    {
      key: "payment_mode",
      label: "Payment",
      accessor: (row: PharmacyPosSale) => row.payment_mode,
      render: (row: PharmacyPosSale) => <Badge size="xs">{row.payment_mode}</Badge>,
    },
    {
      key: "billing_invoice_id",
      label: "Billing",
      render: (row: PharmacyPosSale) =>
        row.billing_invoice_id ? (
          <Stack gap={2}>
            <Badge size="xs" tone="success">
              Posted
            </Badge>
            {row.billing_posted_at && (
              <Text size="xs" c="dimmed">
                {new Date(row.billing_posted_at).toLocaleTimeString()}
              </Text>
            )}
            {canViewBillingInvoice && (
              <Button
                size="compact-xs"
                tone="ghost"
                leftSection={<IconReceipt size={12} />}
                onClick={() => navigate(`/billing/invoices/${row.billing_invoice_id}`)}
              >
                Open invoice
              </Button>
            )}
          </Stack>
        ) : (
          <Badge size="xs" tone="neutral">
            POS only
          </Badge>
        ),
    },
    {
      key: "status",
      label: "Status",
      render: (row: PharmacyPosSale) => {
        const saleStatus = row.status ?? "completed";
        const refundAmount = Number(row.refund_amount ?? 0);
        return (
          <Stack gap={2}>
            <Badge size="xs" tone={sharedColorBadgeTone(statusColors[saleStatus])}>
              {saleStatus.replace(/_/g, " ")}
            </Badge>
            {refundAmount > 0 && (
              <Text size="xs" c="dimmed">
                Refund {renderPharmacySensitiveCurrency(priceAccess, refundAmount)}
              </Text>
            )}
          </Stack>
        );
      },
    },
    {
      key: "created_at",
      label: "Time",
      sortable: true,
      sortValue: (row: PharmacyPosSale) => row.created_at,
      accessor: (row: PharmacyPosSale) => new Date(row.created_at).toLocaleTimeString(),
      render: (row: PharmacyPosSale) => (
        <Text size="sm">{new Date(row.created_at).toLocaleTimeString()}</Text>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (row: PharmacyPosSale) => {
        const saleStatus = row.status ?? "completed";
        const canCancelSale = canCancel && !["cancelled", "refunded"].includes(saleStatus);
        const canReturnSale = canReturn && !["cancelled", "refunded"].includes(saleStatus);
        return canCancelSale || canReturnSale ? (
          <Group gap={4} wrap="nowrap">
            {canReturnSale && (
              <Tooltip label="Return selected items">
                <IconButton
                  size="sm"
                  tone="default"
                  onClick={() => {
                    void openReturnSale(row);
                  }}
                  aria-label="Return POS sale items"
                >
                  <IconReceipt size={14} />
                </IconButton>
              </Tooltip>
            )}
            {canCancelSale && (
              <Tooltip label="Cancel sale and reverse remaining stock/refund">
                <IconButton
                  size="sm"
                  tone="danger"
                  onClick={() => openCancelSale(row)}
                  aria-label="Cancel POS sale"
                >
                  <IconX size={14} />
                </IconButton>
              </Tooltip>
            )}
          </Group>
        ) : (
          <Text size="xs" c="dimmed">
            Locked
          </Text>
        );
      },
    },
  ];

  const saleFilters: DataTableFilter<PharmacyPosSale>[] = [
    {
      key: "payment_mode",
      label: "Payment",
      options: pharmacyPosPaymentModeOptions.map((option) => ({
        value: option.value,
        label: option.label,
      })),
      matches: (row, value) => row.payment_mode === value,
    },
  ];

  return (
    <Stack>
      {canView && daySummary && (
        <Group gap="lg">
          <Card withBorder p="xs" style={{ flex: 1 }}>
            <Text size="xs" c="dimmed">
              Sales Today
            </Text>
            <Text size="lg" fw={700}>
              {daySummary.total_sales}
            </Text>
          </Card>
          <Card withBorder p="xs" style={{ flex: 1 }}>
            <Text size="xs" c="dimmed">
              Revenue
            </Text>
            <Text size="lg" fw={700}>
              {renderPharmacySensitiveCurrency(priceAccess, daySummary.total_revenue)}
            </Text>
          </Card>
          <Card withBorder p="xs" style={{ flex: 1 }}>
            <Text size="xs" c="dimmed">
              Cash
            </Text>
            <Text size="lg" fw={700}>
              {renderPharmacySensitiveCurrency(priceAccess, daySummary.cash_total)}
            </Text>
          </Card>
          <Card withBorder p="xs" style={{ flex: 1 }}>
            <Text size="xs" c="dimmed">
              Card/UPI
            </Text>
            <Text size="lg" fw={700}>
              {renderPharmacySensitiveCurrency(
                priceAccess,
                Number(daySummary.card_total) + Number(daySummary.upi_total),
              )}
            </Text>
          </Card>
        </Group>
      )}

      {canCreate && (
        <Card withBorder p="md">
          <Stack component="form" onSubmit={handleSubmit(handleSubmitSale)}>
            <Text fw={600}>New Sale</Text>
            <Alert tone={registeredPatientId ? "info" : "neutral"}>
              {registeredPatientId
                ? "Registered patient sale will post a paid invoice into Billing and keep Pharmacy POS as the stock and cash-drawer source."
                : "Walk-in sale stays in Pharmacy POS until a registered patient is selected."}
            </Alert>
            <Group mb="sm" align="flex-end">
              <DrugSearchSelect
                label="Add medicine"
                value={drugSelectValue}
                onChange={(id: string, drug) => {
                  setDrugSelectValue("");
                  addToCart(id, drug?.name ?? id, Number(drug?.base_price ?? 0));
                }}
              />
              <Controller
                control={control}
                name="patient_id"
                render={({ field, fieldState }) => (
                  <PatientSearchSelect
                    size="xs"
                    label="Registered patient"
                    value={field.value}
                    onChange={field.onChange}
                    error={fieldState.error?.message}
                  />
                )}
              />
              {canViewWalkInName && (
                <TextInput
                  size="xs"
                  label="Customer"
                  w={160}
                  disabled={!canEditWalkInName}
                  {...register("patient_name")}
                />
              )}
              {canViewWalkInPhone && (
                <TextInput
                  size="xs"
                  label="Phone"
                  w={130}
                  disabled={!canEditWalkInPhone}
                  {...register("patient_phone")}
                />
              )}
            </Group>

            {posAllergyConflicts.length > 0 && (
              <Alert
                tone="danger"
                icon={<IconAlertTriangle size={16} />}
                title="Documented drug allergy"
              >
                <Stack gap={4}>
                  {posAllergyConflicts.map((c) => (
                    <Text key={c.drug} size="sm">
                      <b>{c.drug}</b> — patient allergic to {c.allergen}
                      {c.cross ? " (cross-reactive)" : ""}
                    </Text>
                  ))}
                  <Textarea
                    label="Override reason"
                    required
                    autosize
                    minRows={2}
                    placeholder="e.g. Prior documented tolerance; prescriber confirmed; no alternative"
                    value={posAllergyReason}
                    onChange={(e) => setPosAllergyReason(e.currentTarget.value)}
                    error={
                      posAllergyBlocked ? "A reason (≥5 chars) is required to sell" : undefined
                    }
                  />
                </Stack>
              </Alert>
            )}

            {cart.length > 0 && (
              <Table striped highlightOnHover mb="sm">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Drug</Table.Th>
                    <Table.Th>Qty</Table.Th>
                    <Table.Th>Price</Table.Th>
                    <Table.Th>Line Total</Table.Th>
                    <Table.Th />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {fields.map((field, index) => {
                    const item = cart[index];
                    if (!item) return null;

                    return (
                      <Table.Tr key={field.id}>
                        <Table.Td>
                          <Text size="sm">{item.drug_name}</Text>
                        </Table.Td>
                        <Table.Td>
                          <NumberInput
                            size="xs"
                            w={70}
                            min={1}
                            value={posSaleLineQuantity(item)}
                            onChange={(val) => updateQuantity(index, val)}
                            error={errors.items?.[index]?.quantity?.message}
                          />
                        </Table.Td>
                        <Table.Td>
                          <NumberInput
                            size="xs"
                            w={90}
                            min={0}
                            decimalScale={2}
                            prefix={"\u20B9"}
                            value={posSaleLinePrice(item)}
                            disabled={!canEditPosAmounts}
                            onChange={(val) => updatePrice(index, val)}
                            error={errors.items?.[index]?.unit_price?.message}
                          />
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" fw={600}>
                            {renderPharmacySensitiveCurrency(
                              priceAccess,
                              posSaleLineQuantity(item) * posSaleLinePrice(item),
                            )}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <IconButton
                            size="sm"
                            tone="danger"
                            onClick={() => remove(index)}
                            aria-label="Remove sale line"
                          >
                            <IconX size={14} />
                          </IconButton>
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            )}
            {errors.items?.message && (
              <Text size="xs" c="danger">
                {errors.items.message}
              </Text>
            )}

            {cart.length > 0 && (
              <Group justify="space-between" align="flex-end">
                <Group gap="sm">
                  <Controller
                    control={control}
                    name="discount_percent"
                    render={({ field, fieldState }) => (
                      <NumberInput
                        size="xs"
                        label="Discount %"
                        w={90}
                        min={0}
                        max={100}
                        value={field.value}
                        onChange={field.onChange}
                        error={fieldState.error?.message}
                      />
                    )}
                  />
                  <Controller
                    control={control}
                    name="payment_mode"
                    render={({ field, fieldState }) => (
                      <Select
                        size="xs"
                        label="Payment"
                        w={130}
                        data={pharmacyPosPaymentModeOptions}
                        value={field.value}
                        onChange={(value) => field.onChange(value ?? "cash")}
                        error={fieldState.error?.message}
                      />
                    )}
                  />
                  <Controller
                    control={control}
                    name="amount_received"
                    render={({ field, fieldState }) => (
                      <NumberInput
                        size="xs"
                        label="Received"
                        w={120}
                        min={0}
                        decimalScale={2}
                        prefix={"\u20B9"}
                        value={field.value}
                        disabled={!canEditPosAmounts}
                        onChange={field.onChange}
                        error={fieldState.error?.message}
                      />
                    )}
                  />
                </Group>
                <Stack gap={2} align="flex-end">
                  <Text size="sm">
                    Subtotal: {renderPharmacySensitiveCurrency(priceAccess, subtotal)} | GST:{" "}
                    {renderPharmacySensitiveCurrency(priceAccess, gstAmount)} | Total:{" "}
                    <b>{renderPharmacySensitiveCurrency(priceAccess, totalAmount)}</b>
                  </Text>
                  {changeDue > 0 && (
                    <Text size="xs" c="green">
                      Change: {renderPharmacySensitiveCurrency(priceAccess, changeDue)}
                    </Text>
                  )}
                  <Button
                    size="xs"
                    tone="primary"
                    loading={createMutation.isPending}
                    type="submit"
                    disabled={
                      !canEditPosAmounts ||
                      cart.length === 0 ||
                      posAllergyBlocked ||
                      formNumberOrFallback(amountReceived, 0) < totalAmount
                    }
                    leftSection={<IconShoppingCart size={14} />}
                  >
                    Complete Sale
                  </Button>
                </Stack>
              </Group>
            )}
          </Stack>
        </Card>
      )}

      {canView || canCancel || canReturn ? (
        <>
          <Text fw={600} mt="md">
            {canView ? "Today's Sales" : "Today's sales available for POS actions"}
          </Text>
          <DataTable
            columns={saleColumns}
            data={sales}
            loading={salesLoading}
            rowKey={(row) => row.id}
            searchable
            searchPlaceholder="Search sales"
            exportable
            exportFileName="pharmacy-pos-sales"
            filters={saleFilters}
          />
        </>
      ) : (
        <Card withBorder p="md">
          <Text size="sm" c="dimmed">
            POS sale history is not available for your role. You can still complete a new counter
            sale when POS creation is allowed.
          </Text>
        </Card>
      )}
      <Modal
        opened={returnOpened}
        onClose={closeReturnSale}
        title="Return POS sale items"
        size="lg"
      >
        <Stack component="form" onSubmit={handleReturnSubmit(submitReturnItems)}>
          <Alert tone="warning" icon={<IconAlertTriangle size={16} />}>
            Return only the medicines actually coming back to pharmacy. This posts a partial POS
            refund and restores stock for the selected quantities.
          </Alert>
          {saleToReturn && (
            <Group justify="space-between">
              <Stack gap={0}>
                <Text size="sm" fw={600}>
                  {saleToReturn.sale_number}
                </Text>
                <Text size="xs" c="dimmed">
                  {new Date(saleToReturn.created_at).toLocaleString()}
                </Text>
              </Stack>
              <Text size="sm" fw={700}>
                {renderPharmacySensitiveCurrency(priceAccess, saleToReturn.total_amount)}
              </Text>
            </Group>
          )}

          {returnItemsLoading ? (
            <Group gap="xs">
              <Loader size="sm" />
              <Text size="sm" c="dimmed">
                Loading sale items...
              </Text>
            </Group>
          ) : returnFields.length > 0 ? (
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Medicine</Table.Th>
                  <Table.Th>Batch</Table.Th>
                  <Table.Th>Remaining</Table.Th>
                  <Table.Th>Return</Table.Th>
                  <Table.Th>Refund</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {returnFields.map((field, index) => {
                  const item = returnItems[index];
                  if (!item) return null;
                  const returnQty = posReturnLineQuantity(item);
                  const refund = returnQty * posReturnLinePrice(item);
                  return (
                    <Table.Tr key={field.id}>
                      <Table.Td>
                        <Text size="sm" fw={600}>
                          {item.drug_name}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">
                          {renderPharmacySensitiveValue(batchNumberAccess, item.batch_number)}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge>{formIntegerOrFallback(item.max_qty, 0)}</Badge>
                      </Table.Td>
                      <Table.Td>
                        <Controller
                          control={returnControl}
                          name={`items.${index}.return_qty` as const}
                          render={({ field: qtyField }) => (
                            <NumberInput
                              size="xs"
                              min={0}
                              max={formIntegerOrFallback(item.max_qty, 0)}
                              value={qtyField.value}
                              onChange={qtyField.onChange}
                              error={returnErrors.items?.[index]?.return_qty?.message}
                              w={100}
                            />
                          )}
                        />
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" fw={600}>
                          {renderPharmacySensitiveCurrency(priceAccess, refund)}
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          ) : (
            <Alert tone="neutral">No returnable items remain on this sale.</Alert>
          )}
          {returnErrors.items?.message && (
            <Text size="xs" c="danger">
              {returnErrors.items.message}
            </Text>
          )}
          <Controller
            control={returnControl}
            name="reason"
            render={({ field, fieldState }) => (
              <Textarea
                label="Return reason"
                required
                minRows={3}
                placeholder="Patient returned medicine, wrong item, damaged strip..."
                error={fieldState.error?.message}
                {...field}
              />
            )}
          />
          <Group justify="space-between">
            <Text fw={700}>
              Refund: {renderPharmacySensitiveCurrency(priceAccess, returnRefundTotal)}
            </Text>
            <Group>
              <Button tone="secondary" onClick={closeReturnSale}>
                Keep sale
              </Button>
              <Button
                tone="primary"
                type="submit"
                loading={returnItemsMutation.isPending}
                disabled={returnItemsLoading || returnFields.length === 0}
                leftSection={<IconReceipt size={14} />}
              >
                Return selected items
              </Button>
            </Group>
          </Group>
        </Stack>
      </Modal>
      <Modal opened={cancelOpened} onClose={closeCancelSale} title="Cancel POS sale" centered>
        <Stack>
          <Alert tone="warning" icon={<IconAlertTriangle size={16} />}>
            Cancelling reverses remaining stock and records a POS refund transaction. Use this only
            for same-day voids or cashier-approved sale reversals.
          </Alert>
          {saleToCancel && (
            <Group justify="space-between">
              <Text size="sm" fw={600}>
                {saleToCancel.sale_number}
              </Text>
              <Text size="sm" fw={700}>
                {renderPharmacySensitiveCurrency(priceAccess, saleToCancel.total_amount)}
              </Text>
            </Group>
          )}
          <Textarea
            label="Reason"
            required
            minRows={3}
            value={cancelReason}
            onChange={(event) => setCancelReason(event.currentTarget.value)}
            placeholder="Wrong item, duplicate bill, payment void, or other approved reason"
          />
          <Group justify="flex-end">
            <Button tone="secondary" onClick={closeCancelSale}>
              Keep sale
            </Button>
            <Button
              tone="danger"
              loading={cancelSaleMutation.isPending}
              disabled={!saleToCancel || cancelReason.trim().length < 3}
              leftSection={<IconX size={14} />}
              onClick={() => {
                if (!saleToCancel) return;
                cancelSaleMutation.mutate({
                  saleId: saleToCancel.id,
                  reason: cancelReason.trim(),
                });
              }}
            >
              Cancel sale
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
