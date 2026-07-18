import { zodResolver } from "@hookform/resolvers/zod";
import {
  Box,
  Card,
  Divider,
  Grid,
  Group,
  NumberInput,
  Progress,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type {
  BillingCreateInvoiceFormInput,
  BillingCreditNoteFormInput,
  BillingDiscountFormInput,
  BillingInsuranceClaimFormInput,
  BillingInvoiceItemFormInput,
  BillingRefundFormInput,
  BillingTpaRateCardFormInput,
  BillingWriteOffFormInput,
} from "@medbrains/schemas";
import {
  billingCreateInvoiceFormSchema,
  billingCreditNoteFormSchema,
  billingDiscountFormSchema,
  billingInsuranceClaimFormSchema,
  billingInvoiceItemFormSchema,
  billingRefundFormSchema,
  billingTpaRateCardFormSchema,
  billingWriteOffFormSchema,
} from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type {
  AddDiscountRequest,
  AddInvoiceItemRequest,
  ApproveWriteOffRequest,
  BadDebtWriteOff,
  ClinicalEventName,
  ClinicalJourneyContext,
  CopayCalculation,
  CreateCreditNoteRequest,
  CreateInsuranceClaimRequest,
  CreateInvoiceRequest,
  CreateRefundRequest,
  CreateTpaRateCardRequest,
  CreateWriteOffRequest,
  CreditNote, // Phase 3
  InsuranceClaim,
  Invoice,
  InvoiceDetailResponse,
  InvoiceDiscount,
  RecordPaymentRequest,
  Refund,
  TpaRateCard,
} from "@medbrains/types";
import {
  billingInvoiceBalanceSignal,
  billingInvoiceStatusSignal,
  P,
  PATIENT_NAME_FIELD_ACCESS_KEYS,
  PATIENT_UHID_FIELD_ACCESS_KEY,
} from "@medbrains/types";
import {
  IconBuildingBank,
  IconCalendarCheck,
  IconCash,
  IconChartBar,
  IconCheck,
  IconClipboardList,
  IconCoin,
  IconCopy,
  IconCreditCard,
  IconDatabase,
  IconDiscount,
  IconDiscount2,
  IconEye,
  IconFileInvoice,
  IconListCheck,
  IconMoneybag,
  IconPackage,
  IconPlus,
  IconPrinter,
  IconReceipt,
  IconRefresh,
  IconReportMoney,
  IconScale,
  IconSettings,
  IconShieldCheck,
  IconShieldHalf,
  IconTags,
  IconTransferIn,
  IconTrash,
  IconWallet,
  IconX,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams, useSearchParams } from "react-router";
import {
  ClinicalEventProvider,
  type Column,
  DataTable,
  DocumentActions,
  FormModal,
  OperationalSignal,
  PageHeader,
  PaymentCollectPanel,
  type SortState,
  useClinicalEmit,
  useProtectedFieldAccess,
} from "@/components";
import { NhcxPayerDirectory } from "@/components/Nhcx/NhcxPayerDirectory";
import { SubmitToNhcxModal } from "@/components/Nhcx/SubmitToNhcxModal";
import { PatientContextBanner } from "@/components/Patient/PatientContextBanner";
import { PatientFlowNavigator } from "@/components/Patient/PatientFlowNavigator";
import { PatientJourneyActions } from "@/components/Patient/PatientJourneyActions";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { PaymentModal, type PaymentModalSettlement } from "@/components/PaymentModal";
import { Alert, Badge, type BadgeTone, Button, IconButton, Table, toast } from "@/components/ui";
import {
  billingChargeSourceOptions,
  billingDiscountTypeOptions,
  billingInsuranceClaimTypeOptions,
  billingInsuranceSchemeTypeOptions,
  billingIntegerOrFallback,
  billingNumberOrFallback,
  billingOptionalNumber,
  billingOptionalText,
  billingPaymentModeOptions,
} from "@/forms/billing.form";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { confirmDestructive } from "@/lib/confirm-destructive";
import { billingService } from "@/services/billing.service";
import { printCopyRouteLabel } from "@/utils/printCopies";
import {
  BankReconTab,
  ConcessionsTab,
  ErpExportTab,
  FinancialMisTab,
  GstTdsTab,
  JournalEntriesTab,
} from "./billing/accounting-tabs";
import { AdvancesTab } from "./billing/advances";
import { AuditLogTab } from "./billing/audit-log";
import { ChargeMasterTab } from "./billing/charge-master";
import { ClaimDetailDrawer } from "./billing/claim-detail-drawer";
import { CorporateTab } from "./billing/corporate";
import { CreditPatientsTab } from "./billing/credit-patients";
import { DayCloseTab } from "./billing/day-close";
import { PackagesTab } from "./billing/packages";
import { RatePlansTab } from "./billing/rate-plans";
import { ReportsTab } from "./billing/reports";
import { BillingSettingsTab } from "./billing/settings";
import {
  BILLING_INVOICE_PRINT_COPIES,
  BILLING_INVOICE_STATUS_OPTIONS,
  type BillingDisplayAccess,
  billingAmountText,
  invoiceBalance,
  invoiceBalanceLabel,
  invoiceDisplayStatus,
  invoiceIsPayable,
  invoiceStatusLabel,
  isBillingTab,
  isInvoiceStatus,
  money,
  printInvoicePacket,
  printReceiptPacket,
} from "./billing/shared";
import classes from "./billing.module.scss";
import {
  billingAdmissionFilterFromSearchParams,
  billingEncounterFilterFromSearchParams,
  billingHandoffActionFromSearchParams,
  billingInvoiceActionFromSearchParams,
  billingInvoicePaymentRoute,
} from "./billing-workspace";

export function BillingPage() {
  useRequirePermission(P.BILLING.INVOICES_LIST);

  return (
    <ClinicalEventProvider moduleCode="billing" contextCode="billing-invoices">
      <BillingPageInner />
    </ClinicalEventProvider>
  );
}

export function BillingInvoiceDetailPage() {
  useRequirePermission(P.BILLING.INVOICES_VIEW);

  const navigate = useNavigate();
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const canCreate = useHasPermission(P.BILLING.INVOICES_CREATE);
  const canPay = useHasPermission(P.BILLING.PAYMENTS_CREATE);
  const initialAction = billingInvoiceActionFromSearchParams(searchParams);
  const clearInvoiceAction = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("action");
    setSearchParams(next, { replace: true });
  };

  if (!invoiceId) {
    return (
      <ClinicalEventProvider moduleCode="billing" contextCode="billing-invoice-detail">
        <Stack>
          <PageHeader
            title="Invoice"
            subtitle="Invoice route is missing an invoice identifier."
            actions={
              <Button tone="ghost" onClick={() => navigate("/billing")}>
                Back to Billing
              </Button>
            }
          />
          <Alert tone="danger">Unable to open invoice without an invoice ID.</Alert>
        </Stack>
      </ClinicalEventProvider>
    );
  }

  return (
    <ClinicalEventProvider moduleCode="billing" contextCode="billing-invoice-detail">
      <Stack>
        <PageHeader
          title="Invoice detail"
          subtitle="Charges, discounts, copay, payments, receipts, and audit context."
          actions={
            <Button tone="ghost" onClick={() => navigate("/billing")}>
              Back to Billing
            </Button>
          }
        />
        <InvoiceDetail
          invoiceId={invoiceId}
          canCreate={canCreate}
          canPay={canPay}
          initialAction={initialAction}
          onClearAction={clearInvoiceAction}
        />
      </Stack>
    </ClinicalEventProvider>
  );
}

