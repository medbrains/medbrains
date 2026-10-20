import { useQuery } from "@tanstack/react-query";
import { paymentsService } from "@/services/payments.service";

/**
 * What this counter's online provider can do (checkout, dynamic UPI QR,
 * payment links…) and the hospital's fallback — so a screen offers only
 * that. The counter's own provider wins over the hospital's (#4884).
 */
export function usePaymentCapabilities(stationId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["payment-capabilities", stationId],
    queryFn: () => paymentsService.getPaymentCapabilities(stationId),
    enabled,
    staleTime: 300_000,
  });
}
