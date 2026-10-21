// PROCUREMENT GrnPanel — the GRN register, entry and posting.

import { Group, Text, Tooltip } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type { GoodsReceiptNote, GrnIssue } from "@medbrains/types";
import { IconEye, IconPlus } from "@tabler/icons-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable, TableValueBadge } from "@/components";
import { printColumn } from "@/components/Print/printColumn";
import { Button, IconButton, Modal } from "@/components/ui";
import { procurementService } from "@/services/procurement.service";
import { CreateGrnForm } from "./grn-create-form";
import { GrnDetailView, grnStatusColors } from "./grn-detail";

export function GrnPanel({ canCreate }: { canCreate: boolean }) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<GrnIssue[]>([]);
  const [detailOpened, { open: openDetail, close: closeDetail }] = useDisclosure(false);

  const { data, isLoading } = useQuery({
    queryKey: ["grns", page],
    queryFn: () => procurementService.listGrns({ page: String(page), per_page: "20" }),
  });

  const columns = [
    {
      key: "grn_number",
      label: "GRN #",
      render: (row: GoodsReceiptNote) => <Text fw={600}>{row.grn_number}</Text>,
    },
    {
      key: "status",
      label: "Status",
      render: (row: GoodsReceiptNote) => (
        <TableValueBadge
          value={row.posted_at ? "posted" : row.status}
          kind="status"
          color={grnStatusColors[row.status] ?? "slate"}
        />
      ),
    },
    {
      key: "total_amount",
      label: "Amount",
      render: (row: GoodsReceiptNote) => `₹${row.total_amount}`,
    },
    {
      key: "receipt_date",
      label: "Receipt Date",
      render: (row: GoodsReceiptNote) => row.receipt_date,
    },
    {
      key: "invoice_number",
      label: "Invoice",
      render: (row: GoodsReceiptNote) => row.invoice_number ?? "-",
    },
    {
      key: "actions",
      label: "",
      render: (row: GoodsReceiptNote) => (
        <Tooltip label="View">
          <IconButton
            size={44}
            onClick={() => {
              setWarnings([]);
              setDetailId(row.id);
              openDetail();
            }}
            aria-label="View details"
          >
            <IconEye size={16} />
          </IconButton>
        </Tooltip>
      ),
    },
    printColumn<GoodsReceiptNote>("grn", { label: (row) => row.grn_number }),
  ];

  return (
    <>
      {canCreate && (
        <Group justify="flex-end" mb="md">
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={openCreate}>
            New GRN
          </Button>
        </Group>
      )}

      <DataTable
        columns={columns}
        data={data?.grns ?? []}
        loading={isLoading}
        page={page}
        totalPages={Math.ceil((data?.total ?? 0) / 20)}
        onPageChange={setPage}
        rowKey={(row) => row.id}
        emptyTitle="No goods receipt notes"
      />

      <Modal
        opened={createOpened}
        onClose={closeCreate}
        title="Create GRN"
        closeButtonProps={{ "aria-label": "Close Create GRN" }}
        fullScreen
      >
        <CreateGrnForm
          onSuccess={(result) => {
            void queryClient.invalidateQueries({ queryKey: ["grns"] });
            closeCreate();
            // Straight to the draft: posting it is the next step.
            setWarnings(result.warnings);
            setDetailId(result.grn.id);
            openDetail();
          }}
        />
      </Modal>

      <Modal
        opened={detailOpened}
        onClose={closeDetail}
        title="GRN Details"
        closeButtonProps={{ "aria-label": "Close GRN Details" }}
        fullScreen
      >
        {detailId && <GrnDetailView id={detailId} warnings={warnings} />}
      </Modal>
    </>
  );
}
