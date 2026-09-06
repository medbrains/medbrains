import { zodResolver } from "@hookform/resolvers/zod";
import { Group, Stack, Text } from "@mantine/core";
import type { BedsideEducationVideoRow } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { type Column, DataTable } from "@/components";
import { Alert, Badge, Button, Input, Modal, NumberField, Select, TextArea } from "@/components/ui";
import { bedsideService } from "@/services/bedside.service";

/**
 * The patient education library, and the screen that fills it.
 *
 * `bedside_education_videos` could be listed, played and its views tracked —
 * and nothing could put a video in it. createBedsideVideo and
 * updateBedsideVideo had no caller on any of the eleven app surfaces, so the
 * education section on every bedside screen rendered an empty list, and
 * always would have. Patient education is one of the main reasons to put a
 * screen at a bed.
 *
 * The permission already existed for exactly this: bedside.videos.manage,
 * distinct from bedside.videos.list, so the ward can watch without being able
 * to publish.
 */

// The categories a ward actually files education under. Free text here would
// fragment the library — "post-op", "post op" and "Post Operative" are three
// buckets to a patient looking for one.
const CATEGORIES = [
  { value: "post_operative", label: "Post-operative" },
  { value: "wound_care", label: "Wound care" },
  { value: "medication", label: "Medication" },
  { value: "chronic_disease", label: "Chronic disease" },
  { value: "physiotherapy", label: "Physiotherapy" },
  { value: "maternity", label: "Maternity & newborn" },
  { value: "infection_control", label: "Infection control" },
  { value: "discharge", label: "Discharge" },
  { value: "nutrition", label: "Nutrition" },
];

// A video only educates in a language the patient reads.
const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "ta", label: "Tamil" },
  { value: "hi", label: "Hindi" },
];

const schema = z.object({
  title: z.string().trim().min(3, "Give the video a title a patient would recognise"),
  description: z.string().trim().optional(),
  video_url: z.string().trim().url("Must be a full URL the bedside screen can load"),
  thumbnail_url: z.string().trim().url("Must be a full URL").optional().or(z.literal("")),
  category: z.string().min(1, "Choose a category"),
  language: z.string().min(1, "Choose a language"),
  duration_seconds: z.number().int().positive().optional(),
  sort_order: z.number().int().optional(),
});

type FormValues = z.infer<typeof schema>;

