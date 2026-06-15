import { zodResolver } from "@hookform/resolvers/zod";
import {
  ActionIcon,
  Card,
  Drawer,
  Group,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import type { AssetCategoryFormInput, StoreCategoryFormInput } from "@medbrains/schemas";
import {
  assetCategoryFormSchema,
  assetDomainValues,
  storeCategoryFormSchema,
  storeDomainValues,
} from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type { AssetCategory, StoreCategory, UnifiedAsset } from "@medbrains/types";
import { P } from "@medbrains/types";
import {
  IconBuildingWarehouse,
  IconEdit,
  IconPackage,
  IconPlus,
  IconSearch,
  IconShieldCheck,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useSearchParams } from "react-router";
import {
  DataTable,
  IpdContextStrip,
  ipdContextFromSearchParams,
  PageHeader,
  TableValueBadge,
} from "@/components";
import type { Column } from "@/components/DataTable";
import { Button } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { assetsService } from "@/services/assets.service";

const assetDomainOptions = assetDomainValues.map((value) => ({
  value,
  label: domainLabel(value),
}));

const storeDomainOptions = storeDomainValues.map((value) => ({
  value,
  label: domainLabel(value),
}));

const assetCategoryDefaults: AssetCategoryFormInput = {
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

const storeCategoryDefaults: StoreCategoryFormInput = {
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

function domainLabel(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formNumber(value: unknown) {
  if (typeof value === "number") return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function nullableTrimmed(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function validAssetDomain(value: string): AssetCategoryFormInput["asset_domain"] {
  return assetDomainValues.find((domain) => domain === value) ?? "general";
}

function validStoreDomain(value: string): StoreCategoryFormInput["store_domain"] {
  return storeDomainValues.find((domain) => domain === value) ?? "general";
}

function assetCategoryToForm(category: AssetCategory): AssetCategoryFormInput {
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

function storeCategoryToForm(category: StoreCategory): StoreCategoryFormInput {
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

export function AssetsPage() {
  useRequirePermission(P.ASSETS.LIST);
  const canManage = useHasPermission(P.ASSETS.MANAGE);
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const ipdContext = ipdContextFromSearchParams(searchParams);
  const [search, setSearch] = useState("");
  const [assetDomain, setAssetDomain] = useState<string | null>(null);
  const [sourceType, setSourceType] = useState<string | null>(null);
  const [campEligible, setCampEligible] = useState<string | null>(null);
  const [assetCategoryDrawerOpen, assetCategoryDrawerHandlers] = useDisclosure(false);
  const [storeCategoryDrawerOpen, storeCategoryDrawerHandlers] = useDisclosure(false);
  const [editingAssetCategory, setEditingAssetCategory] = useState<AssetCategory | null>(null);
  const [editingStoreCategory, setEditingStoreCategory] = useState<StoreCategory | null>(null);

  const {
    control: assetCategoryControl,
    register: registerAssetCategory,
    reset: resetAssetCategory,
    handleSubmit: handleAssetCategorySubmit,
    formState: { errors: assetCategoryErrors },
  } = useForm<AssetCategoryFormInput>({
    resolver: zodResolver(assetCategoryFormSchema),
    defaultValues: assetCategoryDefaults,
  });

  const {
    control: storeCategoryControl,
    register: registerStoreCategory,
    reset: resetStoreCategory,
    handleSubmit: handleStoreCategorySubmit,
    formState: { errors: storeCategoryErrors },
  } = useForm<StoreCategoryFormInput>({
    resolver: zodResolver(storeCategoryFormSchema),
    defaultValues: storeCategoryDefaults,
  });

  const { data: assets = [], isLoading: assetsLoading } = useQuery({
    queryKey: ["assets", search, assetDomain, sourceType, campEligible],
    queryFn: () =>
      assetsService.listAssets({
        search,
        asset_domain: assetDomain ?? undefined,
        source_type: sourceType ?? undefined,
        camp_eligible: campEligible ? campEligible === "yes" : undefined,
      }),
  });

  const { data: assetCategories = [], isLoading: assetCategoriesLoading } = useQuery({
    queryKey: ["asset-categories"],
    queryFn: () => assetsService.listAssetCategories(),
  });

  const { data: storeCategories = [], isLoading: storeCategoriesLoading } = useQuery({
    queryKey: ["store-categories"],
    queryFn: () => assetsService.listStoreCategories(),
  });

  const sourceOptions = useMemo(
    () =>
      Array.from(new Set(assets.map((asset) => asset.source_type))).map((value) => ({
        value,
        label: domainLabel(value),
      })),
    [assets],
  );

  const assetCategoryParentOptions = useMemo(
    () =>
      assetCategories.map((category) => ({
        value: category.id,
        label: `${category.name} · ${category.code}`,
      })),
    [assetCategories],
  );

  const storeCategoryParentOptions = useMemo(
    () =>
      storeCategories.map((category) => ({
        value: category.id,
        label: `${category.name} · ${category.code}`,
      })),
    [storeCategories],
  );

  const assetCategoryMutation = useMutation({
    mutationFn: (values: AssetCategoryFormInput) => {
      const payload = {
        code: nullableTrimmed(values.code) ?? undefined,
        name: values.name.trim(),
        parent_id: values.parent_id || undefined,
        asset_domain: values.asset_domain,
        description: nullableTrimmed(values.description),
        regulatory_class: nullableTrimmed(values.regulatory_class),
        default_pm_frequency: nullableTrimmed(values.default_pm_frequency),
        default_calibration_frequency: nullableTrimmed(values.default_calibration_frequency),
        requires_pm: values.requires_pm,
        requires_calibration: values.requires_calibration,
        is_camp_eligible: values.is_camp_eligible,
        sort_order: formNumber(values.sort_order),
      };
      if (editingAssetCategory) {
        return assetsService.updateAssetCategory(editingAssetCategory.id, {
          ...payload,
          is_active: values.is_active,
        });
      }
      return assetsService.createAssetCategory(payload);
    },
    onSuccess: async () => {
      notifications.show({ color: "green", message: "Asset category saved" });
      assetCategoryDrawerHandlers.close();
      setEditingAssetCategory(null);
      resetAssetCategory(assetCategoryDefaults);
      await qc.invalidateQueries({ queryKey: ["asset-categories"] });
      await qc.invalidateQueries({ queryKey: ["assets"] });
    },
  });

  const storeCategoryMutation = useMutation({
    mutationFn: (values: StoreCategoryFormInput) => {
      const payload = {
        code: nullableTrimmed(values.code) ?? undefined,
        name: values.name.trim(),
        parent_id: values.parent_id || undefined,
        store_domain: values.store_domain,
        description: nullableTrimmed(values.description),
        requires_batch_tracking: values.requires_batch_tracking,
        requires_expiry_tracking: values.requires_expiry_tracking,
        requires_temperature_log: values.requires_temperature_log,
        requires_license_tracking: values.requires_license_tracking,
        is_camp_source: values.is_camp_source,
        sort_order: formNumber(values.sort_order),
      };
      if (editingStoreCategory) {
        return assetsService.updateStoreCategory(editingStoreCategory.id, {
          ...payload,
          is_active: values.is_active,
        });
      }
      return assetsService.createStoreCategory(payload);
    },
    onSuccess: async () => {
      notifications.show({ color: "green", message: "Store category saved" });
      storeCategoryDrawerHandlers.close();
      setEditingStoreCategory(null);
      resetStoreCategory(storeCategoryDefaults);
      await qc.invalidateQueries({ queryKey: ["store-categories"] });
      await qc.invalidateQueries({ queryKey: ["assets"] });
    },
  });

  const assetColumns: Column<UnifiedAsset>[] = [
    {
      key: "asset",
      label: "Asset",
      render: (row) => (
        <Stack gap={2}>
          <Text size="sm" fw={600}>
            {row.name}
          </Text>
          <Text size="xs" c="dimmed">
            {row.display_code ?? row.serial_number ?? row.source_id}
          </Text>
        </Stack>
      ),
    },
    {
      key: "category",
      label: "Category",
      render: (row) => (
        <Stack gap={2}>
          <TableValueBadge
            value={row.asset_domain}
            kind="asset"
            label={domainLabel(row.asset_domain)}
          />
          <Text size="xs" c="dimmed">
            {row.asset_category_name ?? "Unclassified"}
          </Text>
        </Stack>
      ),
    },
    {
      key: "source",
      label: "Source",
      render: (row) => (
        <Group gap="xs">
          <TableValueBadge
            value={row.source_type}
            kind="stock"
            label={domainLabel(row.source_type)}
            variant="outline"
          />
          {row.store_category_name && (
            <Text size="xs" c="dimmed">
              {row.store_category_name}
            </Text>
          )}
        </Group>
      ),
    },
    {
      key: "compliance",
      label: "Compliance",
      render: (row) => (
        <Group gap="xs">
          <TableValueBadge
            value={row.compliance_state}
            kind="asset"
            color={row.compliance_state === "ready" ? "green" : "orange"}
            label={domainLabel(row.compliance_state)}
          />
          {row.is_critical && (
            <TableValueBadge value="critical" kind="asset" color="red" label="Critical" />
          )}
        </Group>
      ),
    },
    {
      key: "camp",
      label: "Camp Use",
      render: (row) => (
        <Group gap="xs">
          <TableValueBadge
            value={row.camp_eligible ? "camp" : "inactive"}
            kind="asset"
            color={row.camp_eligible ? "teal" : "gray"}
            label={row.camp_eligible ? "Eligible" : "Not eligible"}
          />
          {row.open_reservation_count > 0 && (
            <TableValueBadge
              value="reserved"
              kind="asset"
              color="yellow"
              label={`${row.open_reservation_count} reserved`}
            />
          )}
        </Group>
      ),
    },
  ];

  const assetCategoryColumns: Column<AssetCategory>[] = [
    {
      key: "name",
      label: "Category",
      render: (row) => (
        <Stack gap={2}>
          <Text size="sm" fw={600}>
            {row.name}
          </Text>
          <Text size="xs" c="dimmed">
            {row.code}
          </Text>
        </Stack>
      ),
    },
    {
      key: "domain",
      label: "Domain",
      render: (row) => (
        <TableValueBadge
          value={row.asset_domain}
          kind="asset"
          label={domainLabel(row.asset_domain)}
        />
      ),
    },
    {
      key: "controls",
      label: "Controls",
      render: (row) => (
        <Group gap="xs">
          {row.requires_pm && <TableValueBadge value="pm" kind="asset" label="PM" />}
          {row.requires_calibration && (
            <TableValueBadge value="calibration" kind="asset" label="Calibration" />
          )}
          {row.is_camp_eligible && <TableValueBadge value="camp" kind="asset" label="Camp" />}
        </Group>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (row) =>
        canManage && row.tenant_id ? (
          <Tooltip label="Edit asset category">
            <ActionIcon
              variant="subtle"
              onClick={() => {
                setEditingAssetCategory(row);
                resetAssetCategory(assetCategoryToForm(row));
                assetCategoryDrawerHandlers.open();
              }}
            >
              <IconEdit size={16} />
            </ActionIcon>
          </Tooltip>
        ) : null,
    },
  ];

  const storeCategoryColumns: Column<StoreCategory>[] = [
    {
      key: "name",
      label: "Store Category",
      render: (row) => (
        <Stack gap={2}>
          <Text size="sm" fw={600}>
            {row.name}
          </Text>
          <Text size="xs" c="dimmed">
            {row.code}
          </Text>
        </Stack>
      ),
    },
    {
      key: "domain",
      label: "Domain",
      render: (row) => (
        <TableValueBadge
          value={row.store_domain}
          kind="store"
          label={domainLabel(row.store_domain)}
        />
      ),
    },
    {
      key: "controls",
      label: "Controls",
      render: (row) => (
        <Group gap="xs">
          {row.requires_batch_tracking && (
            <TableValueBadge value="batch" kind="stock" label="Batch" />
          )}
          {row.requires_expiry_tracking && (
            <TableValueBadge value="expiry" kind="stock" label="Expiry" />
          )}
          {row.requires_temperature_log && (
            <TableValueBadge value="temperature" kind="stock" label="Temperature" />
          )}
          {row.requires_license_tracking && (
            <TableValueBadge value="license" kind="stock" label="License" />
          )}
          {row.is_camp_source && (
            <TableValueBadge value="camp_source" kind="stock" label="Camp source" />
          )}
        </Group>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (row) =>
        canManage && row.tenant_id ? (
          <Tooltip label="Edit store category">
            <ActionIcon
              variant="subtle"
              onClick={() => {
                setEditingStoreCategory(row);
                resetStoreCategory(storeCategoryToForm(row));
                storeCategoryDrawerHandlers.open();
              }}
            >
              <IconEdit size={16} />
            </ActionIcon>
          </Tooltip>
        ) : null,
    },
  ];

  return (
    <Stack>
      <PageHeader
        title="Assets & Stores"
        subtitle="Unified equipment, reusable assets, and store category control"
        icon={<IconBuildingWarehouse size={18} />}
        actions={
          canManage ? (
            <Group gap="xs">
              <Button
                tone="secondary"
                leftSection={<IconPlus size={16} />}
                onClick={() => {
                  setEditingAssetCategory(null);
                  resetAssetCategory(assetCategoryDefaults);
                  assetCategoryDrawerHandlers.open();
                }}
              >
                Asset Category
              </Button>
              <Button
                tone="primary"
                leftSection={<IconPlus size={16} />}
                onClick={() => {
                  setEditingStoreCategory(null);
                  resetStoreCategory(storeCategoryDefaults);
                  storeCategoryDrawerHandlers.open();
                }}
              >
                Store Category
              </Button>
            </Group>
          ) : undefined
        }
      />

      <IpdContextStrip context={ipdContext} />

      <SimpleGrid cols={{ base: 1, md: 4 }}>
        <Card withBorder>
          <Text size="xs" c="dimmed">
            Unified assets
          </Text>
          <Text fw={700} size="xl">
            {assets.length}
          </Text>
        </Card>
        <Card withBorder>
          <Text size="xs" c="dimmed">
            Camp eligible
          </Text>
          <Text fw={700} size="xl">
            {assets.filter((asset) => asset.camp_eligible).length}
          </Text>
        </Card>
        <Card withBorder>
          <Text size="xs" c="dimmed">
            Open reservations
          </Text>
          <Text fw={700} size="xl">
            {assets.reduce((sum, asset) => sum + asset.open_reservation_count, 0)}
          </Text>
        </Card>
        <Card withBorder>
          <Text size="xs" c="dimmed">
            Master categories
          </Text>
          <Text fw={700} size="xl">
            {assetCategories.length + storeCategories.length}
          </Text>
        </Card>
      </SimpleGrid>

      <Tabs defaultValue="assets">
        <Tabs.List>
          <Tabs.Tab value="assets" leftSection={<IconPackage size={16} />}>
            Assets
          </Tabs.Tab>
          <Tabs.Tab value="asset-categories" leftSection={<IconShieldCheck size={16} />}>
            Asset Categories
          </Tabs.Tab>
          <Tabs.Tab value="store-categories" leftSection={<IconBuildingWarehouse size={16} />}>
            Store Categories
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="assets" pt="md">
          <DataTable
            columns={assetColumns}
            data={assets}
            loading={assetsLoading}
            rowKey={(row) => `${row.source_type}:${row.source_id}`}
            emptyIcon={<IconPackage size={32} />}
            emptyTitle="No assets found"
            toolbar={
              <Group gap="xs" wrap="wrap">
                <TextInput
                  leftSection={<IconSearch size={16} />}
                  placeholder="Search asset, tag, serial, barcode"
                  value={search}
                  onChange={(event) => setSearch(event.currentTarget.value)}
                />
                <Select
                  placeholder="Domain"
                  clearable
                  data={assetDomainOptions}
                  value={assetDomain}
                  onChange={setAssetDomain}
                />
                <Select
                  placeholder="Source"
                  clearable
                  data={sourceOptions}
                  value={sourceType}
                  onChange={setSourceType}
                />
                <Select
                  placeholder="Camp"
                  clearable
                  data={[
                    { value: "yes", label: "Camp eligible" },
                    { value: "no", label: "Not eligible" },
                  ]}
                  value={campEligible}
                  onChange={setCampEligible}
                />
              </Group>
            }
          />
        </Tabs.Panel>

        <Tabs.Panel value="asset-categories" pt="md">
          <DataTable
            columns={assetCategoryColumns}
            data={assetCategories}
            loading={assetCategoriesLoading}
            rowKey={(row) => row.id}
            emptyIcon={<IconShieldCheck size={32} />}
            emptyTitle="No asset categories found"
          />
        </Tabs.Panel>

        <Tabs.Panel value="store-categories" pt="md">
          <DataTable
            columns={storeCategoryColumns}
            data={storeCategories}
            loading={storeCategoriesLoading}
            rowKey={(row) => row.id}
            emptyIcon={<IconBuildingWarehouse size={32} />}
            emptyTitle="No store categories found"
          />
        </Tabs.Panel>
      </Tabs>

      <Drawer
        opened={assetCategoryDrawerOpen}
        onClose={assetCategoryDrawerHandlers.close}
        title={editingAssetCategory ? "Edit Asset Category" : "Add Asset Category"}
        position="right"
        size="md"
      >
        <form
          onSubmit={handleAssetCategorySubmit((values) => assetCategoryMutation.mutate(values))}
        >
          <Stack>
            <SimpleGrid cols={2}>
              <TextInput
                label="Code"
                disabled={Boolean(editingAssetCategory)}
                {...registerAssetCategory("code")}
              />
              <Controller
                name="asset_domain"
                control={assetCategoryControl}
                render={({ field }) => (
                  <Select label="Domain" data={assetDomainOptions} required {...field} />
                )}
              />
            </SimpleGrid>
            <TextInput
              label="Name"
              required
              error={assetCategoryErrors.name?.message}
              {...registerAssetCategory("name")}
            />
            <Controller
              name="parent_id"
              control={assetCategoryControl}
              render={({ field }) => (
                <Select
                  label="Parent category"
                  clearable
                  data={assetCategoryParentOptions}
                  value={field.value || null}
                  onChange={(value) => field.onChange(value ?? "")}
                />
              )}
            />
            <Textarea label="Description" minRows={3} {...registerAssetCategory("description")} />
            <SimpleGrid cols={2}>
              <TextInput label="PM frequency" {...registerAssetCategory("default_pm_frequency")} />
              <TextInput
                label="Calibration frequency"
                {...registerAssetCategory("default_calibration_frequency")}
              />
            </SimpleGrid>
            <TextInput label="Regulatory class" {...registerAssetCategory("regulatory_class")} />
            <Controller
              name="sort_order"
              control={assetCategoryControl}
              render={({ field }) => (
                <NumberInput
                  label="Sort order"
                  min={0}
                  value={formNumber(field.value)}
                  onChange={(value) => field.onChange(value ?? 0)}
                />
              )}
            />
            <SimpleGrid cols={2}>
              <Controller
                name="requires_pm"
                control={assetCategoryControl}
                render={({ field }) => (
                  <Switch label="Requires PM" checked={field.value} onChange={field.onChange} />
                )}
              />
              <Controller
                name="requires_calibration"
                control={assetCategoryControl}
                render={({ field }) => (
                  <Switch
                    label="Requires calibration"
                    checked={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
              <Controller
                name="is_camp_eligible"
                control={assetCategoryControl}
                render={({ field }) => (
                  <Switch label="Camp eligible" checked={field.value} onChange={field.onChange} />
                )}
              />
              <Controller
                name="is_active"
                control={assetCategoryControl}
                render={({ field }) => (
                  <Switch label="Active" checked={field.value} onChange={field.onChange} />
                )}
              />
            </SimpleGrid>
            <Group justify="flex-end">
              <Button tone="ghost" onClick={assetCategoryDrawerHandlers.close}>
                Cancel
              </Button>
              <Button tone="primary" type="submit" loading={assetCategoryMutation.isPending}>
                Save
              </Button>
            </Group>
          </Stack>
        </form>
      </Drawer>

      <Drawer
        opened={storeCategoryDrawerOpen}
        onClose={storeCategoryDrawerHandlers.close}
        title={editingStoreCategory ? "Edit Store Category" : "Add Store Category"}
        position="right"
        size="md"
      >
        <form
          onSubmit={handleStoreCategorySubmit((values) => storeCategoryMutation.mutate(values))}
        >
          <Stack>
            <SimpleGrid cols={2}>
              <TextInput
                label="Code"
                disabled={Boolean(editingStoreCategory)}
                {...registerStoreCategory("code")}
              />
              <Controller
                name="store_domain"
                control={storeCategoryControl}
                render={({ field }) => (
                  <Select label="Domain" data={storeDomainOptions} required {...field} />
                )}
              />
            </SimpleGrid>
            <TextInput
              label="Name"
              required
              error={storeCategoryErrors.name?.message}
              {...registerStoreCategory("name")}
            />
            <Controller
              name="parent_id"
              control={storeCategoryControl}
              render={({ field }) => (
                <Select
                  label="Parent category"
                  clearable
                  data={storeCategoryParentOptions}
                  value={field.value || null}
                  onChange={(value) => field.onChange(value ?? "")}
                />
              )}
            />
            <Textarea label="Description" minRows={3} {...registerStoreCategory("description")} />
            <Controller
              name="sort_order"
              control={storeCategoryControl}
              render={({ field }) => (
                <NumberInput
                  label="Sort order"
                  min={0}
                  value={formNumber(field.value)}
                  onChange={(value) => field.onChange(value ?? 0)}
                />
              )}
            />
            <SimpleGrid cols={2}>
              <Controller
                name="requires_batch_tracking"
                control={storeCategoryControl}
                render={({ field }) => (
                  <Switch label="Batch tracking" checked={field.value} onChange={field.onChange} />
                )}
              />
              <Controller
                name="requires_expiry_tracking"
                control={storeCategoryControl}
                render={({ field }) => (
                  <Switch label="Expiry tracking" checked={field.value} onChange={field.onChange} />
                )}
              />
              <Controller
                name="requires_temperature_log"
                control={storeCategoryControl}
                render={({ field }) => (
                  <Switch label="Temperature log" checked={field.value} onChange={field.onChange} />
                )}
              />
              <Controller
                name="requires_license_tracking"
                control={storeCategoryControl}
                render={({ field }) => (
                  <Switch
                    label="License tracking"
                    checked={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
              <Controller
                name="is_camp_source"
                control={storeCategoryControl}
                render={({ field }) => (
                  <Switch label="Camp source" checked={field.value} onChange={field.onChange} />
                )}
              />
              <Controller
                name="is_active"
                control={storeCategoryControl}
                render={({ field }) => (
                  <Switch label="Active" checked={field.value} onChange={field.onChange} />
                )}
              />
            </SimpleGrid>
            <Group justify="flex-end">
              <Button tone="ghost" onClick={storeCategoryDrawerHandlers.close}>
                Cancel
              </Button>
              <Button tone="primary" type="submit" loading={storeCategoryMutation.isPending}>
                Save
              </Button>
            </Group>
          </Stack>
        </form>
      </Drawer>
    </Stack>
  );
}
