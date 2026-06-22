import { Box, Drawer, Group, Select, Stack, Text, Textarea } from "@mantine/core";
import type { MrdCaseSheetFileFormInput, MrdCaseSheetReprintFormInput } from "@medbrains/schemas";
import type {
  MrdCaseSheetCompletenessResponse,
  MrdCaseSheetPacket,
  MrdCaseSheetPage,
  MrdCaseSheetPageStatus,
} from "@medbrains/types";
import { IconMapPin, IconPrinter } from "@tabler/icons-react";
import type { UseMutationResult } from "@tanstack/react-query";
import type { RefObject } from "react";
import { Controller, type UseFormReturn } from "react-hook-form";
import { DataTable } from "@/components";
import { Badge, Button, Modal } from "@/components/ui";
import { type PrintCopyRoute, printCopyRouteLabel } from "@/utils/printCopies";
import { MrdCaseSheetPrintablePreview, printMrdCaseSheetPreview } from "./CaseSheetPrintPreview";
import { MrdCompletenessPanel } from "./MrdCompletenessPanel";
import {
  MRD_FILE_FORM_DEFAULTS,
  MRD_REPRINT_FORM_DEFAULTS,
  type MrdCaseSheetPrintPreview,
  STATUS_COLORS,
} from "./mrdShared";

interface CaseSheetDrawersProps {
  selectedPacket: MrdCaseSheetPacket | null;
  canFile: boolean;
  reprintCopies: readonly PrintCopyRoute[];

  pagesOpen: boolean;
  closePages: () => void;
  pages: MrdCaseSheetPage[];
  pagesLoading: boolean;
  completeness: MrdCaseSheetCompletenessResponse | undefined;
  completenessLoading: boolean;

  deficientPage: MrdCaseSheetPage | null;
  setDeficientPage: (page: MrdCaseSheetPage | null) => void;
  deficiencyReason: string;
  setDeficiencyReason: (reason: string) => void;
  pageStatusMutation: UseMutationResult<
    MrdCaseSheetPage,
    Error,
    { pageId: string; status: MrdCaseSheetPageStatus; reason?: string }
  >;

  fileOpen: boolean;
  closeFile: () => void;
  fileForm: UseFormReturn<MrdCaseSheetFileFormInput>;
  fileMut: UseMutationResult<MrdCaseSheetPacket, Error, MrdCaseSheetFileFormInput>;
  locationOptions: { value: string; label: string }[];

  reprintOpen: boolean;
  closeReprint: () => void;
  reprintForm: UseFormReturn<MrdCaseSheetReprintFormInput>;
  reprintMut: UseMutationResult<MrdCaseSheetPrintPreview, Error, MrdCaseSheetReprintFormInput>;

  printPreviewOpen: boolean;
  closePrintPreview: () => void;
  printPreview: MrdCaseSheetPrintPreview | null;
  printPreviewRef: RefObject<HTMLDivElement | null>;
}

