import { zodResolver } from "@hookform/resolvers/zod";
import { Group, NumberInput, Stack, Text, Textarea, TextInput } from "@mantine/core";
import type { MarketingArea, MarketingCampaign } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Alert, Button, Modal, Select, toast } from "@/components/ui";
import {
  type AreaFormInput,
  areaSchema,
  DISTRIBUTION_CHANNEL_OPTIONS,
  type DistributionFormInput,
  distributionSchema,
  rupeesToPaise,
} from "@/forms/marketing.form";
import { marketingService } from "@/services/marketing.service";

/**
 * Record what went out.
 *
 * Written before the result is known, which is the point: the expectation on
 * this form is the only number that means anything when the report compares it
 * to what came back. Filled in afterwards it is just the answer copied into
 * the question.
 */
export function DistributionForm({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [addingArea, setAddingArea] = useState(false);

  const areas = useQuery({
    queryKey: ["marketing", "areas"],
    queryFn: () => marketingService.listAreas(),
    enabled: opened,
  });

  const campaigns = useQuery({
    queryKey: ["marketing", "campaigns"],
    queryFn: () => marketingService.listCampaigns(),
    enabled: opened,
  });

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<DistributionFormInput>({
    resolver: zodResolver(distributionSchema),
    defaultValues: {
      area_id: "",
      campaign_id: "",
      channel: "pamphlet",
      quantity: 1000,
      distributed_on: new Date().toISOString().slice(0, 10),
      cost_rupees: 0,
      response_window_days: 90,
      expected_enquiries: null,
      note: "",
    },
  });

  const create = useMutation({
    mutationFn: (values: DistributionFormInput) =>
      marketingService.createDistribution({
        area_id: values.area_id,
        campaign_id: values.campaign_id || undefined,
        channel: values.channel,
        quantity: values.quantity,
        distributed_on: values.distributed_on,
        cost_minor: rupeesToPaise(values.cost_rupees),
        response_window_days: values.response_window_days,
        expected_enquiries: values.expected_enquiries ?? undefined,
        note: values.note || undefined,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["marketing", "distributions"] });
      toast.success("It will be measured against what comes back from that locality", {
        title: "Run recorded",
      });
      reset();
      onClose();
    },
    onError: (error: Error) => toast.error(error.message, { title: "Could not record the run" }),
  });

  const areaOptions = (areas.data ?? []).map((a: MarketingArea) => ({
    value: a.id,
    label: a.latitude === null ? `${a.name} (no coordinates)` : a.name,
  }));

  return (
    <Modal opened={opened} onClose={onClose} title="Record a distribution run" size="lg">
      <Stack gap="sm">
        {areas.data?.length === 0 && (
          <Alert tone="info" title="No localities yet">
            A run goes to a place. Add the ward or town first — coordinates are optional, but
            without them it will not appear on the map.
          </Alert>
        )}

        <Group align="flex-end" gap="xs">
          <Controller
            name="area_id"
            control={control}
            render={({ field }) => (
              <Select
                label="Locality"
                placeholder="Where did it go?"
                data={areaOptions}
                searchable
                style={{ flex: 1 }}
                error={errors.area_id?.message}
                {...field}
              />
            )}
          />
          <Button tone="ghost" size="sm" onClick={() => setAddingArea(true)}>
            New locality
          </Button>
        </Group>

        <Group grow>
          <Controller
            name="channel"
            control={control}
            render={({ field }) => (
              <Select
                label="What went out"
                data={[...DISTRIBUTION_CHANNEL_OPTIONS]}
                allowDeselect={false}
                error={errors.channel?.message}
                {...field}
              />
            )}
          />
          <Controller
            name="quantity"
            control={control}
            render={({ field }) => (
              <NumberInput
                label="How many"
                description="One hoarding is 1"
                min={1}
                thousandSeparator=","
                error={errors.quantity?.message}
                {...field}
              />
            )}
          />
        </Group>

        <Group grow>
          <Controller
            name="distributed_on"
            control={control}
            render={({ field }) => (
              <TextInput
                label="Date it went out"
                type="date"
                error={errors.distributed_on?.message}
                {...field}
              />
            )}
          />
          <Controller
            name="cost_rupees"
            control={control}
            render={({ field }) => (
              <NumberInput
                label="Cost"
                prefix="₹"
                min={0}
                thousandSeparator=","
                error={errors.cost_rupees?.message}
                {...field}
              />
            )}
          />
        </Group>

        <Group grow>
          <Controller
            name="expected_enquiries"
            control={control}
            render={({ field }) => (
              <NumberInput
                label="Expected enquiries"
                description="Leave blank rather than guess — a bar drawn against an invented expectation is worse than none"
                min={0}
                error={errors.expected_enquiries?.message}
                {...field}
                value={field.value ?? ""}
                onChange={(v) => field.onChange(v === "" ? null : Number(v))}
              />
            )}
          />
          <Controller
            name="response_window_days"
            control={control}
            render={({ field }) => (
              <NumberInput
                label="Response window (days)"
                description="How long you expect it to keep working"
                min={1}
                max={730}
                error={errors.response_window_days?.message}
                {...field}
              />
            )}
          />
        </Group>

        <Controller
          name="campaign_id"
          control={control}
          render={({ field }) => (
            <Select
              label="Campaign"
              placeholder="Optional — links the spend to a campaign"
              data={(campaigns.data ?? []).map((c: MarketingCampaign) => ({
                value: c.id,
                label: c.name,
              }))}
              clearable
              searchable
              {...field}
            />
          )}
        />

        <Controller
          name="note"
          control={control}
          render={({ field }) => (
            <Textarea
              label="Note"
              autosize
              minRows={2}
              placeholder="Distributed at the bus stand and the market"
              {...field}
            />
          )}
        />

        <Group justify="flex-end">
          <Button tone="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            tone="primary"
            loading={create.isPending}
            onClick={handleSubmit((values) => create.mutate(values))}
          >
            Record it
          </Button>
        </Group>
      </Stack>

      <AreaForm opened={addingArea} onClose={() => setAddingArea(false)} />
    </Modal>
  );
}

