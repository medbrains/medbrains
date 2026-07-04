import { zodResolver } from "@hookform/resolvers/zod";
import { Group, SegmentedControl, SimpleGrid, Stack } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { api } from "@medbrains/api";
import { useHasPermission } from "@medbrains/stores";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Button, Input, Modal, NumberField, Select } from "@/components/ui";
import { useAddProductStore } from "./add-product-store";

// Quick-addable stock catalogs. Consumable + stationery are both store_catalog
// rows (distinguished by `domain`); drug is the pharmacy catalog. Assets are
// individually-tracked (asset tags/serials) → managed on the Assets page.
type ProductType = "consumable" | "stationery" | "drug";

const PHARMACY_PERM = "pharmacy.stock.manage";
const STORE_PERM = "indent.stock.manage";

const DRUG_SCHEDULES = ["", "H", "H1", "X", "G", "OTC"] as const;

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  code: z.string().optional(),
  category: z.string().optional(),
  unit: z.string().optional(),
  base_price: z.number().min(0).optional(),
  reorder_level: z.number().int().min(0).optional(),
  generic_name: z.string().optional(),
  drug_schedule: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

const EMPTY: FormValues = { name: "", code: "" };

/** Slug a name into a fallback catalog code when the user leaves code blank. */
function codeFromName(name: string): string {
  return name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 20);
}

export function AddProductModal() {
  const opened = useAddProductStore((s) => s.opened);
  const close = useAddProductStore((s) => s.close);
  const qc = useQueryClient();
  const canDrug = useHasPermission(PHARMACY_PERM);
  const canConsumable = useHasPermission(STORE_PERM);

  const availableTypes = useMemo<ProductType[]>(
    () => [
      ...(canConsumable ? (["consumable", "stationery"] as ProductType[]) : []),
      ...(canDrug ? (["drug"] as ProductType[]) : []),
    ],
    [canConsumable, canDrug],
  );
  const [type, setType] = useState<ProductType>("consumable");
  const effectiveType = availableTypes.includes(type) ? type : (availableTypes[0] ?? "consumable");

  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: EMPTY });

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const code = values.code?.trim() || codeFromName(values.name);
      if (effectiveType === "drug") {
        await api.createPharmacyCatalog({
          code,
          name: values.name,
          generic_name: values.generic_name || undefined,
          category: values.category || undefined,
          unit: values.unit || undefined,
          base_price: values.base_price ?? 0,
          reorder_level: values.reorder_level,
          drug_schedule: (values.drug_schedule || undefined) as never,
        });
        return;
      }
      await api.createStoreCatalogItem({
        code,
        name: values.name,
        category: values.category || undefined,
        unit: values.unit || undefined,
        base_price: values.base_price,
        reorder_level: values.reorder_level,
        domain: effectiveType === "stationery" ? "stationery" : "consumable",
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["materials"] });
      qc.invalidateQueries({
        queryKey: [effectiveType === "drug" ? "pharmacy-catalog" : "store-catalog"],
      });
      notifications.show({
        title: "Added",
        message: "Product added to the catalog",
        color: "success",
      });
      form.reset(EMPTY);
      close();
    },
    onError: () =>
      notifications.show({ title: "Error", message: "Could not add the product", color: "danger" }),
  });

  if (availableTypes.length === 0) return null;

  return (
    <Modal opened={opened} onClose={close} title="Add product" size="lg">
      <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))}>
        <Stack gap="md">
          {availableTypes.length > 1 && (
            <SegmentedControl
              fullWidth
              value={effectiveType}
              onChange={(v) => setType(v as ProductType)}
              data={[
                { value: "consumable", label: "Consumable" },
                { value: "stationery", label: "Stationery" },
                { value: "drug", label: "Drug" },
              ]}
            />
          )}

          <Input
            label="Name"
            required
            {...form.register("name")}
            error={form.formState.errors.name?.message}
          />
          <SimpleGrid cols={2}>
            <Input
              label="Code"
              description="Auto-generated from name if blank"
              {...form.register("code")}
            />
            <Input label="Category" {...form.register("category")} />
          </SimpleGrid>

          {effectiveType === "drug" && (
            <SimpleGrid cols={2}>
              <Input label="Generic name" {...form.register("generic_name")} />
              <Controller
                control={form.control}
                name="drug_schedule"
                render={({ field }) => (
                  <Select
                    label="Drug schedule"
                    data={DRUG_SCHEDULES.map((s) => ({ value: s, label: s || "None" }))}
                    value={field.value ?? ""}
                    onChange={(v) => field.onChange(v ?? "")}
                  />
                )}
              />
            </SimpleGrid>
          )}

          <SimpleGrid cols={3}>
            <Input label="Unit" placeholder="e.g. box, strip" {...form.register("unit")} />
            <Controller
              control={form.control}
              name="base_price"
              render={({ field }) => (
                <NumberField
                  label="Price"
                  min={0}
                  value={field.value ?? ""}
                  onChange={(v) => field.onChange(typeof v === "number" ? v : undefined)}
                />
              )}
            />
            <Controller
              control={form.control}
              name="reorder_level"
              render={({ field }) => (
                <NumberField
                  label="Reorder at"
                  min={0}
                  value={field.value ?? ""}
                  onChange={(v) => field.onChange(typeof v === "number" ? v : undefined)}
                />
              )}
            />
          </SimpleGrid>

          <Group justify="flex-end">
            <Button tone="secondary" onClick={close}>
              Cancel
            </Button>
            <Button tone="primary" type="submit" loading={mutation.isPending}>
              Add product
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
