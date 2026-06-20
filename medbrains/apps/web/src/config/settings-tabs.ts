import {
  IconAlertTriangle,
  IconApps,
  IconBed,
  IconBuildingCommunity,
  IconCash,
  IconChartBar,
  IconClockCog,
  IconCloudOff,
  IconCreditCard,
  IconHash,
  IconHeartbeat,
  IconHeartRateMonitor,
  IconMapPin,
  IconMedicalCross,
  IconPalette,
  IconPill,
  IconPlug,
  IconPrinter,
  IconRuler2,
  IconSettings,
  IconShieldCheck,
  IconShieldLock,
  IconSitemap,
  IconStethoscope,
  IconTableOptions,
  IconWorld,
} from "@tabler/icons-react";
import type { ComponentType } from "react";
import { AccessMatrixSettings } from "@/pages/admin/settings/AccessMatrixSettings";
import { BedTypesSettings } from "@/pages/admin/settings/BedTypesSettings";
import { BillingTaxSettings } from "@/pages/admin/settings/BillingTaxSettings";
import { BrandingSettings } from "@/pages/admin/settings/BrandingSettings";
import { ClinicalConfigSettings } from "@/pages/admin/settings/ClinicalConfigSettings";
import { ClinicalMastersSettings } from "@/pages/admin/settings/ClinicalMastersSettings";
import { ClinicalProtocolsSettings } from "@/pages/admin/settings/ClinicalProtocolsSettings";
import { ComplianceSettingsTab } from "@/pages/admin/settings/ComplianceSettings";
import { ConsultationTemplatesSettings } from "@/pages/admin/settings/ConsultationTemplatesSettings";
import { CriticalValueRulesSettings } from "@/pages/admin/settings/CriticalValueRulesSettings";
import { DepartmentsSettings } from "@/pages/admin/settings/DepartmentsSettings";
import { DeviceIntegrationsSettings } from "@/pages/admin/settings/DeviceIntegrationsSettings";
import { DrugInteractionsSettings } from "@/pages/admin/settings/DrugInteractionsSettings";
import { FacilitiesSettings } from "@/pages/admin/settings/FacilitiesSettings";
import { GeneralSettings } from "@/pages/admin/settings/GeneralSettings";
import { GeoSettings } from "@/pages/admin/settings/GeoSettings";
import { LocationsSettings } from "@/pages/admin/settings/LocationsSettings";
import { MasterDataStatusSettings } from "@/pages/admin/settings/MasterDataStatusSettings";
import { ModulesSettings } from "@/pages/admin/settings/ModulesSettings";
import { OfflineModeSettings } from "@/pages/admin/settings/OfflineModeSettings";
import { OperationsSettings } from "@/pages/admin/settings/OperationsSettings";
import { PaymentTerminalsSettings } from "@/pages/admin/settings/PaymentTerminalsSettings";
import { PrintTemplateSettings } from "@/pages/admin/settings/PrintTemplateSettings";
import { SequencesSettings } from "@/pages/admin/settings/SequencesSettings";
import { ServicesSettings } from "@/pages/admin/settings/ServicesSettings";
import { StandardsSettings } from "@/pages/admin/settings/StandardsSettings";
import { SystemHealthSettings } from "@/pages/admin/settings/SystemHealthSettings";
import { TokensSettings } from "@/pages/admin/settings/TokensSettings";
import { UnitsLocaleSettings } from "@/pages/admin/settings/UnitsLocaleSettings";

export interface SettingsTabConfig {
  value: string;
  /** i18n key in the "admin" namespace */
  i18nKey: string;
  /** Icon name string — resolved via SETTINGS_TAB_ICON_MAP */
  icon: string;
  requiredPermission?: string;
  requiredPermissions?: readonly string[];
  component: ComponentType;
}

