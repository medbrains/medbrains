import { useState } from "react";
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Drawer,
  Group,
  NumberInput,
  Progress,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  Tabs,
  Text,
  TextInput,
  Textarea,
  Title,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconAmbulance,
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
  IconDiscount2,
  IconEye,
  IconFileInvoice,
  IconMoneybag,
  IconPackage,
  IconPencil,
  IconPlus,
  IconReceipt,
  IconRefresh,
  IconReportMoney,
  IconScale,
  IconSettings,
  IconShieldCheck,
  IconTags,
  IconTransferIn,
  IconTrash,
  IconUpload,
  IconWallet,
  IconX,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import { useHasPermission } from "@medbrains/stores";
import type {
  AddDiscountRequest,
  AddInvoiceItemRequest,
  AdjustAdvanceRequest,
  AgingBucket,
  ApproveWriteOffRequest,
  BadDebtWriteOff,
  BillingAuditEntry,
  BillingPackage,
  BillingSummaryReport,
  ChargeMaster,
  CorporateClient,
  CorporateEnrollment,
  CreateAdvanceRequest,
  CreateChargeMasterRequest,
  CreateCorporateRequest,
  CreateCreditNoteRequest,
  CreateDayCloseRequest,
  CreateEnrollmentRequest,
  CreateInsuranceClaimRequest,
  CreateInvoiceRequest,
  CreatePackageRequest,
  CreateRefundRequest,
  CreateTpaRateCardRequest,
  CreateWriteOffRequest,
  CreditNote,
  DayEndClose,
  DepartmentRevenueRow,
  DoctorRevenueRow,
  InsuranceClaim,
  InsurancePanelRow,
  Invoice,
  InvoiceDetailResponse,
  InvoiceDiscount,
  PatientAdvance,
  RatePlan,
  RecordPaymentRequest,
  Refund,
  RefundAdvanceRequest,
  TenantSettingsRow,
  TpaRateCard,
  UpdateCorporateRequest,
  CopayCalculation,
  ErFastInvoiceRequest,
  // Phase 3
  CreditPatient,
  CreditAgingRow,
  CreateJournalEntryRequest,
  CreateTdsRequest,
  ErpExportLog,
  ErpExportRequest,
  GenerateGstrRequest,
  GlAccount,
  GstReturnSummary,
  HsnSummaryRow,
  ImportBankTransactionsRequest,
  JournalEntry,
  JournalLineInput,
  BankTransaction,
  ProfitLossDeptRow,
  TdsDeduction,
  UpdateCreditPatientRequest,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { ClinicalEventProvider, useClinicalEmit, DataTable, PageHeader, StatusDot } from "../components";
import { EmployeeSearchSelect } from "../components/EmployeeSearchSelect";
import { PatientSearchSelect } from "../components/PatientSearchSelect";
import { useRequirePermission } from "../hooks/useRequirePermission";

const statusColors: Record<string, string> = {
  draft: "slate",
  issued: "primary",
  partially_paid: "warning",
  paid: "success",
  cancelled: "danger",
  refunded: "orange",
};

// Dropdown options for categorical fields
const SERVICE_CATEGORIES = [
  { value: "consultation", label: "Consultation" },
  { value: "procedure", label: "Procedure" },
  { value: "laboratory", label: "Laboratory" },
  { value: "radiology", label: "Radiology" },
  { value: "pharmacy", label: "Pharmacy" },
  { value: "nursing", label: "Nursing Services" },
  { value: "room_rent", label: "Room Rent" },
  { value: "ot", label: "Operation Theatre" },
  { value: "icu", label: "ICU Charges" },
  { value: "physiotherapy", label: "Physiotherapy" },
  { value: "ambulance", label: "Ambulance" },
  { value: "consumables", label: "Consumables" },
  { value: "equipment", label: "Equipment" },
  { value: "miscellaneous", label: "Miscellaneous" },
];

const INSURANCE_SCHEME_TYPES = [
  { value: "tpa", label: "TPA (Third Party Administrator)" },
  { value: "cghs", label: "CGHS (Central Government Health Scheme)" },
  { value: "echs", label: "ECHS (Ex-Servicemen Health Scheme)" },
  { value: "esic", label: "ESIC (Employee State Insurance)" },
  { value: "ayushman_bharat", label: "Ayushman Bharat (PMJAY)" },
  { value: "state_scheme", label: "State Government Scheme" },
  { value: "corporate", label: "Corporate Insurance" },
  { value: "cashless", label: "Cashless" },
  { value: "reimbursement", label: "Reimbursement" },
  { value: "other", label: "Other" },
];

export function BillingPage() {
  useRequirePermission(P.BILLING.INVOICES_LIST);

  return (
    <ClinicalEventProvider moduleCode="billing" contextCode="billing-invoices">
      <BillingPageInner />
    </ClinicalEventProvider>
  );
}

function BillingPageInner() {
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

  const [page, setPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);
  const [detailOpened, { open: openDetail, close: closeDetail }] = useDisclosure(false);
  const [erInvoiceOpened, { open: openErInvoice, close: closeErInvoice }] = useDisclosure(false);

  const params: Record<string, string> = { page: String(page), per_page: "20" };
  if (filterStatus) params.status = filterStatus;

  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["invoices", params],
    queryFn: () => api.listInvoices(params),
  });

  const cloneMutation = useMutation({
    mutationFn: (id: string) => api.cloneInvoice(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["invoices"] });
      notifications.show({ title: "Cloned", message: "Invoice duplicated as draft", color: "success" });
    },
    onError: () => notifications.show({ title: "Error", message: "Failed to clone invoice", color: "danger" }),
  });

  const columns = [
    { key: "invoice_number", label: "Invoice #", render: (row: Invoice) => <Text fw={600}>{row.invoice_number}</Text> },
    {
      key: "status",
      label: "Status",
      render: (row: Invoice) => (
        <Group gap={6}>
          <StatusDot color={statusColors[row.status] ?? "slate"} label={row.status.replace(/_/g, " ")} />
          {row.notes === "Auto-generated" && <Badge size="xs" color="primary" variant="light">Auto</Badge>}
          {row.is_interim && <Badge size="xs" color="violet" variant="light">Interim</Badge>}
          {row.corporate_id && <Badge size="xs" color="info" variant="light">Corporate</Badge>}
          {row.is_er_deferred && <Badge size="xs" color="danger" variant="light">ER Deferred</Badge>}
          {row.cloned_from_id && <Badge size="xs" color="violet" variant="light">Cloned</Badge>}
        </Group>
      ),
    },
    { key: "total_amount", label: "Total", render: (row: Invoice) => <Text size="sm">₹{row.total_amount}</Text> },
    { key: "paid_amount", label: "Paid", render: (row: Invoice) => <Text size="sm">₹{row.paid_amount}</Text> },
    {
      key: "balance",
      label: "Balance",
      render: (row: Invoice) => {
        const balance = Number(row.total_amount) - Number(row.paid_amount);
        return <Text size="sm" c={balance > 0 ? "danger" : "success"}>₹{balance.toFixed(2)}</Text>;
      },
    },
    {
      key: "created_at",
      label: "Date",
      render: (row: Invoice) => <Text size="sm">{new Date(row.created_at).toLocaleDateString()}</Text>,
    },
    {
      key: "actions",
      label: "Actions",
      render: (row: Invoice) => (
        <Group gap={4}>
          <Tooltip label="View">
            <ActionIcon
              variant="subtle"
              onClick={() => {
                setSelectedInvoiceId(row.id);
                openDetail();
              }}
            >
              <IconEye size={16} />
            </ActionIcon>
          </Tooltip>
          {canCreate && (
            <Tooltip label="Clone">
              <ActionIcon variant="subtle" color="violet" onClick={() => cloneMutation.mutate(row.id)} loading={cloneMutation.isPending}>
                <IconCopy size={16} />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Billing"
        subtitle="Invoices and payments"
        icon={<IconReceipt size={20} stroke={1.5} />}
        color="orange"
        actions={
          canCreate ? (
            <Group gap="xs">
              <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
                New Invoice
              </Button>
              <Button variant="light" color="danger" leftSection={<IconAmbulance size={16} />} onClick={openErInvoice}>
                ER Fast Invoice
              </Button>
            </Group>
          ) : undefined
        }
      />

      <Tabs defaultValue="invoices">
        <Tabs.List mb="md">
          <Tabs.Tab value="invoices" leftSection={<IconFileInvoice size={14} />}>Invoices</Tabs.Tab>
          <Tabs.Tab value="charge-master" leftSection={<IconTags size={14} />}>Charge Master</Tabs.Tab>
          <Tabs.Tab value="packages" leftSection={<IconPackage size={14} />}>Packages</Tabs.Tab>
          <Tabs.Tab value="rate-plans" leftSection={<IconCreditCard size={14} />}>Rate Plans</Tabs.Tab>
          <Tabs.Tab value="refunds" leftSection={<IconRefresh size={14} />}>Refunds & Credits</Tabs.Tab>
          <Tabs.Tab value="insurance" leftSection={<IconShieldCheck size={14} />}>Insurance Claims</Tabs.Tab>
          <Tabs.Tab value="advances" leftSection={<IconWallet size={14} />}>Advances</Tabs.Tab>
          <Tabs.Tab value="corporate" leftSection={<IconBuildingBank size={14} />}>Corporate</Tabs.Tab>
          <Tabs.Tab value="reports" leftSection={<IconChartBar size={14} />}>Reports</Tabs.Tab>
          {canDayClose && <Tabs.Tab value="day-close" leftSection={<IconCalendarCheck size={14} />}>Day Close</Tabs.Tab>}
          {canAudit && <Tabs.Tab value="audit-log" leftSection={<IconClipboardList size={14} />}>Audit Log</Tabs.Tab>}
          {canCredit && <Tabs.Tab value="credit-patients" leftSection={<IconMoneybag size={14} />}>Credit Patients</Tabs.Tab>}
          {canGst && <Tabs.Tab value="gst-tds" leftSection={<IconReportMoney size={14} />}>GST & TDS</Tabs.Tab>}
          {canJournal && <Tabs.Tab value="journal" leftSection={<IconScale size={14} />}>Journal Entries</Tabs.Tab>}
          {canBankRecon && <Tabs.Tab value="bank-recon" leftSection={<IconTransferIn size={14} />}>Bank Recon</Tabs.Tab>}
          <Tabs.Tab value="financial-mis" leftSection={<IconCoin size={14} />}>Financial MIS</Tabs.Tab>
          {canErp && <Tabs.Tab value="erp-export" leftSection={<IconDatabase size={14} />}>ERP Export</Tabs.Tab>}
          <Tabs.Tab value="settings" leftSection={<IconSettings size={14} />}>Settings</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="invoices">
          <Group mb="md">
            <Select
              placeholder="Status"
              data={[
                { value: "draft", label: "Draft" },
                { value: "issued", label: "Issued" },
                { value: "partially_paid", label: "Partially Paid" },
                { value: "paid", label: "Paid" },
                { value: "cancelled", label: "Cancelled" },
              ]}
              value={filterStatus}
              onChange={setFilterStatus}
              clearable
              w={180}
            />
          </Group>
          <DataTable
            columns={columns}
            data={data?.invoices ?? []}
            loading={isLoading}
            page={page}
            totalPages={data ? Math.ceil(data.total / data.per_page) : 1}
            onPageChange={setPage}
            rowKey={(row) => row.id}
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

        <Tabs.Panel value="settings">
          <BillingSettingsTab />
        </Tabs.Panel>
      </Tabs>

      <CreateInvoiceDrawer opened={createOpened} onClose={closeCreate} />
      <ErFastInvoiceModal opened={erInvoiceOpened} onClose={closeErInvoice} />

      <Drawer opened={detailOpened} onClose={closeDetail} title="Invoice Detail" position="right" size="lg">
        {selectedInvoiceId && <InvoiceDetail invoiceId={selectedInvoiceId} canCreate={canCreate} canPay={canPay} />}
      </Drawer>
    </div>
  );
}

function CreateInvoiceDrawer({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const emit = useClinicalEmit();
  const queryClient = useQueryClient();
  const [patientId, setPatientId] = useState("");
  const [encounterId, setEncounterId] = useState("");
  const [notes, setNotes] = useState("");

  const createMutation = useMutation({
    mutationFn: (data: CreateInvoiceRequest) => api.createInvoice(data),
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["invoices"] });
      notifications.show({ title: "Invoice created", message: "Draft invoice created", color: "success" });
      emit("invoice.created", { patient_id: variables.patient_id });
      onClose();
      setPatientId("");
      setEncounterId("");
      setNotes("");
    },
    onError: () => {
      notifications.show({ title: "Error", message: "Failed to create invoice", color: "danger" });
    },
  });

  return (
    <Drawer opened={opened} onClose={onClose} title="Create Invoice" position="right" size="xl">
      <Stack>
        <TextInput label="Patient ID" required value={patientId} onChange={(e) => setPatientId(e.currentTarget.value)} />
        <TextInput label="Encounter ID" value={encounterId} onChange={(e) => setEncounterId(e.currentTarget.value)} />
        <Textarea label="Notes" value={notes} onChange={(e) => setNotes(e.currentTarget.value)} />
        <Button onClick={() => createMutation.mutate({ patient_id: patientId, encounter_id: encounterId || undefined, notes: notes || undefined })} loading={createMutation.isPending}>
          Create Draft Invoice
        </Button>
      </Stack>
    </Drawer>
  );
}

function InvoiceDetail({ invoiceId, canCreate, canPay }: { invoiceId: string; canCreate: boolean; canPay: boolean }) {
  const emit = useClinicalEmit();
  const queryClient = useQueryClient();
  const [showAddItem, setShowAddItem] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showDiscount, setShowDiscount] = useState(false);
  const [showCopay, setShowCopay] = useState(false);
  const [itemForm, setItemForm] = useState<Partial<AddInvoiceItemRequest>>({ source: "manual", quantity: 1 });
  const [payForm, setPayForm] = useState<Partial<RecordPaymentRequest>>({ mode: "cash" });
  const [discForm, setDiscForm] = useState<Partial<AddDiscountRequest>>({ discount_type: "percentage" });

  const { data } = useQuery({
    queryKey: ["invoice-detail", invoiceId],
    queryFn: () => api.getInvoice(invoiceId),
  });

  const issueMutation = useMutation({
    mutationFn: () => api.issueInvoice(invoiceId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["invoice-detail", invoiceId] });
      emit("invoice.issued", { invoice_id: invoiceId });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => api.cancelInvoice(invoiceId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["invoice-detail", invoiceId] }),
  });

  const addItemMutation = useMutation({
    mutationFn: (item: AddInvoiceItemRequest) => api.addInvoiceItem(invoiceId, item),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["invoice-detail", invoiceId] });
      setShowAddItem(false);
    },
  });

  const removeItemMutation = useMutation({
    mutationFn: (itemId: string) => api.removeInvoiceItem(invoiceId, itemId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["invoice-detail", invoiceId] }),
  });

  const payMutation = useMutation({
    mutationFn: (pay: RecordPaymentRequest) => api.recordPayment(invoiceId, pay),
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["invoice-detail", invoiceId] });
      emit("payment.recorded", { invoice_id: invoiceId, amount: variables.amount, mode: variables.mode });
      setShowPayment(false);
    },
  });

  const { data: discounts = [] } = useQuery({
    queryKey: ["invoice-discounts", invoiceId],
    queryFn: () => api.listInvoiceDiscounts(invoiceId),
  });

  const addDiscountMutation = useMutation({
    mutationFn: (d: AddDiscountRequest) => api.addDiscount(invoiceId, d),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["invoice-discounts", invoiceId] });
      void queryClient.invalidateQueries({ queryKey: ["invoice-detail", invoiceId] });
      setShowDiscount(false);
    },
  });

  const removeDiscountMutation = useMutation({
    mutationFn: (discId: string) => api.removeDiscount(invoiceId, discId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["invoice-discounts", invoiceId] });
      void queryClient.invalidateQueries({ queryKey: ["invoice-detail", invoiceId] });
    },
  });

  const receiptMutation = useMutation({
    mutationFn: (paymentId: string) => api.generateReceipt(invoiceId, paymentId),
    onSuccess: () => {
      notifications.show({ title: "Receipt generated", message: "Receipt created successfully", color: "success" });
    },
  });

  if (!data) return <Text c="dimmed">Loading...</Text>;

  const detail = data as InvoiceDetailResponse;
  const inv = detail.invoice;

  return (
    <Stack>
      <Group justify="space-between">
        <Text fw={700} size="lg">{inv.invoice_number}</Text>
        <Badge color={statusColors[inv.status] ?? "slate"} variant="light" size="lg">
          {inv.status.replace(/_/g, " ")}
        </Badge>
      </Group>
      <Group>
        <Text size="sm">Total: ₹{inv.total_amount}</Text>
        <Text size="sm">Paid: ₹{inv.paid_amount}</Text>
        <Text size="sm" c="danger">Balance: ₹{(Number(inv.total_amount) - Number(inv.paid_amount)).toFixed(2)}</Text>
      </Group>
      {(Number(inv.cgst_amount ?? 0) > 0 || Number(inv.sgst_amount ?? 0) > 0 || Number(inv.igst_amount ?? 0) > 0) && (
        <Group gap="xs">
          <Badge variant="light" color="teal" size="sm">CGST: ₹{inv.cgst_amount}</Badge>
          <Badge variant="light" color="teal" size="sm">SGST: ₹{inv.sgst_amount}</Badge>
          <Badge variant="light" color="primary" size="sm">IGST: ₹{inv.igst_amount}</Badge>
          {Number(inv.cess_amount ?? 0) > 0 && <Badge variant="light" color="orange" size="sm">Cess: ₹{inv.cess_amount}</Badge>}
        </Group>
      )}
      {inv.is_interim && (
        <Group gap="xs">
          <Badge color="violet" variant="light">Interim #{inv.sequence_number}</Badge>
          {inv.billing_period_start && inv.billing_period_end && (
            <Text size="xs" c="dimmed">
              Period: {new Date(inv.billing_period_start).toLocaleDateString()} – {new Date(inv.billing_period_end).toLocaleDateString()}
            </Text>
          )}
        </Group>
      )}

      {canCreate && inv.status === "draft" && (
        <Group>
          <Button size="xs" color="primary" onClick={() => issueMutation.mutate()}>Issue Invoice</Button>
          <Button size="xs" color="danger" variant="light" onClick={() => cancelMutation.mutate()}>Cancel</Button>
        </Group>
      )}

      <Group>
        <Button size="xs" variant="light" color="teal" leftSection={<IconShieldCheck size={14} />} onClick={() => setShowCopay(!showCopay)}>
          {showCopay ? "Hide Co-pay" : "Calculate Co-pay"}
        </Button>
      </Group>
      {showCopay && <CopayBreakdown invoiceId={invoiceId} />}

      <Text fw={600} mt="md">Items</Text>
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
              <Table.Td>₹{item.unit_price}</Table.Td>
              <Table.Td>{item.tax_percent}%</Table.Td>
              <Table.Td>₹{item.total_price}</Table.Td>
              {canCreate && inv.status === "draft" && (
                <Table.Td>
                  <ActionIcon variant="subtle" color="danger" onClick={() => removeItemMutation.mutate(item.id)}>
                    <IconTrash size={14} />
                  </ActionIcon>
                </Table.Td>
              )}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      {canCreate && inv.status === "draft" && (
        <>
          <Button size="xs" variant="light" leftSection={<IconPlus size={14} />} onClick={() => setShowAddItem(!showAddItem)}>
            Add Item
          </Button>
          {showAddItem && (
            <Stack gap="xs">
              <Group grow>
                <TextInput label="Charge Code" required onChange={(e) => setItemForm({ ...itemForm, charge_code: e.currentTarget.value })} />
                <Select
                  label="Source"
                  data={[
                    { value: "opd", label: "OPD" },
                    { value: "ipd", label: "IPD" },
                    { value: "lab", label: "Lab" },
                    { value: "pharmacy", label: "Pharmacy" },
                    { value: "radiology", label: "Radiology" },
                    { value: "procedure", label: "Procedure" },
                    { value: "manual", label: "Manual" },
                  ]}
                  value={itemForm.source}
                  onChange={(v) => setItemForm({ ...itemForm, source: v ?? "manual" })}
                />
              </Group>
              <TextInput label="Description" required onChange={(e) => setItemForm({ ...itemForm, description: e.currentTarget.value })} />
              <Group grow>
                <NumberInput label="Qty" min={1} value={itemForm.quantity} onChange={(v) => setItemForm({ ...itemForm, quantity: Number(v) })} />
                <NumberInput label="Unit Price" min={0} decimalScale={2} onChange={(v) => setItemForm({ ...itemForm, unit_price: Number(v) })} />
                <NumberInput label="Tax %" min={0} max={100} decimalScale={2} onChange={(v) => setItemForm({ ...itemForm, tax_percent: Number(v) })} />
              </Group>
              <Button size="xs" onClick={() => addItemMutation.mutate(itemForm as AddInvoiceItemRequest)} loading={addItemMutation.isPending}>
                Add
              </Button>
            </Stack>
          )}
        </>
      )}

      <Text fw={600} mt="md">Payments</Text>
      <Table striped>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Amount</Table.Th>
            <Table.Th>Mode</Table.Th>
            <Table.Th>Reference</Table.Th>
            <Table.Th>Date</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {detail.payments.map((p) => (
            <Table.Tr key={p.id}>
              <Table.Td>₹{p.amount}</Table.Td>
              <Table.Td>{p.mode}</Table.Td>
              <Table.Td>{p.reference_number ?? "—"}</Table.Td>
              <Table.Td>{new Date(p.created_at).toLocaleString()}</Table.Td>
              <Table.Td>
                <Tooltip label="Generate Receipt">
                  <ActionIcon variant="subtle" size="sm" onClick={() => receiptMutation.mutate(p.id)}>
                    <IconReceipt size={14} />
                  </ActionIcon>
                </Tooltip>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      {canPay && (inv.status === "issued" || inv.status === "partially_paid") && (
        <>
          <Button size="xs" leftSection={<IconCash size={14} />} onClick={() => setShowPayment(!showPayment)}>
            Record Payment
          </Button>
          {showPayment && (
            <Stack gap="xs">
              <NumberInput label="Amount" required min={0} decimalScale={2} onChange={(v) => setPayForm({ ...payForm, amount: Number(v) })} />
              <Select
                label="Mode"
                data={[
                  { value: "cash", label: "Cash" },
                  { value: "card", label: "Card" },
                  { value: "upi", label: "UPI" },
                  { value: "bank_transfer", label: "Bank Transfer" },
                  { value: "cheque", label: "Cheque" },
                  { value: "insurance", label: "Insurance" },
                  { value: "credit", label: "Credit" },
                ]}
                value={payForm.mode}
                onChange={(v) => setPayForm({ ...payForm, mode: v ?? "cash" })}
              />
              <TextInput label="Reference #" onChange={(e) => setPayForm({ ...payForm, reference_number: e.currentTarget.value || undefined })} />
              <Button size="xs" onClick={() => payMutation.mutate(payForm as RecordPaymentRequest)} loading={payMutation.isPending}>
                Save Payment
              </Button>
            </Stack>
          )}
        </>
      )}

      <Text fw={600} mt="md">Discounts</Text>
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
                <Table.Td><Badge variant="light">{d.discount_type}</Badge></Table.Td>
                <Table.Td>{d.discount_type === "percentage" ? `${d.discount_value}%` : `₹${d.discount_value}`}</Table.Td>
                <Table.Td>{d.reason ?? "—"}</Table.Td>
                {canCreate && (
                  <Table.Td>
                    <ActionIcon variant="subtle" color="danger" size="sm" onClick={() => removeDiscountMutation.mutate(d.id)}>
                      <IconTrash size={14} />
                    </ActionIcon>
                  </Table.Td>
                )}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      ) : (
        <Text size="sm" c="dimmed">No discounts applied</Text>
      )}

      {canCreate && inv.status === "draft" && (
        <>
          <Button size="xs" variant="light" leftSection={<IconDiscount2 size={14} />} onClick={() => setShowDiscount(!showDiscount)}>
            Add Discount
          </Button>
          {showDiscount && (
            <Stack gap="xs">
              <Group grow>
                <Select
                  label="Type"
                  data={[
                    { value: "percentage", label: "Percentage" },
                    { value: "fixed", label: "Fixed Amount" },
                    { value: "concession", label: "Concession" },
                  ]}
                  value={discForm.discount_type}
                  onChange={(v) => setDiscForm({ ...discForm, discount_type: v ?? "percentage" })}
                />
                <NumberInput label="Value" required min={0} decimalScale={2} onChange={(v) => setDiscForm({ ...discForm, discount_value: Number(v) })} />
              </Group>
              <TextInput label="Reason" onChange={(e) => setDiscForm({ ...discForm, reason: e.currentTarget.value || undefined })} />
              <Button size="xs" onClick={() => addDiscountMutation.mutate(discForm as AddDiscountRequest)} loading={addDiscountMutation.isPending}>
                Apply Discount
              </Button>
            </Stack>
          )}
        </>
      )}

      {inv.discount_amount !== "0" && inv.discount_amount !== "0.00" && (
        <Text size="sm" fw={500} c="orange">
          Total Discount: ₹{inv.discount_amount}
        </Text>
      )}
    </Stack>
  );
}