function durationLabel(seconds: number | null) {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function EducationLibraryTab() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<BedsideEducationVideoRow | null>(null);
  const [open, setOpen] = useState(false);

  const videosQ = useQuery({
    queryKey: ["bedside", "videos"],
    queryFn: () => bedsideService.listBedsideVideos(),
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { title: "", video_url: "", category: "", language: "en" },
  });

  const closeForm = () => {
    setOpen(false);
    setEditing(null);
    form.reset({ title: "", video_url: "", category: "", language: "en" });
  };

  const saveMutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = {
        ...values,
        description: values.description || undefined,
        thumbnail_url: values.thumbnail_url || undefined,
      };
      return editing
        ? bedsideService.updateBedsideVideo(editing.id, payload)
        : bedsideService.createBedsideVideo(payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["bedside", "videos"] });
      closeForm();
    },
  });

  const openCreate = () => {
    setEditing(null);
    form.reset({ title: "", video_url: "", category: "", language: "en" });
    setOpen(true);
  };

  const openEdit = (row: BedsideEducationVideoRow) => {
    setEditing(row);
    form.reset({
      title: row.title,
      description: row.description ?? "",
      video_url: row.video_url,
      thumbnail_url: row.thumbnail_url ?? "",
      category: row.category,
      language: row.language ?? "en",
      duration_seconds: row.duration_seconds ?? undefined,
      sort_order: row.sort_order ?? undefined,
    });
    setOpen(true);
  };

  const rows = (videosQ.data ?? []) as BedsideEducationVideoRow[];

  const columns: Column<BedsideEducationVideoRow>[] = [
    { key: "title", label: "Title", render: (r) => <Text size="sm">{r.title}</Text> },
    {
      key: "category",
      label: "Category",
      render: (r) => (
        <Text size="sm">{CATEGORIES.find((c) => c.value === r.category)?.label ?? r.category}</Text>
      ),
    },
    {
      key: "language",
      label: "Language",
      render: (r) => (
        <Text size="sm">{LANGUAGES.find((l) => l.value === r.language)?.label ?? r.language}</Text>
      ),
    },
    {
      key: "duration_seconds",
      label: "Length",
      render: (r) => <Text size="sm">{durationLabel(r.duration_seconds)}</Text>,
    },
    {
      key: "is_active",
      label: "Status",
      render: (r) => (
        <Badge tone={r.is_active ? "success" : "neutral"}>
          {r.is_active ? "Published" : "Retired"}
        </Badge>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (r) => (
        <Button tone="ghost" size="compact-xs" onClick={() => openEdit(r)}>
          Edit
        </Button>
      ),
    },
  ];

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        Videos shown on the screen at the patient&apos;s bed. A patient only reads one language, so
        publish each title in every language your wards need.
      </Text>

      {rows.length === 0 && !videosQ.isLoading && (
        <Alert tone="info" title="The library is empty">
          Nothing has been published yet, so the education section at every bed is blank. Add a
          video to change that.
        </Alert>
      )}

      <DataTable
        columns={columns}
        data={rows}
        loading={videosQ.isLoading}
        rowKey={(row) => row.id}
        tableActions={
          <Button tone="primary" onClick={openCreate}>
            Add video
          </Button>
        }
      />

      <Modal
        opened={open}
        onClose={closeForm}
        title={editing ? `Edit ${editing.title}` : "Add education video"}
      >
        <form onSubmit={form.handleSubmit((v) => saveMutation.mutate(v))}>
          <Stack gap="sm">
            <Input
              label="Title"
              placeholder="After your surgery: the first 24 hours"
              required
              error={form.formState.errors.title?.message}
              {...form.register("title")}
            />
            <TextArea
              label="Description"
              placeholder="What the patient will learn, in plain words."
              minRows={2}
              {...form.register("description")}
            />
            <Input
              label="Video URL"
              placeholder="https://…/post-op-first-24h-en.mp4"
              required
              error={form.formState.errors.video_url?.message}
              {...form.register("video_url")}
            />
            <Input
              label="Thumbnail URL"
              placeholder="Optional"
              error={form.formState.errors.thumbnail_url?.message}
              {...form.register("thumbnail_url")}
            />
            <Controller
              control={form.control}
              name="category"
              render={({ field }) => (
                <Select
                  label="Category"
                  data={CATEGORIES}
                  value={field.value}
                  onChange={(v) => field.onChange(v ?? "")}
                  error={form.formState.errors.category?.message}
                  required
                />
              )}
            />
            <Controller
              control={form.control}
              name="language"
              render={({ field }) => (
                <Select
                  label="Language"
                  data={LANGUAGES}
                  value={field.value}
                  onChange={(v) => field.onChange(v ?? "")}
                  error={form.formState.errors.language?.message}
                  required
                />
              )}
            />
            <Group grow>
              <Controller
                control={form.control}
                name="duration_seconds"
                render={({ field }) => (
                  <NumberField
                    label="Length (seconds)"
                    value={field.value}
                    onChange={(v) => field.onChange(typeof v === "number" ? v : undefined)}
                    min={1}
                  />
                )}
              />
              <Controller
                control={form.control}
                name="sort_order"
                render={({ field }) => (
                  <NumberField
                    label="Sort order"
                    value={field.value}
                    onChange={(v) => field.onChange(typeof v === "number" ? v : undefined)}
                  />
                )}
              />
            </Group>

            {saveMutation.isError && (
              <Alert tone="danger" title="The video could not be saved">
                {(saveMutation.error as Error).message}
              </Alert>
            )}

            <Group justify="flex-end">
              <Button tone="ghost" onClick={closeForm} type="button">
                Cancel
              </Button>
              <Button tone="primary" type="submit" loading={saveMutation.isPending}>
                {editing ? "Save changes" : "Publish video"}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}
