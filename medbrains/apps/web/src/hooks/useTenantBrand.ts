import { api } from "@medbrains/api";
import type { PublicTenant } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";

/**
 * The deployment's primary tenant brand (hospital name + logo), resolved once
 * from the public `tenant-by-host` endpoint — env-bindable via
 * `MEDBRAINS_TENANT_*`, no auth required, shared cache. Returns `null` for the
 * bare MedBrains default (no host/env match). Single source of truth: render
 * brand UI from this, don't re-query or re-check tenant identity inline.
 */
export function useTenantBrand(): PublicTenant | null {
  const { data } = useQuery({
    queryKey: ["tenant-by-host"],
    queryFn: () => api.getTenantByHost(window.location.hostname),
    retry: false,
    staleTime: 300_000,
  });
  return data ?? null;
}