function ChargeMasterTab({ canCreate }: { canCreate: boolean }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<CreateChargeMasterRequest>>({});

  const { data: charges = [], isLoading } = useQuery({
    queryKey: ["charge-master"],
    queryFn: () => api.listChargeMaster(),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateChargeMasterRequest) => api.createChargeMaster(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["charge-master"] });
      setShowForm(false);
      setForm({});
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteChargeMaster(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["charge-master"] }),
  });

  const columns = [
    { key: "code", label: "Code", render: (row: ChargeMaster) => <Text fw={500}>{row.code}</Text> },
    { key: "name", label: "Name", render: (row: ChargeMaster) => <Text size="sm">{row.name}</Text> },
    { key: "category", label: "Category", render: (row: ChargeMaster) => <Text size="sm">{row.category || "—"}</Text> },
    { key: "base_price", label: "Price", render: (row: ChargeMaster) => <Text size="sm">₹{row.base_price}</Text> },
    { key: "hsn_sac_code", label: "HSN/SAC", render: (row: ChargeMaster) => <Text size="sm">{row.hsn_sac_code ?? "—"}</Text> },
    { key: "gst_category", label: "GST Cat.", render: (row: ChargeMaster) => <Text size="sm">{row.gst_category ?? "—"}</Text> },
    { key: "is_active", label: "Active", render: (row: ChargeMaster) => row.is_active ? <IconCheck size={14} color="success" /> : <IconX size={14} color="danger" /> },
    {
      key: "actions",
      label: "",
      render: (row: ChargeMaster) =>
        canCreate ? (
          <ActionIcon variant="subtle" color="danger" onClick={() => deleteMutation.mutate(row.id)}>
            <IconTrash size={14} />
          </ActionIcon>
        ) : null,
    },
  ];

  return (
    <Stack>
      {canCreate && (
        <Group>
          <Button size="xs" leftSection={<IconPlus size={14} />} onClick={() => setShowForm(!showForm)}>
            Add Charge
          </Button>
        </Group>
      )}
      {showForm && (
        <Stack gap="xs">
          <Group grow>
            <TextInput label="Code" required onChange={(e) => setForm({ ...form, code: e.currentTarget.value })} />
            <TextInput label="Name" required onChange={(e) => setForm({ ...form, name: e.currentTarget.value })} />
          </Group>
          <Select label="Category" required data={SERVICE_CATEGORIES} onChange={(v) => setForm({ ...form, category: v ?? "" })} searchable />
          <Group grow>
            <NumberInput label="Base Price" required min={0} decimalScale={2} onChange={(v) => setForm({ ...form, base_price: Number(v) })} />
            <NumberInput label="Tax %" min={0} max={100} decimalScale={2} onChange={(v) => setForm({ ...form, tax_percent: Number(v) })} />
          </Group>
          <Group grow>
            <TextInput label="HSN/SAC Code" placeholder="e.g. 999312" onChange={(e) => setForm({ ...form, hsn_sac_code: e.currentTarget.value || undefined })} />
            <Select
              label="GST Category"
              data={[
                { value: "healthcare", label: "Healthcare (Exempt)" },
                { value: "pharmacy", label: "Pharmacy (Taxable)" },
                { value: "room_rent", label: "Room Rent" },
                { value: "consumable", label: "Consumable" },
                { value: "equipment", label: "Equipment" },
              ]}
              onChange={(v) => setForm({ ...form, gst_category: v ?? undefined })}
              clearable
            />
          </Group>
          <Button size="xs" onClick={() => createMutation.mutate(form as CreateChargeMasterRequest)} loading={createMutation.isPending}>
            Save
          </Button>
        </Stack>
      )}
      <DataTable columns={columns} data={charges} loading={isLoading} rowKey={(row) => row.id} />
    </Stack>
  );
}

// ── Packages Tab ────────────────────────────────────────

// ── Co-pay Calculation Breakdown ──────────────────────────

function CopayBreakdown({ invoiceId }: { invoiceId: string }) {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["copay-calculation", invoiceId],
    queryFn: () => api.calculateCopay({ invoice_id: invoiceId }),
    enabled: false,
  });

  const calculateMutation = useMutation({
    mutationFn: () => api.calculateCopay({ invoice_id: invoiceId }),
    onSuccess: () => refetch(),
  });

  const copay = data as CopayCalculation | undefined;

  return (
    <Card withBorder p="sm">
      {!copay && !isLoading && (
        <Button size="xs" onClick={() => calculateMutation.mutate()} loading={calculateMutation.isPending}>
          Calculate Co-pay
        </Button>
      )}
      {(isLoading || calculateMutation.isPending) && <Text size="sm" c="dimmed">Calculating...</Text>}
      {copay && (
        <SimpleGrid cols={5}>
          <Stack gap={2}>
            <Text size="xs" c="dimmed">Invoice Amount</Text>
            <Text size="sm" fw={700}>{"\u20B9"}{copay.invoice_amount.toFixed(2)}</Text>
          </Stack>
          <Stack gap={2}>
            <Text size="xs" c="dimmed">Insurance Coverage</Text>
            <Text size="sm" fw={700} c="success">{"\u20B9"}{copay.insurance_coverage.toFixed(2)}</Text>
          </Stack>
          <Stack gap={2}>
            <Text size="xs" c="dimmed">Co-pay</Text>
            <Text size="sm" fw={700}>{"\u20B9"}{copay.copay_amount.toFixed(2)}</Text>
          </Stack>
          <Stack gap={2}>
            <Text size="xs" c="dimmed">Deductible</Text>
            <Text size="sm" fw={700}>{"\u20B9"}{copay.deductible.toFixed(2)}</Text>
          </Stack>
          <Stack gap={2}>
            <Text size="xs" c="dimmed">Patient Responsibility</Text>
            <Text size="sm" fw={700} c="danger">{"\u20B9"}{copay.patient_responsibility.toFixed(2)}</Text>
          </Stack>
        </SimpleGrid>
      )}
    </Card>
  );
}

// ── ER Fast Invoice Modal ─────────────────────────────────

function ErFastInvoiceModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const emit = useClinicalEmit();
  const [emergencyVisitId, setEmergencyVisitId] = useState("");

  const createMutation = useMutation({
    mutationFn: (data: ErFastInvoiceRequest) => api.erFastInvoice(data),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["invoices"] });
      notifications.show({ title: "ER Invoice Created", message: `Invoice ${(result as Invoice).invoice_number} created`, color: "success" });
      emit("invoice.created", { invoice_id: (result as Invoice).id });
      onClose();
      setEmergencyVisitId("");
    },
    onError: () => {
      notifications.show({ title: "Error", message: "Failed to create ER invoice", color: "danger" });
    },
  });

  return (
    <Drawer opened={opened} onClose={onClose} title="ER Fast Invoice" position="right" size="xl">
      <Stack>
        <Alert color="danger" variant="light" title="Emergency Department Fast Billing">
          <Text size="sm">Creates an invoice with standard ER charges for the specified emergency visit. Additional charges can be added later.</Text>
        </Alert>
        <TextInput
          label="Emergency Visit ID"
          placeholder="Enter emergency visit UUID"
          value={emergencyVisitId}
          onChange={(e) => setEmergencyVisitId(e.currentTarget.value)}
          required
        />
        <Button
          color="danger"
          onClick={() => createMutation.mutate({ emergency_visit_id: emergencyVisitId })}
          loading={createMutation.isPending}
          disabled={!emergencyVisitId.trim()}
          leftSection={<IconAmbulance size={16} />}
        >
          Create ER Invoice
        </Button>
      </Stack>
    </Drawer>
  );
}

