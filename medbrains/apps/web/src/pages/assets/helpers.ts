// Assets pure helpers/defaults — split from assets.tsx (pure move).

import type { AssetCategoryFormInput, StoreCategoryFormInput } from "@medbrains/schemas";
import { assetDomainValues, storeDomainValues } from "@medbrains/schemas";
import type { AssetCategory, StoreCategory } from "@medbrains/types";

export function domainLabel(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formNumber(value: unknown) {
  if (typeof value === "number") return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function nullableTrimmed(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function validAssetDomain(value: string): AssetCategoryFormInput["asset_domain"] {
  return assetDomainValues.find((domain) => domain === value) ?? "general";
}

export function validStoreDomain(value: string): StoreCategoryFormInput["store_domain"] {
  return storeDomainValues.find((domain) => domain === value) ?? "general";
}

export const assetDomainOptions = assetDomainValues.map((value) => ({
  value,
  label: domainLabel(value),
}));

export const storeDomainOptions = storeDomainValues.map((value) => ({
  value,
  label: domainLabel(value),
}));

export const assetCategoryDefaults: AssetCategoryFormInput = {
  code: "",
  name: "",
  parent_id: "",
  asset_domain: "general",
  description: "",
  regulatory_class: "",
  default_pm_frequency: "",
  default_calibration_frequency: "",
  requires_pm: false,
  requires_calibration: false,
  is_camp_eligible: false,
  is_active: true,
  sort_order: 0,
};

export const storeCategoryDefaults: StoreCategoryFormInput = {
  code: "",
  name: "",
  parent_id: "",
  store_domain: "general",
  description: "",
  requires_batch_tracking: false,
  requires_expiry_tracking: false,
  requires_temperature_log: false,
  requires_license_tracking: false,
  is_camp_source: false,
  is_active: true,
  sort_order: 0,
};

export function assetCategoryToForm(category: AssetCategory): AssetCategoryFormInput {
  return {
    code: category.code,
    name: category.name,
    parent_id: category.parent_id ?? "",
    asset_domain: validAssetDomain(category.asset_domain),
    description: category.description ?? "",
    regulatory_class: category.regulatory_class ?? "",
    default_pm_frequency: category.default_pm_frequency ?? "",
    default_calibration_frequency: category.default_calibration_frequency ?? "",
    requires_pm: category.requires_pm,
    requires_calibration: category.requires_calibration,
    is_camp_eligible: category.is_camp_eligible,
    is_active: category.is_active,
    sort_order: category.sort_order,
  };
}

export function storeCategoryToForm(category: StoreCategory): StoreCategoryFormInput {
  return {
    code: category.code,
    name: category.name,
    parent_id: category.parent_id ?? "",
    store_domain: validStoreDomain(category.store_domain),
    description: category.description ?? "",
    requires_batch_tracking: category.requires_batch_tracking,
    requires_expiry_tracking: category.requires_expiry_tracking,
    requires_temperature_log: category.requires_temperature_log,
    requires_license_tracking: category.requires_license_tracking,
    is_camp_source: category.is_camp_source,
    is_active: category.is_active,
    sort_order: category.sort_order,
  };
}