function BillingPageInner() {
  const { t } = useTranslation("billing");
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const canCreate = useHasPermission(P.BILLING.INVOICES_CREATE);
  const canPay = useHasPermission(P.BILLING.PAYMENTS_CREATE);
  const canDayClose = useHasPermission(P.BILLING.DAY_CLOSE_CREATE);
  const canWriteOff = useHasPermission(P.BILLING.WRITE_OFF_CREATE);
  const canAudit = useHasPermission(P.BILLING.AUDIT_VIEW);
  // Phase 3 permissions
  const canCredit = useHasPermission(P.BILLING.CREDIT_LIST);
  const canJournal = useHasPermission(P.BILLING.JOURNAL_LIST);
  const canBankRecon = useHasPermission(P.BILLING.BANK_RECON_LIST);
  const canTds = useHasPermission(P.BILLING.TDS_LIST);
  const canGst = useHasPermission(P.BILLING.GST_RETURNS_LIST);
  const canErp = useHasPermission(P.BILLING.ERP_EXPORT);
  const canConcessions = useHasPermission(P.BILLING.CONCESSIONS_LIST);
  const canApproveConcessions = useHasPermission(P.BILLING.CONCESSIONS_APPROVE);

  const [page, setPage] = useState(1);
  const [invoiceSort, setInvoiceSort] = useState<SortState | null>(null);
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);
  const visibleBillingTabs = new Set<string>([
    "invoices",
    "charge-master",
    "packages",
    "rate-plans",
    "refunds",
    "insurance",
    "advances",
    "corporate",
    "reports",
    ...(canDayClose ? ["day-close"] : []),
    ...(canAudit ? ["audit-log"] : []),
    ...(canCredit ? ["credit-patients"] : []),
    ...(canGst ? ["gst-tds"] : []),
    ...(canJournal ? ["journal"] : []),
    ...(canBankRecon ? ["bank-recon"] : []),
    "financial-mis",
    ...(canErp ? ["erp-export"] : []),
    ...(canConcessions ? ["concessions"] : []),
    "settings",
  ]);
  const requestedTab = searchParams.get("tab");
  const selectedTab =
    isBillingTab(requestedTab) && visibleBillingTabs.has(requestedTab) ? requestedTab : "invoices";
  const patientFilterId = searchParams.get("patient_id")?.trim() || null;
  const admissionFilterId = billingAdmissionFilterFromSearchParams(searchParams);
  const encounterFilterId = billingEncounterFilterFromSearchParams(searchParams);
  const requestedStatus = searchParams.get("status");
  const filterStatus = isInvoiceStatus(requestedStatus) ? requestedStatus : null;
  const activeHandoff = billingHandoffActionFromSearchParams(searchParams);

  const setBillingParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    setSearchParams(next, { replace: true });
  };
  const clearBillingHandoff = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("action");
    next.delete("source");
    setSearchParams(next, { replace: true });
  };
  const clearPatientBillingFilter = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("patient_id");
    next.delete("admission_id");
    next.delete("encounter_id");
    next.delete("action");
    next.delete("source");
    setSearchParams(next, { replace: true });
  };

  const setSelectedTab = (value: string | null) => {
    setBillingParam("tab", value && visibleBillingTabs.has(value) ? value : "invoices");
  };

  const params: Record<string, string> = { page: String(page), per_page: "20" };
  if (filterStatus) params.status = filterStatus;
  if (patientFilterId) params.patient_id = patientFilterId;
  if (encounterFilterId) params.encounter_id = encounterFilterId;
  if (admissionFilterId) params.admission_id = admissionFilterId;
  if (invoiceSort) {
    params.sort = invoiceSort.key;
    params.order = invoiceSort.dir;
  }

  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["invoices", params],
    queryFn: () => billingService.listInvoices(params),
  });
  const invoices = data?.invoices ?? [];
  const firstPayableInvoice = invoices.find(invoiceIsPayable);

  const cloneMutation = useMutation({
    mutationFn: (id: string) => billingService.cloneInvoice(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Invoice duplicated as draft", { title: "Cloned" });
    },
    onError: () => toast.error("Failed to clone invoice", { title: "Error" }),
  });

  const columns = [
    {
      key: "invoice_number",
      label: "Invoice #",
      sortable: true,
      render: (row: Invoice) => <Text fw={600}>{row.invoice_number}</Text>,
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (row: Invoice) => {
        const displayStatus = invoiceDisplayStatus(row);
        const statusSignal = billingInvoiceStatusSignal(displayStatus);
        return (
          <Group gap={6}>
            <OperationalSignal
              label={invoiceStatusLabel(t, displayStatus)}
              shape={statusSignal.shape}
              size="xs"
              tone={statusSignal.tone}
            />
            {row.notes === "Auto-generated" && (
              <OperationalSignal label={t("auto")} shape="token" size="xs" tone="active" />
            )}
            {row.is_interim && (
              <OperationalSignal label={t("interim")} shape="token" size="xs" tone="blocked" />
            )}
            {row.corporate_id && (
              <OperationalSignal label={t("corporate")} shape="token" size="xs" tone="active" />
            )}
            {row.is_er_deferred && (
              <OperationalSignal label={t("erDeferred")} shape="diamond" size="xs" tone="risk" />
            )}
            {row.cloned_from_id && (
              <OperationalSignal label={t("cloned")} shape="token" size="xs" tone="neutral" />
            )}
          </Group>
        );
      },
    },
    {
      key: "total_amount",
      label: "Total",
      sortable: true,
      fieldAccessKey: "billing.amount",
      accessor: (row: Invoice) => row.total_amount,
      fieldKind: "money",
      render: (row: Invoice) => <Text size="sm">₹{money(row.total_amount)}</Text>,
    },
    {
      key: "paid_amount",
      label: "Paid",
      fieldAccessKey: "billing.amount",
      accessor: (row: Invoice) => row.paid_amount,
      fieldKind: "money",
      render: (row: Invoice) => {
        const paid = Number(row.paid_amount);
        const total = Number(row.total_amount);
        const percent = total > 0 ? Math.min(100, Math.max(0, (paid / total) * 100)) : 0;
        return (
          <Stack gap={2}>
            <Text size="sm" fw={paid > 0 ? 600 : 400}>
              ₹{money(row.paid_amount)}
            </Text>
            {paid > 0 && paid < total && (
              <Progress
                value={percent}
                size={4}
                color="warning"
                aria-label={t("billingSignals.paymentProgress")}
              />
            )}
          </Stack>
        );
      },
    },
    {
      key: "balance",
      label: "Balance",
      fieldAccessKey: "billing.amount",
      accessor: invoiceBalance,
      fieldKind: "money",
      render: (row: Invoice) => {
        const balance = invoiceBalance(row);
        const balanceSignal = billingInvoiceBalanceSignal(balance, true);
        return (
          <OperationalSignal
            label={invoiceBalanceLabel(t, balanceSignal)}
            shape={balanceSignal.shape}
            size="xs"
            tone={balanceSignal.tone}
            value={`₹${money(balance)}`}
          />
        );
      },
    },
    {
      key: "created_at",
      label: "Date",
      render: (row: Invoice) => (
        <Text size="sm">{new Date(row.created_at).toLocaleDateString()}</Text>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      requiredPermissions: [P.BILLING.INVOICES_VIEW],
      render: (row: Invoice) => (
        <Group gap={4}>
          <Tooltip label="View">
            <IconButton
              tone="default"
              onClick={() => navigate(`/billing/invoices/${row.id}`)}
              aria-label={`Open invoice ${row.invoice_number}`}
            >
              <IconEye size={16} />
            </IconButton>
          </Tooltip>
          {canCreate && (
            <Tooltip label="Clone">
              <IconButton
                tone="default"
                aria-label="Clone"
                onClick={() => cloneMutation.mutate(row.id)}
                loading={cloneMutation.isPending}
              >
                <IconCopy size={16} />
              </IconButton>
            </Tooltip>
          )}
          {activeHandoff === "payment" && canPay && invoiceIsPayable(row) && (
            <Tooltip label="Collect payment">
              <IconButton
                tone="default"
                onClick={() => navigate(`/billing/invoices/${row.id}?action=payment`)}
                aria-label={`Collect payment for invoice ${row.invoice_number}`}
              >
                <IconCash size={16} />
              </IconButton>
            </Tooltip>
          )}
        </Group>
      ),
    },
  ] satisfies Column<Invoice>[];

  return (
    <div>
      <PageHeader
        title={t("title.billing")}
        subtitle={t("subtitle.invoicesAndPayments")}
        icon={<IconReceipt size={20} stroke={1.5} />}
        color="orange"
        actions={
          <Group gap="xs">
            <Button
              tone="ghost"
              leftSection={<IconListCheck size={16} />}
              onClick={() => navigate("/billing/worklist")}
            >
              Worklist
            </Button>
            <Button
              tone="ghost"
              leftSection={<IconShieldHalf size={16} />}
              onClick={() => navigate("/billing/tpa-pipeline")}
            >
              TPA pipeline
            </Button>
            {canPay && (
              <Button
                tone="secondary"
                leftSection={<IconCash size={16} />}
                onClick={() => navigate("/billing/counter")}
              >
                Cashier counter
              </Button>
            )}
            {canCreate && (
              <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={openCreate}>
                {t("button.newInvoice")}
              </Button>
            )}
          </Group>
        }
      />

      {patientFilterId && (
        <Stack gap="xs" mb="md">
          <PatientContextBanner patientId={patientFilterId} hideLoadingState variant="financial" />
          <Group justify="space-between" align="center">
            <PatientFlowNavigator
              patientId={patientFilterId}
              active="billing"
              activeEncounterId={encounterFilterId}
              activeAdmissionId={admissionFilterId}
              activeAdmissionStatus={admissionFilterId ? "admitted" : null}
              activeOrderContext={admissionFilterId ? "ipd" : encounterFilterId ? "opd" : null}
              compact
            />
            <Button
              tone="ghost"
              size="xs"
              leftSection={<IconX size={14} />}
              onClick={clearPatientBillingFilter}
            >
              {t("button.allBilling")}
            </Button>
          </Group>
          {activeHandoff && (
            <Alert
              tone={activeHandoff === "payment" ? "warning" : "success"}
              title={
                activeHandoff === "payment"
                  ? t("handoff.payment.title")
                  : t("handoff.dischargeBill.title")
              }
            >
              <Group justify="space-between" align="center" gap="sm">
                <Stack gap={6}>
                  <Text size="sm">
                    {activeHandoff === "payment"
                      ? t("handoff.payment.message")
                      : t("handoff.dischargeBill.message")}
                  </Text>
                  <Group gap={6}>
                    <OperationalSignal
                      label={t("billingSignals.filteredInvoices", { count: invoices.length })}
                      shape="token"
                      size="xs"
                      tone="active"
                    />
                    <OperationalSignal
                      label={
                        firstPayableInvoice
                          ? t("billingSignals.payableReady")
                          : t("billingSignals.noPayableInvoice")
                      }
                      shape={firstPayableInvoice ? "pill" : "diamond"}
                      size="xs"
                      tone={firstPayableInvoice ? "ready" : "blocked"}
                    />
                  </Group>
                </Stack>
                <Group gap="xs">
                  {activeHandoff === "payment" && firstPayableInvoice && canPay && (
                    <Button
                      tone="primary"
                      size="xs"
                      leftSection={<IconCash size={14} />}
                      onClick={() =>
                        navigate(`/billing/invoices/${firstPayableInvoice.id}?action=payment`)
                      }
                    >
                      {t("button.openPayableInvoice")}
                    </Button>
                  )}
                  {activeHandoff === "discharge_bill" && canCreate && (
                    <Button tone="primary" size="xs" onClick={openCreate}>
                      {t("button.newInvoice")}
                    </Button>
                  )}
                  <Button tone="ghost" size="xs" onClick={clearBillingHandoff}>
                    {t("button.dismiss")}
                  </Button>
                </Group>
              </Group>
            </Alert>
          )}
        </Stack>
      )}

      <Tabs value={selectedTab} onChange={setSelectedTab} keepMounted={false}>
        <Tabs.List mb="md">
          <Tabs.Tab value="invoices" leftSection={<IconFileInvoice size={14} />}>
            {t("invoices")}
          </Tabs.Tab>
          <Tabs.Tab value="charge-master" leftSection={<IconTags size={14} />}>
            {t("chargeMaster")}
          </Tabs.Tab>
          <Tabs.Tab value="packages" leftSection={<IconPackage size={14} />}>
            {t("packages")}
          </Tabs.Tab>
          <Tabs.Tab value="rate-plans" leftSection={<IconCreditCard size={14} />}>
            {t("ratePlans")}
          </Tabs.Tab>
          <Tabs.Tab value="refunds" leftSection={<IconRefresh size={14} />}>
            {t("refunds&Credits")}
          </Tabs.Tab>
          <Tabs.Tab value="insurance" leftSection={<IconShieldCheck size={14} />}>
            {t("insuranceClaims")}
          </Tabs.Tab>
          <Tabs.Tab value="advances" leftSection={<IconWallet size={14} />}>
            {t("advances")}
          </Tabs.Tab>
          <Tabs.Tab value="corporate" leftSection={<IconBuildingBank size={14} />}>
            {t("corporate")}
          </Tabs.Tab>
          <Tabs.Tab value="reports" leftSection={<IconChartBar size={14} />}>
            {t("reports")}
          </Tabs.Tab>
          {canDayClose && (
            <Tabs.Tab value="day-close" leftSection={<IconCalendarCheck size={14} />}>
              {t("dayClose")}
            </Tabs.Tab>
          )}
          {canAudit && (
            <Tabs.Tab value="audit-log" leftSection={<IconClipboardList size={14} />}>
              {t("auditLog")}
            </Tabs.Tab>
          )}
          {canCredit && (
            <Tabs.Tab value="credit-patients" leftSection={<IconMoneybag size={14} />}>
              {t("creditPatients")}
            </Tabs.Tab>
          )}
          {canGst && (
            <Tabs.Tab value="gst-tds" leftSection={<IconReportMoney size={14} />}>
              {t("gst&Tds")}
            </Tabs.Tab>
          )}
          {canJournal && (
            <Tabs.Tab value="journal" leftSection={<IconScale size={14} />}>
              {t("journalEntries")}
            </Tabs.Tab>
          )}
          {canBankRecon && (
            <Tabs.Tab value="bank-recon" leftSection={<IconTransferIn size={14} />}>
              {t("bankRecon")}
            </Tabs.Tab>
          )}
          <Tabs.Tab value="financial-mis" leftSection={<IconCoin size={14} />}>
            {t("financialMis")}
          </Tabs.Tab>
          {canErp && (
            <Tabs.Tab value="erp-export" leftSection={<IconDatabase size={14} />}>
              {t("erpExport")}
            </Tabs.Tab>
          )}
          {canConcessions && (
            <Tabs.Tab value="concessions" leftSection={<IconDiscount size={14} />}>
              Concessions
            </Tabs.Tab>
          )}
          <Tabs.Tab value="settings" leftSection={<IconSettings size={14} />}>
            {t("settings")}
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="invoices">
          <Group mb="md">
            <Select
              placeholder="Status"
              data={BILLING_INVOICE_STATUS_OPTIONS}
              value={filterStatus}
              onChange={(value) => {
                setPage(1);
                setBillingParam("status", value);
              }}
              clearable
              w={180}
            />
          </Group>
          <DataTable
            columns={columns}
            data={invoices}
            loading={isLoading}
            page={page}
            totalPages={data ? Math.ceil(data.total / data.per_page) : 1}
            onPageChange={setPage}
            sort={invoiceSort}
            onSortChange={(next) => {
              setInvoiceSort(next);
              setPage(1);
            }}
            rowKey={(row) => row.id}
            virtualized="auto"
            virtualizeAt={40}
            virtualRowHeight={58}
            tableMaxHeight="calc(100vh - 360px)"
          />
        </Tabs.Panel>

        <Tabs.Panel value="charge-master">
          <ChargeMasterTab canCreate={canCreate} />
        </Tabs.Panel>

        <Tabs.Panel value="packages">
          <PackagesTab canCreate={canCreate} />
        </Tabs.Panel>

        <Tabs.Panel value="rate-plans">
          <RatePlansTab canCreate={canCreate} />
        </Tabs.Panel>

        <Tabs.Panel value="refunds">
          <RefundsCreditsTab canCreate={canCreate} canWriteOff={canWriteOff} />
        </Tabs.Panel>

        <Tabs.Panel value="insurance">
          <InsuranceClaimsTab canCreate={canCreate} canWriteOff={canWriteOff} />
        </Tabs.Panel>

        <Tabs.Panel value="advances">
          <AdvancesTab />
        </Tabs.Panel>

        <Tabs.Panel value="corporate">
          <CorporateTab />
        </Tabs.Panel>

        <Tabs.Panel value="reports">
          <ReportsTab />
        </Tabs.Panel>

        {canDayClose && (
          <Tabs.Panel value="day-close">
            <DayCloseTab />
          </Tabs.Panel>
        )}

        {canAudit && (
          <Tabs.Panel value="audit-log">
            <AuditLogTab />
          </Tabs.Panel>
        )}

        {canCredit && (
          <Tabs.Panel value="credit-patients">
            <CreditPatientsTab />
          </Tabs.Panel>
        )}

        {canGst && (
          <Tabs.Panel value="gst-tds">
            <GstTdsTab canTds={canTds} />
          </Tabs.Panel>
        )}

        {canJournal && (
          <Tabs.Panel value="journal">
            <JournalEntriesTab />
          </Tabs.Panel>
        )}

        {canBankRecon && (
          <Tabs.Panel value="bank-recon">
            <BankReconTab />
          </Tabs.Panel>
        )}

        <Tabs.Panel value="financial-mis">
          <FinancialMisTab />
        </Tabs.Panel>

        {canErp && (
          <Tabs.Panel value="erp-export">
            <ErpExportTab />
          </Tabs.Panel>
        )}

        {canConcessions && (
          <Tabs.Panel value="concessions">
            <ConcessionsTab canApprove={canApproveConcessions} />
          </Tabs.Panel>
        )}

        <Tabs.Panel value="settings">
          <BillingSettingsTab />
        </Tabs.Panel>
      </Tabs>

      <CreateInvoiceDrawer
        key={`${patientFilterId ?? "all-billing"}:${encounterFilterId ?? "all-encounters"}:${admissionFilterId ?? "all-admissions"}`}
        opened={createOpened}
        onClose={closeCreate}
        initialPatientId={patientFilterId ?? ""}
        initialEncounterId={encounterFilterId ?? ""}
        initialAdmissionId={admissionFilterId ?? ""}
      />
    </div>
  );
}