function PackagesTab({ canCreate }: { canCreate: boolean }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<CreatePackageRequest>>({ items: [] });
  const [itemCode, setItemCode] = useState("");
  const [itemDesc, setItemDesc] = useState("");
  const [itemQty, setItemQty] = useState(1);
  const [itemPrice, setItemPrice] = useState(0);

  const { data: packages = [], isLoading } = useQuery({
    queryKey: ["billing-packages"],
    queryFn: () => api.listPackages(),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreatePackageRequest) => api.createPackage(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["billing-packages"] });
      setShowForm(false);
      setForm({ items: [] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deletePackage(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["billing-packages"] }),
  });

  const addPkgItem = () => {
    if (!itemCode || !itemDesc) return;
    setForm({
      ...form,
      items: [...(form.items ?? []), { charge_code: itemCode, description: itemDesc, quantity: itemQty, unit_price: itemPrice }],
    });
    setItemCode("");
    setItemDesc("");
    setItemQty(1);
    setItemPrice(0);
  };

  const columns = [
    { key: "code", label: "Code", render: (row: BillingPackage) => <Text fw={500}>{row.code}</Text> },
    { key: "name", label: "Name", render: (row: BillingPackage) => <Text size="sm">{row.name}</Text> },
    { key: "total_price", label: "Price", render: (row: BillingPackage) => <Text size="sm">₹{row.total_price}</Text> },
    { key: "discount_percent", label: "Discount", render: (row: BillingPackage) => <Text size="sm">{row.discount_percent}%</Text> },
    { key: "is_active", label: "Active", render: (row: BillingPackage) => row.is_active ? <IconCheck size={14} color="success" /> : <IconX size={14} color="danger" /> },
    {
      key: "actions", label: "",
      render: (row: BillingPackage) => canCreate ? (
        <ActionIcon variant="subtle" color="danger" onClick={() => deleteMutation.mutate(row.id)}>
          <IconTrash size={14} />
        </ActionIcon>
      ) : null,
    },
  ];

  return (
    <Stack>
      {canCreate && (
        <Group>
          <Button size="xs" leftSection={<IconPlus size={14} />} onClick={() => setShowForm(!showForm)}>
            Add Package
          </Button>
        </Group>
      )}
      {showForm && (
        <Stack gap="xs">
          <Group grow>
            <TextInput label="Code" required onChange={(e) => setForm({ ...form, code: e.currentTarget.value })} />
            <TextInput label="Name" required onChange={(e) => setForm({ ...form, name: e.currentTarget.value })} />
          </Group>
          <Group grow>
            <NumberInput label="Total Price" required min={0} decimalScale={2} onChange={(v) => setForm({ ...form, total_price: Number(v) })} />
            <NumberInput label="Discount %" min={0} max={100} decimalScale={2} onChange={(v) => setForm({ ...form, discount_percent: Number(v) })} />
          </Group>
          <Textarea label="Description" onChange={(e) => setForm({ ...form, description: e.currentTarget.value || undefined })} />
          <Text fw={500} size="sm" mt="xs">Package Items ({form.items?.length ?? 0})</Text>
          {(form.items ?? []).map((it, i) => (
            <Text key={i} size="xs" c="dimmed">{it.charge_code} — {it.description} x{it.quantity} @ ₹{it.unit_price}</Text>
          ))}
          <Group grow>
            <TextInput size="xs" placeholder="Charge Code" value={itemCode} onChange={(e) => setItemCode(e.currentTarget.value)} />
            <TextInput size="xs" placeholder="Description" value={itemDesc} onChange={(e) => setItemDesc(e.currentTarget.value)} />
            <NumberInput size="xs" placeholder="Qty" min={1} value={itemQty} onChange={(v) => setItemQty(Number(v))} />
            <NumberInput size="xs" placeholder="Price" min={0} decimalScale={2} value={itemPrice} onChange={(v) => setItemPrice(Number(v))} />
            <Button size="xs" variant="light" onClick={addPkgItem}>+ Item</Button>
          </Group>
          <Button size="xs" onClick={() => createMutation.mutate(form as CreatePackageRequest)} loading={createMutation.isPending}>
            Save Package
          </Button>
        </Stack>
      )}
      <DataTable columns={columns} data={packages} loading={isLoading} rowKey={(row) => row.id} />
    </Stack>
  );
}

// ── Rate Plans Tab ──────────────────────────────────────

function RatePlansTab({ canCreate }: { canCreate: boolean }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<{ name: string; description: string; patient_category: string; items: { charge_code: string; override_price: number; override_tax_percent?: number }[] }>({ name: "", description: "", patient_category: "", items: [] });
  const [rpCode, setRpCode] = useState("");
  const [rpPrice, setRpPrice] = useState(0);

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ["rate-plans"],
    queryFn: () => api.listRatePlans(),
  });

  const createMutation = useMutation({
    mutationFn: () => api.createRatePlan({ name: form.name, description: form.description || undefined, patient_category: form.patient_category || undefined, items: form.items }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["rate-plans"] });
      setShowForm(false);
      setForm({ name: "", description: "", patient_category: "", items: [] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteRatePlan(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["rate-plans"] }),
  });

  const addRpItem = () => {
    if (!rpCode) return;
    setForm({ ...form, items: [...form.items, { charge_code: rpCode, override_price: rpPrice }] });
    setRpCode("");
    setRpPrice(0);
  };

  const columns = [
    { key: "name", label: "Name", render: (row: RatePlan) => <Text fw={500}>{row.name}</Text> },
    { key: "patient_category", label: "Category", render: (row: RatePlan) => <Text size="sm">{row.patient_category ?? "All"}</Text> },
    { key: "is_default", label: "Default", render: (row: RatePlan) => row.is_default ? <Badge size="xs" color="primary">Default</Badge> : null },
    { key: "is_active", label: "Active", render: (row: RatePlan) => row.is_active ? <IconCheck size={14} color="success" /> : <IconX size={14} color="danger" /> },
    {
      key: "actions", label: "",
      render: (row: RatePlan) => canCreate ? (
        <ActionIcon variant="subtle" color="danger" onClick={() => deleteMutation.mutate(row.id)}>
          <IconTrash size={14} />
        </ActionIcon>
      ) : null,
    },
  ];

  return (
    <Stack>
      {canCreate && (
        <Group>
          <Button size="xs" leftSection={<IconPlus size={14} />} onClick={() => setShowForm(!showForm)}>
            Add Rate Plan
          </Button>
        </Group>
      )}
      {showForm && (
        <Stack gap="xs">
          <Group grow>
            <TextInput label="Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.currentTarget.value })} />
            <Select
              label="Patient Category"
              data={[
                { value: "general", label: "General" },
                { value: "insurance", label: "Insurance" },
                { value: "corporate", label: "Corporate" },
                { value: "staff", label: "Staff" },
              ]}
              value={form.patient_category || null}
              onChange={(v) => setForm({ ...form, patient_category: v ?? "" })}
              clearable
            />
          </Group>
          <Textarea label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.currentTarget.value })} />
          <Text fw={500} size="sm" mt="xs">Price Overrides ({form.items.length})</Text>
          {form.items.map((it, i) => (
            <Text key={i} size="xs" c="dimmed">{it.charge_code} → ₹{it.override_price}</Text>
          ))}
          <Group grow>
            <TextInput size="xs" placeholder="Charge Code" value={rpCode} onChange={(e) => setRpCode(e.currentTarget.value)} />
            <NumberInput size="xs" placeholder="Override Price" min={0} decimalScale={2} value={rpPrice} onChange={(v) => setRpPrice(Number(v))} />
            <Button size="xs" variant="light" onClick={addRpItem}>+ Override</Button>
          </Group>
          <Button size="xs" onClick={() => createMutation.mutate()} loading={createMutation.isPending}>
            Save Rate Plan
          </Button>
        </Stack>
      )}
      <DataTable columns={columns} data={plans} loading={isLoading} rowKey={(row) => row.id} />
    </Stack>
  );
}

// ── Refunds & Credits Tab ───────────────────────────────

function RefundsCreditsTab({ canCreate, canWriteOff }: { canCreate: boolean; canWriteOff: boolean }) {
  const queryClient = useQueryClient();
  const canApproveWriteOff = useHasPermission(P.BILLING.WRITE_OFF_APPROVE);
  const [showRefund, setShowRefund] = useState(false);
  const [showCredit, setShowCredit] = useState(false);
  const [showWriteOff, setShowWriteOff] = useState(false);
  const [refundForm, setRefundForm] = useState<Partial<CreateRefundRequest>>({ mode: "cash" });
  const [creditForm, setCreditForm] = useState<Partial<CreateCreditNoteRequest>>({});
  const [writeOffForm, setWriteOffForm] = useState<Partial<CreateWriteOffRequest>>({});

  const { data: refunds = [] } = useQuery({
    queryKey: ["refunds"],
    queryFn: () => api.listRefunds(),
  });

  const { data: creditNotes = [] } = useQuery({
    queryKey: ["credit-notes"],
    queryFn: () => api.listCreditNotes(),
  });

  const refundMutation = useMutation({
    mutationFn: (data: CreateRefundRequest) => api.createRefund(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["refunds"] });
      setShowRefund(false);
      setRefundForm({ mode: "cash" });
    },
  });

  const creditMutation = useMutation({
    mutationFn: (data: CreateCreditNoteRequest) => api.createCreditNote(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["credit-notes"] });
      setShowCredit(false);
      setCreditForm({});
    },
  });

  const applyMutation = useMutation({
    mutationFn: ({ noteId, invoiceId }: { noteId: string; invoiceId: string }) =>
      api.applyCreditNote(noteId, invoiceId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["credit-notes"] }),
  });

  const { data: writeOffs = [] } = useQuery({
    queryKey: ["write-offs"],
    queryFn: () => api.listWriteOffs(),
  });

  const writeOffMutation = useMutation({
    mutationFn: (data: CreateWriteOffRequest) => api.createWriteOff(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["write-offs"] });
      setShowWriteOff(false);
      setWriteOffForm({});
    },
  });

  const approveWriteOffMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ApproveWriteOffRequest }) => api.approveWriteOff(id, data),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["write-offs"] }),
  });

  const writeOffColumns = [
    { key: "write_off_number", label: "WO #", render: (row: BadDebtWriteOff) => <Text fw={500}>{row.write_off_number}</Text> },
    { key: "amount", label: "Amount", render: (row: BadDebtWriteOff) => <Text size="sm">₹{row.amount}</Text> },
    { key: "reason", label: "Reason", render: (row: BadDebtWriteOff) => <Text size="sm">{row.reason}</Text> },
    {
      key: "status", label: "Status",
      render: (row: BadDebtWriteOff) => (
        <Badge variant="light" color={row.status === "approved" ? "success" : row.status === "rejected" ? "danger" : "warning"}>
          {row.status}
        </Badge>
      ),
    },
    {
      key: "actions", label: "",
      render: (row: BadDebtWriteOff) => row.status === "pending" && canApproveWriteOff ? (
        <Group gap={4}>
          <Tooltip label="Approve"><ActionIcon color="success" variant="light" size="sm" onClick={() => approveWriteOffMutation.mutate({ id: row.id, data: { approved: true } })}><IconCheck size={14} /></ActionIcon></Tooltip>
          <Tooltip label="Reject"><ActionIcon color="danger" variant="light" size="sm" onClick={() => approveWriteOffMutation.mutate({ id: row.id, data: { approved: false } })}><IconX size={14} /></ActionIcon></Tooltip>
        </Group>
      ) : null,
    },
  ];

  const refundColumns = [
    { key: "refund_number", label: "Refund #", render: (row: Refund) => <Text fw={500}>{row.refund_number}</Text> },
    { key: "amount", label: "Amount", render: (row: Refund) => <Text size="sm">₹{row.amount}</Text> },
    { key: "reason", label: "Reason", render: (row: Refund) => <Text size="sm">{row.reason}</Text> },
    { key: "mode", label: "Mode", render: (row: Refund) => <Badge variant="light">{row.mode}</Badge> },
    { key: "refunded_at", label: "Date", render: (row: Refund) => <Text size="sm">{new Date(row.refunded_at).toLocaleDateString()}</Text> },
  ];

  const creditColumns = [
    { key: "credit_note_number", label: "CN #", render: (row: CreditNote) => <Text fw={500}>{row.credit_note_number}</Text> },
    { key: "amount", label: "Amount", render: (row: CreditNote) => <Text size="sm">₹{row.amount}</Text> },
    { key: "reason", label: "Reason", render: (row: CreditNote) => <Text size="sm">{row.reason}</Text> },
    { key: "status", label: "Status", render: (row: CreditNote) => <Badge variant="light" color={row.status === "active" ? "success" : row.status === "used" ? "primary" : "danger"}>{row.status}</Badge> },
    {
      key: "actions", label: "",
      render: (row: CreditNote) => row.status === "active" && canCreate ? (
        <Button size="compact-xs" variant="light" onClick={() => {
          const invoiceId = prompt("Enter Invoice ID to apply credit note:");
          if (invoiceId) applyMutation.mutate({ noteId: row.id, invoiceId });
        }}>
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
          <Button size="xs" leftSection={<IconPlus size={14} />} onClick={() => setShowRefund(!showRefund)}>
            Create Refund
          </Button>
          {showRefund && (
            <Stack gap="xs">
              <Group grow>
                <TextInput label="Invoice ID" required onChange={(e) => setRefundForm({ ...refundForm, invoice_id: e.currentTarget.value })} />
                <NumberInput label="Amount" required min={0} decimalScale={2} onChange={(v) => setRefundForm({ ...refundForm, amount: Number(v) })} />
              </Group>
              <TextInput label="Reason" required onChange={(e) => setRefundForm({ ...refundForm, reason: e.currentTarget.value })} />
              <Select
                label="Mode"
                data={["cash", "card", "upi", "bank_transfer", "cheque", "insurance", "credit"]}
                value={refundForm.mode}
                onChange={(v) => setRefundForm({ ...refundForm, mode: v ?? "cash" })}
              />
              <Button size="xs" onClick={() => refundMutation.mutate(refundForm as CreateRefundRequest)} loading={refundMutation.isPending}>
                Process Refund
              </Button>
            </Stack>
          )}
        </>
      )}
      <DataTable columns={refundColumns} data={refunds} rowKey={(row) => row.id} />

      <Text fw={600} mt="lg">Credit Notes</Text>
      {canCreate && (
        <>
          <Button size="xs" leftSection={<IconPlus size={14} />} onClick={() => setShowCredit(!showCredit)}>
            Create Credit Note
          </Button>
          {showCredit && (
            <Stack gap="xs">
              <TextInput label="Invoice ID" required onChange={(e) => setCreditForm({ ...creditForm, invoice_id: e.currentTarget.value })} />
              <NumberInput label="Amount" required min={0} decimalScale={2} onChange={(v) => setCreditForm({ ...creditForm, amount: Number(v) })} />
              <TextInput label="Reason" required onChange={(e) => setCreditForm({ ...creditForm, reason: e.currentTarget.value })} />
              <Button size="xs" onClick={() => creditMutation.mutate(creditForm as CreateCreditNoteRequest)} loading={creditMutation.isPending}>
                Issue Credit Note
              </Button>
            </Stack>
          )}
        </>
      )}
      <DataTable columns={creditColumns} data={creditNotes} rowKey={(row) => row.id} />

      <Text fw={600} mt="lg">Write-Offs</Text>
      {canWriteOff && (
        <>
          <Button size="xs" leftSection={<IconPlus size={14} />} onClick={() => setShowWriteOff(!showWriteOff)}>
            Request Write-Off
          </Button>
          {showWriteOff && (
            <Stack gap="xs">
              <TextInput label="Invoice ID" required onChange={(e) => setWriteOffForm({ ...writeOffForm, invoice_id: e.currentTarget.value })} />
              <NumberInput label="Amount" required min={0} decimalScale={2} onChange={(v) => setWriteOffForm({ ...writeOffForm, amount: Number(v) })} />
              <TextInput label="Reason" required onChange={(e) => setWriteOffForm({ ...writeOffForm, reason: e.currentTarget.value })} />
              <Textarea label="Notes" onChange={(e) => setWriteOffForm({ ...writeOffForm, notes: e.currentTarget.value || undefined })} />
              <Button size="xs" onClick={() => writeOffMutation.mutate(writeOffForm as CreateWriteOffRequest)} loading={writeOffMutation.isPending}>
                Submit Write-Off
              </Button>
            </Stack>
          )}
        </>
      )}
      <DataTable columns={writeOffColumns} data={writeOffs} rowKey={(row) => row.id} />
    </Stack>
  );
}

// ── Insurance Claims Tab ────────────────────────────────

