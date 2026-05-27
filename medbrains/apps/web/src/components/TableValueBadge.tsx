import { Badge, ThemeIcon } from "@mantine/core";
import {
  IconAlertTriangle,
  IconAmbulance,
  IconArrowRight,
  IconArrowsExchange,
  IconBarcode,
  IconBed,
  IconBuildingStore,
  IconCalendarEvent,
  IconCash,
  IconCircleCheck,
  IconCircleX,
  IconClipboardList,
  IconClock,
  IconDeviceMobile,
  IconFlag,
  IconGauge,
  IconMapPin,
  IconPackage,
  IconPackageImport,
  IconPill,
  IconProgress,
  IconRefresh,
  IconShieldCheck,
  IconStarFilled,
  IconTemperature,
  IconTool,
  IconTruck,
  IconUser,
  IconUserCheck,
  IconUsers,
} from "@tabler/icons-react";
import type { ComponentType } from "react";

type ValueIcon = ComponentType<{ className?: string; size?: number; stroke?: number }>;

export type TableValueKind =
  | "asset"
  | "billing"
  | "category"
  | "pharmacy"
  | "priority"
  | "source"
  | "status"
  | "stock"
  | "store"
  | "visit";

interface TableValueBadgeProps {
  value: string | null | undefined;
  kind?: TableValueKind;
  label?: string;
  color?: string;
  variant?: "dot" | "filled" | "gradient" | "light" | "outline" | "transparent" | "white";
  size?: "xs" | "sm" | "md" | "lg" | "xl";
}

const statusIcons: Record<string, ValueIcon> = {
  active: IconCircleCheck,
  admitted: IconBed,
  approved: IconCircleCheck,
  available: IconCircleCheck,
  called: IconArrowRight,
  cancelled: IconCircleX,
  closed: IconCircleCheck,
  completed: IconCircleCheck,
  confirmed: IconCircleCheck,
  current: IconCircleCheck,
  discharged: IconCircleCheck,
  draft: IconClock,
  expired: IconCircleX,
  failed: IconAlertTriangle,
  inactive: IconCircleX,
  in_consultation: IconProgress,
  in_progress: IconProgress,
  issued: IconArrowRight,
  no_show: IconCircleX,
  open: IconClock,
  ordered: IconClock,
  paid: IconCircleCheck,
  partial: IconProgress,
  partially_paid: IconAlertTriangle,
  pending: IconClock,
  planned: IconCalendarEvent,
  processing: IconProgress,
  ready: IconCircleCheck,
  received: IconPackageImport,
  rejected: IconCircleX,
  reserved: IconCalendarEvent,
  revoked: IconCircleX,
  scheduled: IconCalendarEvent,
  triaged: IconCircleCheck,
  verified: IconCircleCheck,
  waiting: IconClock,
};

const categoryIcons: Record<string, ValueIcon> = {
  cghs: IconShieldCheck,
  charity: IconUserCheck,
  corporate: IconBuildingStore,
  emergency: IconAmbulance,
  esi: IconShieldCheck,
  free: IconCash,
  general: IconUser,
  insurance: IconShieldCheck,
  mlc: IconAlertTriangle,
  pmjay: IconShieldCheck,
  private: IconUser,
  research_subject: IconUsers,
  staff: IconUserCheck,
  staff_dependent: IconUsers,
  vip: IconStarFilled,
};

const priorityIcons: Record<string, ValueIcon> = {
  critical: IconAlertTriangle,
  emergency: IconAmbulance,
  high: IconAlertTriangle,
  low: IconFlag,
  normal: IconFlag,
  routine: IconFlag,
  stat: IconAlertTriangle,
  urgent: IconAlertTriangle,
};

const visitIcons: Record<string, ValueIcon> = {
  booked: IconCalendarEvent,
  camp: IconMapPin,
  emergency: IconAmbulance,
  follow_up: IconRefresh,
  referral: IconArrowRight,
  revisit: IconRefresh,
  telemedicine: IconDeviceMobile,
  transfer: IconArrowRight,
  walk_in: IconUser,
};

const stockIcons: Record<string, ValueIcon> = {
  adjustment: IconTool,
  batch: IconBarcode,
  biomedical_spares: IconTool,
  biomedical_waste: IconAlertTriangle,
  blood_bank: IconShieldCheck,
  borrow: IconArrowsExchange,
  calibration: IconGauge,
  camp_mobile: IconMapPin,
  camp_source: IconMapPin,
  cssd_sterile: IconShieldCheck,
  expiry: IconCalendarEvent,
  general: IconPackage,
  grn: IconPackageImport,
  housekeeping: IconPackage,
  indent: IconClipboardList,
  issue: IconArrowRight,
  it_store: IconDeviceMobile,
  kitchen_dietary: IconPackage,
  lab_reagents: IconPackage,
  license: IconShieldCheck,
  linen_laundry: IconPackage,
  low_stock: IconAlertTriangle,
  maintenance_engineering: IconTool,
  medical_consumables: IconPackage,
  ndps_controlled: IconAlertTriangle,
  pharmacy: IconPill,
  ppe_infection_control: IconShieldCheck,
  purchase: IconTruck,
  radiology_contrast: IconPackage,
  receipt: IconPackageImport,
  received: IconPackageImport,
  return: IconArrowsExchange,
  stationery_forms: IconClipboardList,
  stock: IconPackage,
  store: IconBuildingStore,
  surgical_consumables: IconTool,
  temperature: IconTemperature,
  transfer: IconArrowsExchange,
};