function CreateInvoiceDrawer({
  opened,
  onClose,
  initialPatientId,
  initialEncounterId,
  initialAdmissionId,
}: {
  opened: boolean;
  onClose: () => void;
  initialPatientId: string;
  initialEncounterId: string;
  initialAdmissionId: string;
}) {
  const { t } = useTranslation("billing");
  const emit = useClinicalEmit();
  const queryClient = useQueryClient();
  const invoiceDefaults: BillingCreateInvoiceFormInput = {
    patient_id: initialPatientId,
    encounter_id: initialEncounterId,
    admission_id: initialAdmissionId,
    notes: "",
  };
  const {
    control,
    register,
    reset,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<BillingCreateInvoiceFormInput>({
    resolver: zodResolver(billingCreateInvoiceFormSchema),
    defaultValues: invoiceDefaults,
  });
  const invoiceFieldError = (field: keyof BillingCreateInvoiceFormInput) => {
    const message = errors[field]?.message;
    if (!message) return undefined;
    if (field === "patient_id") return t("validation.patientRequired");
    return t("validation.invalidField");
  };
  const createInvoiceErrorMessage = (error: Error) => {
    if (error.message === "billing.error.admissionNotFound") {
      return t("error.admissionNotFound");
    }
    if (error.message === "billing.error.admissionPatientMismatch") {
      return t("error.admissionPatientMismatch");
    }
    if (error.message === "billing.error.encounterAdmissionMismatch") {
      return t("error.encounterAdmissionMismatch");
    }
    return t("notification.createInvoiceFailed");
  };

  const createMutation = useMutation({
    mutationFn: (data: CreateInvoiceRequest) => billingService.createInvoice(data),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["invoices"] });
      void queryClient.invalidateQueries({ queryKey: ["patient-invoices", result.patient_id] });
      toast.success(t("notification.draftInvoiceCreated"), {
        title: t("notification.invoiceCreatedTitle"),
      });
      emit("billing.invoice.created", {
        admission_id: result.admission_id,
        encounter_id: result.encounter_id,
        invoice_id: result.id,
        patient_id: result.patient_id,
        total_amount: result.total_amount,
      });
      onClose();
      reset(invoiceDefaults);
    },
    onError: (error: Error) => {
      toast.error(createInvoiceErrorMessage(error), {
        title: t("notification.errorTitle"),
      });
    },
  });
  const patientId = watch("patient_id");
  const contextPatientId = patientId.trim().length >= 32 ? patientId.trim() : null;
  const closeDrawer = () => {
    reset(invoiceDefaults);
    onClose();
  };
  const submitInvoice = handleSubmit((values) => {
    createMutation.mutate({
      patient_id: values.patient_id.trim(),
      encounter_id: billingOptionalText(values.encounter_id),
      admission_id: billingOptionalText(values.admission_id),
      notes: billingOptionalText(values.notes),
    });
  });

  return (
    <FormModal
      opened={opened}
      onClose={closeDrawer}
      title={t("title.createInvoice")}
      variant="drawer"
      size="xl"
      onSubmit={submitInvoice}
      submitLabel={t("button.createDraftInvoice")}
      submitting={createMutation.isPending}
    >
      <Controller
        control={control}
        name="patient_id"
        render={({ field }) => (
          <PatientSearchSelect value={field.value} onChange={field.onChange} required />
        )}
      />
      {errors.patient_id?.message && (
        <Text size="xs" c="danger">
          {invoiceFieldError("patient_id")}
        </Text>
      )}
      {contextPatientId && (
        <PatientContextBanner patientId={contextPatientId} hideLoadingState variant="financial" />
      )}
      <TextInput
        label={t("label.encounterId")}
        error={invoiceFieldError("encounter_id")}
        {...register("encounter_id")}
      />
      <TextInput
        label={t("label.admissionId")}
        error={invoiceFieldError("admission_id")}
        {...register("admission_id")}
      />
      <Textarea
        label={t("label.notes")}
        error={invoiceFieldError("notes")}
        {...register("notes")}
      />
    </FormModal>
  );
}

// Cashiers work the invoice, not the clinical journey — the flow
// navigator above already covers cross-module navigation, so the
// action row keeps only billing moves (payment, discharge bill).
const BILLING_DETAIL_HIDDEN_ACTIONS = [
  "patient.edit",
  "patient.share",
  "patient.print_card",
  "opd.open_visit",
  "orders.medication",
  "orders.lab",
  "orders.radiology",
  "ipd.open_admission",
  "ipd.admit",
  "emergency.open_visit",
  "emergency.open_mlc",
  "camp.open_context",
  "pharmacy.dispense_order",
  "pharmacy.open_patient_queue",
  "mrd.open_case_sheet",
  "billing.open_ledger",
] as const;

