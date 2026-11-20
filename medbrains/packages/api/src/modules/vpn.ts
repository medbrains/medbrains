/** The `/vpn` API area. Moved from `client.ts`; one module per first path segment. */
import { request } from "../client.js";

export const vpnApi = {
  // VPN platform — device enrollment (RFC-VPN-PLATFORM).
  enrollVpn: (deviceName: string) =>
    request<{ device_id: string; login_server: string; auth_key: string; expires_at: string }>(
      "/vpn/enroll",
      { method: "POST", body: JSON.stringify({ device_name: deviceName }) },
    ),
  getVpnStatus: () =>
    request<
      {
        id: string;
        name: string;
        created_at: string;
        last_seen_at: string | null;
        revoked_at: string | null;
      }[]
    >("/vpn/status"),
  revokeVpnDevice: (id: string) =>
    request<{ status: string }>(`/vpn/devices/${id}/revoke`, { method: "POST" }),
};