const assetIcons: Record<string, ValueIcon> = {
  available: IconCircleCheck,
  biomedical: IconTool,
  calibration: IconGauge,
  camp: IconMapPin,
  camp_mobile: IconMapPin,
  critical: IconAlertTriangle,
  dental_ent_ophthalmology: IconTool,
  diagnostic_monitoring: IconGauge,
  facility_utility: IconTool,
  fire_safety: IconAlertTriangle,
  furniture_fixture: IconPackage,
  general: IconPackage,
  housekeeping_laundry: IconPackage,
  imaging: IconPackage,
  it_device: IconDeviceMobile,
  kitchen_dietary: IconPackage,
  lab: IconPackage,
  maintenance: IconTool,
  mobility_transport: IconTruck,
  ot_cssd: IconTool,
  pm: IconCalendarEvent,
  ready: IconCircleCheck,
  reserved: IconCalendarEvent,
  security_surveillance: IconShieldCheck,
  teaching_simulation: IconUsers,
  therapeutic_life_support: IconBed,
};

const billingIcons: Record<string, ValueIcon> = {
  auto: IconRefresh,
  cloned: IconRefresh,
  concession: IconCash,
  cost: IconCash,
  corporate: IconBuildingStore,
  credit: IconClock,
  due: IconAlertTriangle,
  invoice: IconCash,
  interim: IconClock,
  paid: IconCircleCheck,
  payment: IconCash,
  partial: IconAlertTriangle,
  pending: IconClock,
  refund: IconArrowsExchange,
  tpa: IconShieldCheck,
};

const pharmacyIcons: Record<string, ValueIcon> = {
  antibiotic: IconPill,
  aware: IconShieldCheck,
  batch: IconBarcode,
  controlled: IconAlertTriangle,
  dispensing: IconPill,
  expiry: IconCalendarEvent,
  lasa: IconAlertTriangle,
  ndps: IconAlertTriangle,
  otc: IconCircleCheck,
  prescription: IconPill,
  schedule_g: IconShieldCheck,
  schedule_h: IconShieldCheck,
  schedule_h1: IconAlertTriangle,
  schedule_x: IconAlertTriangle,
};

const kindIconMaps: Record<TableValueKind, Record<string, ValueIcon>> = {
  asset: assetIcons,
  billing: billingIcons,
  category: categoryIcons,
  pharmacy: pharmacyIcons,
  priority: priorityIcons,
  source: visitIcons,
  status: statusIcons,
  stock: stockIcons,
  store: stockIcons,
  visit: visitIcons,
};

export function normalizeTableValue(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function labelTableValue(value: string | null | undefined): string {
  const text = value?.trim();
  if (!text) return "-";
  return text
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .replace(/\bMlc\b/g, "MLC")
    .replace(/\bNdps\b/g, "NDPS")
    .replace(/\bOpd\b/g, "OPD")
    .replace(/\bIpd\b/g, "IPD")
    .replace(/\bEr\b/g, "ER")
    .replace(/\bGrn\b/g, "GRN")
    .replace(/\bPo\b/g, "PO")
    .replace(/\bTpa\b/g, "TPA")
    .replace(/\bPm\b/g, "PM");
}

export function tableValueIcon(
  value: string | null | undefined,
  kind: TableValueKind = "status",
): ValueIcon | undefined {
  const key = normalizeTableValue(value);
  const kindMap = kindIconMaps[kind];
  return kindMap[key] ?? statusIcons[key] ?? categoryIcons[key] ?? priorityIcons[key];
}

export function TableValueBadge({
  value,
  kind = "status",
  label,
  color = "slate",
  variant = "light",
  size = "sm",
}: TableValueBadgeProps) {
  const Icon = tableValueIcon(value, kind);
  const iconSize = size === "xs" ? 10 : size === "sm" ? 12 : 14;
  const iconBoxSize = size === "xs" ? 14 : size === "sm" ? 16 : 18;

  return (
    <Badge
      color={color}
      variant={variant}
      size={size}
      leftSection={
        Icon ? (
          <ThemeIcon color={color} variant="light" size={iconBoxSize} radius="xl">
            <Icon size={iconSize} stroke={2.4} />
          </ThemeIcon>
        ) : undefined
      }
    >
      {label ?? labelTableValue(value)}
    </Badge>
  );
}
