import {
  IconAlertTriangle,
  IconApps,
  IconBed,
  IconBuildingCommunity,
  IconCash,
  IconChartBar,
  IconClock,
  IconDashboard,
  IconForms,
  IconHash,
  IconHeartbeat,
  IconHeartRateMonitor,
  IconListCheck,
  IconMapPin,
  IconMedicalCross,
  IconPalette,
  IconPill,
  IconPlug,
  IconPrinter,
  IconRuler2,
  IconSettings,
  IconShield,
  IconShieldCheck,
  IconSitemap,
  IconStethoscope,
  IconUsers,
  IconWorld,
} from "@tabler/icons-react";
import type { ComponentType } from "react";
import { BedTypesSettings } from "../pages/admin/settings/BedTypesSettings";
import { BillingTaxSettings } from "../pages/admin/settings/BillingTaxSettings";
import { BrandingSettings } from "../pages/admin/settings/BrandingSettings";
import { ClinicalMastersSettings } from "../pages/admin/settings/ClinicalMastersSettings";
import { ClinicalProtocolsSettings } from "../pages/admin/settings/ClinicalProtocolsSettings";
import { ComplianceSettingsTab } from "../pages/admin/settings/ComplianceSettings";
import { ConsultationTemplatesSettings } from "../pages/admin/settings/ConsultationTemplatesSettings";
import { CriticalValueRulesSettings } from "../pages/admin/settings/CriticalValueRulesSettings";
import { DashboardList } from "../pages/admin/settings/DashboardList";
import { DepartmentHoursSettings } from "../pages/admin/settings/DepartmentHoursSettings";
import { DepartmentsSettings } from "../pages/admin/settings/DepartmentsSettings";
import { DeviceIntegrationsSettings } from "../pages/admin/settings/DeviceIntegrationsSettings";
import { DrugInteractionsSettings } from "../pages/admin/settings/DrugInteractionsSettings";
import { FacilitiesSettings } from "../pages/admin/settings/FacilitiesSettings";
import { FormsManagement } from "../pages/admin/settings/FormsManagement";
import { GeneralSettings } from "../pages/admin/settings/GeneralSettings";
import { GeoSettings } from "../pages/admin/settings/GeoSettings";
import { LocationsSettings } from "../pages/admin/settings/LocationsSettings";
import { LocationTreeSettings } from "../pages/admin/settings/LocationTreeSettings";
import { MasterDataStatusSettings } from "../pages/admin/settings/MasterDataStatusSettings";
import { ModulesSettings } from "../pages/admin/settings/ModulesSettings";
import { PrintTemplateSettings } from "../pages/admin/settings/PrintTemplateSettings";
import { RegulatoryManagement } from "../pages/admin/settings/RegulatoryManagement";
import { SequencesSettings } from "../pages/admin/settings/SequencesSettings";
import { ServicesSettings } from "../pages/admin/settings/ServicesSettings";
import { SetupWizardSettings } from "../pages/admin/settings/SetupWizardSettings";
import { SystemHealthSettings } from "../pages/admin/settings/SystemHealthSettings";
import { UnitsLocaleSettings } from "../pages/admin/settings/UnitsLocaleSettings";
import { UsersRolesSettings } from "../pages/admin/settings/UsersRolesSettings";

export interface SettingsTabConfig {
  value: string;
  /** i18n key in the "admin" namespace */
  i18nKey: string;
  /** Icon name string — resolved via SETTINGS_TAB_ICON_MAP */
  icon: string;
  requiredPermission?: string;
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
    value: "location-tree",
    i18nKey: "settings.locationTree",
    icon: "IconSitemap",
    requiredPermission: "admin.settings.locations.list",
    component: LocationTreeSettings,
  },
  {
    value: "departments",
    i18nKey: "settings.departments",
    icon: "IconSitemap",
    requiredPermission: "admin.settings.departments.list",
    component: DepartmentsSettings,
  },
  {
    value: "dept-hours",
    i18nKey: "settings.deptHours",
    icon: "IconClock",
    requiredPermission: "admin.settings.departments.list",
    component: DepartmentHoursSettings,
  },
  {
    value: "users",
    i18nKey: "settings.users",
    icon: "IconUsers",
    requiredPermission: "admin.users.list",
    component: UsersRolesSettings,
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
    value: "print-templates",
    i18nKey: "settings.printTemplates",
    icon: "IconPrinter",
    requiredPermission: "admin.settings.branding.manage",
    component: PrintTemplateSettings,
  },
  {
    value: "regulatory",
    i18nKey: "settings.regulatory",
    icon: "IconShield",
    requiredPermission: "admin.settings.regulatory.manage",
    component: RegulatoryManagement,
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
    requiredPermission: "admin.settings.general.manage",
    component: DrugInteractionsSettings,
  },
  {
    value: "critical-values",
    i18nKey: "settings.criticalValues",
    icon: "IconShieldCheck",
    requiredPermission: "admin.settings.general.manage",
    component: CriticalValueRulesSettings,
  },
  {
    value: "clinical-protocols",
    i18nKey: "settings.clinicalProtocols",
    icon: "IconHeartbeat",
    requiredPermission: "admin.settings.general.manage",
    component: ClinicalProtocolsSettings,
  },
  {
    value: "forms",
    i18nKey: "settings.forms",
    icon: "IconForms",
    requiredPermission: "admin.settings.forms.manage",
    component: FormsManagement,
  },
  {
    value: "consultation-templates",
    i18nKey: "settings.consultationTemplates",
    icon: "IconStethoscope",
    requiredPermission: "opd.visit.create",
    component: ConsultationTemplatesSettings,
  },
  {
    value: "dashboards",
    i18nKey: "settings.dashboards",
    icon: "IconDashboard",
    requiredPermission: "admin.dashboard_builder.list",
    component: DashboardList,
  },
  {
    value: "setup-wizard",
    i18nKey: "settings.setupWizard",
    icon: "IconListCheck",
    requiredPermission: "admin.settings.general.manage",
    component: SetupWizardSettings,
  },
  {
    value: "master-data",
    i18nKey: "settings.masterData",
    icon: "IconChartBar",
    requiredPermission: "admin.settings.general.manage",
    component: MasterDataStatusSettings,
  },
  {
    value: "system-health",
    i18nKey: "settings.systemHealth",
    icon: "IconHeartRateMonitor",
    requiredPermission: "admin.settings.general.manage",
    component: SystemHealthSettings,
  },
];

export const SETTINGS_TAB_ICON_MAP: Record<string, ComponentType<{ size?: number }>> = {
  IconSettings,
  IconWorld,
  IconRuler2,
  IconBuildingCommunity,
  IconMapPin,
  IconSitemap,
  IconUsers,
  IconApps,
  IconHash,
  IconMedicalCross,
  IconHeartbeat,
  IconBed,
  IconCash,
  IconPalette,
  IconPlug,
  IconPrinter,
  IconShield,
  IconShieldCheck,
  IconPill,
  IconAlertTriangle,
  IconStethoscope,
  IconForms,
  IconDashboard,
  IconClock,
  IconListCheck,
  IconChartBar,
  IconHeartRateMonitor,
};
