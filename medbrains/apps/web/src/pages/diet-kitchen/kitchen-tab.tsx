// IPD KitchenTab — split from diet-kitchen.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Card,
  Drawer,
  Group,
  NumberInput,
  Progress,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import type { KitchenMenuFormInput, MealPrepFormInput } from "@medbrains/schemas";
import { kitchenMenuFormSchema, mealPrepFormSchema } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type {
  CreateKitchenMenuRequest,
  CreateMealPrepRequest,
  KitchenMenu,
  MealCount,
  MealPreparation,
  UpdateMealPrepStatusRequest,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPencil, IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { DataTable } from "@/components";
import { Badge, type BadgeTone, Button, IconButton } from "@/components/ui";
import { dietOptionalInteger, dietOptionalText, mealTypeOptions } from "@/forms/diet-kitchen.form";
import { dietKitchenService } from "@/services/diet-kitchen.service";
import { notifyFormError, notifyMutationError, optionalUuid, rowsOrEmpty } from "./shared";

const PREP_STATUS_COLORS: Record<string, BadgeTone> = {
  pending: "neutral",
  preparing: "warning",
  ready: "primary",
  dispatched: "warning",
  delivered: "success",
};

export function KitchenTab() {
  const qc = useQueryClient();
  const canViewKitchen = useHasPermission(P.DIET.KITCHEN_LIST);
  const canManage = useHasPermission(P.DIET.KITCHEN_MANAGE);
  const canViewOrders = useHasPermission(P.DIET.ORDERS_LIST);
  const canCreateMealPrep = canManage && canViewOrders;
  const [menuOpened, { open: openMenu, close: closeMenu }] = useDisclosure(false);
  const [prepOpened, { open: openPrep, close: closePrep }] = useDisclosure(false);
  const [sub, setSub] = useState<"menus" | "preps" | "counts" | "summary">("menus");

  const { data: menusData, isLoading: menusLoading } = useQuery({
    queryKey: ["kitchen-menus"],
    queryFn: dietKitchenService.listKitchenMenus,
    enabled: canViewKitchen,
  });
  const menus = canViewKitchen ? rowsOrEmpty(menusData) : [];

  const { data: prepsData, isLoading: prepsLoading } = useQuery({
    queryKey: ["meal-preps"],
    queryFn: dietKitchenService.listMealPreps,
    enabled: canViewKitchen,
  });
  const preps = canViewKitchen ? rowsOrEmpty(prepsData) : [];

  const { data: countsData, isLoading: countsLoading } = useQuery({
    queryKey: ["meal-counts"],
    queryFn: dietKitchenService.listMealCounts,
    enabled: canViewKitchen,
  });
  const counts = canViewKitchen ? rowsOrEmpty(countsData) : [];

  const { data: ordersData } = useQuery({
    queryKey: ["diet-orders-for-prep"],
    queryFn: dietKitchenService.listDietOrders,
    enabled: canCreateMealPrep,
    staleTime: 30_000,
  });
  const prepOrders = canCreateMealPrep ? rowsOrEmpty(ordersData) : [];
  const prepOrderOptions = useMemo(
    () =>
      prepOrders
        .filter((order) => order.status === "active")
        .map((order) => ({
          value: order.id,
          label: `${order.diet_type}${order.admission_id ? " · IPD" : ""} · ${order.id.slice(0, 8)}`,
        })),
    [prepOrders],
  );

  const menuForm = useForm<KitchenMenuFormInput>({
    resolver: zodResolver(kitchenMenuFormSchema),
    defaultValues: {
      name: "",
      week_number: "",
      season: "",
    },
  });
  const {
    control: menuControl,
    handleSubmit: handleMenuSubmit,
    reset: resetMenu,
    formState: { errors: menuErrors },
  } = menuForm;
  const prepForm = useForm<MealPrepFormInput>({
    resolver: zodResolver(mealPrepFormSchema),
    defaultValues: {
      diet_order_id: "",
      meal_type: "breakfast",
    },
  });
  const {
    control: prepControl,
    handleSubmit: handlePrepSubmit,
    reset: resetPrep,
    formState: { errors: prepErrors },
  } = prepForm;

  const createMenuMut = useMutation({
    mutationFn: (data: CreateKitchenMenuRequest) => dietKitchenService.createKitchenMenu(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["kitchen-menus"] });
      notifications.show({ title: "Success", message: "Menu created", color: "success" });
      closeMenu();
      resetMenu();
    },
    onError: notifyMutationError("Could not create menu"),
  });

  const createPrepMut = useMutation({
    mutationFn: (data: CreateMealPrepRequest) => dietKitchenService.createMealPrep(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["meal-preps"] });
      notifications.show({ title: "Success", message: "Meal prep created", color: "success" });
      closePrep();
      resetPrep();
    },
    onError: notifyMutationError("Could not create meal prep"),
  });

  const updatePrepMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateMealPrepStatusRequest }) =>
      dietKitchenService.updateMealPrepStatus(id, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["meal-preps"] });
      notifications.show({ title: "Success", message: "Status updated", color: "success" });
    },
    onError: notifyMutationError("Could not update meal status"),
  });

  const submitMenu = (values: KitchenMenuFormInput) => {
    createMenuMut.mutate({
      name: values.name.trim(),
      week_number: dietOptionalInteger(values.week_number),
      season: dietOptionalText(values.season),
    });
  };

  const submitPrep = (values: MealPrepFormInput) => {
    const dietOrderId = optionalUuid(values.diet_order_id, "Diet Order ID");
    if (dietOrderId === null) {
      return;
    }

    if (!dietOrderId) {
      notifyFormError("Enter a diet order ID and select a meal type.");
      return;
    }

    createPrepMut.mutate({
      diet_order_id: dietOrderId,
      meal_type: values.meal_type,
    });
  };

  const menuCols = [
    { key: "name", label: "Menu Name", render: (r: KitchenMenu) => <Text fw={500}>{r.name}</Text> },
    {
      key: "week_number",
      label: "Week",
      render: (r: KitchenMenu) => <Text size="sm">{r.week_number ?? "-"}</Text>,
    },
    {
      key: "season",
      label: "Season",
      render: (r: KitchenMenu) => <Text size="sm">{r.season ?? "-"}</Text>,
    },
    {
      key: "is_active",
      label: "Active",
      render: (r: KitchenMenu) => (
        <Badge tone={r.is_active ? "success" : "neutral"}>{r.is_active ? "Yes" : "No"}</Badge>
      ),
    },
    {
      key: "valid_from",
      label: "Valid From",
      render: (r: KitchenMenu) => <Text size="sm">{r.valid_from ?? "-"}</Text>,
    },
    {
      key: "valid_until",
      label: "Valid Until",
      render: (r: KitchenMenu) => <Text size="sm">{r.valid_until ?? "-"}</Text>,
    },
  ];

  const prepCols = [
    {
      key: "meal_type",
      label: "Meal",
      render: (r: MealPreparation) => <Badge>{r.meal_type}</Badge>,
    },
    {
      key: "meal_date",
      label: "Date",
      render: (r: MealPreparation) => <Text size="sm">{r.meal_date}</Text>,
    },
    {
      key: "status",
      label: "Status",
      render: (r: MealPreparation) => (
        <Badge tone={PREP_STATUS_COLORS[r.status] ?? "neutral"}>{r.status}</Badge>
      ),
    },
    {
      key: "delivered_to_ward",
      label: "Ward",
      render: (r: MealPreparation) => <Text size="sm">{r.delivered_to_ward ?? "-"}</Text>,
    },
    {
      key: "feedback_rating",
      label: "Rating",
      render: (r: MealPreparation) => (
        <Text size="sm">{r.feedback_rating ? `${r.feedback_rating}/5` : "-"}</Text>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (r: MealPreparation) => {
        if (!canManage) return <Text size="sm">-</Text>;
        const next: Partial<
          Record<MealPreparation["status"], UpdateMealPrepStatusRequest["status"]>
        > = {
          pending: "preparing",
          preparing: "ready",
          ready: "dispatched",
          dispatched: "delivered",
        };
        const nextStatus = next[r.status];
        if (!nextStatus) return <Text size="sm">-</Text>;
        return (
          <Tooltip label={`Mark ${nextStatus}`}>
            <IconButton
              size="sm"
              loading={updatePrepMut.isPending}
              onClick={() =>
                updatePrepMut.mutate({
                  id: r.id,
                  data: { status: nextStatus },
                })
              }
              aria-label={`Mark ${nextStatus}`}
            >
              <IconPencil size={14} />
            </IconButton>
          </Tooltip>
        );
      },
    },
  ];

  const countCols = [
    {
      key: "count_date",
      label: "Date",
      render: (r: MealCount) => <Text size="sm">{r.count_date}</Text>,
    },
    {
      key: "meal_type",
      label: "Meal",
      render: (r: MealCount) => <Badge>{r.meal_type}</Badge>,
    },
    { key: "ward", label: "Ward", render: (r: MealCount) => <Text size="sm">{r.ward}</Text> },
    {
      key: "occupied",
      label: "Occupied",
      render: (r: MealCount) => (
        <Text size="sm">
          {r.occupied}/{r.total_beds}
        </Text>
      ),
    },
    {
      key: "npo_count",
      label: "NPO",
      render: (r: MealCount) => (
        <Text size="sm" c={r.npo_count > 0 ? "danger" : undefined}>
          {r.npo_count}
        </Text>
      ),
    },
    {
      key: "regular_count",
      label: "Regular",
      render: (r: MealCount) => <Text size="sm">{r.regular_count}</Text>,
    },
    {
      key: "special_count",
      label: "Special",
      render: (r: MealCount) => <Text size="sm">{r.special_count}</Text>,
    },
  ];

  // Production summary aggregations
  const summary = useMemo(() => {
    const stats = {
      total: preps.length,
      pending: preps.filter((p) => p.status === "pending").length,
      preparing: preps.filter((p) => p.status === "preparing").length,
      ready: preps.filter((p) => p.status === "ready").length,
      dispatched: preps.filter((p) => p.status === "dispatched").length,
      delivered: preps.filter((p) => p.status === "delivered").length,
    };

    const byMealType: Record<string, number> = {};
    preps.forEach((p) => {
      byMealType[p.meal_type] = (byMealType[p.meal_type] ?? 0) + 1;
    });

    return { stats, byMealType };
  }, [preps]);

  return (
    <>
      <Group mb="md">
        <Button
          tone={sub === "menus" ? "primary" : "secondary"}
          size="xs"
          onClick={() => setSub("menus")}
        >
          Menus
        </Button>
        <Button
          tone={sub === "preps" ? "primary" : "secondary"}
          size="xs"
          onClick={() => setSub("preps")}
        >
          Meal Prep
        </Button>
        <Button
          tone={sub === "counts" ? "primary" : "secondary"}
          size="xs"
          onClick={() => setSub("counts")}
        >
          Meal Counts
        </Button>
        <Button
          tone={sub === "summary" ? "primary" : "secondary"}
          size="xs"
          onClick={() => setSub("summary")}
        >
          Summary
        </Button>
        <div style={{ flex: 1 }} />
        {canManage && sub === "menus" && (
          <Button tone="primary" leftSection={<IconPlus size={16} />} size="xs" onClick={openMenu}>
            New Menu
          </Button>
        )}
        {canCreateMealPrep && sub === "preps" && (
          <Button tone="primary" leftSection={<IconPlus size={16} />} size="xs" onClick={openPrep}>
            New Meal Prep
          </Button>
        )}
      </Group>

      {!canViewKitchen && (
        <Card withBorder p="md">
          <Text size="sm" c="dimmed">
            Kitchen production lists are not available for your role. Management actions stay
            available where the required action permissions are present.
          </Text>
        </Card>
      )}

      {canViewKitchen && sub === "menus" && (
        <DataTable
          columns={menuCols}
          data={menus}
          loading={menusLoading}
          rowKey={(r) => r.id}
          emptyTitle="No menus"
        />
      )}
      {canViewKitchen && sub === "preps" && (
        <DataTable
          columns={prepCols}
          data={preps}
          loading={prepsLoading}
          rowKey={(r) => r.id}
          emptyTitle="No meal preps"
        />
      )}
      {canViewKitchen && sub === "counts" && (
        <DataTable
          columns={countCols}
          data={counts}
          loading={countsLoading}
          rowKey={(r) => r.id}
          emptyTitle="No meal counts"
        />
      )}

      {canViewKitchen && sub === "summary" && (
        <Stack>
          <Text fw={600} size="lg">
            Kitchen Production Summary
          </Text>
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 6 }}>
            <Card withBorder>
              <Text size="xs" c="dimmed" tt="uppercase">
                Total Meals
              </Text>
              <Text size="xl" fw={700}>
                {summary.stats.total}
              </Text>
            </Card>
            <Card withBorder>
              <Text size="xs" c="dimmed" tt="uppercase">
                Pending
              </Text>
              <Text size="xl" fw={700} c="slate">
                {summary.stats.pending}
              </Text>
            </Card>
            <Card withBorder>
              <Text size="xs" c="dimmed" tt="uppercase">
                Preparing
              </Text>
              <Text size="xl" fw={700} c="warning">
                {summary.stats.preparing}
              </Text>
            </Card>
            <Card withBorder>
              <Text size="xs" c="dimmed" tt="uppercase">
                Ready
              </Text>
              <Text size="xl" fw={700} c="primary">
                {summary.stats.ready}
              </Text>
            </Card>
            <Card withBorder>
              <Text size="xs" c="dimmed" tt="uppercase">
                Dispatched
              </Text>
              <Text size="xl" fw={700} c="orange">
                {summary.stats.dispatched}
              </Text>
            </Card>
            <Card withBorder>
              <Text size="xs" c="dimmed" tt="uppercase">
                Delivered
              </Text>
              <Text size="xl" fw={700} c="success">
                {summary.stats.delivered}
              </Text>
            </Card>
          </SimpleGrid>

          <Text fw={600} mt="md">
            Meals by Type
          </Text>
          <Card withBorder>
            <Stack gap="sm">
              {Object.entries(summary.byMealType).length > 0 ? (
                Object.entries(summary.byMealType)
                  .sort(([, a], [, b]) => b - a)
                  .map(([mealType, count]) => (
                    <Group key={mealType} justify="space-between">
                      <Badge>{mealType}</Badge>
                      <Group gap="xs">
                        <Progress value={(count / summary.stats.total) * 100} w={100} size="sm" />
                        <Text size="sm" fw={500} w={40} ta="right">
                          {count}
                        </Text>
                      </Group>
                    </Group>
                  ))
              ) : (
                <Text size="sm" c="dimmed">
                  No meal data available
                </Text>
              )}
            </Stack>
          </Card>
        </Stack>
      )}

      <Drawer
        opened={menuOpened}
        onClose={closeMenu}
        title="New Kitchen Menu"
        position="right"
        size="xl"
      >
        <Stack component="form" onSubmit={handleMenuSubmit(submitMenu)}>
          <Controller
            name="name"
            control={menuControl}
            render={({ field }) => (
              <TextInput label="Menu Name" required {...field} error={menuErrors.name?.message} />
            )}
          />
          <Controller
            name="week_number"
            control={menuControl}
            render={({ field }) => (
              <NumberInput
                label="Week Number"
                value={field.value}
                onChange={field.onChange}
                error={menuErrors.week_number?.message}
              />
            )}
          />
          <Controller
            name="season"
            control={menuControl}
            render={({ field }) => (
              <TextInput label="Season" {...field} error={menuErrors.season?.message} />
            )}
          />
          <Button tone="primary" loading={createMenuMut.isPending} type="submit">
            Create Menu
          </Button>
        </Stack>
      </Drawer>

      <Drawer
        opened={prepOpened}
        onClose={closePrep}
        title="New Meal Preparation"
        position="right"
        size="xl"
      >
        <Stack component="form" onSubmit={handlePrepSubmit(submitPrep)}>
          <Controller
            name="diet_order_id"
            control={prepControl}
            render={({ field }) => (
              <Select
                label="Diet Order"
                required
                searchable
                data={prepOrderOptions}
                value={field.value || null}
                onChange={(value) => field.onChange(value ?? "")}
                nothingFoundMessage="No active diet orders"
                error={prepErrors.diet_order_id?.message}
              />
            )}
          />
          <Controller
            name="meal_type"
            control={prepControl}
            render={({ field }) => (
              <Select
                label="Meal Type"
                data={mealTypeOptions}
                required
                value={field.value}
                onChange={(value) => field.onChange(value ?? "breakfast")}
                error={prepErrors.meal_type?.message}
              />
            )}
          />
          <Button tone="primary" loading={createPrepMut.isPending} type="submit">
            Create Meal Prep
          </Button>
        </Stack>
      </Drawer>
    </>
  );
}

// ══════════════════════════════════════════════════════════
//  Kitchen Inventory Tab
// ══════════════════════════════════════════════════════════