function InvoiceDetail({
  invoiceId,
  canCreate,
  canPay,
  initialAction,
  onClearAction,
}: {
  invoiceId: string;
  canCreate: boolean;
  canPay: boolean;
  initialAction?: "payment" | null;
  onClearAction?: () => void;
}) {
  const { t } = useTranslation("billing");
  const emit = useClinicalEmit();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canPrintBillingDocs = useHasPermission(P.BILLING.RECEIPTS_PRINT);
  const amountAccess = useProtectedFieldAccess("billing.amount");
  const patientNameAccess = useProtectedFieldAccess(undefined, PATIENT_NAME_FIELD_ACCESS_KEYS);
  const patientAddressAccess = useProtectedFieldAccess("patients.address");
  const uhidAccess = useProtectedFieldAccess(PATIENT_UHID_FIELD_ACCESS_KEY);
  const billingDisplayAccess: BillingDisplayAccess = {
    amount: amountAccess,
    patientAddress: patientAddressAccess,
    patientName: patientNameAccess,
    uhid: uhidAccess,
  };
  const [addItemOpened, addItemHandlers] = useDisclosure(false);
  const [paymentOpened, { open: openPaymentPanel, close: closePaymentPanel }] =
    useDisclosure(false);
  const [gatewayOpened, gatewayHandlers] = useDisclosure(false);
  const [discountOpened, discountHandlers] = useDisclosure(false);
  const [copayOpened, copayHandlers] = useDisclosure(false);
  const itemDefaults: BillingInvoiceItemFormInput = {
    charge_code: "",
    description: "",
    source: "manual",
    quantity: 1,
    unit_price: 0,
    tax_percent: 0,
  };
  const discountDefaults: BillingDiscountFormInput = {
    discount_type: "percentage",
    discount_value: 0,
    reason: "",
  };
  const {
    control: itemControl,
    register: registerItem,
    reset: resetItem,
    handleSubmit: handleSubmitItem,
    formState: { errors: itemErrors },
  } = useForm<BillingInvoiceItemFormInput>({
    resolver: zodResolver(billingInvoiceItemFormSchema),
    defaultValues: itemDefaults,
  });
  const {
    control: discountControl,
    register: registerDiscount,
    reset: resetDiscount,
    handleSubmit: handleSubmitDiscount,
    formState: { errors: discountErrors },
  } = useForm<BillingDiscountFormInput>({
    resolver: zodResolver(billingDiscountFormSchema),
    defaultValues: discountDefaults,
  });

  const { data } = useQuery({
    queryKey: ["invoice-detail", invoiceId],
    queryFn: () => billingService.getInvoice(invoiceId),
  });

  const issueMutation = useMutation({
    mutationFn: () => billingService.issueInvoice(invoiceId),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["invoice-detail", invoiceId] });
      void queryClient.invalidateQueries({ queryKey: ["invoices"] });
      void queryClient.invalidateQueries({ queryKey: ["patient-invoices", result.patient_id] });
      emit("billing.invoice.finalized", {
        admission_id: result.admission_id,
        encounter_id: result.encounter_id,
        invoice_id: result.id,
        invoice_number: result.invoice_number,
        patient_id: result.patient_id,
        status: result.status,
      });
      // Cashier flow: issuing is almost always followed by collecting —
      // land straight on the payment panel via the ?action=payment link.
      if (canPay && invoiceBalance(result) > 0) {
        navigate(billingInvoicePaymentRoute(invoiceId), { replace: true });
      }
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => billingService.cancelInvoice(invoiceId),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["invoice-detail", invoiceId] }),
  });

  const closeZeroMutation = useMutation({
    mutationFn: () => billingService.closeZeroInvoice(invoiceId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["invoice-detail", invoiceId] });
      void queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Zero-balance bill settled.", { title: "Invoice closed" });
    },
    onError: (error: Error) => {
      toast.error(error.message, { title: "Could not close" });
    },
  });

  const invoicePrintMutation = useMutation({
    mutationFn: () => billingService.getInvoicePrintData(invoiceId),
    onSuccess: (printData) => {
      printInvoicePacket(printData, billingDisplayAccess);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to prepare invoice packet", {
        title: "Invoice print failed",
      });
    },
  });

  const addItemMutation = useMutation({
    mutationFn: (item: AddInvoiceItemRequest) => billingService.addInvoiceItem(invoiceId, item),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["invoice-detail", invoiceId] });
      addItemHandlers.close();
      resetItem(itemDefaults);
    },
  });

  const removeItemMutation = useMutation({
    mutationFn: (itemId: string) => billingService.removeInvoiceItem(invoiceId, itemId),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["invoice-detail", invoiceId] }),
  });

  const payMutation = useMutation({
    mutationFn: (pay: RecordPaymentRequest) => billingService.recordPayment(invoiceId, pay),
    onSuccess: (result, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["invoice-detail", invoiceId] });
      void queryClient.invalidateQueries({ queryKey: ["invoices"] });
      void queryClient.invalidateQueries({ queryKey: ["patients"] });
      void queryClient.invalidateQueries({ queryKey: ["patient-context", inv.patient_id] });
      void queryClient.invalidateQueries({ queryKey: ["patient-invoices", inv.patient_id] });
      emit("billing.payment.received", {
        amount: variables.amount,
        admission_id: inv.admission_id,
        encounter_id: inv.encounter_id,
        invoice_id: result.invoice_id,
        mode: variables.mode,
        patient_id: inv.patient_id,
        payment_id: result.id,
      });
      closePaymentPanel();
      onClearAction?.();
    },
  });

  const { data: discounts = [] } = useQuery({
    queryKey: ["invoice-discounts", invoiceId],
    queryFn: () => billingService.listInvoiceDiscounts(invoiceId),
  });

  const addDiscountMutation = useMutation({
    mutationFn: (d: AddDiscountRequest) => billingService.addDiscount(invoiceId, d),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["invoice-discounts", invoiceId] });
      void queryClient.invalidateQueries({ queryKey: ["invoice-detail", invoiceId] });
      discountHandlers.close();
      resetDiscount(discountDefaults);
    },
  });

  const removeDiscountMutation = useMutation({
    mutationFn: (discId: string) => billingService.removeDiscount(invoiceId, discId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["invoice-discounts", invoiceId] });
      void queryClient.invalidateQueries({ queryKey: ["invoice-detail", invoiceId] });
    },
  });

  const { data: receipts = [] } = useQuery({
    queryKey: ["invoice-receipts", invoiceId],
    queryFn: () => billingService.listReceipts(invoiceId),
    enabled: canPrintBillingDocs,
  });

  const receiptMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      const receipt = await billingService.generateReceipt(invoiceId, paymentId);
      const printData = await billingService.getReceiptPrintData(paymentId);
      return { printData, receipt };
    },
    onSuccess: ({ printData }) => {
      printReceiptPacket(printData, billingDisplayAccess);
      void queryClient.invalidateQueries({ queryKey: ["invoice-detail", invoiceId] });
      void queryClient.invalidateQueries({ queryKey: ["invoice-receipts", invoiceId] });
      toast.success("Customer and office copies are ready to print", {
        title: "Receipt generated",
      });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to prepare receipt packet", {
        title: "Receipt print failed",
      });
    },
  });

  useEffect(() => {
    if (initialAction !== "payment" || !data) {
      return;
    }

    window.requestAnimationFrame(() => {
      document.getElementById("billing-payments")?.scrollIntoView({ block: "start" });
    });

    if (paymentOpened) {
      return;
    }

    const invoiceDetail = data as InvoiceDetailResponse;
    const invoice = invoiceDetail.invoice;
    const invoiceStatus = invoiceDisplayStatus(invoice);
    const invoiceBalanceAmount = invoiceBalance(invoice);
    const canOpenPaymentPanel =
      amountAccess === "edit" &&
      canPay &&
      (invoiceStatus === "issued" || invoiceStatus === "partially_paid") &&
      invoiceBalanceAmount > 0;

    if (!canOpenPaymentPanel) {
      return;
    }

    openPaymentPanel();
  }, [amountAccess, canPay, data, initialAction, openPaymentPanel, paymentOpened]);

  if (!data) return <Text c="dimmed">Loading...</Text>;

  const detail = data as InvoiceDetailResponse;
  const inv = detail.invoice;
  const displayStatus = invoiceDisplayStatus(inv);
  const invoiceSignal = billingInvoiceStatusSignal(displayStatus);
  const balance = invoiceBalance(inv);
  const balanceSignal = billingInvoiceBalanceSignal(balance, amountAccess !== "hidden");
  const balanceSignalLabel = invoiceBalanceLabel(t, balanceSignal);
  const completedEvents: ClinicalEventName[] = ["billing.invoice.created"];
  if (
    displayStatus === "issued" ||
    displayStatus === "partially_paid" ||
    displayStatus === "paid"
  ) {
    completedEvents.push("billing.invoice.finalized");
  }
  if (
    displayStatus === "partially_paid" ||
    displayStatus === "paid" ||
    detail.payments.length > 0
  ) {
    completedEvents.push("billing.payment.received");
  }
  const journeyContext: ClinicalJourneyContext = {
    patientId: inv.patient_id,
    activeEncounterId: inv.encounter_id,
    activeAdmissionId: inv.admission_id,
    activeAdmissionStatus: inv.admission_id ? "admitted" : null,
    activeInvoiceId: inv.id,
    activeOrderContext: inv.admission_id ? "ipd" : inv.encounter_id ? "opd" : null,
    completedEvents,
  };
  const canRecordPayment =
    amountAccess === "edit" &&
    canPay &&
    (displayStatus === "issued" || displayStatus === "partially_paid") &&
    balance > 0;
  const openPaymentForm = () => {
    if (paymentOpened) {
      closePaymentPanel();
      onClearAction?.();
      return;
    }
    navigate(billingInvoicePaymentRoute(invoiceId), { replace: true });
    openPaymentPanel();
  };
  const handleAddInvoiceItem = (values: BillingInvoiceItemFormInput) => {
    addItemMutation.mutate({
      charge_code: values.charge_code.trim(),
      description: values.description.trim(),
      source: values.source,
      quantity: billingIntegerOrFallback(values.quantity, 1),
      unit_price: billingNumberOrFallback(values.unit_price, 0),
      tax_percent: billingNumberOrFallback(values.tax_percent, 0),
    });
  };
  const handleAddDiscount = (values: BillingDiscountFormInput) => {
    addDiscountMutation.mutate({
      discount_type: values.discount_type,
      discount_value: billingNumberOrFallback(values.discount_value, 0),
      reason: billingOptionalText(values.reason),
    });
  };
  const handleGatewayPaymentSuccess = (_paymentId: string, settlement: PaymentModalSettlement) => {
    if (settlement.source === "manual") {
      payMutation.mutate({
        amount: settlement.amount,
        mode: settlement.mode,
        reference_number: settlement.reference_number,
      });
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ["invoice-detail", invoiceId] });
    void queryClient.invalidateQueries({ queryKey: ["invoices"] });
    gatewayHandlers.close();
    onClearAction?.();
  };

  return (
    <Stack className={classes.invoiceWorkspace}>
      <Card withBorder className={classes.commandBar}>
        <Stack gap="xs">
          <PatientContextBanner patientId={inv.patient_id} hideLoadingState variant="financial" />
          <PatientFlowNavigator
            patientId={inv.patient_id}
            active="billing"
            activeEncounterId={inv.encounter_id}
            activeAdmissionId={inv.admission_id}
            activeInvoiceId={inv.id}
            activeOrderContext={inv.admission_id ? "ipd" : inv.encounter_id ? "opd" : null}
            completedEvents={completedEvents}
            compact
          />
          <Group justify="space-between" align="flex-start" gap="sm">
            <Stack gap={4}>
              <Group gap="xs">
                <Text fw={700}>{inv.invoice_number}</Text>
                <OperationalSignal
                  label={invoiceStatusLabel(t, displayStatus)}
                  shape={invoiceSignal.shape}
                  tone={invoiceSignal.tone}
                />
                {inv.is_interim && <Badge tone="accent">Interim #{inv.sequence_number}</Badge>}
                {inv.is_er_deferred && <Badge tone="danger">ER Deferred</Badge>}
              </Group>
              <Group gap="md">
                <Text size="sm">Total: {billingAmountText(inv.total_amount, amountAccess)}</Text>
                <Text size="sm">Paid: {billingAmountText(inv.paid_amount, amountAccess)}</Text>
                <Text
                  size="sm"
                  c={amountAccess === "hidden" ? undefined : balance > 0 ? "danger" : "success"}
                >
                  Balance: {billingAmountText(balance, amountAccess)}
                </Text>
              </Group>
              <PatientJourneyActions
                context={journeyContext}
                hiddenActionIds={BILLING_DETAIL_HIDDEN_ACTIONS}
                size="xs"
              />
            </Stack>
            <Group gap="xs" justify="flex-end">
              {canPay && displayStatus === "issued" && balance === 0 && (
                <Tooltip label="No money to collect — record this free / scheme bill as settled">
                  <Button
                    tone="secondary"
                    size="xs"
                    leftSection={<IconCheck size={14} />}
                    loading={closeZeroMutation.isPending}
                    onClick={() => closeZeroMutation.mutate()}
                  >
                    Close ₹0 bill
                  </Button>
                </Tooltip>
              )}
              {canPrintBillingDocs && (
                <Tooltip
                  label={
                    inv.status === "draft"
                      ? "Issue the invoice before printing"
                      : "Customer and office copies"
                  }
                >
                  <Button
                    tone="secondary"
                    size="xs"
                    leftSection={<IconPrinter size={14} />}
                    loading={invoicePrintMutation.isPending}
                    disabled={inv.status === "draft"}
                    onClick={() => invoicePrintMutation.mutate()}
                  >
                    Print packet
                  </Button>
                </Tooltip>
              )}
              {inv.status !== "draft" && (
                <DocumentActions templateCode="invoice_gst" sourceId={inv.id} />
              )}
              {canCreate && inv.status === "draft" && (
                <>
                  <Button
                    tone="primary"
                    size="xs"
                    leftSection={<IconCheck size={14} />}
                    loading={issueMutation.isPending}
                    onClick={() => issueMutation.mutate()}
                  >
                    Issue
                  </Button>
                  <Button
                    tone="subtle-danger"
                    size="xs"
                    leftSection={<IconX size={14} />}
                    loading={cancelMutation.isPending}
                    onClick={() =>
                      confirmDestructive({
                        title: "Cancel invoice",
                        message:
                          "Cancel this draft invoice? Its line items will no longer be billable from this draft.",
                        confirmLabel: "Cancel invoice",
                        onConfirm: () => cancelMutation.mutate(),
                      })
                    }
                  >
                    Cancel
                  </Button>
                </>
              )}
              {canRecordPayment && (
                <>
                  <Button
                    tone="primary"
                    size="xs"
                    leftSection={<IconCash size={14} />}
                    onClick={openPaymentForm}
                  >
                    {t("button.recordPayment")}
                  </Button>
                  <Button
                    tone="secondary"
                    size="xs"
                    leftSection={<IconCreditCard size={14} />}
                    onClick={gatewayHandlers.open}
                  >
                    {t("button.gateway")}
                  </Button>
                </>
              )}
            </Group>
          </Group>
        </Stack>
      </Card>

      {initialAction === "payment" && (
        <Alert tone={canRecordPayment ? "warning" : "neutral"} title={t("handoff.payment.title")}>
          <Group justify="space-between" align="center" gap="sm">
            <Text size="sm">
              {canRecordPayment
                ? t("handoff.invoicePayment.readyMessage")
                : t("handoff.invoicePayment.unavailableMessage")}
            </Text>
            <Group gap="xs">
              {canRecordPayment && (
                <Button
                  tone="primary"
                  size="xs"
                  leftSection={<IconCash size={14} />}
                  onClick={openPaymentForm}
                >
                  {t("button.recordPayment")}
                </Button>
              )}
              {onClearAction && (
                <Button tone="ghost" size="xs" onClick={onClearAction}>
                  {t("button.dismiss")}
                </Button>
              )}
            </Group>
          </Group>
        </Alert>
      )}

      <Grid align="flex-start" className={classes.workspaceGrid}>
        <Grid.Col span={{ base: 12, lg: 8 }}>
          <Stack className={classes.workspaceMain}>
            <Card id="billing-summary" withBorder>
              <Stack gap="sm">
                <Group justify="space-between" align="center">
                  <Text fw={700}>Invoice summary</Text>
                  {canPrintBillingDocs && (
                    <Group gap={4}>
                      {BILLING_INVOICE_PRINT_COPIES.map((copy) => (
                        <Badge key={copy.label} tone="accent">
                          {printCopyRouteLabel(copy)}
                        </Badge>
                      ))}
                    </Group>
                  )}
                </Group>
                {(Number(inv.cgst_amount ?? 0) > 0 ||
                  Number(inv.sgst_amount ?? 0) > 0 ||
                  Number(inv.igst_amount ?? 0) > 0) && (
                  <Group gap="xs">
                    <Badge tone="success" size="sm">
                      CGST: {billingAmountText(inv.cgst_amount, amountAccess)}
                    </Badge>
                    <Badge tone="success" size="sm">
                      SGST: {billingAmountText(inv.sgst_amount, amountAccess)}
                    </Badge>
                    <Badge tone="primary" size="sm">
                      IGST: {billingAmountText(inv.igst_amount, amountAccess)}
                    </Badge>
                    {Number(inv.cess_amount ?? 0) > 0 && (
                      <Badge tone="warning" size="sm">
                        Cess: {billingAmountText(inv.cess_amount, amountAccess)}
                      </Badge>
                    )}
                  </Group>
                )}
                {inv.is_interim && inv.billing_period_start && inv.billing_period_end && (
                  <Text size="xs" c="dimmed">
                    Period: {new Date(inv.billing_period_start).toLocaleDateString()} -{" "}
                    {new Date(inv.billing_period_end).toLocaleDateString()}
                  </Text>
                )}
                {copayOpened && (
                  <Box id="billing-copay">
                    <CopayBreakdown invoiceId={invoiceId} />
                  </Box>
                )}
              </Stack>
            </Card>

            <Card id="billing-items" withBorder>
              <Stack gap="sm">
                <Group justify="space-between" align="center">
                  <Text fw={700}>Items</Text>
                  {canCreate && inv.status === "draft" && (
                    <Button
                      tone="secondary"
                      size="xs"
                      leftSection={<IconPlus size={14} />}
                      onClick={addItemHandlers.toggle}
                    >
                      {addItemOpened ? "Close" : "Add Item"}
                    </Button>
                  )}
                </Group>
                <Table striped>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Description</Table.Th>
                      <Table.Th>Qty</Table.Th>
                      <Table.Th>Price</Table.Th>
                      <Table.Th>Tax</Table.Th>
                      <Table.Th>Total</Table.Th>
                      {canCreate && inv.status === "draft" && <Table.Th />}
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {detail.items.map((item) => (
                      <Table.Tr key={item.id}>
                        <Table.Td>{item.description}</Table.Td>
                        <Table.Td>{item.quantity}</Table.Td>
                        <Table.Td>{billingAmountText(item.unit_price, amountAccess)}</Table.Td>
                        <Table.Td>{item.tax_percent}%</Table.Td>
                        <Table.Td>{billingAmountText(item.total_price, amountAccess)}</Table.Td>
                        {canCreate && inv.status === "draft" && (
                          <Table.Td>
                            <IconButton
                              tone="danger"
                              aria-label="Delete"
                              onClick={() =>
                                confirmDestructive({
                                  title: "Remove item",
                                  message: "Remove this line item from the invoice?",
                                  confirmLabel: "Remove item",
                                  onConfirm: () => removeItemMutation.mutate(item.id),
                                })
                              }
                            >
                              <IconTrash size={14} />
                            </IconButton>
                          </Table.Td>
                        )}
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>

                {canCreate && inv.status === "draft" && addItemOpened && (
                  <Stack
                    component="form"
                    gap="xs"
                    onSubmit={handleSubmitItem(handleAddInvoiceItem)}
                  >
                    <Group grow>
                      <TextInput
                        label="Charge Code"
                        required
                        error={itemErrors.charge_code?.message}
                        {...registerItem("charge_code")}
                      />
                      <Controller
                        control={itemControl}
                        name="source"
                        render={({ field }) => (
                          <Select
                            label="Source"
                            data={billingChargeSourceOptions}
                            value={field.value}
                            onChange={(value) => field.onChange(value ?? "manual")}
                            error={itemErrors.source?.message}
                          />
                        )}
                      />
                    </Group>
                    <TextInput
                      label="Description"
                      required
                      error={itemErrors.description?.message}
                      {...registerItem("description")}
                    />
                    <Group grow>
                      <Controller
                        control={itemControl}
                        name="quantity"
                        render={({ field }) => (
                          <NumberInput
                            label="Qty"
                            min={1}
                            value={field.value}
                            onChange={field.onChange}
                            error={itemErrors.quantity?.message}
                          />
                        )}
                      />
                      <Controller
                        control={itemControl}
                        name="unit_price"
                        render={({ field }) => (
                          <NumberInput
                            label="Unit Price"
                            min={0}
                            decimalScale={2}
                            value={field.value}
                            onChange={field.onChange}
                            error={itemErrors.unit_price?.message}
                          />
                        )}
                      />
                      <Controller
                        control={itemControl}
                        name="tax_percent"
                        render={({ field }) => (
                          <NumberInput
                            label="Tax %"
                            min={0}
                            max={100}
                            decimalScale={2}
                            value={field.value}
                            onChange={field.onChange}
                            error={itemErrors.tax_percent?.message}
                          />
                        )}
                      />
                    </Group>
                    <Button
                      tone="primary"
                      size="xs"
                      type="submit"
                      loading={addItemMutation.isPending}
                    >
                      Add
                    </Button>
                  </Stack>
                )}
              </Stack>
            </Card>

            <Card id="billing-payments" withBorder>
              <Stack gap="sm">
                <Group justify="space-between" align="center">
                  <Text fw={700}>{t("payments")}</Text>
                  {canRecordPayment && (
                    <Group gap="xs">
                      <Button
                        tone="primary"
                        size="xs"
                        leftSection={<IconCash size={14} />}
                        onClick={openPaymentForm}
                      >
                        {paymentOpened ? t("label.close") : t("button.recordPayment")}
                      </Button>
                      <Button
                        tone="secondary"
                        size="xs"
                        leftSection={<IconCreditCard size={14} />}
                        onClick={gatewayHandlers.open}
                      >
                        {t("button.gateway")}
                      </Button>
                    </Group>
                  )}
                </Group>
                <Table striped>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>{t("label.amount")}</Table.Th>
                      <Table.Th>{t("label.mode")}</Table.Th>
                      <Table.Th>{t("label.reference")}</Table.Th>
                      <Table.Th>{t("label.date")}</Table.Th>
                      {canPrintBillingDocs && <Table.Th />}
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {detail.payments.map((p) => (
                      <Table.Tr key={p.id}>
                        <Table.Td>{billingAmountText(p.amount, amountAccess)}</Table.Td>
                        <Table.Td>{p.mode}</Table.Td>
                        <Table.Td>{p.reference_number ?? "—"}</Table.Td>
                        <Table.Td>{new Date(p.created_at).toLocaleString()}</Table.Td>
                        {canPrintBillingDocs && (
                          <Table.Td>
                            <Tooltip label="Generate + print receipt packet">
                              <IconButton
                                tone="default"
                                aria-label="Generate + print receipt packet"
                                size="sm"
                                loading={receiptMutation.isPending}
                                onClick={() => receiptMutation.mutate(p.id)}
                              >
                                <IconReceipt size={14} />
                              </IconButton>
                            </Tooltip>
                          </Table.Td>
                        )}
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>

                {canRecordPayment && paymentOpened && (
                  <PaymentCollectPanel
                    invoiceId={invoiceId}
                    balance={balance}
                    onRecorded={(payments) => {
                      for (const payment of payments) {
                        emit("billing.payment.received", {
                          amount: Number(payment.amount),
                          admission_id: inv.admission_id,
                          encounter_id: inv.encounter_id,
                          invoice_id: payment.invoice_id,
                          mode: payment.mode,
                          patient_id: inv.patient_id,
                          payment_id: payment.id,
                        });
                      }
                      void queryClient.invalidateQueries({
                        queryKey: ["invoice-detail", invoiceId],
                      });
                      void queryClient.invalidateQueries({ queryKey: ["invoices"] });
                      void queryClient.invalidateQueries({
                        queryKey: ["patient-context", inv.patient_id],
                      });
                      void queryClient.invalidateQueries({
                        queryKey: ["patient-invoices", inv.patient_id],
                      });
                      closePaymentPanel();
                      onClearAction?.();
                    }}
                    onPrint={
                      canPrintBillingDocs
                        ? (payments) => {
                            const last = payments.at(-1);
                            if (last) receiptMutation.mutate(last.id);
                          }
                        : undefined
                    }
                    autoFocus
                  />
                )}
                {canRecordPayment && (
                  <PaymentModal
                    opened={gatewayOpened}
                    onClose={gatewayHandlers.close}
                    amount={balance}
                    amountAccess={amountAccess}
                    invoiceId={invoiceId}
                    onSuccess={handleGatewayPaymentSuccess}
                  />
                )}
              </Stack>
            </Card>

            {canPrintBillingDocs && receipts.length > 0 && (
              <Card id="billing-receipts" withBorder>
                <Stack gap="sm">
                  <Text fw={700}>Issued receipts</Text>
                  <Table striped>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Receipt #</Table.Th>
                        <Table.Th>{t("label.date")}</Table.Th>
                        <Table.Th>{t("label.amount")}</Table.Th>
                        <Table.Th>Printed</Table.Th>
                        <Table.Th />
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {receipts.map((r) => (
                        <Table.Tr key={r.id}>
                          <Table.Td>
                            <Text ff="monospace" size="sm">
                              {r.receipt_number}
                            </Text>
                          </Table.Td>
                          <Table.Td>{new Date(r.receipt_date).toLocaleString()}</Table.Td>
                          <Table.Td>{billingAmountText(r.amount, amountAccess)}</Table.Td>
                          <Table.Td>
                            <Badge tone={r.printed_at ? "success" : "neutral"} size="sm">
                              {r.printed_at ? "Printed" : "Not printed"}
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            <Tooltip label="Reprint receipt">
                              <IconButton
                                tone="default"
                                aria-label="Reprint receipt"
                                size="sm"
                                loading={receiptMutation.isPending}
                                onClick={() => receiptMutation.mutate(r.payment_id)}
                              >
                                <IconReceipt size={14} />
                              </IconButton>
                            </Tooltip>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Stack>
              </Card>
            )}

            <Card id="billing-discounts" withBorder>
              <Stack gap="sm">
                <Group justify="space-between" align="center">
                  <Text fw={700}>Discounts</Text>
                  {canCreate && inv.status === "draft" && (
                    <Button
                      tone="secondary"
                      size="xs"
                      leftSection={<IconDiscount2 size={14} />}
                      onClick={discountHandlers.toggle}
                    >
                      {discountOpened ? "Close" : "Add Discount"}
                    </Button>
                  )}
                </Group>
                {discounts.length > 0 ? (
                  <Table striped>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Type</Table.Th>
                        <Table.Th>Value</Table.Th>
                        <Table.Th>Reason</Table.Th>
                        {canCreate && <Table.Th />}
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {discounts.map((d: InvoiceDiscount) => (
                        <Table.Tr key={d.id}>
                          <Table.Td>
                            <Badge tone="neutral">{d.discount_type}</Badge>
                          </Table.Td>
                          <Table.Td>
                            {d.discount_type === "percentage"
                              ? `${d.discount_value}%`
                              : billingAmountText(d.discount_value, amountAccess)}
                          </Table.Td>
                          <Table.Td>{d.reason ?? "—"}</Table.Td>
                          {canCreate && (
                            <Table.Td>
                              <IconButton
                                tone="danger"
                                aria-label="Delete"
                                size="sm"
                                onClick={() =>
                                  confirmDestructive({
                                    title: "Remove discount",
                                    message:
                                      "Remove this discount from the invoice? Totals will be recalculated.",
                                    confirmLabel: "Remove discount",
                                    onConfirm: () => removeDiscountMutation.mutate(d.id),
                                  })
                                }
                              >
                                <IconTrash size={14} />
                              </IconButton>
                            </Table.Td>
                          )}
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                ) : (
                  <Text size="sm" c="dimmed">
                    No discounts applied
                  </Text>
                )}

                {canCreate && inv.status === "draft" && discountOpened && (
                  <Stack
                    component="form"
                    gap="xs"
                    onSubmit={handleSubmitDiscount(handleAddDiscount)}
                  >
                    <Group grow>
                      <Controller
                        control={discountControl}
                        name="discount_type"
                        render={({ field }) => (
                          <Select
                            label="Type"
                            data={billingDiscountTypeOptions}
                            value={field.value}
                            onChange={(value) => field.onChange(value ?? "percentage")}
                            error={discountErrors.discount_type?.message}
                          />
                        )}
                      />
                      <Controller
                        control={discountControl}
                        name="discount_value"
                        render={({ field }) => (
                          <NumberInput
                            label="Value"
                            required
                            min={0}
                            decimalScale={2}
                            value={field.value}
                            onChange={field.onChange}
                            error={discountErrors.discount_value?.message}
                          />
                        )}
                      />
                    </Group>
                    <TextInput
                      label="Reason"
                      error={discountErrors.reason?.message}
                      {...registerDiscount("reason")}
                    />
                    <Button
                      tone="primary"
                      size="xs"
                      type="submit"
                      loading={addDiscountMutation.isPending}
                    >
                      Apply Discount
                    </Button>
                  </Stack>
                )}

                {inv.discount_amount !== "0" && inv.discount_amount !== "0.00" && (
                  <Text size="sm" fw={500} c="orange">
                    Total Discount: {billingAmountText(inv.discount_amount, amountAccess)}
                  </Text>
                )}
              </Stack>
            </Card>
          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 4 }}>
          <Box className={classes.contextRail}>
            <Stack gap="sm">
              <Stack gap={2}>
                <Text size="xs" fw={700} c="dimmed" tt="uppercase">
                  Billing workspace
                </Text>
                <Text size="sm" fw={700}>
                  {inv.invoice_number}
                </Text>
              </Stack>
              <Group gap="xs">
                <OperationalSignal
                  label={invoiceStatusLabel(t, displayStatus)}
                  shape={invoiceSignal.shape}
                  size="xs"
                  tone={invoiceSignal.tone}
                />
                <OperationalSignal
                  label={balanceSignalLabel}
                  shape={balanceSignal.shape}
                  size="xs"
                  tone={balanceSignal.tone}
                />
              </Group>
              <Divider />
              <SimpleGrid cols={{ base: 1, sm: 3, lg: 1 }}>
                <BillingSummaryMetric
                  label="Total"
                  value={billingAmountText(inv.total_amount, amountAccess)}
                />
                <BillingSummaryMetric
                  label="Paid"
                  value={billingAmountText(inv.paid_amount, amountAccess)}
                />
                <BillingSummaryMetric
                  label="Balance"
                  value={billingAmountText(balance, amountAccess)}
                  tone={amountAccess === "hidden" ? undefined : balance > 0 ? "danger" : "success"}
                />
              </SimpleGrid>
              <Divider />
              <Stack gap="xs">
                <Text size="xs" fw={700} c="dimmed" tt="uppercase">
                  Navigate
                </Text>
                <Button
                  tone="secondary"
                  size="xs"
                  component="a"
                  href="#billing-summary"
                  leftSection={<IconFileInvoice size={14} />}
                  fullWidth
                >
                  Summary
                </Button>
                <Button
                  tone="secondary"
                  size="xs"
                  component="a"
                  href="#billing-items"
                  leftSection={<IconTags size={14} />}
                  fullWidth
                >
                  Items
                </Button>
                <Button
                  tone="secondary"
                  size="xs"
                  component="a"
                  href="#billing-payments"
                  leftSection={<IconReceipt size={14} />}
                  fullWidth
                >
                  Payments
                </Button>
                <Button
                  tone="secondary"
                  size="xs"
                  component="a"
                  href="#billing-discounts"
                  leftSection={<IconDiscount2 size={14} />}
                  fullWidth
                >
                  Discounts
                </Button>
              </Stack>
              <Divider />
              <Stack gap="xs">
                <Text size="xs" fw={700} c="dimmed" tt="uppercase">
                  {t("label.actions")}
                </Text>
                {canRecordPayment && (
                  <>
                    <Button
                      tone="primary"
                      size="xs"
                      leftSection={<IconCash size={14} />}
                      onClick={openPaymentForm}
                      fullWidth
                    >
                      {t("button.recordPayment")}
                    </Button>
                    <Button
                      tone="secondary"
                      size="xs"
                      leftSection={<IconCreditCard size={14} />}
                      onClick={gatewayHandlers.open}
                      fullWidth
                    >
                      {t("button.gateway")}
                    </Button>
                  </>
                )}
                {canCreate && inv.status === "draft" && (
                  <>
                    <Button
                      tone="secondary"
                      size="xs"
                      leftSection={<IconPlus size={14} />}
                      onClick={addItemHandlers.toggle}
                      fullWidth
                    >
                      Add Item
                    </Button>
                    <Button
                      tone="secondary"
                      size="xs"
                      leftSection={<IconDiscount2 size={14} />}
                      onClick={discountHandlers.toggle}
                      fullWidth
                    >
                      Add Discount
                    </Button>
                  </>
                )}
                <Button
                  tone="secondary"
                  size="xs"
                  leftSection={<IconShieldCheck size={14} />}
                  onClick={copayHandlers.toggle}
                  fullWidth
                >
                  {copayOpened ? "Close Co-pay" : "Calculate Co-pay"}
                </Button>
                <Button
                  tone="secondary"
                  size="xs"
                  leftSection={<IconFileInvoice size={14} />}
                  onClick={() => navigate(`/billing?tab=invoices&patient_id=${inv.patient_id}`)}
                  fullWidth
                >
                  Patient Ledger
                </Button>
              </Stack>
            </Stack>
          </Box>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}

function BillingSummaryMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "danger" | "success";
}) {
  return (
    <Stack gap={1}>
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text size="sm" fw={700} c={tone}>
        {value}
      </Text>
    </Stack>
  );
}

function CopayBreakdown({ invoiceId }: { invoiceId: string }) {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["copay-calculation", invoiceId],
    queryFn: () => billingService.calculateCopay({ invoice_id: invoiceId }),
    enabled: false,
  });

  const calculateMutation = useMutation({
    mutationFn: () => billingService.calculateCopay({ invoice_id: invoiceId }),
    onSuccess: () => refetch(),
  });

  const copay = data as CopayCalculation | undefined;

  return (
    <Card withBorder p="sm">
      {!copay && !isLoading && (
        <Button
          tone="primary"
          size="xs"
          onClick={() => calculateMutation.mutate()}
          loading={calculateMutation.isPending}
        >
          Calculate Co-pay
        </Button>
      )}
      {(isLoading || calculateMutation.isPending) && (
        <Text size="sm" c="dimmed">
          Calculating...
        </Text>
      )}
      {copay && (
        <SimpleGrid cols={5}>
          <Stack gap={2}>
            <Text size="xs" c="dimmed">
              Invoice Amount
            </Text>
            <Text size="sm" fw={700}>
              {"\u20B9"}
              {copay.invoice_amount.toFixed(2)}
            </Text>
          </Stack>
          <Stack gap={2}>
            <Text size="xs" c="dimmed">
              Insurance Coverage
            </Text>
            <Text size="sm" fw={700} c="success">
              {"\u20B9"}
              {copay.insurance_coverage.toFixed(2)}
            </Text>
          </Stack>
          <Stack gap={2}>
            <Text size="xs" c="dimmed">
              Co-pay
            </Text>
            <Text size="sm" fw={700}>
              {"\u20B9"}
              {copay.copay_amount.toFixed(2)}
            </Text>
          </Stack>
          <Stack gap={2}>
            <Text size="xs" c="dimmed">
              Deductible
            </Text>
            <Text size="sm" fw={700}>
              {"\u20B9"}
              {copay.deductible.toFixed(2)}
            </Text>
          </Stack>
          <Stack gap={2}>
            <Text size="xs" c="dimmed">
              Patient Responsibility
            </Text>
            <Text size="sm" fw={700} c="danger">
              {"\u20B9"}
              {copay.patient_responsibility.toFixed(2)}
            </Text>
          </Stack>
        </SimpleGrid>
      )}
    </Card>
  );
}

// ── ER Fast Invoice Modal ─────────────────────────────────

function RefundsCreditsTab({
  canCreate,
  canWriteOff,
}: {
  canCreate: boolean;
  canWriteOff: boolean;
}) {
  const queryClient = useQueryClient();
  const canApproveWriteOff = useHasPermission(P.BILLING.WRITE_OFF_APPROVE);
  const [showRefund, setShowRefund] = useState(false);
  const [showCredit, setShowCredit] = useState(false);
  const [showWriteOff, setShowWriteOff] = useState(false);
  const refundDefaults: BillingRefundFormInput = {
    invoice_id: "",
    amount: 0,
    reason: "",
    mode: "cash",
    reference_number: "",
  };
  const creditDefaults: BillingCreditNoteFormInput = {
    invoice_id: "",
    amount: 0,
    reason: "",
  };
  const writeOffDefaults: BillingWriteOffFormInput = {
    invoice_id: "",
    amount: 0,
    reason: "",
    notes: "",
  };
  const {
    control: refundControl,
    register: registerRefund,
    reset: resetRefund,
    handleSubmit: handleSubmitRefund,
    formState: { errors: refundErrors },
  } = useForm<BillingRefundFormInput>({
    resolver: zodResolver(billingRefundFormSchema),
    defaultValues: refundDefaults,
  });
  const {
    control: creditControl,
    register: registerCredit,
    reset: resetCredit,
    handleSubmit: handleSubmitCredit,
    formState: { errors: creditErrors },
  } = useForm<BillingCreditNoteFormInput>({
    resolver: zodResolver(billingCreditNoteFormSchema),
    defaultValues: creditDefaults,
  });
  const {
    control: writeOffControl,
    register: registerWriteOff,
    reset: resetWriteOff,
    handleSubmit: handleSubmitWriteOff,
    formState: { errors: writeOffErrors },
  } = useForm<BillingWriteOffFormInput>({
    resolver: zodResolver(billingWriteOffFormSchema),
    defaultValues: writeOffDefaults,
  });

  const [refundsPage, setRefundsPage] = useState(1);
  const { data: refunds } = useQuery({
    queryKey: ["refunds", refundsPage],
    queryFn: () => billingService.listRefunds({ page: String(refundsPage), limit: "50" }),
  });

  const [creditNotesPage, setCreditNotesPage] = useState(1);
  const { data: creditNotes } = useQuery({
    queryKey: ["credit-notes", creditNotesPage],
    queryFn: () => billingService.listCreditNotes({ page: String(creditNotesPage), limit: "50" }),
  });

  const refundMutation = useMutation({
    mutationFn: (data: CreateRefundRequest) => billingService.createRefund(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["refunds"] });
      setShowRefund(false);
      resetRefund(refundDefaults);
    },
  });

  const creditMutation = useMutation({
    mutationFn: (data: CreateCreditNoteRequest) => billingService.createCreditNote(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["credit-notes"] });
      setShowCredit(false);
      resetCredit(creditDefaults);
    },
  });

  const applyMutation = useMutation({
    mutationFn: ({ noteId, invoiceId }: { noteId: string; invoiceId: string }) =>
      billingService.applyCreditNote(noteId, invoiceId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["credit-notes"] }),
  });

  const [writeOffsPage, setWriteOffsPage] = useState(1);
  const { data: writeOffs } = useQuery({
    queryKey: ["write-offs", writeOffsPage],
    queryFn: () => billingService.listWriteOffs({ page: String(writeOffsPage), limit: "50" }),
  });

  const writeOffMutation = useMutation({
    mutationFn: (data: CreateWriteOffRequest) => billingService.createWriteOff(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["write-offs"] });
      setShowWriteOff(false);
      resetWriteOff(writeOffDefaults);
    },
  });

  const handleCreateRefund = (values: BillingRefundFormInput) => {
    refundMutation.mutate({
      invoice_id: values.invoice_id.trim(),
      amount: billingNumberOrFallback(values.amount, 0),
      reason: values.reason.trim(),
      mode: values.mode,
      reference_number: billingOptionalText(values.reference_number),
    });
  };

  const handleCreateCreditNote = (values: BillingCreditNoteFormInput) => {
    creditMutation.mutate({
      invoice_id: values.invoice_id.trim(),
      amount: billingNumberOrFallback(values.amount, 0),
      reason: values.reason.trim(),
    });
  };

  const handleCreateWriteOff = (values: BillingWriteOffFormInput) => {
    writeOffMutation.mutate({
      invoice_id: values.invoice_id.trim(),
      amount: billingNumberOrFallback(values.amount, 0),
      reason: values.reason.trim(),
      notes: billingOptionalText(values.notes),
    });
  };

  const approveWriteOffMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ApproveWriteOffRequest }) =>
      billingService.approveWriteOff(id, data),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["write-offs"] }),
  });

  const writeOffColumns = [
    {
      key: "write_off_number",
      label: "WO #",
      sortable: true,
      searchable: true,
      accessor: (row: BadDebtWriteOff) => row.write_off_number,
      render: (row: BadDebtWriteOff) => <Text fw={500}>{row.write_off_number}</Text>,
    },
    {
      key: "amount",
      label: "Amount",
      sortable: true,
      sortValue: (row: BadDebtWriteOff) => Number(row.amount),
      accessor: (row: BadDebtWriteOff) => row.amount,
      render: (row: BadDebtWriteOff) => <Text size="sm">₹{row.amount}</Text>,
    },
    {
      key: "reason",
      label: "Reason",
      searchable: true,
      accessor: (row: BadDebtWriteOff) => row.reason,
      render: (row: BadDebtWriteOff) => <Text size="sm">{row.reason}</Text>,
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      accessor: (row: BadDebtWriteOff) => row.status,
      render: (row: BadDebtWriteOff) => (
        <Badge
          tone={
            row.status === "approved" ? "success" : row.status === "rejected" ? "danger" : "warning"
          }
        >
          {row.status}
        </Badge>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (row: BadDebtWriteOff) =>
        row.status === "pending" && canApproveWriteOff ? (
          <Group gap={4}>
            <Tooltip label="Approve">
              <IconButton
                tone="success"
                aria-label="Approve"
                size="sm"
                onClick={() =>
                  approveWriteOffMutation.mutate({ id: row.id, data: { approved: true } })
                }
              >
                <IconCheck size={14} />
              </IconButton>
            </Tooltip>
            <Tooltip label="Reject">
              <IconButton
                tone="danger"
                aria-label="Reject"
                size="sm"
                onClick={() =>
                  approveWriteOffMutation.mutate({ id: row.id, data: { approved: false } })
                }
              >
                <IconX size={14} />
              </IconButton>
            </Tooltip>
          </Group>
        ) : null,
    },
  ];

  const refundColumns = [
    {
      key: "refund_number",
      label: "Refund #",
      sortable: true,
      searchable: true,
      accessor: (row: Refund) => row.refund_number,
      render: (row: Refund) => <Text fw={500}>{row.refund_number}</Text>,
    },
    {
      key: "amount",
      label: "Amount",
      sortable: true,
      sortValue: (row: Refund) => Number(row.amount),
      accessor: (row: Refund) => row.amount,
      render: (row: Refund) => <Text size="sm">₹{row.amount}</Text>,
    },
    {
      key: "reason",
      label: "Reason",
      searchable: true,
      accessor: (row: Refund) => row.reason,
      render: (row: Refund) => <Text size="sm">{row.reason}</Text>,
    },
    {
      key: "mode",
      label: "Mode",
      render: (row: Refund) => <Badge tone="neutral">{row.mode}</Badge>,
    },
    {
      key: "refunded_at",
      label: "Date",
      sortable: true,
      sortValue: (row: Refund) => new Date(row.refunded_at).getTime(),
      accessor: (row: Refund) => new Date(row.refunded_at).toLocaleDateString(),
      render: (row: Refund) => (
        <Text size="sm">{new Date(row.refunded_at).toLocaleDateString()}</Text>
      ),
    },
  ];

  const creditColumns = [
    {
      key: "credit_note_number",
      label: "CN #",
      sortable: true,
      searchable: true,
      accessor: (row: CreditNote) => row.credit_note_number,
      render: (row: CreditNote) => <Text fw={500}>{row.credit_note_number}</Text>,
    },
    {
      key: "amount",
      label: "Amount",
      sortable: true,
      sortValue: (row: CreditNote) => Number(row.amount),
      accessor: (row: CreditNote) => row.amount,
      render: (row: CreditNote) => <Text size="sm">₹{row.amount}</Text>,
    },
    {
      key: "reason",
      label: "Reason",
      searchable: true,
      accessor: (row: CreditNote) => row.reason,
      render: (row: CreditNote) => <Text size="sm">{row.reason}</Text>,
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      accessor: (row: CreditNote) => row.status,
      render: (row: CreditNote) => (
        <Badge
          tone={row.status === "active" ? "success" : row.status === "used" ? "primary" : "danger"}
        >
          {row.status}
        </Badge>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (row: CreditNote) =>
        row.status === "active" && canCreate ? (
          <Button
            tone="secondary"
            size="compact-xs"
            onClick={() => {
              const invoiceId = prompt("Enter Invoice ID to apply credit note:");
              if (invoiceId) applyMutation.mutate({ noteId: row.id, invoiceId });
            }}
          >
            Apply
          </Button>
        ) : null,
    },
  ];

  return (
    <Stack>
      <Text fw={600}>Refunds</Text>
      {canCreate && (
        <>
          <Button
            tone="primary"
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={() => setShowRefund(!showRefund)}
          >
            Create Refund
          </Button>
          {showRefund && (
            <Stack component="form" gap="xs" onSubmit={handleSubmitRefund(handleCreateRefund)}>
              <Group grow>
                <TextInput
                  label="Invoice ID"
                  required
                  error={refundErrors.invoice_id?.message}
                  {...registerRefund("invoice_id")}
                />
                <Controller
                  control={refundControl}
                  name="amount"
                  render={({ field }) => (
                    <NumberInput
                      label="Amount"
                      required
                      min={0}
                      decimalScale={2}
                      value={field.value}
                      onChange={field.onChange}
                      error={refundErrors.amount?.message}
                    />
                  )}
                />
              </Group>
              <TextInput
                label="Reason"
                required
                error={refundErrors.reason?.message}
                {...registerRefund("reason")}
              />
              <Controller
                control={refundControl}
                name="mode"
                render={({ field }) => (
                  <Select
                    label="Mode"
                    data={billingPaymentModeOptions}
                    value={field.value}
                    onChange={(value) => field.onChange(value ?? "cash")}
                    error={refundErrors.mode?.message}
                  />
                )}
              />
              <TextInput
                label="Reference #"
                error={refundErrors.reference_number?.message}
                {...registerRefund("reference_number")}
              />
              <Button tone="primary" size="xs" type="submit" loading={refundMutation.isPending}>
                Process Refund
              </Button>
            </Stack>
          )}
        </>
      )}
      <DataTable
        columns={refundColumns}
        data={refunds?.data ?? []}
        rowKey={(row) => row.id}
        searchable
        searchPlaceholder="Search refund # or reason"
        exportable
        exportFileName="refunds"
        page={refundsPage}
        perPage={50}
        total={refunds?.meta.total}
        totalPages={refunds ? Math.ceil(refunds.meta.total / refunds.meta.limit) : 0}
        onPageChange={setRefundsPage}
      />

      <Text fw={600} mt="lg">
        Credit Notes
      </Text>
      {canCreate && (
        <>
          <Button
            tone="primary"
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={() => setShowCredit(!showCredit)}
          >
            Create Credit Note
          </Button>
          {showCredit && (
            <Stack component="form" gap="xs" onSubmit={handleSubmitCredit(handleCreateCreditNote)}>
              <TextInput
                label="Invoice ID"
                required
                error={creditErrors.invoice_id?.message}
                {...registerCredit("invoice_id")}
              />
              <Controller
                control={creditControl}
                name="amount"
                render={({ field }) => (
                  <NumberInput
                    label="Amount"
                    required
                    min={0}
                    decimalScale={2}
                    value={field.value}
                    onChange={field.onChange}
                    error={creditErrors.amount?.message}
                  />
                )}
              />
              <TextInput
                label="Reason"
                required
                error={creditErrors.reason?.message}
                {...registerCredit("reason")}
              />
              <Button tone="primary" size="xs" type="submit" loading={creditMutation.isPending}>
                Issue Credit Note
              </Button>
            </Stack>
          )}
        </>
      )}
      <DataTable
        columns={creditColumns}
        data={creditNotes?.data ?? []}
        rowKey={(row) => row.id}
        searchable
        searchPlaceholder="Search CN # or reason"
        exportable
        exportFileName="credit-notes"
        page={creditNotesPage}
        perPage={50}
        total={creditNotes?.meta.total}
        totalPages={creditNotes ? Math.ceil(creditNotes.meta.total / creditNotes.meta.limit) : 0}
        onPageChange={setCreditNotesPage}
      />

      <Text fw={600} mt="lg">
        Write-Offs
      </Text>
      {canWriteOff && (
        <>
          <Button
            tone="primary"
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={() => setShowWriteOff(!showWriteOff)}
          >
            Request Write-Off
          </Button>
          {showWriteOff && (
            <Stack component="form" gap="xs" onSubmit={handleSubmitWriteOff(handleCreateWriteOff)}>
              <TextInput
                label="Invoice ID"
                required
                error={writeOffErrors.invoice_id?.message}
                {...registerWriteOff("invoice_id")}
              />
              <Controller
                control={writeOffControl}
                name="amount"
                render={({ field }) => (
                  <NumberInput
                    label="Amount"
                    required
                    min={0}
                    decimalScale={2}
                    value={field.value}
                    onChange={field.onChange}
                    error={writeOffErrors.amount?.message}
                  />
                )}
              />
              <TextInput
                label="Reason"
                required
                error={writeOffErrors.reason?.message}
                {...registerWriteOff("reason")}
              />
              <Textarea
                label="Notes"
                error={writeOffErrors.notes?.message}
                {...registerWriteOff("notes")}
              />
              <Button tone="primary" size="xs" type="submit" loading={writeOffMutation.isPending}>
                Submit Write-Off
              </Button>
            </Stack>
          )}
        </>
      )}
      <DataTable
        columns={writeOffColumns}
        data={writeOffs?.data ?? []}
        rowKey={(row) => row.id}
        searchable
        searchPlaceholder="Search WO # or reason"
        exportable
        exportFileName="write-offs"
        page={writeOffsPage}
        perPage={50}
        total={writeOffs?.meta.total}
        totalPages={writeOffs ? Math.ceil(writeOffs.meta.total / writeOffs.meta.limit) : 0}
        onPageChange={setWriteOffsPage}
      />
    </Stack>
  );
}

// ── Insurance Claims Tab ────────────────────────────────

function InsuranceClaimsTab({
  canCreate,
  canWriteOff: _cwo,
}: {
  canCreate: boolean;
  canWriteOff: boolean;
}) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [showTpa, setShowTpa] = useState(false);
  const insuranceClaimDefaults: BillingInsuranceClaimFormInput = {
    invoice_id: "",
    patient_id: "",
    insurance_provider: "",
    policy_number: "",
    claim_type: "cashless",
    pre_auth_amount: "",
    scheme_type: "",
    tpa_name: "",
    co_pay_percent: "",
    deductible_amount: "",
    member_id: "",
    scheme_card_number: "",
    notes: "",
  };
  const tpaRateCardDefaults: BillingTpaRateCardFormInput = {
    tpa_name: "",
    insurance_provider: "",
    scheme_type: "",
    rate_plan_id: "",
    valid_from: "",
    valid_to: "",
    is_active: true,
  };
  const {
    control: claimControl,
    register: registerClaim,
    reset: resetClaim,
    handleSubmit: handleSubmitClaim,
    formState: { errors: claimErrors },
  } = useForm<BillingInsuranceClaimFormInput>({
    resolver: zodResolver(billingInsuranceClaimFormSchema),
    defaultValues: insuranceClaimDefaults,
  });
  const {
    control: tpaControl,
    register: registerTpa,
    reset: resetTpa,
    handleSubmit: handleSubmitTpa,
    formState: { errors: tpaErrors },
  } = useForm<BillingTpaRateCardFormInput>({
    resolver: zodResolver(billingTpaRateCardFormSchema),
    defaultValues: tpaRateCardDefaults,
  });
  const [detailClaim, setDetailClaim] = useState<InsuranceClaim | null>(null);
  const [nhcxAction, setNhcxAction] = useState<{
    id: string;
    mode: "submit" | "eligibility";
  } | null>(null);

  const { data: claims = [], isLoading } = useQuery({
    queryKey: ["insurance-claims"],
    queryFn: () => billingService.listInsuranceClaims(),
  });

  const { data: nhcxCallbacks = [] } = useQuery({
    queryKey: ["nhcx-callbacks", detailClaim?.id],
    queryFn: () => billingService.listNhcxCallbacks({ matched_id: detailClaim?.id }),
    enabled: !!detailClaim,
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateInsuranceClaimRequest) => billingService.createInsuranceClaim(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["insurance-claims"] });
      setShowForm(false);
      resetClaim(insuranceClaimDefaults);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      billingService.updateInsuranceClaim(id, { status }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["insurance-claims"] }),
  });

  const { data: tpaCards = [] } = useQuery({
    queryKey: ["tpa-rate-cards"],
    queryFn: () => billingService.listTpaRateCards(),
  });

  const tpaMutation = useMutation({
    mutationFn: (data: CreateTpaRateCardRequest) => billingService.createTpaRateCard(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tpa-rate-cards"] });
      setShowTpa(false);
      resetTpa(tpaRateCardDefaults);
    },
  });

  const deleteTpaMutation = useMutation({
    mutationFn: (id: string) => billingService.deleteTpaRateCard(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["tpa-rate-cards"] }),
  });

  const tpaColumns = [
    {
      key: "tpa_name",
      label: "TPA Name",
      sortable: true,
      searchable: true,
      accessor: (row: TpaRateCard) => row.tpa_name,
      render: (row: TpaRateCard) => <Text fw={500}>{row.tpa_name}</Text>,
    },
    {
      key: "insurance_provider",
      label: "Provider",
      sortable: true,
      searchable: true,
      accessor: (row: TpaRateCard) => row.insurance_provider,
      render: (row: TpaRateCard) => <Text size="sm">{row.insurance_provider}</Text>,
    },
    {
      key: "scheme_type",
      label: "Scheme",
      sortable: true,
      accessor: (row: TpaRateCard) => row.scheme_type ?? "—",
      render: (row: TpaRateCard) => <Badge tone="neutral">{row.scheme_type ?? "—"}</Badge>,
    },
    {
      key: "valid_from",
      label: "Valid From",
      render: (row: TpaRateCard) => <Text size="sm">{row.valid_from ?? "—"}</Text>,
    },
    {
      key: "valid_to",
      label: "Valid To",
      render: (row: TpaRateCard) => <Text size="sm">{row.valid_to ?? "—"}</Text>,
    },
    {
      key: "is_active",
      label: "Active",
      render: (row: TpaRateCard) => (
        <Badge tone={row.is_active ? "success" : "neutral"}>{row.is_active ? "Yes" : "No"}</Badge>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (row: TpaRateCard) =>
        canCreate ? (
          <Tooltip label="Delete">
            <IconButton
              tone="danger"
              aria-label="Delete"
              size="sm"
              onClick={() =>
                confirmDestructive({
                  title: "Delete TPA rate card",
                  message:
                    "Delete this TPA rate card? Insurance billing will fall back to standard rates.",
                  confirmLabel: "Delete rate card",
                  onConfirm: () => deleteTpaMutation.mutate(row.id),
                })
              }
            >
              <IconTrash size={14} />
            </IconButton>
          </Tooltip>
        ) : null,
    },
  ];

  const claimStatusColors: Record<string, BadgeTone> = {
    initiated: "neutral",
    pre_auth_requested: "primary",
    pre_auth_approved: "success",
    pre_auth_rejected: "danger",
    claim_submitted: "primary",
    claim_approved: "success",
    claim_rejected: "danger",
    settled: "success",
    partially_settled: "warning",
  };

  const handleCreateInsuranceClaim = (values: BillingInsuranceClaimFormInput) => {
    const payload: CreateInsuranceClaimRequest = {
      invoice_id: values.invoice_id.trim(),
      patient_id: values.patient_id.trim(),
      insurance_provider: values.insurance_provider.trim(),
      policy_number: billingOptionalText(values.policy_number),
      claim_type: values.claim_type,
      pre_auth_amount: billingOptionalNumber(values.pre_auth_amount),
      tpa_name: billingOptionalText(values.tpa_name),
      notes: billingOptionalText(values.notes),
      scheme_type: values.scheme_type || undefined,
      co_pay_percent: billingOptionalNumber(values.co_pay_percent),
      deductible_amount: billingOptionalNumber(values.deductible_amount),
      member_id: billingOptionalText(values.member_id),
      scheme_card_number: billingOptionalText(values.scheme_card_number),
    };
    createMutation.mutate(payload);
  };

  const handleCreateTpaRateCard = (values: BillingTpaRateCardFormInput) => {
    const payload: CreateTpaRateCardRequest = {
      tpa_name: values.tpa_name.trim(),
      insurance_provider: values.insurance_provider.trim(),
      rate_plan_id: billingOptionalText(values.rate_plan_id),
      scheme_type: values.scheme_type || undefined,
      valid_from: billingOptionalText(values.valid_from),
      valid_to: billingOptionalText(values.valid_to),
      is_active: values.is_active,
    };
    tpaMutation.mutate(payload);
  };

  const columns = [
    {
      key: "insurance_provider",
      label: "Provider",
      sortable: true,
      searchable: true,
      accessor: (row: InsuranceClaim) => row.insurance_provider,
      render: (row: InsuranceClaim) => <Text fw={500}>{row.insurance_provider}</Text>,
    },
    {
      key: "claim_type",
      label: "Type",
      sortable: true,
      searchable: true,
      accessor: (row: InsuranceClaim) => row.claim_type,
      render: (row: InsuranceClaim) => <Badge tone="neutral">{row.claim_type}</Badge>,
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      accessor: (row: InsuranceClaim) => row.status.replace(/_/g, " "),
      render: (row: InsuranceClaim) => (
        <Badge tone={claimStatusColors[row.status] ?? "neutral"}>
          {row.status.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      key: "pre_auth_amount",
      label: "Pre-Auth",
      sortable: true,
      sortValue: (row: InsuranceClaim) => Number(row.pre_auth_amount ?? 0),
      accessor: (row: InsuranceClaim) => (row.pre_auth_amount ? `₹${row.pre_auth_amount}` : "—"),
      render: (row: InsuranceClaim) => (
        <Text size="sm">{row.pre_auth_amount ? `₹${row.pre_auth_amount}` : "—"}</Text>
      ),
    },
    {
      key: "approved_amount",
      label: "Approved",
      render: (row: InsuranceClaim) => (
        <Text size="sm">{row.approved_amount ? `₹${row.approved_amount}` : "—"}</Text>
      ),
    },
    {
      key: "settled_amount",
      label: "Settled",
      render: (row: InsuranceClaim) => (
        <Text size="sm">{row.settled_amount ? `₹${row.settled_amount}` : "—"}</Text>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (row: InsuranceClaim) =>
        canCreate && row.status === "initiated" ? (
          <Button
            tone="secondary"
            size="compact-xs"
            onClick={() => updateMutation.mutate({ id: row.id, status: "pre_auth_requested" })}
          >
            Request Pre-Auth
          </Button>
        ) : null,
    },
  ];

  return (
    <Stack>
      {canCreate && (
        <>
          <Button
            tone="primary"
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={() => {
              setShowForm(!showForm);
              if (showForm) resetClaim(insuranceClaimDefaults);
            }}
          >
            New Claim
          </Button>
          {showForm && (
            <Stack
              component="form"
              gap="xs"
              onSubmit={handleSubmitClaim(handleCreateInsuranceClaim)}
            >
              <Group grow>
                <TextInput
                  label="Invoice ID"
                  required
                  error={claimErrors.invoice_id?.message}
                  {...registerClaim("invoice_id")}
                />
                <Controller
                  name="patient_id"
                  control={claimControl}
                  render={({ field }) => (
                    <PatientSearchSelect value={field.value ?? ""} onChange={field.onChange} />
                  )}
                />
              </Group>
              <Group grow>
                <TextInput
                  label="Insurance Provider"
                  required
                  error={claimErrors.insurance_provider?.message}
                  {...registerClaim("insurance_provider")}
                />
                <TextInput
                  label="Policy Number"
                  error={claimErrors.policy_number?.message}
                  {...registerClaim("policy_number")}
                />
              </Group>
              <Group grow>
                <Controller
                  control={claimControl}
                  name="claim_type"
                  render={({ field }) => (
                    <Select
                      label="Claim Type"
                      data={billingInsuranceClaimTypeOptions}
                      value={field.value}
                      onChange={(value) => field.onChange(value ?? "cashless")}
                      error={claimErrors.claim_type?.message}
                    />
                  )}
                />
                <Controller
                  control={claimControl}
                  name="pre_auth_amount"
                  render={({ field }) => (
                    <NumberInput
                      label="Pre-Auth Amount"
                      min={0}
                      decimalScale={2}
                      value={field.value}
                      onChange={field.onChange}
                      error={claimErrors.pre_auth_amount?.message}
                    />
                  )}
                />
              </Group>
              <Group grow>
                <Controller
                  control={claimControl}
                  name="scheme_type"
                  render={({ field }) => (
                    <Select
                      label="Scheme Type"
                      data={billingInsuranceSchemeTypeOptions}
                      value={field.value || null}
                      onChange={(value) => field.onChange(value ?? "")}
                      error={claimErrors.scheme_type?.message}
                      clearable
                      searchable
                    />
                  )}
                />
                <TextInput
                  label="TPA Name"
                  error={claimErrors.tpa_name?.message}
                  {...registerClaim("tpa_name")}
                />
              </Group>
              <Group grow>
                <Controller
                  control={claimControl}
                  name="co_pay_percent"
                  render={({ field }) => (
                    <NumberInput
                      label="Co-Pay %"
                      min={0}
                      max={100}
                      decimalScale={2}
                      value={field.value}
                      onChange={field.onChange}
                      error={claimErrors.co_pay_percent?.message}
                    />
                  )}
                />
                <Controller
                  control={claimControl}
                  name="deductible_amount"
                  render={({ field }) => (
                    <NumberInput
                      label="Deductible Amount"
                      min={0}
                      decimalScale={2}
                      value={field.value}
                      onChange={field.onChange}
                      error={claimErrors.deductible_amount?.message}
                    />
                  )}
                />
              </Group>
              <Group grow>
                <TextInput
                  label="Member ID"
                  error={claimErrors.member_id?.message}
                  {...registerClaim("member_id")}
                />
                <TextInput
                  label="Scheme Card Number"
                  error={claimErrors.scheme_card_number?.message}
                  {...registerClaim("scheme_card_number")}
                />
              </Group>
              <Textarea
                label="Notes"
                error={claimErrors.notes?.message}
                {...registerClaim("notes")}
              />
              <Button tone="primary" size="xs" type="submit" loading={createMutation.isPending}>
                Create Claim
              </Button>
            </Stack>
          )}
        </>
      )}
      <DataTable
        columns={columns}
        data={claims}
        loading={isLoading}
        rowKey={(row) => row.id}
        onRowClick={(row) => setDetailClaim(row)}
        searchable
        searchPlaceholder="Search provider or claim type"
        exportable
        exportFileName="insurance-claims"
      />

      <ClaimDetailDrawer
        claim={detailClaim}
        callbacks={nhcxCallbacks}
        onClose={() => setDetailClaim(null)}
        onNhcxAction={(c, mode) => {
          setDetailClaim(null);
          setNhcxAction({ id: c.id, mode });
        }}
      />

      <SubmitToNhcxModal
        claimId={nhcxAction?.id ?? ""}
        mode={nhcxAction?.mode ?? "submit"}
        opened={!!nhcxAction}
        onClose={() => setNhcxAction(null)}
      />

      <Text fw={600} mt="lg">
        NHCX
      </Text>
      <NhcxPayerDirectory />

      <Text fw={600} mt="lg">
        TPA Rate Cards
      </Text>
      {canCreate && (
        <>
          <Button
            tone="primary"
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={() => {
              setShowTpa(!showTpa);
              if (showTpa) resetTpa(tpaRateCardDefaults);
            }}
          >
            Add TPA Rate Card
          </Button>
          {showTpa && (
            <Stack component="form" gap="xs" onSubmit={handleSubmitTpa(handleCreateTpaRateCard)}>
              <Group grow>
                <TextInput
                  label="TPA Name"
                  required
                  error={tpaErrors.tpa_name?.message}
                  {...registerTpa("tpa_name")}
                />
                <TextInput
                  label="Insurance Provider"
                  required
                  error={tpaErrors.insurance_provider?.message}
                  {...registerTpa("insurance_provider")}
                />
              </Group>
              <Group grow>
                <Controller
                  control={tpaControl}
                  name="scheme_type"
                  render={({ field }) => (
                    <Select
                      label="Scheme Type"
                      data={billingInsuranceSchemeTypeOptions}
                      value={field.value || null}
                      onChange={(value) => field.onChange(value ?? "")}
                      error={tpaErrors.scheme_type?.message}
                      clearable
                      searchable
                    />
                  )}
                />
                <TextInput
                  label="Rate Plan ID"
                  error={tpaErrors.rate_plan_id?.message}
                  {...registerTpa("rate_plan_id")}
                />
              </Group>
              <Group grow>
                <TextInput
                  label="Valid From"
                  type="date"
                  error={tpaErrors.valid_from?.message}
                  {...registerTpa("valid_from")}
                />
                <TextInput
                  label="Valid To"
                  type="date"
                  error={tpaErrors.valid_to?.message}
                  {...registerTpa("valid_to")}
                />
              </Group>
              <Controller
                control={tpaControl}
                name="is_active"
                render={({ field }) => (
                  <Switch
                    label="Active rate card"
                    checked={field.value}
                    onChange={(event) => field.onChange(event.currentTarget.checked)}
                  />
                )}
              />
              <Button tone="primary" size="xs" type="submit" loading={tpaMutation.isPending}>
                Save TPA Rate Card
              </Button>
            </Stack>
          )}
        </>
      )}
      <DataTable
        columns={tpaColumns}
        data={tpaCards}
        rowKey={(row) => row.id}
        searchable
        searchPlaceholder="Search TPA or provider"
        exportable
        exportFileName="tpa-rate-cards"
      />
    </Stack>
  );
}