export function CaseSheetDrawers({
  selectedPacket,
  canFile,
  reprintCopies,
  pagesOpen,
  closePages,
  pages,
  pagesLoading,
  completeness,
  completenessLoading,
  deficientPage,
  setDeficientPage,
  deficiencyReason,
  setDeficiencyReason,
  pageStatusMutation,
  fileOpen,
  closeFile,
  fileForm,
  fileMut,
  locationOptions,
  reprintOpen,
  closeReprint,
  reprintForm,
  reprintMut,
  printPreviewOpen,
  closePrintPreview,
  printPreview,
  printPreviewRef,
}: CaseSheetDrawersProps) {
  return (
    <>
      <Drawer
        opened={pagesOpen}
        onClose={closePages}
        title={`Checklist: ${selectedPacket?.packet_number ?? ""}`}
        position="right"
        size="xl"
      >
        <Stack>
          <Text size="sm" c="dimmed">
            Required pages mirror the MRD assembly order so missing clinical, consent, nursing,
            pharmacy, lab, billing, or discharge pages can be caught before filing.
          </Text>
          <MrdCompletenessPanel completeness={completeness} loading={completenessLoading} />
          <DataTable
            columns={[
              {
                key: "page_order",
                label: "#",
                render: (page: MrdCaseSheetPage) => <Text>{page.page_order}</Text>,
              },
              {
                key: "page_title",
                label: "Page",
                render: (page: MrdCaseSheetPage) => (
                  <Stack gap={0}>
                    <Text fw={500}>{page.page_title}</Text>
                    <Text size="xs" c="dimmed">
                      {page.page_code}
                    </Text>
                  </Stack>
                ),
              },
              {
                key: "source_module",
                label: "Source",
                render: (page: MrdCaseSheetPage) => (
                  <Text size="sm">{page.source_module ?? "manual"}</Text>
                ),
              },
              {
                key: "is_required",
                label: "Required",
                render: (page: MrdCaseSheetPage) =>
                  page.is_required ? (
                    <Badge tone="danger">Required</Badge>
                  ) : (
                    <Badge tone="neutral">Optional</Badge>
                  ),
              },
              {
                key: "status",
                label: "Status",
                render: (page: MrdCaseSheetPage) => (
                  <Stack gap={2}>
                    <Badge tone={STATUS_COLORS[page.status] ?? "neutral"}>{page.status}</Badge>
                    {page.deficiency_reason && (
                      <Text size="xs" c="red">
                        {page.deficiency_reason}
                      </Text>
                    )}
                  </Stack>
                ),
              },
              {
                key: "deficiency",
                label: "Deficiency",
                render: (page: MrdCaseSheetPage) =>
                  canFile ? (
                    page.status === "deficient" ? (
                      <Button
                        size="xs"
                        tone="secondary"
                        loading={pageStatusMutation.isPending}
                        onClick={() =>
                          pageStatusMutation.mutate({ pageId: page.id, status: "available" })
                        }
                      >
                        Resolve
                      </Button>
                    ) : (
                      <Button size="xs" tone="danger" onClick={() => setDeficientPage(page)}>
                        Flag deficient
                      </Button>
                    )
                  ) : (
                    <Text size="xs" c="dimmed">
                      —
                    </Text>
                  ),
              },
            ]}
            data={pages}
            loading={pagesLoading}
            rowKey={(page) => page.id}
          />
        </Stack>
      </Drawer>

      <Modal
        opened={deficientPage !== null}
        onClose={() => setDeficientPage(null)}
        title={`Flag deficient: ${deficientPage?.page_title ?? ""}`}
      >
        <Stack>
          <Textarea
            label="Reason"
            placeholder="e.g. missing signature, incomplete form, illegible"
            value={deficiencyReason}
            onChange={(e) => setDeficiencyReason(e.currentTarget.value)}
            minRows={2}
            required
          />
          <Group justify="flex-end">
            <Button
              tone="danger"
              disabled={!deficiencyReason.trim()}
              loading={pageStatusMutation.isPending}
              onClick={() =>
                deficientPage &&
                pageStatusMutation.mutate({
                  pageId: deficientPage.id,
                  status: "deficient",
                  reason: deficiencyReason.trim(),
                })
              }
            >
              Flag deficient
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Drawer
        opened={fileOpen}
        onClose={() => {
          closeFile();
          fileForm.reset(MRD_FILE_FORM_DEFAULTS);
        }}
        title={`File in MRD: ${selectedPacket?.packet_number ?? ""}`}
        position="right"
        size="lg"
      >
        <form onSubmit={fileForm.handleSubmit((values) => fileMut.mutate(values))}>
          <Stack>
            <Controller
              name="storage_location_id"
              control={fileForm.control}
              render={({ field, fieldState }) => (
                <Select
                  label="Storage Location"
                  placeholder="Select rack / shelf / compactor"
                  data={locationOptions}
                  value={field.value}
                  onChange={(value) => field.onChange(value ?? "")}
                  error={fieldState.error?.message}
                  required
                  searchable
                />
              )}
            />
            <Controller
              name="notes"
              control={fileForm.control}
              render={({ field, fieldState }) => (
                <Textarea
                  label="Filing Notes"
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  error={fieldState.error?.message}
                />
              )}
            />
            <Button
              tone="primary"
              type="submit"
              leftSection={<IconMapPin size={16} />}
              loading={fileMut.isPending}
            >
              Mark Filed
            </Button>
          </Stack>
        </form>
      </Drawer>

      <Drawer
        opened={reprintOpen}
        onClose={() => {
          closeReprint();
          reprintForm.reset(MRD_REPRINT_FORM_DEFAULTS);
        }}
        title={`Reprint: ${selectedPacket?.packet_number ?? ""}`}
        position="right"
        size="lg"
      >
        <form onSubmit={reprintForm.handleSubmit((values) => reprintMut.mutate(values))}>
          <Stack>
            <Group gap={6}>
              {reprintCopies.map((copy) => (
                <Badge key={copy.label} tone="warning">
                  {printCopyRouteLabel(copy)}
                </Badge>
              ))}
            </Group>
            <Controller
              name="reprint_reason"
              control={reprintForm.control}
              render={({ field, fieldState }) => (
                <Textarea
                  label="Reprint Reason"
                  description="Duplicate case-sheet prints must keep an MRD audit reason."
                  value={field.value}
                  onChange={field.onChange}
                  error={fieldState.error?.message}
                  minRows={4}
                  required
                />
              )}
            />
            <Button
              tone="primary"
              type="submit"
              leftSection={<IconPrinter size={16} />}
              loading={reprintMut.isPending}
            >
              Prepare Duplicate
            </Button>
          </Stack>
        </form>
      </Drawer>

      <Drawer
        opened={printPreviewOpen}
        onClose={closePrintPreview}
        title={
          printPreview?.action === "reprint"
            ? `Duplicate print: ${printPreview.packet.packet_number}`
            : `Print packet: ${printPreview?.packet.packet_number ?? ""}`
        }
        position="right"
        size="xl"
      >
        <Stack>
          {printPreview && (
            <>
              <Group gap={6}>
                {printPreview.copies.map((copy) => (
                  <Badge key={copy.label} tone="accent">
                    {printCopyRouteLabel(copy)}
                  </Badge>
                ))}
              </Group>
              <Box ref={printPreviewRef}>
                <MrdCaseSheetPrintablePreview preview={printPreview} />
              </Box>
              <Group justify="flex-end">
                <Button tone="secondary" onClick={closePrintPreview}>
                  Close
                </Button>
                <Button
                  tone="primary"
                  leftSection={<IconPrinter size={16} />}
                  onClick={() =>
                    printMrdCaseSheetPreview(
                      `MRD Case Sheet - ${printPreview.packet.packet_number}`,
                      printPreviewRef.current,
                      printPreview.copies,
                    )
                  }
                >
                  {printPreview.action === "reprint" ? "Print Duplicate" : "Print Copies"}
                </Button>
              </Group>
            </>
          )}
        </Stack>
      </Drawer>
    </>
  );
}