/**
 * Define a locality once, so a report has one spelling and a map has
 * coordinates.
 *
 * Free-text areas keep working on touchpoints — the desk should never be
 * blocked at capture because a ward is not yet in a list — and defining one
 * here adopts the history that already named it.
 */
export function AreaForm({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AreaFormInput>({
    resolver: zodResolver(areaSchema),
    defaultValues: { name: "", latitude: null, longitude: null, pincode: "", population: null },
  });

  const save = useMutation({
    mutationFn: (values: AreaFormInput) =>
      marketingService.upsertArea({
        name: values.name,
        latitude: values.latitude === null ? undefined : String(values.latitude),
        longitude: values.longitude === null ? undefined : String(values.longitude),
        pincode: values.pincode || undefined,
        population: values.population ?? undefined,
      }),
    onSuccess: (area) => {
      void queryClient.invalidateQueries({ queryKey: ["marketing", "areas"] });
      void queryClient.invalidateQueries({ queryKey: ["marketing", "distributions"] });
      toast.success(`${area.name} saved`, { title: "Locality ready" });
      reset();
      onClose();
    },
    onError: (error: Error) => toast.error(error.message, { title: "Could not save the locality" }),
  });

  return (
    <Modal opened={opened} onClose={onClose} title="Add a locality" size="md">
      <Stack gap="sm">
        <Controller
          name="name"
          control={control}
          render={({ field }) => (
            <TextInput
              label="Name"
              placeholder="Gandhipuram"
              error={errors.name?.message}
              {...field}
            />
          )}
        />
        <Group grow>
          <Controller
            name="latitude"
            control={control}
            render={({ field }) => (
              <NumberInput
                label="Latitude"
                placeholder="11.0168"
                decimalScale={6}
                error={errors.latitude?.message}
                {...field}
                value={field.value ?? ""}
                onChange={(v) => field.onChange(v === "" ? null : Number(v))}
              />
            )}
          />
          <Controller
            name="longitude"
            control={control}
            render={({ field }) => (
              <NumberInput
                label="Longitude"
                placeholder="76.9558"
                decimalScale={6}
                error={errors.longitude?.message}
                {...field}
                value={field.value ?? ""}
                onChange={(v) => field.onChange(v === "" ? null : Number(v))}
              />
            )}
          />
        </Group>
        <Text size="xs" c="dimmed">
          A locality centroid, so the catchment can be drawn. Never a street address — this is where
          the marketing went, not where anybody lives.
        </Text>
        <Group grow>
          <Controller
            name="pincode"
            control={control}
            render={({ field }) => <TextInput label="Pincode" {...field} />}
          />
          <Controller
            name="population"
            control={control}
            render={({ field }) => (
              <NumberInput
                label="Reachable population"
                description="Optional"
                min={0}
                thousandSeparator=","
                {...field}
                value={field.value ?? ""}
                onChange={(v) => field.onChange(v === "" ? null : Number(v))}
              />
            )}
          />
        </Group>
        <Group justify="flex-end">
          <Button tone="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            tone="primary"
            loading={save.isPending}
            onClick={handleSubmit((values) => save.mutate(values))}
          >
            Save
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
