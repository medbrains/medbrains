import { Group, Progress, Select, Stack, Tabs, Text, Tooltip } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useHasPermission } from "@medbrains/stores";
import type { Invoice } from "@medbrains/types";
import { billingInvoiceBalanceSignal, billingInvoiceStatusSignal, P } from "@medbrains/types";
import {
  IconBuildingBank,
  IconCalendarCheck,
  IconCash,
  IconChartBar,
  IconClipboardList,
  IconCoin,
  IconCopy,
  IconCreditCard,
  IconDatabase,
  IconDiscount,
  IconEye,
  IconFileInvoice,
  IconListCheck,
  IconMoneybag,
  IconPackage,
  IconPlus,
  IconReceipt,
  IconRefresh,
  IconReportMoney,
  IconScale,
  IconSettings,
  IconShieldCheck,
  IconShieldHalf,
  IconTags,
  IconTransferIn,
  IconWallet,
  IconX,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams, useSearchParams } from "react-router";
import {
  ClinicalEventProvider,
  type Column,
  DataTable,
  OperationalSignal,
  PageHeader,
  type SortState,
} from "@/components";
import { PatientContextBanner } from "@/components/Patient/PatientContextBanner";
import { PatientFlowNavigator } from "@/components/Patient/PatientFlowNavigator";
import { Alert, Button, IconButton, toast } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { billingService } from "@/services/billing.service";
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
import { CorporateTab } from "./billing/corporate";
import { CreateInvoiceDrawer } from "./billing/create-invoice-drawer";
import { CreditPatientsTab } from "./billing/credit-patients";
import { DayCloseTab } from "./billing/day-close";
import { InsuranceClaimsTab } from "./billing/insurance-claims";
import { InvoiceDetail } from "./billing/invoice-detail";
import { PackagesTab } from "./billing/packages";
import { RatePlansTab } from "./billing/rate-plans";
import { RefundsCreditsTab } from "./billing/refunds-credits";
import { ReportsTab } from "./billing/reports";
import { BillingSettingsTab } from "./billing/settings";
import {
  BILLING_INVOICE_STATUS_OPTIONS,
  invoiceBalance,
  invoiceBalanceLabel,
  invoiceDisplayStatus,
  invoiceIsPayable,
  invoiceStatusLabel,
  isBillingTab,
  isInvoiceStatus,
  money,
} from "./billing/shared";
import {
  billingAdmissionFilterFromSearchParams,
  billingEncounterFilterFromSearchParams,
  billingHandoffActionFromSearchParams,
  billingInvoiceActionFromSearchParams,
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
