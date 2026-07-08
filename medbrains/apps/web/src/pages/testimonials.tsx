import { Group, Modal, NumberInput, Stack, Textarea, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useHasPermission } from "@medbrains/stores";
import type { Testimonial } from "@medbrains/types";
import { IconPlus, IconStar } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable, PageHeader } from "@/components";
import type { Column } from "@/components/DataTable";
import { Badge, Button, toast } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { micrositeService } from "@/services/microsite.service";

function CreateTestimonialModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [rating, setRating] = useState<number | "">(5);
  const [service, setService] = useState("");
  const [body, setBody] = useState("");

  const create = useMutation({
    mutationFn: () =>
      micrositeService.createTestimonial({
        patient_name: name,
        rating: typeof rating === "number" ? rating : 5,
        service: service || undefined,
        body,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["testimonials"] });
      toast.success("Testimonial added", { title: "Testimonials" });
      onClose();
      setName("");
      setBody("");
    },
    onError: (e: Error) => toast.error(e.message, { title: "Failed" }),
  });

  return (
    <Modal opened={opened} onClose={onClose} title="Add testimonial">
      <Stack gap="sm">
        <Group grow>
          <TextInput
            label="Patient name"
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            required
          />
          <NumberInput
            label="Rating"
            value={rating}
            onChange={(v) => setRating(typeof v === "number" ? v : "")}
            min={1}
            max={5}
          />
        </Group>
        <TextInput
          label="Service"
          value={service}
          onChange={(e) => setService(e.currentTarget.value)}
          placeholder="Cardiology"
        />
        <Textarea
          label="Review"
          value={body}
          onChange={(e) => setBody(e.currentTarget.value)}
          minRows={3}
          required
        />
        <Button
          onClick={() => create.mutate()}
          loading={create.isPending}
          disabled={!name.trim() || !body.trim()}
        >
          Add
        </Button>
      </Stack>
    </Modal>
  );
}

export function TestimonialsPage() {
  useRequirePermission("specialty.health_packages.list");
  const canManage = useHasPermission("specialty.health_packages.manage");
  const qc = useQueryClient();
  const [modalOpen, modal] = useDisclosure(false);

  const { data = [], isLoading } = useQuery({
    queryKey: ["testimonials"],
    queryFn: () => micrositeService.listTestimonials(),
  });

  const moderate = useMutation({
    mutationFn: (v: { id: string; is_approved?: boolean; is_published?: boolean }) =>
      micrositeService.moderateTestimonial(v.id, {
        is_approved: v.is_approved,
        is_published: v.is_published,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["testimonials"] });
      toast.success("Updated", { title: "Testimonials" });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Failed" }),
  });

  const columns: Column<Testimonial>[] = [
    { key: "patient_name", label: "Patient", render: (r) => r.patient_name },
    { key: "rating", label: "Rating", render: (r) => "★".repeat(r.rating) },
    { key: "service", label: "Service", render: (r) => r.service ?? "—" },
    { key: "body", label: "Review", render: (r) => r.body },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <Group gap={6}>
          {r.is_approved && (
            <Badge tone="info" size="xs">
              approved
            </Badge>
          )}
          <Badge tone={r.is_published ? "success" : "neutral"} size="xs">
            {r.is_published ? "published" : "draft"}
          </Badge>
        </Group>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (r) =>
        canManage ? (
          <Group gap="xs">
            {!r.is_approved && (
              <Button
                size="xs"
                tone="primary"
                onClick={() => moderate.mutate({ id: r.id, is_approved: true })}
              >
                Approve
              </Button>
            )}
            <Button
              size="xs"
              tone={r.is_published ? "ghost" : "secondary"}
              onClick={() => moderate.mutate({ id: r.id, is_published: !r.is_published })}
            >
              {r.is_published ? "Unpublish" : "Publish"}
            </Button>
          </Group>
        ) : null,
    },
  ];

  return (
    <Stack gap="md">
      <PageHeader
        title="Testimonials"
        subtitle="Patient reviews for the micro-site — moderated before publishing"
        icon={<IconStar size={20} />}
        actions={
          canManage ? (
            <Button leftSection={<IconPlus size={16} />} onClick={modal.open}>
              Add testimonial
            </Button>
          ) : undefined
        }
      />
      <DataTable
        columns={columns}
        data={data}
        loading={isLoading}
        rowKey={(r) => r.id}
        emptyTitle="No testimonials yet."
      />
      <CreateTestimonialModal opened={modalOpen} onClose={modal.close} />
    </Stack>
  );
}