function InsuranceClaimsTab({ canCreate, canWriteOff: _cwo }: { canCreate: boolean; canWriteOff: boolean }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [showTpa, setShowTpa] = useState(false);
  const [form, setForm] = useState<Partial<CreateInsuranceClaimRequest>>({ claim_type: "cashless" });
  const [tpaForm, setTpaForm] = useState<Partial<CreateTpaRateCardRequest>>({});

  const { data: claims = [], isLoading } = useQuery({
    queryKey: ["insurance-claims"],
    queryFn: () => api.listInsuranceClaims(),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateInsuranceClaimRequest) => api.createInsuranceClaim(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["insurance-claims"] });
      setShowForm(false);
      setForm({ claim_type: "cashless" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.updateInsuranceClaim(id, { status }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["insurance-claims"] }),
  });

  const { data: tpaCards = [] } = useQuery({
    queryKey: ["tpa-rate-cards"],
    queryFn: () => api.listTpaRateCards(),
  });

  const tpaMutation = useMutation({
    mutationFn: (data: CreateTpaRateCardRequest) => api.createTpaRateCard(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tpa-rate-cards"] });
      setShowTpa(false);
      setTpaForm({});
    },
  });

  const deleteTpaMutation = useMutation({
    mutationFn: (id: string) => api.deleteTpaRateCard(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["tpa-rate-cards"] }),
  });

  const tpaColumns = [
    { key: "tpa_name", label: "TPA Name", render: (row: TpaRateCard) => <Text fw={500}>{row.tpa_name}</Text> },
    { key: "insurance_provider", label: "Provider", render: (row: TpaRateCard) => <Text size="sm">{row.insurance_provider}</Text> },
    { key: "scheme_type", label: "Scheme", render: (row: TpaRateCard) => <Badge variant="light">{row.scheme_type ?? "—"}</Badge> },
    { key: "valid_from", label: "Valid From", render: (row: TpaRateCard) => <Text size="sm">{row.valid_from ?? "—"}</Text> },
    { key: "valid_to", label: "Valid To", render: (row: TpaRateCard) => <Text size="sm">{row.valid_to ?? "—"}</Text> },
    { key: "is_active", label: "Active", render: (row: TpaRateCard) => <Badge color={row.is_active ? "success" : "slate"}>{row.is_active ? "Yes" : "No"}</Badge> },
    {
      key: "actions", label: "",
      render: (row: TpaRateCard) => canCreate ? (
        <Tooltip label="Delete"><ActionIcon color="danger" variant="subtle" size="sm" onClick={() => deleteTpaMutation.mutate(row.id)}><IconTrash size={14} /></ActionIcon></Tooltip>
      ) : null,
    },
  ];

  const claimStatusColors: Record<string, string> = {
    initiated: "slate",
    pre_auth_requested: "primary",
    pre_auth_approved: "teal",
    pre_auth_rejected: "danger",
    claim_submitted: "primary",
    claim_approved: "success",
    claim_rejected: "danger",
    settled: "success",
    partially_settled: "warning",
  };

  const columns = [
    { key: "insurance_provider", label: "Provider", render: (row: InsuranceClaim) => <Text fw={500}>{row.insurance_provider}</Text> },
    { key: "claim_type", label: "Type", render: (row: InsuranceClaim) => <Badge variant="light">{row.claim_type}</Badge> },
    {
      key: "status", label: "Status",
      render: (row: InsuranceClaim) => (
        <Badge variant="light" color={claimStatusColors[row.status] ?? "slate"}>
          {row.status.replace(/_/g, " ")}
        </Badge>
      ),
    },
    { key: "pre_auth_amount", label: "Pre-Auth", render: (row: InsuranceClaim) => <Text size="sm">{row.pre_auth_amount ? `₹${row.pre_auth_amount}` : "—"}</Text> },
    { key: "approved_amount", label: "Approved", render: (row: InsuranceClaim) => <Text size="sm">{row.approved_amount ? `₹${row.approved_amount}` : "—"}</Text> },
    { key: "settled_amount", label: "Settled", render: (row: InsuranceClaim) => <Text size="sm">{row.settled_amount ? `₹${row.settled_amount}` : "—"}</Text> },
    {
      key: "actions", label: "",
      render: (row: InsuranceClaim) => canCreate && row.status === "initiated" ? (
        <Button size="compact-xs" variant="light" onClick={() => updateMutation.mutate({ id: row.id, status: "pre_auth_requested" })}>
          Request Pre-Auth
        </Button>
      ) : null,
    },
  ];

  return (
    <Stack>
      {canCreate && (
        <>
          <Button size="xs" leftSection={<IconPlus size={14} />} onClick={() => setShowForm(!showForm)}>
            New Claim
          </Button>
          {showForm && (
            <Stack gap="xs">
              <Group grow>
                <TextInput label="Invoice ID" required onChange={(e) => setForm({ ...form, invoice_id: e.currentTarget.value })} />
                <TextInput label="Patient ID" required onChange={(e) => setForm({ ...form, patient_id: e.currentTarget.value })} />
              </Group>
              <Group grow>
                <TextInput label="Insurance Provider" required onChange={(e) => setForm({ ...form, insurance_provider: e.currentTarget.value })} />
                <TextInput label="Policy Number" onChange={(e) => setForm({ ...form, policy_number: e.currentTarget.value || undefined })} />
              </Group>
              <Group grow>
                <Select
                  label="Claim Type"
                  data={[
                    { value: "cashless", label: "Cashless" },
                    { value: "reimbursement", label: "Reimbursement" },
                  ]}
                  value={form.claim_type}
                  onChange={(v) => setForm({ ...form, claim_type: v ?? "cashless" })}
                />
                <NumberInput label="Pre-Auth Amount" min={0} decimalScale={2} onChange={(v) => setForm({ ...form, pre_auth_amount: Number(v) || undefined })} />
              </Group>
              <Group grow>
                <Select
                  label="Scheme Type"
                  data={[
                    { value: "private", label: "Private Insurance" },
                    { value: "cghs", label: "CGHS" },
                    { value: "echs", label: "ECHS" },
                    { value: "pmjay", label: "PM-JAY (Ayushman Bharat)" },
                    { value: "esis", label: "ESIS" },
                    { value: "state_scheme", label: "State Scheme" },
                  ]}
                  onChange={(v) => setForm({ ...form, scheme_type: v ?? undefined })}
                  clearable
                />
                <TextInput label="TPA Name" onChange={(e) => setForm({ ...form, tpa_name: e.currentTarget.value || undefined })} />
              </Group>
              <Group grow>
                <NumberInput label="Co-Pay %" min={0} max={100} decimalScale={2} onChange={(v) => setForm({ ...form, co_pay_percent: Number(v) || undefined })} />
                <NumberInput label="Deductible Amount" min={0} decimalScale={2} onChange={(v) => setForm({ ...form, deductible_amount: Number(v) || undefined })} />
              </Group>
              <Group grow>
                <TextInput label="Member ID" onChange={(e) => setForm({ ...form, member_id: e.currentTarget.value || undefined })} />
                <TextInput label="Scheme Card Number" onChange={(e) => setForm({ ...form, scheme_card_number: e.currentTarget.value || undefined })} />
              </Group>
              <Textarea label="Notes" onChange={(e) => setForm({ ...form, notes: e.currentTarget.value || undefined })} />
              <Button size="xs" onClick={() => createMutation.mutate(form as CreateInsuranceClaimRequest)} loading={createMutation.isPending}>
                Create Claim
              </Button>
            </Stack>
          )}
        </>
      )}
      <DataTable columns={columns} data={claims} loading={isLoading} rowKey={(row) => row.id} />

      <Text fw={600} mt="lg">TPA Rate Cards</Text>
      {canCreate && (
        <>
          <Button size="xs" leftSection={<IconPlus size={14} />} onClick={() => setShowTpa(!showTpa)}>
            Add TPA Rate Card
          </Button>
          {showTpa && (
            <Stack gap="xs">
              <Group grow>
                <TextInput label="TPA Name" required onChange={(e) => setTpaForm({ ...tpaForm, tpa_name: e.currentTarget.value })} />
                <TextInput label="Insurance Provider" required onChange={(e) => setTpaForm({ ...tpaForm, insurance_provider: e.currentTarget.value })} />
              </Group>
              <Group grow>
                <Select label="Scheme Type" data={INSURANCE_SCHEME_TYPES} onChange={(v) => setTpaForm({ ...tpaForm, scheme_type: v || undefined })} clearable searchable />
                <TextInput label="Rate Plan ID" onChange={(e) => setTpaForm({ ...tpaForm, rate_plan_id: e.currentTarget.value || undefined })} />
              </Group>
              <Group grow>
                <TextInput label="Valid From" type="date" onChange={(e) => setTpaForm({ ...tpaForm, valid_from: e.currentTarget.value || undefined })} />
                <TextInput label="Valid To" type="date" onChange={(e) => setTpaForm({ ...tpaForm, valid_to: e.currentTarget.value || undefined })} />
              </Group>
              <Button size="xs" onClick={() => tpaMutation.mutate(tpaForm as CreateTpaRateCardRequest)} loading={tpaMutation.isPending}>
                Save TPA Rate Card
              </Button>
            </Stack>
          )}
        </>
      )}
      <DataTable columns={tpaColumns} data={tpaCards} rowKey={(row) => row.id} />
    </Stack>
  );
}

// ── Billing Settings Tab ────────────────────────────────

const AUTO_BILLING_KEYS = [
  { key: "auto_charge_opd", label: "OPD Consultation", description: "Auto-charge when an OPD visit is completed" },
  { key: "auto_charge_lab", label: "Lab Tests", description: "Auto-charge when a lab order is completed" },
  { key: "auto_charge_pharmacy", label: "Pharmacy Dispensing", description: "Auto-charge when a pharmacy order is dispensed" },
  { key: "auto_charge_radiology", label: "Radiology Exams", description: "Auto-charge when a radiology order is completed" },
  { key: "auto_charge_ipd_room", label: "IPD Room Charges", description: "Auto-charge room/bed fees on patient discharge" },
] as const;

function BillingSettingsTab() {
  const queryClient = useQueryClient();

  const { data: settings = [], isLoading } = useQuery({
    queryKey: ["tenant-settings", "billing"],
    queryFn: () => api.getTenantSettings("billing"),
  });

  const settingsMap = new Map(settings.map((s: TenantSettingsRow) => [s.key, s.value]));

  const updateMutation = useMutation({
    mutationFn: (data: { category: string; key: string; value: unknown }) =>
      api.updateTenantSetting(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tenant-settings", "billing"] });
    },
    onError: () => {
      notifications.show({ title: "Error", message: "Failed to update setting", color: "danger" });
    },
  });

  const isEnabled = (key: string) => settingsMap.get(key) === true || settingsMap.get(key) === "true";

  const toggle = (key: string) => {
    const current = isEnabled(key);
    updateMutation.mutate({ category: "billing", key, value: !current });
  };

  const getStrVal = (key: string) => {
    const v = settingsMap.get(key);
    return typeof v === "string" ? v : "";
  };

  const updateStr = (key: string, value: string) => {
    updateMutation.mutate({ category: "billing", key, value });
  };

  if (isLoading) return <Text c="dimmed">Loading settings...</Text>;

  return (
    <Stack>
      <Text fw={600}>GST Configuration</Text>
      <Text size="sm" c="dimmed">
        Configure GST details for tax computation on invoices. CGST/SGST applies for intra-state
        transactions, IGST for inter-state.
      </Text>
      <Group grow>
        <TextInput
          label="GSTIN"
          placeholder="e.g. 33AABCU9603R1ZM"
          defaultValue={getStrVal("gst_number")}
          onBlur={(e) => updateStr("gst_number", e.currentTarget.value)}
        />
        <TextInput
          label="State Code"
          placeholder="e.g. 33 (Tamil Nadu)"
          defaultValue={getStrVal("gst_state_code")}
          onBlur={(e) => updateStr("gst_state_code", e.currentTarget.value)}
        />
        <Select
          label="Default GST Type"
          data={[
            { value: "cgst_sgst", label: "CGST + SGST (Intra-State)" },
            { value: "igst", label: "IGST (Inter-State)" },
            { value: "exempt", label: "Exempt" },
          ]}
          value={getStrVal("default_gst_type") || "exempt"}
          onChange={(v) => { if (v) updateStr("default_gst_type", v); }}
        />
      </Group>

      <Text fw={600} mt="lg">Advance Settings</Text>
      <Switch
        label="Auto-adjust advance on invoice payment"
        description="Automatically apply available patient advance deposits when recording payments"
        checked={isEnabled("auto_adjust_advance")}
        onChange={() => toggle("auto_adjust_advance")}
        disabled={updateMutation.isPending}
      />

      <Text fw={600} mt="lg">Auto-Billing</Text>
      <Text size="sm" c="dimmed">
        When enabled, invoices are automatically created or updated when services are completed.
        Charges use the Charge Master and Rate Plans for pricing.
      </Text>
      {AUTO_BILLING_KEYS.map(({ key, label, description }) => (
        <Switch
          key={key}
          label={label}
          description={description}
          checked={isEnabled(key)}
          onChange={() => toggle(key)}
          disabled={updateMutation.isPending}
        />
      ))}
    </Stack>
  );
}

// ── Advances Tab ────────────────────────────────────────

const advanceStatusColors: Record<string, string> = {
  active: "success",
  partially_used: "warning",
  fully_used: "primary",
  refunded: "orange",
};

function AdvancesTab() {
  const canCreate = useHasPermission(P.BILLING.ADVANCES_CREATE);
  const canAdjust = useHasPermission(P.BILLING.ADVANCES_ADJUST);
  const canRefund = useHasPermission(P.BILLING.ADVANCES_REFUND);
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<CreateAdvanceRequest>>({ payment_mode: "cash", purpose: "general" });
  const [adjustId, setAdjustId] = useState<string | null>(null);
  const [adjustForm, setAdjustForm] = useState<Partial<AdjustAdvanceRequest>>({});
  const [refundId, setRefundId] = useState<string | null>(null);
  const [refundForm, setRefundForm] = useState<Partial<RefundAdvanceRequest>>({ mode: "cash" });

  const { data: advances = [], isLoading } = useQuery({
    queryKey: ["advances"],
    queryFn: () => api.listAdvances(),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateAdvanceRequest) => api.createAdvance(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["advances"] });
      notifications.show({ title: "Advance created", message: "Patient advance recorded", color: "success" });
      setShowForm(false);
      setForm({ payment_mode: "cash", purpose: "general" });
    },
    onError: () => notifications.show({ title: "Error", message: "Failed to create advance", color: "danger" }),
  });

  const adjustMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: AdjustAdvanceRequest }) => api.adjustAdvance(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["advances"] });
      notifications.show({ title: "Adjusted", message: "Advance adjusted against invoice", color: "success" });
      setAdjustId(null);
      setAdjustForm({});
    },
    onError: () => notifications.show({ title: "Error", message: "Failed to adjust advance", color: "danger" }),
  });

  const refundMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: RefundAdvanceRequest }) => api.refundAdvance(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["advances"] });
      notifications.show({ title: "Refunded", message: "Advance refunded", color: "success" });
      setRefundId(null);
      setRefundForm({ mode: "cash" });
    },
    onError: () => notifications.show({ title: "Error", message: "Failed to refund advance", color: "danger" }),
  });

  const columns = [
    { key: "advance_number", label: "Advance #", render: (row: PatientAdvance) => <Text fw={600}>{row.advance_number}</Text> },
    { key: "amount", label: "Amount", render: (row: PatientAdvance) => <Text size="sm">₹{row.amount}</Text> },
    {
      key: "balance", label: "Balance",
      render: (row: PatientAdvance) => <Text size="sm" c={Number(row.balance) > 0 ? "success" : "dimmed"}>₹{row.balance}</Text>,
    },
    { key: "purpose", label: "Purpose", render: (row: PatientAdvance) => <Badge variant="light">{row.purpose}</Badge> },
    { key: "payment_mode", label: "Mode", render: (row: PatientAdvance) => <Text size="sm">{row.payment_mode}</Text> },
    {
      key: "status", label: "Status",
      render: (row: PatientAdvance) => (
        <Badge variant="light" color={advanceStatusColors[row.status] ?? "slate"}>
          {row.status.replace(/_/g, " ")}
        </Badge>
      ),
    },
    { key: "created_at", label: "Date", render: (row: PatientAdvance) => <Text size="sm">{new Date(row.created_at).toLocaleDateString()}</Text> },
    {
      key: "actions", label: "",
      render: (row: PatientAdvance) => {
        if (Number(row.balance) <= 0) return null;
        return (
          <Group gap={4}>
            {canAdjust && (
              <Button size="compact-xs" variant="light" onClick={() => setAdjustId(row.id)}>
                Adjust
              </Button>
            )}
            {canRefund && (
              <Button size="compact-xs" variant="light" color="orange" onClick={() => setRefundId(row.id)}>
                Refund
              </Button>
            )}
          </Group>
        );
      },
    },
  ];

  return (
    <Stack>
      {canCreate && (
        <Group>
          <Button size="xs" leftSection={<IconPlus size={14} />} onClick={() => setShowForm(!showForm)}>
            Collect Advance
          </Button>
        </Group>
      )}
      {showForm && (
        <Stack gap="xs">
          <Group grow>
            <TextInput label="Patient ID" required onChange={(e) => setForm({ ...form, patient_id: e.currentTarget.value })} />
            <TextInput label="Encounter ID" onChange={(e) => setForm({ ...form, encounter_id: e.currentTarget.value || undefined })} />
          </Group>
          <Group grow>
            <NumberInput label="Amount" required min={0} decimalScale={2} onChange={(v) => setForm({ ...form, amount: Number(v) })} />
            <Select
              label="Payment Mode"
              data={["cash", "card", "upi", "bank_transfer", "cheque"]}
              value={form.payment_mode}
              onChange={(v) => setForm({ ...form, payment_mode: v ?? "cash" })}
            />
          </Group>
          <Group grow>
            <Select
              label="Purpose"
              data={[
                { value: "general", label: "General" },
                { value: "admission", label: "Admission Deposit" },
                { value: "prepaid", label: "Prepaid" },
                { value: "procedure", label: "Procedure" },
              ]}
              value={form.purpose}
              onChange={(v) => setForm({ ...form, purpose: v ?? "general" })}
            />
            <TextInput label="Reference #" onChange={(e) => setForm({ ...form, reference_number: e.currentTarget.value || undefined })} />
          </Group>
          <Textarea label="Notes" onChange={(e) => setForm({ ...form, notes: e.currentTarget.value || undefined })} />
          <Button size="xs" onClick={() => createMutation.mutate(form as CreateAdvanceRequest)} loading={createMutation.isPending}>
            Save Advance
          </Button>
        </Stack>
      )}

      <DataTable columns={columns} data={advances} loading={isLoading} rowKey={(row) => row.id} />

      <Drawer opened={adjustId !== null} onClose={() => setAdjustId(null)} title="Adjust Advance Against Invoice" position="right" size="sm">
        <Stack>
          <TextInput label="Invoice ID" required onChange={(e) => setAdjustForm({ ...adjustForm, invoice_id: e.currentTarget.value })} />
          <NumberInput label="Amount" required min={0} decimalScale={2} onChange={(v) => setAdjustForm({ ...adjustForm, amount: Number(v) })} />
          <Textarea label="Notes" onChange={(e) => setAdjustForm({ ...adjustForm, notes: e.currentTarget.value || undefined })} />
          <Button onClick={() => adjustId && adjustMutation.mutate({ id: adjustId, data: adjustForm as AdjustAdvanceRequest })} loading={adjustMutation.isPending}>
            Apply Adjustment
          </Button>
        </Stack>
      </Drawer>

      <Drawer opened={refundId !== null} onClose={() => setRefundId(null)} title="Refund Advance" position="right" size="sm">
        <Stack>
          <NumberInput label="Refund Amount" required min={0} decimalScale={2} onChange={(v) => setRefundForm({ ...refundForm, amount: Number(v) })} />
          <TextInput label="Reason" required onChange={(e) => setRefundForm({ ...refundForm, reason: e.currentTarget.value })} />
          <Select
            label="Refund Mode"
            data={["cash", "card", "upi", "bank_transfer", "cheque"]}
            value={refundForm.mode}
            onChange={(v) => setRefundForm({ ...refundForm, mode: v ?? "cash" })}
          />
          <TextInput label="Reference #" onChange={(e) => setRefundForm({ ...refundForm, reference_number: e.currentTarget.value || undefined })} />
          <Button onClick={() => refundId && refundMutation.mutate({ id: refundId, data: refundForm as RefundAdvanceRequest })} loading={refundMutation.isPending}>
            Process Refund
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ── Corporate Tab ───────────────────────────────────────

function CorporateTab() {
  const canCreate = useHasPermission(P.BILLING.CORPORATE_CREATE);
  const canUpdate = useHasPermission(P.BILLING.CORPORATE_UPDATE);
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<CreateCorporateRequest>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpened, { open: openDetail, close: closeDetail }] = useDisclosure(false);

  const { data: corporates = [], isLoading } = useQuery({
    queryKey: ["corporates"],
    queryFn: () => api.listCorporates(),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateCorporateRequest) => api.createCorporate(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["corporates"] });
      notifications.show({ title: "Created", message: "Corporate client created", color: "success" });
      setShowForm(false);
      setForm({});
    },
    onError: () => notifications.show({ title: "Error", message: "Failed to create corporate client", color: "danger" }),
  });

  const columns = [
    { key: "code", label: "Code", render: (row: CorporateClient) => <Text fw={600}>{row.code}</Text> },
    { key: "name", label: "Name", render: (row: CorporateClient) => <Text size="sm">{row.name}</Text> },
    { key: "gst_number", label: "GSTIN", render: (row: CorporateClient) => <Text size="sm">{row.gst_number ?? "—"}</Text> },
    { key: "credit_limit", label: "Credit Limit", render: (row: CorporateClient) => <Text size="sm">₹{row.credit_limit}</Text> },
    { key: "credit_days", label: "Credit Days", render: (row: CorporateClient) => <Text size="sm">{row.credit_days}</Text> },
    { key: "discount", label: "Discount %", render: (row: CorporateClient) => <Text size="sm">{row.agreed_discount_percent}%</Text> },
    { key: "is_active", label: "Active", render: (row: CorporateClient) => row.is_active ? <IconCheck size={14} color="success" /> : <IconX size={14} color="danger" /> },
    {
      key: "actions", label: "",
      render: (row: CorporateClient) => (
        <Tooltip label="View Details">
          <ActionIcon variant="subtle" onClick={() => { setSelectedId(row.id); openDetail(); }}>
            <IconEye size={16} />
          </ActionIcon>
        </Tooltip>
      ),
    },
  ];

  return (
    <Stack>
      {canCreate && (
        <Group>
          <Button size="xs" leftSection={<IconPlus size={14} />} onClick={() => setShowForm(!showForm)}>
            Add Corporate Client
          </Button>
        </Group>
      )}
      {showForm && (
        <Stack gap="xs">
          <Group grow>
            <TextInput label="Code" required placeholder="e.g. CORP-001" onChange={(e) => setForm({ ...form, code: e.currentTarget.value })} />
            <TextInput label="Name" required onChange={(e) => setForm({ ...form, name: e.currentTarget.value })} />
          </Group>
          <Group grow>
            <TextInput label="GST Number" onChange={(e) => setForm({ ...form, gst_number: e.currentTarget.value || undefined })} />
            <TextInput label="Contact Email" onChange={(e) => setForm({ ...form, contact_email: e.currentTarget.value || undefined })} />
            <TextInput label="Contact Phone" onChange={(e) => setForm({ ...form, contact_phone: e.currentTarget.value || undefined })} />
          </Group>
          <Textarea label="Billing Address" onChange={(e) => setForm({ ...form, billing_address: e.currentTarget.value || undefined })} />
          <Group grow>
            <NumberInput label="Credit Limit (₹)" min={0} decimalScale={2} onChange={(v) => setForm({ ...form, credit_limit: Number(v) })} />
            <NumberInput label="Credit Days" min={0} value={30} onChange={(v) => setForm({ ...form, credit_days: Number(v) })} />
            <NumberInput label="Agreed Discount %" min={0} max={100} decimalScale={2} onChange={(v) => setForm({ ...form, agreed_discount_percent: Number(v) })} />
          </Group>
          <Button size="xs" onClick={() => createMutation.mutate(form as CreateCorporateRequest)} loading={createMutation.isPending}>
            Save Client
          </Button>
        </Stack>
      )}

      <DataTable columns={columns} data={corporates} loading={isLoading} rowKey={(row) => row.id} />

      <Drawer opened={detailOpened} onClose={closeDetail} title="Corporate Client Detail" position="right" size="lg">
        {selectedId && <CorporateDetail corporateId={selectedId} canUpdate={canUpdate} />}
      </Drawer>
    </Stack>
  );
}

