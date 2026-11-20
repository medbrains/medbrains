/** The `/payments` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  CapabilitiesView,
  ChooseProviders,
  CreateLinkRequest,
  CreatePaymentOrderRequest,
  CreatePaymentOrderResponse,
  CreatePaymentTerminalRequest,
  CreateVirtualAccountRequest,
  CreateVirtualAccountResponse,
  GenerateUpiQrRequest,
  InitiateRefundRequest,
  OnlineSettings,
  PaymentGatewayTransaction,
  PaymentLinkView,
  PaymentProvidersResponse,
  PaymentStatusResponse,
  PaymentTerminal,
  PaymentWebhookException,
  PosSaleRequest,
  PosSaleView,
  ProviderSetup,
  ProviderTestResult,
  RazorpayStatusResponse,
  ReconSummary,
  RefundGatewayResponse,
  ResendLinkRequest,
  ResolveExceptionRequest,
  ResolveSale,
  SetKeys,
  SimulatedOutcome,
  SimulatedSale,
  StationChoice,
  TerminalJob,
  TerminalJobResult,
  TerminalProviders,
  UpdatePaymentTerminalRequest,
  UpiDeepLinkRequest,
  UpiDeepLinkResponse,
  UpiQrResponse,
  VerifyPaymentRequest,
} from "@medbrains/types";
import { request } from "../client.js";

export const paymentsApi = {
  // ── Payment Gateway ──────────────────────────────────────
  createPaymentOrder: (data: CreatePaymentOrderRequest) =>
    request<CreatePaymentOrderResponse>("/payments/create-order", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  /** Send an amount to the card machine at the counter. */
  posSale: (data: PosSaleRequest) =>
    request<PosSaleView>("/payments/pos-sale", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  /** Where a card sale stands; asks the machine while it is open. */
  getCardSale: (id: string) => request<PosSaleView>(`/payments/pos-sale/${id}`),
  cancelCardSale: (id: string) =>
    request<PosSaleView>(`/payments/pos-sale/${id}/cancel`, { method: "POST" }),
  /** A bill's card sales with no definite outcome, asked of the machine once more. */
  listUnresolvedCardSales: (invoiceId: string) =>
    request<PosSaleView[]>(
      `/payments/pos-sales/unresolved?${new URLSearchParams({ invoice_id: invoiceId })}`,
    ),
  /** A supervisor records what the machine's slip shows for a sale with no definite outcome. */
  resolveCardSale: (id: string, data: ResolveSale) =>
    request<PosSaleView>(`/payments/pos-sale/${id}/resolve`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  /** A site bridge's heartbeat for its card machines, and the jobs for them. */
  claimTerminalJobs: (data: {
    terminals: { terminal_id: string; online: boolean; error?: string | null }[];
  }) =>
    request<TerminalJob[]>("/payments/terminal-jobs/claim", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  /** A site bridge reports what the card machine did. */
  reportTerminalJob: (id: string, data: TerminalJobResult) =>
    request<{ status: string }>(`/payments/terminal-jobs/${id}/result`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  /** Dev/test: sales waiting at a simulated card machine. */
  listSimulatedSales: () => request<SimulatedSale[]>("/payments/simulator/sales"),
  /** Dev/test: what the card did at the simulated machine. */
  actOnSimulatedSale: (id: string, data: { outcome: SimulatedOutcome; approved_amount?: number }) =>
    request<{ outcome: string }>(`/payments/simulator/sales/${id}`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  /** Dev/test: plug a simulated machine in, or pull its cable. */
  powerSimulatedTerminal: (id: string, data: { on: boolean }) =>
    request<{ on: boolean }>(`/payments/simulator/terminals/${id}/power`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  createVirtualAccount: (data: CreateVirtualAccountRequest) =>
    request<CreateVirtualAccountResponse>("/payments/virtual-account", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  verifyPayment: (data: VerifyPaymentRequest) =>
    request<PaymentGatewayTransaction>("/payments/verify", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getPaymentStatus: (id: string) => request<PaymentStatusResponse>(`/payments/${id}/status`),
  getRazorpayStatus: () => request<RazorpayStatusResponse>("/payments/razorpay/status"),
  listPaymentProviders: () => request<PaymentProvidersResponse>("/payments/providers"),
  /** What this counter's online provider can do, and the hospital's fallback. */
  getPaymentCapabilities: (stationId?: string | null) =>
    request<CapabilitiesView>(
      `/payments/capabilities?${new URLSearchParams(stationId ? { station_id: stationId } : {})}`,
    ),
  /** Make a balance link (or send the live one again) for a patient's dues (#4871). */
  createPaymentLink: (data: CreateLinkRequest) =>
    request<PaymentLinkView>("/payments/links", { method: "POST", body: JSON.stringify(data) }),
  listPaymentLinks: (params: { patient_id?: string; invoice_id?: string }) =>
    request<PaymentLinkView[]>(
      `/payments/links?${new URLSearchParams(
        Object.entries(params).filter((e): e is [string, string] => Boolean(e[1])),
      )}`,
    ),
  getPaymentLink: (id: string) => request<PaymentLinkView>(`/payments/links/${id}`),
  resendPaymentLink: (id: string, data: ResendLinkRequest) =>
    request<PaymentLinkView>(`/payments/links/${id}/resend`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  cancelPaymentLink: (id: string) =>
    request<PaymentLinkView>(`/payments/links/${id}/cancel`, { method: "POST" }),
  getOnlineSettings: () => request<OnlineSettings>("/payments/online-settings"),
  updateOnlineSettings: (data: ChooseProviders) =>
    request<ChooseProviders>("/payments/online-settings", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  /** Write-only: a stored secret is never sent back. */
  setProviderKeys: (provider: string, data: SetKeys) =>
    request<ProviderSetup>(`/payments/online-settings/keys/${provider}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  setStationProvider: (id: string, data: StationChoice) =>
    request<StationChoice & { id: string }>(`/payments/online-settings/stations/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  testPaymentProvider: (provider: string) =>
    request<ProviderTestResult>(`/payments/online-settings/test/${provider}`, { method: "POST" }),
  getReconSummary: () => request<ReconSummary>("/payments/recon-summary"),
  listPaymentExceptions: (params?: { status?: string }) => {
    const qs = params?.status ? `?${new URLSearchParams({ status: params.status })}` : "";
    return request<PaymentWebhookException[]>(`/payments/exceptions${qs}`);
  },
  resolvePaymentException: (id: string, data: ResolveExceptionRequest) =>
    request<PaymentWebhookException>(`/payments/exceptions/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  listPaymentTerminals: (params?: { station_id?: string; active_only?: boolean }) => {
    const qs = params
      ? `?${new URLSearchParams(
          Object.entries(params)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => [k, String(v)]),
        )}`
      : "";
    return request<PaymentTerminal[]>(`/payments/terminals${qs}`);
  },
  createPaymentTerminal: (data: CreatePaymentTerminalRequest) =>
    request<PaymentTerminal>("/payments/terminals", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updatePaymentTerminal: (id: string, data: UpdatePaymentTerminalRequest) =>
    request<PaymentTerminal>(`/payments/terminals/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  /** Does the card machine answer? The answer is kept for the counter. */
  pingPaymentTerminal: (id: string) =>
    request<PaymentTerminal>(`/payments/terminals/${id}/ping`, { method: "POST" }),
  /** A replaced machine takes no more sales. */
  retirePaymentTerminal: (id: string) =>
    request<PaymentTerminal>(`/payments/terminals/${id}/retire`, { method: "POST" }),
  listTerminalProviders: () => request<TerminalProviders>("/payments/terminal-providers"),
  generateUpiQr: (data: GenerateUpiQrRequest) =>
    request<UpiQrResponse>("/payments/upi-qr", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  createUpiDeepLink: (data: UpiDeepLinkRequest) =>
    request<UpiDeepLinkResponse>("/payments/upi-deep-link", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  initiateRefund: (data: InitiateRefundRequest) =>
    request<RefundGatewayResponse>("/payments/refund", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};
