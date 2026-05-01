/**
 * Adapter contract for mDNS edge-node discovery. Backed by
 * `react-native-zeroconf` (or a custom Expo module) in production;
 * tests inject a stub.
 *
 * The shell only depends on this interface — the concrete
 * implementation is wired by the staff-app template, which has the
 * config-plugin entry that pulls in zeroconf.
 */

export interface DiscoveredEdge {
  hostname: string;
  ipv4: string;
  port: number;
  tenantHint: string | null;
  txtRecord: Readonly<Record<string, string>>;
}

export type DiscoverySubscription = () => void;

export interface MdnsDiscovery {
  start(serviceType: string): Promise<void>;
  stop(): Promise<void>;
  onResolved(handler: (edge: DiscoveredEdge) => void): DiscoverySubscription;
  onLost(handler: (hostname: string) => void): DiscoverySubscription;
}

let registered: MdnsDiscovery | null = null;

export function registerMdnsDiscovery(impl: MdnsDiscovery | null): void {
  registered = impl;
}

export function getMdnsDiscovery(): MdnsDiscovery {
  if (!registered) {
    throw new Error(
      "MdnsDiscovery not registered — call registerMdnsDiscovery in app bootstrap.",
    );
  }
  return registered;
}