export const SETTINGS_TABS: SettingsTabConfig[] = [
  {
    value: "general",
    i18nKey: "settings.general",
    icon: "IconSettings",
    requiredPermission: "admin.settings.general.manage",
    component: GeneralSettings,
  },
  {
    value: "operations",
    i18nKey: "settings.operations",
    icon: "IconClockCog",
    requiredPermission: "admin.settings.general.manage",
    component: OperationsSettings,
  },
  {
    value: "tokens",
    i18nKey: "settings.tokens",
    icon: "IconLayoutGrid",
    requiredPermission: "admin.settings.general.manage",
    component: TokensSettings,
  },
  {
    value: "master-data",
    i18nKey: "settings.masterData",
    icon: "IconChartBar",
    requiredPermissions: [
      "admin.settings.general.manage",
      "admin.settings.facilities.list",
      "admin.settings.locations.list",
      "admin.settings.departments.list",
      "admin.doctors.list",
      "admin.users.list",
      "admin.settings.modules.manage",
      "admin.settings.sequences.manage",
      "admin.settings.services.list",
      "admin.settings.clinical_masters.list",
      "admin.settings.bed_types.manage",
      "admin.settings.billing_tax.manage",
      "admin.settings.branding.manage",
      "admin.roles.list",
      "communications.config.manage",
      "assets.list",
      "billing.corporate.list",
      "billing.invoices.list",
      "billing.journal.list",
      "consent.templates.list",
      "diet.templates.list",
      "documents.templates.list",
      "indent.list",
      "ipd.admissions.list",
      "ipd.bed_dashboard.view",
      "ipd.discharge_summary.create",
      "ipd.discharge_summary.finalize",
      "ipd.tariffs.list",
      "ipd.tariffs.manage",
      "ipd.wards.manage",
      "lab.orders.list",
      "lab.reports.view",
      "mrd.records.list",
      "opd.procedures.list",
      "opd.queue.view",
      "opd.visit.create",
      "opd.visit.update",
      "order_sets.templates.list",
      "ot.rooms.list",
      "pharmacy.prescriptions.list",
      "pharmacy.stores.list",
      "pharmacy.stores.manage",
      "procurement.rc.list",
      "procurement.stores.list",
      "procurement.stores.manage",
      "procurement.vendors.list",
      "specialty.other.templates.list",
    ],
    component: MasterDataStatusSettings,
  },
  {
    value: "access-matrix",
    i18nKey: "settings.accessMatrix",
    icon: "IconShieldLock",
    requiredPermissions: ["admin.roles.list", "admin.users.list"],
    component: AccessMatrixSettings,
  },
  {
    value: "geo",
    i18nKey: "settings.geo",
    icon: "IconWorld",
    requiredPermission: "admin.settings.general.manage",
    component: GeoSettings,
  },
  {
    value: "units",
    i18nKey: "settings.units",
    icon: "IconRuler2",
    requiredPermission: "admin.settings.general.manage",
    component: UnitsLocaleSettings,
  },
  {
    value: "facilities",
    i18nKey: "settings.facilities",
    icon: "IconBuildingCommunity",
    requiredPermission: "admin.settings.facilities.list",
    component: FacilitiesSettings,
  },
  {
    value: "locations",
    i18nKey: "settings.locations",
    icon: "IconMapPin",
    requiredPermission: "admin.settings.locations.list",
    component: LocationsSettings,
  },
  {
    value: "departments",
    i18nKey: "settings.departments",
    icon: "IconSitemap",
    requiredPermission: "admin.settings.departments.list",
    component: DepartmentsSettings,
  },
  {
    value: "modules",
    i18nKey: "settings.modules",
    icon: "IconApps",
    requiredPermission: "admin.settings.modules.manage",
    component: ModulesSettings,
  },
  {
    value: "sequences",
    i18nKey: "settings.sequences",
    icon: "IconHash",
    requiredPermission: "admin.settings.sequences.manage",
    component: SequencesSettings,
  },
  {
    value: "services",
    i18nKey: "settings.services",
    icon: "IconMedicalCross",
    requiredPermission: "admin.settings.services.list",
    component: ServicesSettings,
  },
  {
    value: "clinical-masters",
    i18nKey: "settings.clinicalMasters",
    icon: "IconHeartbeat",
    requiredPermission: "admin.settings.clinical_masters.list",
    component: ClinicalMastersSettings,
  },
  {
    value: "bed-types",
    i18nKey: "settings.bedTypes",
    icon: "IconBed",
    requiredPermission: "admin.settings.bed_types.manage",
    component: BedTypesSettings,
  },
  {
    value: "billing",
    i18nKey: "settings.billing",
    icon: "IconCash",
    requiredPermission: "admin.settings.billing_tax.manage",
    component: BillingTaxSettings,
  },
  {
    value: "payment-terminals",
    i18nKey: "settings.paymentTerminals",
    icon: "IconCreditCard",
    requiredPermission: "billing.payments.create",
    component: PaymentTerminalsSettings,
  },
  {
    value: "branding",
    i18nKey: "settings.branding",
    icon: "IconPalette",
    requiredPermission: "admin.settings.branding.manage",
    component: BrandingSettings,
  },
  {
    value: "device-integrations",
    i18nKey: "settings.deviceIntegrations",
    icon: "IconPlug",
    requiredPermission: "integration.view",
    component: DeviceIntegrationsSettings,
  },
  {
    value: "standards",
    i18nKey: "settings.standards",
    icon: "IconTableOptions",
    requiredPermission: "admin.settings.general.manage",
    component: StandardsSettings,
  },
  {
    value: "print-templates",
    i18nKey: "settings.printTemplates",
    icon: "IconPrinter",
    requiredPermission: "admin.settings.branding.manage",
    component: PrintTemplateSettings,
  },
  {
    value: "compliance",
    i18nKey: "settings.compliance",
    icon: "IconPill",
    requiredPermission: "admin.settings.regulatory.manage",
    component: ComplianceSettingsTab,
  },
  {
    value: "drug-interactions",
    i18nKey: "settings.drugInteractions",
    icon: "IconAlertTriangle",
    requiredPermissions: ["admin.settings.general.manage", "opd.queue.view"],
    component: DrugInteractionsSettings,
  },
  {
    value: "critical-values",
    i18nKey: "settings.criticalValues",
    icon: "IconShieldCheck",
    requiredPermissions: ["admin.settings.general.manage", "opd.queue.view"],
    component: CriticalValueRulesSettings,
  },
  {
    value: "clinical-protocols",
    i18nKey: "settings.clinicalProtocols",
    icon: "IconHeartbeat",
    requiredPermissions: ["admin.settings.general.manage", "opd.queue.view"],
    component: ClinicalProtocolsSettings,
  },
  {
    value: "consultation-templates",
    i18nKey: "settings.consultationTemplates",
    icon: "IconStethoscope",
    requiredPermissions: ["opd.queue.view", "opd.visit.create", "opd.visit.update"],
    component: ConsultationTemplatesSettings,
  },
  {
    value: "clinical-config",
    i18nKey: "settings.clinicalConfiguration",
    icon: "IconStethoscope",
    requiredPermission: "admin.settings.general.manage",
    component: ClinicalConfigSettings,
  },
  {
    value: "system-health",
    i18nKey: "settings.systemHealth",
    icon: "IconHeartRateMonitor",
    requiredPermission: "admin.settings.general.manage",
    component: SystemHealthSettings,
  },
  {
    value: "offline-mode",
    i18nKey: "settings.offlineMode",
    icon: "IconCloudOff",
    requiredPermission: "admin.settings.general.manage",
    component: OfflineModeSettings,
  },
];

export const SETTINGS_TAB_ICON_MAP: Record<string, ComponentType<{ size?: number }>> = {
  IconClockCog,
  IconSettings,
  IconWorld,
  IconRuler2,
  IconBuildingCommunity,
  IconMapPin,
  IconSitemap,
  IconTableOptions,
  IconApps,
  IconHash,
  IconMedicalCross,
  IconHeartbeat,
  IconBed,
  IconCash,
  IconCreditCard,
  IconPalette,
  IconPlug,
  IconPrinter,
  IconShieldCheck,
  IconShieldLock,
  IconPill,
  IconAlertTriangle,
  IconStethoscope,
  IconChartBar,
  IconHeartRateMonitor,
  IconCloudOff,
};