function CorporateDetail({ corporateId, canUpdate }: { corporateId: string; canUpdate: boolean }) {
  const queryClient = useQueryClient();
  const [showEnroll, setShowEnroll] = useState(false);
  const [enrollForm, setEnrollForm] = useState<Partial<CreateEnrollmentRequest>>({});
  const [editForm, setEditForm] = useState<Partial<UpdateCorporateRequest>>({});
  const [editing, setEditing] = useState(false);

  const { data: corporate } = useQuery({
    queryKey: ["corporate", corporateId],
    queryFn: () => api.getCorporate(corporateId),
  });

  const { data: enrollments = [] } = useQuery({
    queryKey: ["corporate-enrollments", corporateId],
    queryFn: () => api.listCorporateEnrollments(corporateId),
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["corporate-invoices", corporateId],
    queryFn: () => api.listCorporateInvoices(corporateId),
  });

  const updateMutation = useMutation({
    mutationFn: (data: UpdateCorporateRequest) => api.updateCorporate(corporateId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["corporate", corporateId] });
      void queryClient.invalidateQueries({ queryKey: ["corporates"] });
      setEditing(false);
    },
  });

  const enrollMutation = useMutation({
    mutationFn: (data: CreateEnrollmentRequest) => api.createCorporateEnrollment(corporateId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["corporate-enrollments", corporateId] });
      setShowEnroll(false);
      setEnrollForm({});
    },
  });

  const unenrollMutation = useMutation({
    mutationFn: (enrollmentId: string) => api.deleteCorporateEnrollment(corporateId, enrollmentId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["corporate-enrollments", corporateId] }),
  });

  if (!corporate) return <Text c="dimmed">Loading...</Text>;

  return (
    <Stack>
      <Group justify="space-between">
        <Text fw={700} size="lg">{corporate.name}</Text>
        <Badge size="lg" variant="light" color={corporate.is_active ? "success" : "danger"}>
          {corporate.is_active ? "Active" : "Inactive"}
        </Badge>
      </Group>

      <SimpleGrid cols={2}>
        <Text size="sm">Code: <b>{corporate.code}</b></Text>
        <Text size="sm">GSTIN: {corporate.gst_number ?? "—"}</Text>
        <Text size="sm">Credit Limit: ₹{corporate.credit_limit}</Text>
        <Text size="sm">Credit Days: {corporate.credit_days}</Text>
        <Text size="sm">Discount: {corporate.agreed_discount_percent}%</Text>
        <Text size="sm">Email: {corporate.contact_email ?? "—"}</Text>
      </SimpleGrid>

      {canUpdate && (
        <>
          <Button size="xs" variant="light" onClick={() => setEditing(!editing)}>
            {editing ? "Cancel Edit" : "Edit Client"}
          </Button>
          {editing && (
            <Stack gap="xs">
              <Group grow>
                <TextInput label="Name" defaultValue={corporate.name} onChange={(e) => setEditForm({ ...editForm, name: e.currentTarget.value })} />
                <NumberInput label="Credit Limit" defaultValue={Number(corporate.credit_limit)} decimalScale={2} onChange={(v) => setEditForm({ ...editForm, credit_limit: Number(v) })} />
              </Group>
              <Group grow>
                <NumberInput label="Credit Days" defaultValue={corporate.credit_days} onChange={(v) => setEditForm({ ...editForm, credit_days: Number(v) })} />
                <NumberInput label="Discount %" defaultValue={Number(corporate.agreed_discount_percent)} decimalScale={2} onChange={(v) => setEditForm({ ...editForm, agreed_discount_percent: Number(v) })} />
              </Group>
              <Button size="xs" onClick={() => updateMutation.mutate(editForm)} loading={updateMutation.isPending}>
                Save Changes
              </Button>
            </Stack>
          )}
        </>
      )}

      <Text fw={600} mt="md">Enrollments ({enrollments.length})</Text>
      <Table striped>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Patient ID</Table.Th>
            <Table.Th>Employee ID</Table.Th>
            <Table.Th>Department</Table.Th>
            <Table.Th>Enrolled</Table.Th>
            {canUpdate && <Table.Th />}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {enrollments.map((e: CorporateEnrollment) => (
            <Table.Tr key={e.id}>
              <Table.Td>{e.patient_id}</Table.Td>
              <Table.Td>{e.employee_id ?? "—"}</Table.Td>
              <Table.Td>{e.department ?? "—"}</Table.Td>
              <Table.Td>{new Date(e.enrolled_at).toLocaleDateString()}</Table.Td>
              {canUpdate && (
                <Table.Td>
                  <ActionIcon variant="subtle" color="danger" size="sm" onClick={() => unenrollMutation.mutate(e.id)}>
                    <IconTrash size={14} />
                  </ActionIcon>
                </Table.Td>
              )}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      {canUpdate && (
        <>
          <Button size="xs" variant="light" leftSection={<IconPlus size={14} />} onClick={() => setShowEnroll(!showEnroll)}>
            Enroll Patient
          </Button>
          {showEnroll && (
            <Stack gap="xs">
              <Group grow>
                <PatientSearchSelect value={enrollForm.patient_id ?? ""} onChange={(id) => setEnrollForm({ ...enrollForm, patient_id: id })} required />
                <EmployeeSearchSelect value={enrollForm.employee_id ?? ""} onChange={(id) => setEnrollForm({ ...enrollForm, employee_id: id || undefined })} />
                <TextInput label="Department" onChange={(e) => setEnrollForm({ ...enrollForm, department: e.currentTarget.value || undefined })} />
              </Group>
              <Button size="xs" onClick={() => enrollMutation.mutate(enrollForm as CreateEnrollmentRequest)} loading={enrollMutation.isPending}>
                Enroll
              </Button>
            </Stack>
          )}
        </>
      )}

      <Text fw={600} mt="md">Corporate Invoices ({invoices.length})</Text>
      {invoices.length > 0 ? (
        <Table striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Invoice #</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Total</Table.Th>
              <Table.Th>Date</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {invoices.map((inv: Invoice) => (
              <Table.Tr key={inv.id}>
                <Table.Td>{inv.invoice_number}</Table.Td>
                <Table.Td><Badge variant="light" color={statusColors[inv.status] ?? "slate"}>{inv.status.replace(/_/g, " ")}</Badge></Table.Td>
                <Table.Td>₹{inv.total_amount}</Table.Td>
                <Table.Td>{new Date(inv.created_at).toLocaleDateString()}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      ) : (
        <Text size="sm" c="dimmed">No invoices found</Text>
      )}
    </Stack>
  );
}

// ── Reports Tab ─────────────────────────────────────────

function ReportsTab() {
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [fromStr, setFromStr] = useState(() => thirtyDaysAgo.toISOString().slice(0, 10));
  const [toStr, setToStr] = useState(() => today.toISOString().slice(0, 10));
  const [reconDate, setReconDate] = useState(() => today.toISOString().slice(0, 10));

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ["billing-report-summary", fromStr, toStr],
    queryFn: () => api.billingReportSummary(fromStr, toStr),
    enabled: !!fromStr && !!toStr,
  });

  const { data: deptRevenue = [] } = useQuery({
    queryKey: ["billing-report-dept", fromStr, toStr],
    queryFn: () => api.billingReportDepartmentRevenue(fromStr, toStr),
    enabled: !!fromStr && !!toStr,
  });

  const { data: aging = [] } = useQuery({
    queryKey: ["billing-report-aging"],
    queryFn: () => api.billingReportAging(),
  });

  const { data: efficiency } = useQuery({
    queryKey: ["billing-report-efficiency", fromStr, toStr],
    queryFn: () => api.billingReportCollectionEfficiency(fromStr, toStr),
    enabled: !!fromStr && !!toStr,
  });

  const todayStr = today.toISOString().slice(0, 10);
  const { data: daily } = useQuery({
    queryKey: ["billing-report-daily", todayStr],
    queryFn: () => api.billingReportDaily(todayStr),
  });

  const { data: doctorRevenue = [] } = useQuery({
    queryKey: ["billing-report-doctor-revenue", fromStr, toStr],
    queryFn: () => api.billingReportDoctorRevenue(fromStr, toStr),
    enabled: !!fromStr && !!toStr,
  });

  const { data: insurancePanel = [] } = useQuery({
    queryKey: ["billing-report-insurance-panel", fromStr, toStr],
    queryFn: () => api.billingReportInsurancePanel(fromStr, toStr),
    enabled: !!fromStr && !!toStr,
  });

  const { data: reconciliation } = useQuery({
    queryKey: ["billing-report-reconciliation", reconDate],
    queryFn: () => api.billingReportReconciliation(reconDate),
    enabled: !!reconDate,
  });

  return (
    <Stack>
      <Group>
        <TextInput label="From" type="date" value={fromStr} onChange={(e) => setFromStr(e.currentTarget.value)} />
        <TextInput label="To" type="date" value={toStr} onChange={(e) => setToStr(e.currentTarget.value)} />
      </Group>

      {summaryLoading && <Text c="dimmed">Loading reports...</Text>}

      {summary && <ReportSummaryCards summary={summary} />}

      {daily && (
        <>
          <Text fw={600} mt="md">Today&apos;s Summary</Text>
          <SimpleGrid cols={4}>
            <Card withBorder p="sm">
              <Text size="xs" c="dimmed">Invoices Created</Text>
              <Text fw={700} size="lg">{daily.invoices_created}</Text>
            </Card>
            <Card withBorder p="sm">
              <Text size="xs" c="dimmed">Invoices Issued</Text>
              <Text fw={700} size="lg">{daily.invoices_issued}</Text>
            </Card>
            <Card withBorder p="sm">
              <Text size="xs" c="dimmed">Total Billed</Text>
              <Text fw={700} size="lg">₹{daily.total_billed}</Text>
            </Card>
            <Card withBorder p="sm">
              <Text size="xs" c="dimmed">Total Collected</Text>
              <Text fw={700} size="lg" c="success">₹{daily.total_collected}</Text>
            </Card>
          </SimpleGrid>
        </>
      )}

      {aging.length > 0 && (
        <>
          <Text fw={600} mt="md">Aging Analysis</Text>
          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Bucket</Table.Th>
                <Table.Th>Count</Table.Th>
                <Table.Th>Amount</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {aging.map((b: AgingBucket) => (
                <Table.Tr key={b.bucket}>
                  <Table.Td><Badge variant="light" color={b.bucket.includes("90") ? "danger" : b.bucket.includes("60") ? "orange" : b.bucket.includes("30") ? "warning" : "success"}>{b.bucket}</Badge></Table.Td>
                  <Table.Td>{b.count}</Table.Td>
                  <Table.Td>₹{b.total_amount}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </>
      )}

      {deptRevenue.length > 0 && (
        <>
          <Text fw={600} mt="md">Department Revenue</Text>
          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Department</Table.Th>
                <Table.Th>Revenue</Table.Th>
                <Table.Th>Invoices</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {deptRevenue.map((d: DepartmentRevenueRow) => (
                <Table.Tr key={d.department}>
                  <Table.Td>{d.department}</Table.Td>
                  <Table.Td>₹{d.total_revenue}</Table.Td>
                  <Table.Td>{d.invoice_count}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </>
      )}

      {efficiency && efficiency.months.length > 0 && (
        <>
          <Text fw={600} mt="md">Collection Efficiency</Text>
          <Text size="sm" c="dimmed" mb="xs">Overall rate: {efficiency.overall_rate}%</Text>
          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Month</Table.Th>
                <Table.Th>Invoiced</Table.Th>
                <Table.Th>Collected</Table.Th>
                <Table.Th>Rate</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {efficiency.months.map((m) => (
                <Table.Tr key={m.month}>
                  <Table.Td>{m.month}</Table.Td>
                  <Table.Td>₹{m.invoiced}</Table.Td>
                  <Table.Td>₹{m.collected}</Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <Progress value={Number(m.rate)} size="sm" w={80} color={Number(m.rate) > 80 ? "success" : Number(m.rate) > 50 ? "warning" : "danger"} />
                      <Text size="xs">{m.rate}%</Text>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </>
      )}

      {doctorRevenue.length > 0 && (
        <>
          <Text fw={600} mt="md">Doctor Revenue</Text>
          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Doctor</Table.Th>
                <Table.Th>Revenue</Table.Th>
                <Table.Th>Items</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {doctorRevenue.map((d: DoctorRevenueRow) => (
                <Table.Tr key={d.doctor_id ?? "unassigned"}>
                  <Table.Td>{d.doctor_name}</Table.Td>
                  <Table.Td>₹{d.total_revenue}</Table.Td>
                  <Table.Td>{d.item_count}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </>
      )}

      {insurancePanel.length > 0 && (
        <>
          <Text fw={600} mt="md">Insurance Panel</Text>
          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Provider</Table.Th>
                <Table.Th>Claims</Table.Th>
                <Table.Th>Claimed</Table.Th>
                <Table.Th>Approved</Table.Th>
                <Table.Th>Settled</Table.Th>
                <Table.Th>Pending</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {insurancePanel.map((row: InsurancePanelRow) => (
                <Table.Tr key={row.insurance_provider}>
                  <Table.Td>{row.insurance_provider}</Table.Td>
                  <Table.Td>{row.total_claims}</Table.Td>
                  <Table.Td>₹{row.total_claimed}</Table.Td>
                  <Table.Td>₹{row.total_approved}</Table.Td>
                  <Table.Td>₹{row.total_settled}</Table.Td>
                  <Table.Td><Badge color="warning" variant="light">{row.pending_count}</Badge></Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </>
      )}

      <Text fw={600} mt="md">Reconciliation</Text>
      <Group>
        <TextInput label="Date" type="date" value={reconDate} onChange={(e) => setReconDate(e.currentTarget.value)} />
      </Group>
      {reconciliation && (
        <SimpleGrid cols={4} mt="xs">
          <Card withBorder p="sm">
            <Text size="xs" c="dimmed">Expected Cash</Text>
            <Text fw={700}>₹{reconciliation.expected_cash}</Text>
          </Card>
          <Card withBorder p="sm">
            <Text size="xs" c="dimmed">Actual Cash</Text>
            <Text fw={700}>₹{reconciliation.actual_cash}</Text>
          </Card>
          <Card withBorder p="sm">
            <Text size="xs" c="dimmed">Cash Difference</Text>
            <Text fw={700} c={Number(reconciliation.cash_difference) === 0 ? "success" : "danger"}>₹{reconciliation.cash_difference}</Text>
          </Card>
          <Card withBorder p="sm">
            <Text size="xs" c="dimmed">Status</Text>
            <Badge color={reconciliation.status === "verified" ? "success" : reconciliation.status === "discrepancy" ? "danger" : "primary"}>{reconciliation.status}</Badge>
          </Card>
        </SimpleGrid>
      )}
    </Stack>
  );
}

function ReportSummaryCards({ summary }: { summary: BillingSummaryReport }) {
  return (
    <SimpleGrid cols={4}>
      <Card withBorder p="sm">
        <Text size="xs" c="dimmed">Total Invoiced</Text>
        <Text fw={700} size="lg">₹{summary.total_invoiced}</Text>
      </Card>
      <Card withBorder p="sm">
        <Text size="xs" c="dimmed">Total Collected</Text>
        <Text fw={700} size="lg" c="success">₹{summary.total_collected}</Text>
      </Card>
      <Card withBorder p="sm">
        <Text size="xs" c="dimmed">Outstanding</Text>
        <Text fw={700} size="lg" c="danger">₹{summary.total_outstanding}</Text>
      </Card>
      <Card withBorder p="sm">
        <Text size="xs" c="dimmed">Invoices</Text>
        <Text fw={700} size="lg">{summary.invoice_count}</Text>
      </Card>
      <Card withBorder p="sm">
        <Text size="xs" c="dimmed">Total Refunded</Text>
        <Text fw={700} size="lg" c="orange">₹{summary.total_refunded}</Text>
      </Card>
      <Card withBorder p="sm">
        <Text size="xs" c="dimmed">Total Discounts</Text>
        <Text fw={700} size="lg" c="violet">₹{summary.total_discounts}</Text>
      </Card>
      {summary.payment_modes.map((pm) => (
        <Card key={pm.mode} withBorder p="sm">
          <Text size="xs" c="dimmed">{pm.mode} ({pm.count})</Text>
          <Text fw={700} size="lg">₹{pm.total}</Text>
        </Card>
      ))}
    </SimpleGrid>
  );
}

// ── Day Close Tab ─────────────────────────────────────────

function DayCloseTab() {
  const queryClient = useQueryClient();
  const canVerify = useHasPermission(P.BILLING.DAY_CLOSE_VERIFY);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<CreateDayCloseRequest>>({});

  const { data: dayCloses = [], isLoading } = useQuery({
    queryKey: ["day-closes"],
    queryFn: () => api.listDayCloses(),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateDayCloseRequest) => api.createDayClose(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["day-closes"] });
      setShowForm(false);
      setForm({});
      notifications.show({ title: "Success", message: "Day close created", color: "success" });
    },
    onError: () => notifications.show({ title: "Error", message: "Failed to create day close", color: "danger" }),
  });

  const verifyMutation = useMutation({
    mutationFn: (id: string) => api.verifyDayClose(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["day-closes"] });
      notifications.show({ title: "Verified", message: "Day close verified", color: "success" });
    },
  });

  const dayCloseStatusColors: Record<string, string> = {
    open: "primary",
    verified: "success",
    discrepancy: "danger",
  };

  const columns = [
    { key: "close_date", label: "Date", render: (row: DayEndClose) => <Text fw={500}>{row.close_date}</Text> },
    { key: "expected_cash", label: "Expected Cash", render: (row: DayEndClose) => <Text size="sm">₹{row.expected_cash}</Text> },
    { key: "actual_cash", label: "Actual Cash", render: (row: DayEndClose) => <Text size="sm">₹{row.actual_cash}</Text> },
    {
      key: "cash_difference", label: "Difference",
      render: (row: DayEndClose) => {
        const diff = Number(row.cash_difference);
        return <Text size="sm" fw={600} c={diff === 0 ? "success" : "danger"}>₹{row.cash_difference}</Text>;
      },
    },
    { key: "total_collected", label: "Total Collected", render: (row: DayEndClose) => <Text size="sm">₹{row.total_collected}</Text> },
    { key: "invoices_count", label: "Invoices", render: (row: DayEndClose) => <Text size="sm">{row.invoices_count}</Text> },
    {
      key: "status", label: "Status",
      render: (row: DayEndClose) => (
        <Badge color={dayCloseStatusColors[row.status] ?? "slate"} variant="light">{row.status}</Badge>
      ),
    },
    {
      key: "actions", label: "",
      render: (row: DayEndClose) => row.status === "open" && canVerify ? (
        <Button size="compact-xs" variant="light" color="success" leftSection={<IconCheck size={14} />} onClick={() => verifyMutation.mutate(row.id)}>
          Verify
        </Button>
      ) : null,
    },
  ];

  return (
    <Stack>
      <Button size="xs" leftSection={<IconPlus size={14} />} onClick={() => setShowForm(!showForm)}>
        Create Day Close
      </Button>
      {showForm && (
        <Stack gap="xs">
          <Group grow>
            <TextInput label="Close Date" type="date" required onChange={(e) => setForm({ ...form, close_date: e.currentTarget.value })} />
            <NumberInput label="Actual Cash" required min={0} decimalScale={2} onChange={(v) => setForm({ ...form, actual_cash: Number(v) })} />
          </Group>
          <Textarea label="Notes" onChange={(e) => setForm({ ...form, notes: e.currentTarget.value || undefined })} />
          <Button size="xs" onClick={() => createMutation.mutate(form as CreateDayCloseRequest)} loading={createMutation.isPending}>
            Submit Day Close
          </Button>
        </Stack>
      )}
      <DataTable columns={columns} data={dayCloses} loading={isLoading} rowKey={(row) => row.id} />
    </Stack>
  );
}

// ── Audit Log Tab ─────────────────────────────────────────

function AuditLogTab() {
  const [page, setPage] = useState(1);
  const [filterAction, setFilterAction] = useState<string | null>(null);

  const params: Record<string, string> = { page: String(page), per_page: "30" };
  if (filterAction) params.action = filterAction;

  const { data, isLoading } = useQuery({
    queryKey: ["billing-audit-log", params],
    queryFn: () => api.listBillingAuditLog(params),
  });

  const actionColors: Record<string, string> = {
    invoice_created: "primary",
    invoice_issued: "teal",
    invoice_cancelled: "danger",
    payment_recorded: "success",
    payment_voided: "orange",
    refund_created: "orange",
    discount_applied: "violet",
    discount_removed: "slate",
    advance_collected: "info",
    advance_adjusted: "warning",
    advance_refunded: "danger",
    credit_note_created: "primary",
    credit_note_applied: "primary",
    claim_created: "primary",
    claim_updated: "primary",
    day_closed: "teal",
    write_off_created: "orange",
    write_off_approved: "success",
    invoice_cloned: "violet",
  };

  const columns = [
    {
      key: "created_at", label: "Time",
      render: (row: BillingAuditEntry) => <Text size="sm">{new Date(row.created_at).toLocaleString()}</Text>,
    },
    {
      key: "action", label: "Action",
      render: (row: BillingAuditEntry) => (
        <Badge size="sm" variant="light" color={actionColors[row.action] ?? "slate"}>
          {row.action.replace(/_/g, " ")}
        </Badge>
      ),
    },
    { key: "entity_type", label: "Entity", render: (row: BillingAuditEntry) => <Text size="sm">{row.entity_type}</Text> },
    { key: "amount", label: "Amount", render: (row: BillingAuditEntry) => <Text size="sm">{row.amount ? `₹${row.amount}` : "—"}</Text> },
    { key: "performed_by", label: "By", render: (row: BillingAuditEntry) => <Text size="sm">{row.performed_by ?? "—"}</Text> },
  ];

  return (
    <Stack>
      <Group>
        <Select
          placeholder="Filter by action"
          data={[
            "invoice_created", "invoice_issued", "invoice_cancelled",
            "payment_recorded", "payment_voided", "refund_created",
            "discount_applied", "advance_collected", "advance_adjusted",
            "credit_note_created", "claim_created", "day_closed",
            "write_off_created", "write_off_approved", "invoice_cloned",
          ].map((a) => ({ value: a, label: a.replace(/_/g, " ") }))}
          value={filterAction}
          onChange={setFilterAction}
          clearable
          w={220}
        />
      </Group>
      <DataTable
        columns={columns}
        data={data?.entries ?? []}
        loading={isLoading}
        page={page}
        totalPages={data ? Math.ceil(data.total / data.per_page) : 1}
        onPageChange={setPage}
        rowKey={(row) => row.id}
      />
    </Stack>
  );
}

/* ─── Credit Patients Tab ────────────────────────────────────────── */

function CreditPatientsTab() {
  const canManage = useHasPermission(P.BILLING.CREDIT_MANAGE);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [opened, { open, close }] = useDisclosure(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [showAging, setShowAging] = useState(false);
  const queryClient = useQueryClient();

  const params: Record<string, string> = {};
  if (statusFilter) params.status = statusFilter;

  const { data: allCreditPatients, isLoading } = useQuery({
    queryKey: ["credit-patients", params],
    queryFn: () => api.listCreditPatients(params),
  });

  const creditPatients = allCreditPatients ?? [];

  const { data: agingRaw } = useQuery({
    queryKey: ["credit-aging"],
    queryFn: () => api.reportCreditAging(),
    enabled: showAging,
  });
  const agingData = agingRaw ?? [];

  const [form, setForm] = useState({
    patient_id: "",
    credit_limit: 0,
    notes: "",
    status: "" as string,
  });

  const createMut = useMutation({
    mutationFn: () => api.createCreditPatient({ patient_id: form.patient_id, credit_limit: form.credit_limit, notes: form.notes }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["credit-patients"] });
      close();
      notifications.show({ title: "Created", message: "Credit patient added", color: "success" });
    },
    onError: () => notifications.show({ title: "Error", message: "Failed to create", color: "danger" }),
  });

  const updateMut = useMutation({
    mutationFn: (data: { id: string; req: UpdateCreditPatientRequest }) =>
      api.updateCreditPatient(data.id, data.req),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["credit-patients"] });
      close();
      notifications.show({ title: "Updated", message: "Credit patient updated", color: "success" });
    },
    onError: () => notifications.show({ title: "Error", message: "Update failed", color: "danger" }),
  });

  const creditStatusColors: Record<string, string> = {
    active: "success", overdue: "danger", suspended: "orange", closed: "slate",
  };

  const columns = [
    { key: "patient_id", label: "Patient ID", render: (r: CreditPatient) => <Text size="sm">{r.patient_id}</Text> },
    {
      key: "status", label: "Status",
      render: (r: CreditPatient) => (
        <Badge size="sm" color={creditStatusColors[r.status] ?? "slate"}>{r.status}</Badge>
      ),
    },
    {
      key: "credit_limit", label: "Limit",
      render: (r: CreditPatient) => <Text size="sm">₹{r.credit_limit.toLocaleString()}</Text>,
    },
    {
      key: "current_balance", label: "Balance",
      render: (r: CreditPatient) => (
        <Text size="sm" c={r.current_balance > r.credit_limit * 0.8 ? "danger" : undefined}>
          ₹{r.current_balance.toLocaleString()}
        </Text>
      ),
    },
    {
      key: "overdue_since", label: "Overdue Since",
      render: (r: CreditPatient) => <Text size="sm">{r.overdue_since ? new Date(r.overdue_since).toLocaleDateString() : "—"}</Text>,
    },
    ...(canManage ? [{
      key: "actions", label: "",
      render: (r: CreditPatient) => (
        <ActionIcon variant="subtle" onClick={() => { setEditId(r.id); setForm({ patient_id: r.patient_id, credit_limit: r.credit_limit, notes: r.notes ?? "", status: r.status }); open(); }}>
          <IconPencil size={16} />
        </ActionIcon>
      ),
    }] : []),
  ];

  const agingColumns = [
    { key: "patient_id", label: "Patient", render: (r: CreditAgingRow) => <Text size="sm">{r.patient_name ?? r.patient_id}</Text> },
    { key: "credit_limit", label: "Credit Limit", render: (r: CreditAgingRow) => <Text size="sm">₹{r.credit_limit.toLocaleString()}</Text> },
    { key: "current_balance", label: "Balance", render: (r: CreditAgingRow) => <Text size="sm" fw={600}>₹{r.current_balance.toLocaleString()}</Text> },
    {
      key: "utilization", label: "Utilization",
      render: (r: CreditAgingRow) => {
        const pct = r.credit_limit > 0 ? (r.current_balance / r.credit_limit) * 100 : 0;
        return <Progress value={pct} size="sm" color={pct > 90 ? "danger" : pct > 70 ? "orange" : "success"} />;
      },
    },
    { key: "status", label: "Status", render: (r: CreditAgingRow) => <Badge size="sm" color={creditStatusColors[r.status] ?? "slate"}>{r.status}</Badge> },
    { key: "days_overdue", label: "Days Overdue", render: (r: CreditAgingRow) => <Text size="sm" c={r.days_overdue && r.days_overdue > 30 ? "danger" : undefined}>{r.days_overdue ?? "—"}</Text> },
    { key: "overdue_since", label: "Overdue Since", render: (r: CreditAgingRow) => <Text size="sm">{r.overdue_since ? new Date(r.overdue_since).toLocaleDateString() : "—"}</Text> },
  ];

  return (
    <Stack>
      <Group justify="space-between">
        <Group>
          <Select
            placeholder="Status"
            data={["active", "overdue", "suspended", "closed"].map((s) => ({ value: s, label: s }))}
            value={statusFilter}
            onChange={setStatusFilter}
            clearable
            w={160}
          />
          <Button variant="light" onClick={() => setShowAging(!showAging)}>
            {showAging ? "Hide Aging" : "Show Aging Report"}
          </Button>
        </Group>
        {canManage && (
          <Button leftSection={<IconPlus size={16} />} onClick={() => { setEditId(null); setForm({ patient_id: "", credit_limit: 0, notes: "", status: "" }); open(); }}>
            Add Credit Patient
          </Button>
        )}
      </Group>

      <DataTable
        columns={columns}
        data={creditPatients}
        loading={isLoading}
        page={page}
        totalPages={Math.ceil(creditPatients.length / 20) || 1}
        onPageChange={setPage}
        rowKey={(r) => r.id}
      />

      {showAging && agingData.length > 0 && (
        <Card withBorder mt="md">
          <Title order={5} mb="sm">Credit Aging Report</Title>
          <DataTable
            columns={agingColumns}
            data={agingData}
            loading={false}
            page={1}
            totalPages={1}
            onPageChange={() => {}}
            rowKey={(r) => r.patient_id}
          />
        </Card>
      )}

      <Drawer opened={opened} onClose={close} title={editId ? "Edit Credit Patient" : "Add Credit Patient"} position="right" size="xl">
        <Stack>
          {!editId && (
            <TextInput label="Patient ID" value={form.patient_id} onChange={(e) => setForm({ ...form, patient_id: e.currentTarget.value })} required />
          )}
          <NumberInput label="Credit Limit (₹)" value={form.credit_limit} onChange={(v) => setForm({ ...form, credit_limit: Number(v) })} min={0} required />
          <Textarea label="Notes" value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.currentTarget.value })} />
          {editId && (
            <Select
              label="Status"
              data={["active", "overdue", "suspended", "closed"].map((s) => ({ value: s, label: s }))}
              onChange={(v) => setForm({ ...form, status: v ?? "" })}
            />
          )}
          <Button
            onClick={() => editId
              ? updateMut.mutate({ id: editId, req: { credit_limit: form.credit_limit, notes: form.notes, ...(form.status ? { status: form.status as UpdateCreditPatientRequest["status"] } : {}) } })
              : createMut.mutate()
            }
            loading={createMut.isPending || updateMut.isPending}
          >
            {editId ? "Update" : "Create"}
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

/* ─── GST & TDS Tab ──────────────────────────────────────────────── */

function GstTdsTab({ canTds }: { canTds: boolean }) {
  const canManageGst = useHasPermission(P.BILLING.GST_RETURNS_MANAGE);
  const canManageTds = useHasPermission(P.BILLING.TDS_MANAGE);
  const [view, setView] = useState("gstr");

  return (
    <Stack>
      <SegmentedControl
        value={view}
        onChange={setView}
        data={[
          { value: "gstr", label: "GST Returns" },
          ...(canTds ? [{ value: "tds", label: "TDS Management" }] : []),
          { value: "hsn", label: "HSN Summary" },
        ]}
      />
      {view === "gstr" && <GstrSubView canManage={canManageGst} />}
      {view === "tds" && canTds && <TdsSubView canManage={canManageTds} />}
      {view === "hsn" && <HsnSubView />}
    </Stack>
  );
}

function GstrSubView({ canManage }: { canManage: boolean }) {
  const queryClient = useQueryClient();
  const [genForm, setGenForm] = useState<GenerateGstrRequest>({ return_type: "GSTR-1", period: "" });
  const [genOpened, { open: openGen, close: closeGen }] = useDisclosure(false);

  const { data: gstrSummaries, isLoading } = useQuery({
    queryKey: ["gstr-summaries"],
    queryFn: () => api.listGstrSummaries(),
  });

  const generateMut = useMutation({
    mutationFn: () => api.generateGstrSummary(genForm),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["gstr-summaries"] });
      closeGen();
      notifications.show({ title: "Generated", message: "GSTR summary created", color: "success" });
    },
    onError: () => notifications.show({ title: "Error", message: "Failed to generate", color: "danger" }),
  });

  const fileMut = useMutation({
    mutationFn: (id: string) => api.fileGstr(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["gstr-summaries"] });
      notifications.show({ title: "Filed", message: "GSTR marked as filed", color: "success" });
    },
    onError: () => notifications.show({ title: "Error", message: "Filing failed", color: "danger" }),
  });

  const gstrStatusColors: Record<string, string> = {
    draft: "slate", validated: "primary", filed: "success", accepted: "teal", error: "danger",
  };

  const columns = [
    { key: "return_type", label: "Type", render: (r: GstReturnSummary) => <Badge size="sm">{r.return_type}</Badge> },
    { key: "period", label: "Period", render: (r: GstReturnSummary) => <Text size="sm">{r.period}</Text> },
    { key: "filing_status", label: "Status", render: (r: GstReturnSummary) => <Badge size="sm" color={gstrStatusColors[r.filing_status] ?? "slate"}>{r.filing_status}</Badge> },
    { key: "total_taxable", label: "Taxable", render: (r: GstReturnSummary) => <Text size="sm">₹{r.total_taxable.toLocaleString()}</Text> },
    { key: "cgst", label: "CGST", render: (r: GstReturnSummary) => <Text size="sm">₹{r.total_cgst.toLocaleString()}</Text> },
    { key: "sgst", label: "SGST", render: (r: GstReturnSummary) => <Text size="sm">₹{r.total_sgst.toLocaleString()}</Text> },
    { key: "igst", label: "IGST", render: (r: GstReturnSummary) => <Text size="sm">₹{r.total_igst.toLocaleString()}</Text> },
    ...(canManage ? [{
      key: "actions", label: "",
      render: (r: GstReturnSummary) => r.filing_status === "validated" ? (
        <Button size="xs" variant="light" onClick={() => fileMut.mutate(r.id)}>File</Button>
      ) : <Text size="sm">—</Text>,
    }] : []),
  ];

  return (
    <Stack>
      <Group justify="space-between">
        <Text fw={600}>GST Return Summaries</Text>
        {canManage && <Button leftSection={<IconPlus size={16} />} onClick={openGen}>Generate Summary</Button>}
      </Group>
      <DataTable columns={columns} data={gstrSummaries ?? []} loading={isLoading} page={1} totalPages={1} onPageChange={() => {}} rowKey={(r) => r.id} />

      <Drawer opened={genOpened} onClose={closeGen} title="Generate GSTR Summary" position="right" size="xl">
        <Stack>
          <Select label="Return Type" data={["GSTR-1", "GSTR-2B", "GSTR-3B"].map((v) => ({ value: v, label: v }))} value={genForm.return_type} onChange={(v) => setGenForm({ ...genForm, return_type: v ?? "GSTR-1" })} />
          <TextInput label="Period (e.g. 2026-03)" value={genForm.period} onChange={(e) => setGenForm({ ...genForm, period: e.currentTarget.value })} required />
          <Button onClick={() => generateMut.mutate()} loading={generateMut.isPending}>Generate</Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

function TdsSubView({ canManage }: { canManage: boolean }) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [opened, { open, close }] = useDisclosure(false);
  const [form, setForm] = useState<CreateTdsRequest>({
    invoice_id: "", deductee_name: "", deductee_pan: "", tds_section: "194J",
    tds_rate: 10, base_amount: 0, deducted_date: new Date().toISOString().slice(0, 10), financial_year: "2025-26", quarter: "Q4",
  });

  const { data: tdsItems, isLoading } = useQuery({
    queryKey: ["tds-deductions"],
    queryFn: () => api.listTdsDeductions(),
  });

  const createMut = useMutation({
    mutationFn: () => api.createTdsDeduction(form),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tds-deductions"] });
      close();
      notifications.show({ title: "Created", message: "TDS deduction recorded", color: "success" });
    },
    onError: () => notifications.show({ title: "Error", message: "Failed", color: "danger" }),
  });

  const depositMut = useMutation({
    mutationFn: (args: { id: string; challan: string }) =>
      api.depositTds(args.id, { challan_number: args.challan, challan_date: new Date().toISOString().slice(0, 10) }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tds-deductions"] });
      notifications.show({ title: "Deposited", message: "TDS challan recorded", color: "success" });
    },
  });

  const certMut = useMutation({
    mutationFn: (args: { id: string; cert: string }) =>
      api.issueTdsCertificate(args.id, { certificate_number: args.cert, certificate_date: new Date().toISOString().slice(0, 10) }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tds-deductions"] });
      notifications.show({ title: "Issued", message: "Certificate recorded", color: "success" });
    },
  });

  const tdsStatusColors: Record<string, string> = {
    deducted: "primary", deposited: "teal", certificate_issued: "success",
  };

  const columns = [
    { key: "deductee_name", label: "Deductee", render: (r: TdsDeduction) => <Text size="sm">{r.deductee_name}</Text> },
    { key: "deductee_pan", label: "PAN", render: (r: TdsDeduction) => <Text size="sm" ff="monospace">{r.deductee_pan}</Text> },
    { key: "tds_section", label: "Section", render: (r: TdsDeduction) => <Badge size="sm" variant="outline">{r.tds_section}</Badge> },
    { key: "tds_rate", label: "Rate %", render: (r: TdsDeduction) => <Text size="sm">{r.tds_rate}%</Text> },
    { key: "base_amount", label: "Base", render: (r: TdsDeduction) => <Text size="sm">₹{r.base_amount.toLocaleString()}</Text> },
    { key: "tds_amount", label: "TDS", render: (r: TdsDeduction) => <Text size="sm" fw={600}>₹{r.tds_amount.toLocaleString()}</Text> },
    { key: "status", label: "Status", render: (r: TdsDeduction) => <Badge size="sm" color={tdsStatusColors[r.status] ?? "slate"}>{r.status.replace(/_/g, " ")}</Badge> },
    { key: "fy", label: "FY / Q", render: (r: TdsDeduction) => <Text size="sm">{r.financial_year} {r.quarter}</Text> },
    ...(canManage ? [{
      key: "actions", label: "",
      render: (r: TdsDeduction) => (
        <Group gap={4}>
          {r.status === "deducted" && (
            <Tooltip label="Deposit">
              <ActionIcon variant="subtle" color="teal" onClick={() => depositMut.mutate({ id: r.id, challan: `CH-${Date.now()}` })}>
                <IconCheck size={16} />
              </ActionIcon>
            </Tooltip>
          )}
          {r.status === "deposited" && (
            <Tooltip label="Issue Certificate">
              <ActionIcon variant="subtle" color="success" onClick={() => certMut.mutate({ id: r.id, cert: `CERT-${Date.now()}` })}>
                <IconShieldCheck size={16} />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
      ),
    }] : []),
  ];

  return (
    <Stack>
      <Group justify="space-between">
        <Text fw={600}>TDS Deductions</Text>
        {canManage && <Button leftSection={<IconPlus size={16} />} onClick={open}>Record TDS</Button>}
      </Group>
      <DataTable columns={columns} data={tdsItems ?? []} loading={isLoading} page={page} totalPages={Math.ceil((tdsItems?.length ?? 0) / 20) || 1} onPageChange={setPage} rowKey={(r) => r.id} />

      <Drawer opened={opened} onClose={close} title="Record TDS Deduction" position="right" size="xl">
        <Stack>
          <TextInput label="Invoice ID" value={form.invoice_id} onChange={(e) => setForm({ ...form, invoice_id: e.currentTarget.value })} required />
          <TextInput label="Deductee Name" value={form.deductee_name} onChange={(e) => setForm({ ...form, deductee_name: e.currentTarget.value })} required />
          <TextInput label="PAN" value={form.deductee_pan} onChange={(e) => setForm({ ...form, deductee_pan: e.currentTarget.value.toUpperCase() })} required maxLength={10} />
          <Select label="Section" data={["194J", "194C", "194H", "194I", "194A", "194Q"].map((v) => ({ value: v, label: v }))} value={form.tds_section} onChange={(v) => setForm({ ...form, tds_section: v ?? "194J" })} />
          <NumberInput label="TDS Rate %" value={form.tds_rate} onChange={(v) => setForm({ ...form, tds_rate: Number(v) })} min={0} max={100} />
          <NumberInput label="Base Amount" value={form.base_amount} onChange={(v) => setForm({ ...form, base_amount: Number(v) })} min={0} />
          <Text size="sm" c="dimmed">Estimated TDS: ₹{Math.round(form.base_amount * form.tds_rate / 100).toLocaleString()}</Text>
          <TextInput label="Deducted Date" type="date" value={form.deducted_date} onChange={(e) => setForm({ ...form, deducted_date: e.currentTarget.value })} required />
          <Select label="Financial Year" data={["2024-25", "2025-26", "2026-27"].map((v) => ({ value: v, label: v }))} value={form.financial_year} onChange={(v) => setForm({ ...form, financial_year: v ?? "2025-26" })} />
          <Select label="Quarter" data={["Q1", "Q2", "Q3", "Q4"].map((v) => ({ value: v, label: v }))} value={form.quarter} onChange={(v) => setForm({ ...form, quarter: v ?? "Q4" })} />
          <Button onClick={() => createMut.mutate()} loading={createMut.isPending}>Record</Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

function HsnSubView() {
  const [period, setPeriod] = useState("");
  const { data: hsnRows, isLoading } = useQuery({
    queryKey: ["hsn-summary", period],
    queryFn: () => api.reportHsnSummary(period),
    enabled: period.length >= 7,
  });

  const columns = [
    { key: "hsn_code", label: "HSN Code", render: (r: HsnSummaryRow) => <Text size="sm" ff="monospace">{r.hsn_code}</Text> },
    { key: "item_count", label: "Items", render: (r: HsnSummaryRow) => <Text size="sm">{r.item_count}</Text> },
    { key: "taxable_amount", label: "Taxable Amount", render: (r: HsnSummaryRow) => <Text size="sm">₹{r.taxable_amount.toLocaleString()}</Text> },
    { key: "cgst_amount", label: "CGST", render: (r: HsnSummaryRow) => <Text size="sm">₹{r.cgst_amount.toLocaleString()}</Text> },
    { key: "sgst_amount", label: "SGST", render: (r: HsnSummaryRow) => <Text size="sm">₹{r.sgst_amount.toLocaleString()}</Text> },
    { key: "igst_amount", label: "IGST", render: (r: HsnSummaryRow) => <Text size="sm">₹{r.igst_amount.toLocaleString()}</Text> },
    { key: "total_tax", label: "Total Tax", render: (r: HsnSummaryRow) => <Text size="sm" fw={600}>₹{r.total_tax.toLocaleString()}</Text> },
  ];

  return (
    <Stack>
      <Group>
        <TextInput label="Period (YYYY-MM)" placeholder="2026-03" value={period} onChange={(e) => setPeriod(e.currentTarget.value)} w={180} />
      </Group>
      {hsnRows && (
        <DataTable columns={columns} data={hsnRows} loading={isLoading} page={1} totalPages={1} onPageChange={() => {}} rowKey={(r) => r.hsn_code} />
      )}
    </Stack>
  );
}

/* ─── Journal Entries Tab ────────────────────────────────────────── */

function JournalEntriesTab() {
  const canCreate = useHasPermission(P.BILLING.JOURNAL_CREATE);
  const canPost = useHasPermission(P.BILLING.JOURNAL_POST);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [opened, { open, close }] = useDisclosure(false);
  const queryClient = useQueryClient();

  const params: Record<string, string> = { page: String(page), per_page: "20" };
  if (statusFilter) params.status = statusFilter;

  const { data: jeItems, isLoading } = useQuery({
    queryKey: ["journal-entries", params],
    queryFn: () => api.listJournalEntries(params),
  });

  const [form, setForm] = useState<CreateJournalEntryRequest>({
    entry_date: new Date().toISOString().slice(0, 10),
    description: "",
    lines: [
      { account_id: "", debit_amount: 0, credit_amount: 0 },
      { account_id: "", debit_amount: 0, credit_amount: 0 },
    ],
  });

  const { data: glAccounts } = useQuery({
    queryKey: ["gl-accounts"],
    queryFn: () => api.listGlAccounts(),
    enabled: opened,
  });

  const glOptions = (glAccounts ?? []).map((a: GlAccount) => ({
    value: a.id,
    label: `${a.code} — ${a.name}`,
  }));

  const totalDebit = form.lines.reduce((s, l) => s + (l.debit_amount ?? 0), 0);
  const totalCredit = form.lines.reduce((s, l) => s + (l.credit_amount ?? 0), 0);
  const balanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;

  const createMut = useMutation({
    mutationFn: () => api.createJournalEntry(form),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
      close();
      notifications.show({ title: "Created", message: "Journal entry created", color: "success" });
    },
    onError: () => notifications.show({ title: "Error", message: "Failed — ensure debits equal credits", color: "danger" }),
  });

  const postMut = useMutation({
    mutationFn: (id: string) => api.postJournalEntry(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
      notifications.show({ title: "Posted", message: "Journal entry posted to ledger", color: "success" });
    },
    onError: () => notifications.show({ title: "Error", message: "Post failed", color: "danger" }),
  });

  const reverseMut = useMutation({
    mutationFn: (id: string) => api.reverseJournalEntry(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
      notifications.show({ title: "Reversed", message: "Reversal entry created", color: "success" });
    },
    onError: () => notifications.show({ title: "Error", message: "Reversal failed", color: "danger" }),
  });

  const addLine = () => setForm({ ...form, lines: [...form.lines, { account_id: "", debit_amount: 0, credit_amount: 0 }] });
  const removeLine = (idx: number) => setForm({ ...form, lines: form.lines.filter((_, i) => i !== idx) });
  const updateLine = (idx: number, field: keyof JournalLineInput, value: string | number) => {
    const lines: JournalLineInput[] = form.lines.map((l, i) =>
      i === idx ? { ...l, [field]: value } : l,
    );
    setForm({ ...form, lines });
  };

  const jeStatusColors: Record<string, string> = {
    draft: "slate", posted: "success", reversed: "danger",
  };

  const columns = [
    { key: "entry_number", label: "JE #", render: (r: JournalEntry) => <Text size="sm" fw={600}>{r.entry_number}</Text> },
    { key: "entry_date", label: "Date", render: (r: JournalEntry) => <Text size="sm">{new Date(r.entry_date).toLocaleDateString()}</Text> },
    { key: "entry_type", label: "Type", render: (r: JournalEntry) => <Badge size="sm" variant="light">{r.entry_type.replace(/_/g, " ")}</Badge> },
    { key: "status", label: "Status", render: (r: JournalEntry) => <Badge size="sm" color={jeStatusColors[r.status] ?? "slate"}>{r.status}</Badge> },
    { key: "total_debit", label: "Debit", render: (r: JournalEntry) => <Text size="sm">₹{r.total_debit.toLocaleString()}</Text> },
    { key: "total_credit", label: "Credit", render: (r: JournalEntry) => <Text size="sm">₹{r.total_credit.toLocaleString()}</Text> },
    { key: "description", label: "Description", render: (r: JournalEntry) => <Text size="sm" lineClamp={1}>{r.description ?? "—"}</Text> },
    ...(canPost ? [{
      key: "actions", label: "",
      render: (r: JournalEntry) => (
        <Group gap={4}>
          {r.status === "draft" && (
            <Tooltip label="Post to ledger">
              <ActionIcon variant="subtle" color="success" onClick={() => postMut.mutate(r.id)}>
                <IconCheck size={16} />
              </ActionIcon>
            </Tooltip>
          )}
          {r.status === "posted" && (
            <Tooltip label="Reverse entry">
              <ActionIcon variant="subtle" color="danger" onClick={() => reverseMut.mutate(r.id)}>
                <IconX size={16} />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
      ),
    }] : []),
  ];

  return (
    <Stack>
      <Group justify="space-between">
        <Select
          placeholder="Status"
          data={["draft", "posted", "reversed"].map((s) => ({ value: s, label: s }))}
          value={statusFilter}
          onChange={setStatusFilter}
          clearable
          w={160}
        />
        {canCreate && <Button leftSection={<IconPlus size={16} />} onClick={open}>New Journal Entry</Button>}
      </Group>
      <DataTable columns={columns} data={jeItems ?? []} loading={isLoading} page={page} totalPages={Math.ceil((jeItems?.length ?? 0) / 20) || 1} onPageChange={setPage} rowKey={(r) => r.id} />

      <Drawer opened={opened} onClose={close} title="Create Journal Entry" position="right" size="lg">
        <Stack>
          <TextInput label="Entry Date" type="date" value={form.entry_date} onChange={(e) => setForm({ ...form, entry_date: e.currentTarget.value })} required />
          <Textarea label="Description" value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.currentTarget.value })} />

          <Group justify="space-between">
            <Text fw={600}>Lines</Text>
            <Button size="xs" variant="light" onClick={addLine}>Add Line</Button>
          </Group>

          {form.lines.map((line, idx) => (
            <Card key={idx} withBorder p="xs">
              <Group>
                <Select
                  placeholder="Account"
                  data={glOptions}
                  value={line.account_id}
                  onChange={(v) => updateLine(idx, "account_id", v ?? "")}
                  searchable
                  style={{ flex: 1 }}
                />
                <NumberInput placeholder="Debit" value={line.debit_amount} onChange={(v) => updateLine(idx, "debit_amount", Number(v))} min={0} w={120} />
                <NumberInput placeholder="Credit" value={line.credit_amount} onChange={(v) => updateLine(idx, "credit_amount", Number(v))} min={0} w={120} />
                {form.lines.length > 2 && (
                  <ActionIcon variant="subtle" color="danger" onClick={() => removeLine(idx)}>
                    <IconTrash size={16} />
                  </ActionIcon>
                )}
              </Group>
            </Card>
          ))}

          <Group justify="space-between">
            <Text size="sm">Total Debit: ₹{totalDebit.toLocaleString()}</Text>
            <Text size="sm">Total Credit: ₹{totalCredit.toLocaleString()}</Text>
          </Group>
          {!balanced && totalDebit > 0 && (
            <Alert color="danger" title="Unbalanced">
              Debits must equal credits before saving.
            </Alert>
          )}

          <Button onClick={() => createMut.mutate()} loading={createMut.isPending} disabled={!balanced}>
            Create Journal Entry
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

/* ─── Bank Reconciliation Tab ────────────────────────────────────── */

function BankReconTab() {
  const canManage = useHasPermission(P.BILLING.BANK_RECON_MANAGE);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [importOpened, { open: openImport, close: closeImport }] = useDisclosure(false);
  const queryClient = useQueryClient();

  const params: Record<string, string> = { page: String(page), per_page: "20" };
  if (statusFilter) params.recon_status = statusFilter;

  const { data: bankTxns, isLoading } = useQuery({
    queryKey: ["bank-transactions", params],
    queryFn: () => api.listBankTransactions(params),
  });

  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [importTxns, setImportTxns] = useState<ImportBankTransactionsRequest["transactions"]>([]);

  const [manualTxn, setManualTxn] = useState({
    transaction_date: "", description: "", debit_amount: 0, credit_amount: 0, reference_number: "",
  });

  const importMut = useMutation({
    mutationFn: () => api.importBankTransactions({ transactions: importTxns }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["bank-transactions"] });
      closeImport();
      notifications.show({ title: "Imported", message: "Bank transactions imported", color: "success" });
    },
    onError: () => notifications.show({ title: "Error", message: "Import failed", color: "danger" }),
  });

  const autoReconMut = useMutation({
    mutationFn: () => api.autoReconcile(),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: ["bank-transactions"] });
      notifications.show({ title: "Auto-Reconciled", message: `${res.matched_count ?? 0} transactions matched`, color: "success" });
    },
    onError: () => notifications.show({ title: "Error", message: "Auto-reconcile failed", color: "danger" }),
  });

  const reconStatusColors: Record<string, string> = {
    unmatched: "orange", matched: "success", discrepancy: "danger", excluded: "slate",
  };

  const columns = [
    { key: "transaction_date", label: "Date", render: (r: BankTransaction) => <Text size="sm">{new Date(r.transaction_date).toLocaleDateString()}</Text> },
    { key: "bank_name", label: "Bank", render: (r: BankTransaction) => <Text size="sm">{r.bank_name}</Text> },
    { key: "description", label: "Description", render: (r: BankTransaction) => <Text size="sm" lineClamp={1}>{r.description}</Text> },
    { key: "debit_amount", label: "Debit", render: (r: BankTransaction) => <Text size="sm">{r.debit_amount ? `₹${r.debit_amount.toLocaleString()}` : "—"}</Text> },
    { key: "credit_amount", label: "Credit", render: (r: BankTransaction) => <Text size="sm">{r.credit_amount ? `₹${r.credit_amount.toLocaleString()}` : "—"}</Text> },
    { key: "reference_number", label: "Reference", render: (r: BankTransaction) => <Text size="sm" ff="monospace">{r.reference_number ?? "—"}</Text> },
    { key: "recon_status", label: "Status", render: (r: BankTransaction) => <Badge size="sm" color={reconStatusColors[r.recon_status] ?? "slate"}>{r.recon_status}</Badge> },
  ];

  const addManualTxn = () => {
    if (!manualTxn.transaction_date || !manualTxn.description || !bankName) return;
    setImportTxns([...importTxns, {
      bank_name: bankName,
      account_number: accountNumber,
      transaction_date: manualTxn.transaction_date,
      description: manualTxn.description,
      debit_amount: manualTxn.debit_amount,
      credit_amount: manualTxn.credit_amount,
      reference_number: manualTxn.reference_number,
    }]);
    setManualTxn({ transaction_date: "", description: "", debit_amount: 0, credit_amount: 0, reference_number: "" });
  };

  return (
    <Stack>
      <Group justify="space-between">
        <Group>
          <Select
            placeholder="Status"
            data={["unmatched", "matched", "discrepancy", "excluded"].map((s) => ({ value: s, label: s }))}
            value={statusFilter}
            onChange={setStatusFilter}
            clearable
            w={160}
          />
        </Group>
        <Group>
          {canManage && (
            <>
              <Button variant="light" leftSection={<IconRefresh size={16} />} onClick={() => autoReconMut.mutate()} loading={autoReconMut.isPending}>
                Auto-Reconcile
              </Button>
              <Button leftSection={<IconUpload size={16} />} onClick={openImport}>
                Import Transactions
              </Button>
            </>
          )}
        </Group>
      </Group>

      <DataTable columns={columns} data={bankTxns ?? []} loading={isLoading} page={page} totalPages={Math.ceil((bankTxns?.length ?? 0) / 20) || 1} onPageChange={setPage} rowKey={(r) => r.id} />

      <Drawer opened={importOpened} onClose={closeImport} title="Import Bank Transactions" position="right" size="lg">
        <Stack>
          <TextInput label="Bank Name" value={bankName} onChange={(e) => setBankName(e.currentTarget.value)} required />
          <TextInput label="Account Number" value={accountNumber} onChange={(e) => setAccountNumber(e.currentTarget.value)} required />

          <Card withBorder>
            <Text fw={600} mb="sm">Add Transaction</Text>
            <Stack gap="xs">
              <TextInput label="Date" type="date" value={manualTxn.transaction_date} onChange={(e) => setManualTxn({ ...manualTxn, transaction_date: e.currentTarget.value })} />
              <TextInput label="Description" value={manualTxn.description} onChange={(e) => setManualTxn({ ...manualTxn, description: e.currentTarget.value })} />
              <Group grow>
                <NumberInput label="Debit" value={manualTxn.debit_amount} onChange={(v) => setManualTxn({ ...manualTxn, debit_amount: Number(v) })} min={0} />
                <NumberInput label="Credit" value={manualTxn.credit_amount} onChange={(v) => setManualTxn({ ...manualTxn, credit_amount: Number(v) })} min={0} />
              </Group>
              <TextInput label="Reference #" value={manualTxn.reference_number} onChange={(e) => setManualTxn({ ...manualTxn, reference_number: e.currentTarget.value })} />
              <Button size="xs" variant="light" onClick={addManualTxn}>Add to Batch</Button>
            </Stack>
          </Card>

          {importTxns.length > 0 && (
            <Text size="sm">{importTxns.length} transaction(s) in batch</Text>
          )}

          <Button
            onClick={() => importMut.mutate()}
            loading={importMut.isPending}
            disabled={importTxns.length === 0}
          >
            Import {importTxns.length} Transaction(s)
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

/* ─── Financial MIS Tab ──────────────────────────────────────────── */

function FinancialMisTab() {
  const [dateFrom, setDateFrom] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [dateTo, setDateTo] = useState(new Date().toISOString().slice(0, 10));

  const { data: misData } = useQuery({
    queryKey: ["financial-mis", dateFrom, dateTo],
    queryFn: () => api.reportFinancialMis(dateFrom, dateTo),
    enabled: Boolean(dateFrom && dateTo),
  });

  const { data: plRows, isLoading: plLoading } = useQuery({
    queryKey: ["profit-loss", dateFrom, dateTo],
    queryFn: () => api.reportProfitLoss(dateFrom, dateTo),
    enabled: Boolean(dateFrom && dateTo),
  });

  const plColumns = [
    { key: "department_name", label: "Department", render: (r: ProfitLossDeptRow) => <Text size="sm" fw={500}>{r.department_name ?? "Unassigned"}</Text> },
    { key: "revenue", label: "Revenue", render: (r: ProfitLossDeptRow) => <Text size="sm" c="success">₹{r.revenue.toLocaleString()}</Text> },
    { key: "expenses", label: "Expenses", render: (r: ProfitLossDeptRow) => <Text size="sm" c="danger">₹{r.expenses.toLocaleString()}</Text> },
    {
      key: "profit", label: "Profit/Loss",
      render: (r: ProfitLossDeptRow) => (
        <Text size="sm" fw={600} c={r.profit >= 0 ? "success" : "danger"}>₹{r.profit.toLocaleString()}</Text>
      ),
    },
    {
      key: "margin", label: "Margin %",
      render: (r: ProfitLossDeptRow) => {
        const margin = r.revenue > 0 ? ((r.revenue - r.expenses) / r.revenue * 100) : 0;
        return <Text size="sm">{margin.toFixed(1)}%</Text>;
      },
    },
  ];

  return (
    <Stack>
      <Group>
        <TextInput label="From" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.currentTarget.value)} />
        <TextInput label="To" type="date" value={dateTo} onChange={(e) => setDateTo(e.currentTarget.value)} />
      </Group>

      {misData && (
        <SimpleGrid cols={4}>
          <Card withBorder p="md">
            <Text size="xs" c="dimmed">Total Revenue</Text>
            <Text size="xl" fw={700} c="success">₹{misData.total_revenue.toLocaleString()}</Text>
          </Card>
          <Card withBorder p="md">
            <Text size="xs" c="dimmed">Total Collections</Text>
            <Text size="xl" fw={700} c="teal">₹{misData.total_collections.toLocaleString()}</Text>
          </Card>
          <Card withBorder p="md">
            <Text size="xs" c="dimmed">Collection Rate</Text>
            <Text size="xl" fw={700}>{Number(misData.collection_rate).toFixed(1)}%</Text>
            <Progress value={Number(misData.collection_rate)} size="sm" mt="xs" color={Number(misData.collection_rate) >= 80 ? "success" : "orange"} />
          </Card>
          <Card withBorder p="md">
            <Text size="xs" c="dimmed">Outstanding</Text>
            <Text size="xl" fw={700} c="orange">₹{misData.total_outstanding.toLocaleString()}</Text>
          </Card>
        </SimpleGrid>
      )}

      {misData && (
        <Card withBorder>
          <Title order={5} mb="sm">Financial Summary</Title>
          <SimpleGrid cols={4}>
            <div>
              <Text size="xs" c="dimmed">Refunds</Text>
              <Text fw={600}>₹{misData.total_refunds.toLocaleString()}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">Write-Offs</Text>
              <Text fw={600}>₹{misData.total_write_offs.toLocaleString()}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">Advances</Text>
              <Text fw={600}>₹{misData.total_advances.toLocaleString()}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">Period</Text>
              <Text fw={600}>{misData.period_from} → {misData.period_to}</Text>
            </div>
          </SimpleGrid>
        </Card>
      )}

      <Title order={5}>Profit & Loss by Department</Title>
      <DataTable
        columns={plColumns}
        data={plRows ?? []}
        loading={plLoading}
        page={1}
        totalPages={1}
        onPageChange={() => {}}
        rowKey={(r) => r.department_name ?? r.department_id ?? "unknown"}
      />
    </Stack>
  );
}

/* ─── ERP Export Tab ─────────────────────────────────────────────── */

function ErpExportTab() {
  const [form, setForm] = useState<ErpExportRequest>({
    target_system: "tally",
    export_type: "invoices",
    date_from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
    date_to: new Date().toISOString().slice(0, 10),
  });
  const queryClient = useQueryClient();

  const { data: erpExports, isLoading } = useQuery({
    queryKey: ["erp-exports"],
    queryFn: () => api.listErpExports(),
  });

  const exportMut = useMutation({
    mutationFn: () => api.exportToErp(form),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["erp-exports"] });
      notifications.show({ title: "Exported", message: "Data exported to ERP", color: "success" });
    },
    onError: () => notifications.show({ title: "Error", message: "Export failed", color: "danger" }),
  });

  const erpStatusColors: Record<string, string> = {
    pending: "warning", exported: "success", failed: "danger", acknowledged: "teal",
  };

  const columns = [
    { key: "target_system", label: "System", render: (r: ErpExportLog) => <Badge size="sm">{r.target_system}</Badge> },
    { key: "export_type", label: "Type", render: (r: ErpExportLog) => <Text size="sm">{r.export_type}</Text> },
    { key: "status", label: "Status", render: (r: ErpExportLog) => <Badge size="sm" color={erpStatusColors[r.status] ?? "slate"}>{r.status}</Badge> },
    { key: "record_count", label: "Records", render: (r: ErpExportLog) => <Text size="sm">{r.record_ids?.length ?? 0}</Text> },
    { key: "created_at", label: "Exported At", render: (r: ErpExportLog) => <Text size="sm">{new Date(r.created_at).toLocaleString()}</Text> },
    { key: "error_message", label: "Error", render: (r: ErpExportLog) => <Text size="sm" c="danger" lineClamp={1}>{r.error_message ?? "—"}</Text> },
  ];

  return (
    <Stack>
      <Card withBorder>
        <Text fw={600} mb="sm">Export to ERP</Text>
        <Group align="end">
          <Select
            label="Target System"
            data={[
              { value: "tally", label: "Tally ERP" },
              { value: "sap", label: "SAP" },
              { value: "odoo", label: "Odoo" },
              { value: "zoho", label: "Zoho Books" },
            ]}
            value={form.target_system}
            onChange={(v) => setForm({ ...form, target_system: v ?? "tally" })}
            w={180}
          />
          <Select
            label="Export Type"
            data={[
              { value: "invoices", label: "Invoices" },
              { value: "payments", label: "Payments" },
              { value: "journal_entries", label: "Journal Entries" },
              { value: "all", label: "All Financial Data" },
            ]}
            value={form.export_type}
            onChange={(v) => setForm({ ...form, export_type: v ?? "invoices" })}
            w={200}
          />
          <TextInput label="From" type="date" value={form.date_from ?? ""} onChange={(e) => setForm({ ...form, date_from: e.currentTarget.value })} w={160} />
          <TextInput label="To" type="date" value={form.date_to ?? ""} onChange={(e) => setForm({ ...form, date_to: e.currentTarget.value })} w={160} />
          <Button leftSection={<IconDatabase size={16} />} onClick={() => exportMut.mutate()} loading={exportMut.isPending}>
            Export
          </Button>
        </Group>
      </Card>

      <Title order={5}>Export History</Title>
      <DataTable columns={columns} data={erpExports ?? []} loading={isLoading} page={1} totalPages={1} onPageChange={() => {}} rowKey={(r) => r.id} />
    </Stack>
  );
}
