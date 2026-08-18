import { Group, Modal, NumberInput, Stack, Switch, Textarea, TextInput } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type { HealthPackage } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconGift, IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable, PageHeader } from "@/components";
import type { Column } from "@/components/DataTable";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { Badge, Button, toast } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { micrositeService } from "@/services/microsite.service";

function PackageModal({
  pkg,
  onClose,
}: {
  pkg: HealthPackage | "new" | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const editing = pkg && pkg !== "new" ? pkg : null;
  const [name, setName] = useState(editing?.name ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [price, setPrice] = useState<number | "">(editing ? Number(editing.price) : "");
  const [includes, setIncludes] = useState(editing?.includes ?? "");
  const [category, setCategory] = useState(editing?.category ?? "");
  const [promoted, setPromoted] = useState(editing?.is_promoted ?? false);

  const save = useMutation({
    mutationFn: () => {
      const data = {
        name,
        description: description || undefined,
        price: typeof price === "number" ? price : 0,
        includes: includes || undefined,
        category: category || undefined,
        is_promoted: promoted,
      };
      return editing
        ? micrositeService.updateHealthPackage(editing.id, data)
        : micrositeService.createHealthPackage(data);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["health-packages"] });
      toast.success("Package saved", { title: "Health packages" });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message, { title: "Save failed" }),
  });

  return (
    <Modal
      opened={!!pkg}
      onClose={onClose}
      title={editing ? "Edit package" : "New package"}
      size="lg"
    >
      <Stack gap="sm">
        <TextInput
          label="Name"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          required
        />
        <Textarea
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.currentTarget.value)}
        />
        <Group grow>
          <NumberInput
            label="Price ₹"
            value={price}
            onChange={(v) => setPrice(typeof v === "number" ? v : "")}
            min={0}
          />
          <TextInput
            label="Category"
            value={category}
            onChange={(e) => setCategory(e.currentTarget.value)}
            placeholder="preventive"
          />
        </Group>
        <TextInput
          label="Includes"
          value={includes}
          onChange={(e) => setIncludes(e.currentTarget.value)}
          placeholder="CBC, Lipid, ECG…"
        />
        <Switch
          label="Promoted"
          checked={promoted}
          onChange={(e) => setPromoted(e.currentTarget.checked)}
        />
        <Button onClick={() => save.mutate()} loading={save.isPending} disabled={!name.trim()}>
          Save
        </Button>
      </Stack>
    </Modal>
  );
}

function BookModal({ pkg, onClose }: { pkg: HealthPackage | null; onClose: () => void }) {
  const [patientId, setPatientId] = useState("");
  const book = useMutation({
    mutationFn: () => micrositeService.bookHealthPackage(pkg?.id ?? "", patientId),
    onSuccess: () => {
      toast.success("Booked — invoice raised for online payment", { title: "Health packages" });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message, { title: "Booking failed" }),
  });
  return (
    <Modal opened={!!pkg} onClose={onClose} title={`Book — ${pkg?.name ?? ""}`}>
      <Stack gap="sm">
        <PatientSearchSelect value={patientId} onChange={setPatientId} />
        <Button onClick={() => book.mutate()} loading={book.isPending} disabled={!patientId}>
          Book & raise invoice
        </Button>
      </Stack>
    </Modal>
  );
}

export function HealthPackagesPage() {
  useRequirePermission(P.SPECIALTY.HEALTH_PACKAGES.LIST);
  const canManage = useHasPermission(P.SPECIALTY.HEALTH_PACKAGES.MANAGE);
  const qc = useQueryClient();
  const [editPkg, setEditPkg] = useState<HealthPackage | "new" | null>(null);
  const [bookPkg, setBookPkg] = useState<HealthPackage | null>(null);

  const { data = [], isLoading } = useQuery({
    queryKey: ["health-packages"],
    queryFn: () => micrositeService.listHealthPackages(),
  });

  const remove = useMutation({
    mutationFn: (id: string) => micrositeService.deleteHealthPackage(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["health-packages"] });
      toast.success("Package deactivated", { title: "Health packages" });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Failed" }),
  });

  const columns: Column<HealthPackage>[] = [
    {
      key: "name",
      label: "Package",
      render: (r) => (
        <Group gap={6}>
          {r.name}
          {r.is_promoted && (
            <Badge tone="info" size="xs">
              promoted
            </Badge>
          )}
        </Group>
      ),
    },
    { key: "category", label: "Category", render: (r) => r.category ?? "—" },
    { key: "price", label: "Price", render: (r) => `₹${r.price}` },
    {
      key: "is_active",
      label: "Status",
      render: (r) => (
        <Badge tone={r.is_active ? "success" : "neutral"}>
          {r.is_active ? "active" : "inactive"}
        </Badge>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (r) => (
        <Group gap="xs">
          <Button size="xs" tone="secondary" onClick={() => setBookPkg(r)}>
            Book
          </Button>
          {canManage && (
            <>
              <Button size="xs" tone="ghost" onClick={() => setEditPkg(r)}>
                Edit
              </Button>
              {r.is_active && (
                <Button size="xs" tone="danger" onClick={() => remove.mutate(r.id)}>
                  Deactivate
                </Button>
              )}
            </>
          )}
        </Group>
      ),
    },
  ];

  return (
    <Stack gap="md">
      <PageHeader
        title="Health packages"
        subtitle="Marketed check-up packages & promotions"
        icon={<IconGift size={20} />}
        actions={
          canManage ? (
            <Button leftSection={<IconPlus size={16} />} onClick={() => setEditPkg("new")}>
              New package
            </Button>
          ) : undefined
        }
      />
      <DataTable
        columns={columns}
        data={data}
        loading={isLoading}
        rowKey={(r) => r.id}
        emptyTitle="No health packages yet."
      />
      {editPkg && <PackageModal pkg={editPkg} onClose={() => setEditPkg(null)} />}
      {bookPkg && <BookModal pkg={bookPkg} onClose={() => setBookPkg(null)} />}
    </Stack>
  );
}
