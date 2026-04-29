/**
 * TenantConfigProvider — single source of truth for tenant-scoped
 * runtime config that the CRDT data hooks need.
 *
 * Reads:
 *  - the authenticated user (tenant_id, full_name) from the auth store
 *  - tenant_settings.clinical.offline_mode (boolean)
 *  - tenant_settings.clinical.edge_url (string, e.g.
 *    "ws://medbrains-edge.local:7811")
 *  - a device_id persisted in localStorage (generated once per browser
 *    install; survives reloads)
 *
 * Provides:
 *  - `mode` ("rest" | "crdt") derived from offline_mode AND
 *    presence of edge_url. If offline_mode is on but edge_url is
 *    missing we fall back to "rest" with a console warning rather
 *    than crashing.
 *  - `edgeUrl`, `tenantId`, `deviceId`, `authorName` — passed to
 *    `useAppendOnlyCrdtList` / `useCrdtText` when mode === "crdt".
 *
 * Why a context (vs a hook reading the auth store directly): the
 * tenant-settings query needs to live at one stable mount point so
 * we don't refetch it on every page render, and the device_id init
 * must happen exactly once per app lifetime.
 */

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import { useAuthStore } from "@medbrains/stores";
import type { TenantSettingsRow } from "@medbrains/types";

const DEVICE_ID_KEY = "medbrains-crdt-device-id";

export interface TenantConfig {
  /** "rest" = cloud REST flow; "crdt" = on-prem edge sync */
  mode: "rest" | "crdt";
  edgeUrl: string;
  tenantId: string;
  deviceId: string;
  authorName: string;
}

const TenantConfigContext = createContext<TenantConfig | null>(null);

function readOrCreateDeviceId(): string {
  if (typeof localStorage === "undefined") {
    return "ssr-placeholder";
  }
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

function valueAsBoolean(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return v === "true" || v === "1";
  return false;
}

function valueAsString(v: unknown): string {
  if (typeof v === "string") return v;
  return "";
}

interface TenantConfigProviderProps {
  children: ReactNode;
  /** Override edge URL for tests / dev. */
  edgeUrlOverride?: string;
  /** Force mode for tests. */
  modeOverride?: "rest" | "crdt";
}

export function TenantConfigProvider({
  children,
  edgeUrlOverride,
  modeOverride,
}: TenantConfigProviderProps) {
  const user = useAuthStore((s) => s.user);
  const deviceId = useMemo(readOrCreateDeviceId, []);

  const { data: clinicalSettings } = useQuery<TenantSettingsRow[]>({
    queryKey: ["tenant-settings", "clinical"],
    queryFn: () => api.getTenantSettings("clinical"),
    staleTime: 5 * 60 * 1000,
    enabled: !!user,
  });

  const value = useMemo<TenantConfig | null>(() => {
    if (!user) return null;

    const offlineRow = clinicalSettings?.find((s) => s.key === "offline_mode");
    const edgeUrlRow = clinicalSettings?.find((s) => s.key === "edge_url");

    const offlineMode = valueAsBoolean(offlineRow?.value);
    const edgeUrl = edgeUrlOverride ?? valueAsString(edgeUrlRow?.value);

    let mode: "rest" | "crdt";
    if (modeOverride) {
      mode = modeOverride;
    } else if (offlineMode && edgeUrl) {
      mode = "crdt";
    } else {
      if (offlineMode && !edgeUrl) {
        // eslint-disable-next-line no-console
        console.warn(
          "[TenantConfigProvider] tenant.offline_mode=true but tenant_settings.clinical.edge_url is missing; falling back to REST",
        );
      }
      mode = "rest";
    }

    return {
      mode,
      edgeUrl,
      tenantId: user.tenant_id,
      deviceId,
      authorName: user.full_name,
    };
  }, [user, clinicalSettings, deviceId, edgeUrlOverride, modeOverride]);

  return (
    <TenantConfigContext.Provider value={value}>
      {children}
    </TenantConfigContext.Provider>
  );
}

/**
 * Consume the tenant config. Throws if rendered outside the provider —
 * the provider mounts at the app root, so any consumer below
 * AppLayout is safe.
 */
export function useTenantConfig(): TenantConfig {
  const ctx = useContext(TenantConfigContext);
  if (!ctx) {
    throw new Error(
      "useTenantConfig() called outside <TenantConfigProvider>; mount the provider above your routes",
    );
  }
  return ctx;
}

/**
 * Optional consumer that returns null when the provider hasn't loaded
 * yet (e.g. before login). Use this in code paths that may render
 * before the auth store is populated.
 */
export function useTenantConfigOptional(): TenantConfig | null {
  return useContext(TenantConfigContext);
}
