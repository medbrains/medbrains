// Emergency MlcCaseDetail — split from emergency.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Box,
  Card,
  Checkbox,
  Divider,
  Drawer,
  Group,
  Menu,
  Modal,
  Paper,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import type {
  MlcAgeEstimationFormInput,
  MlcCourtSummonsFormInput,
  MlcPocsoReportFormInput,
  MlcPoliceIntimationFormInput,
  MlcPoliceReceiptConfirmationFormInput,
  MlcPrintPacketTypeFormValue,
  MlcPrintReprintFormInput,
  MlcSbarFormInput,
} from "@medbrains/schemas";
import {
  mlcAgeEstimationFormSchema,
  mlcCourtSummonsFormSchema,
  mlcPocsoReportFormSchema,
  mlcPoliceIntimationFormSchema,
  mlcPoliceReceiptConfirmationFormSchema,
  mlcPrintReprintFormSchema,
  mlcSbarFormSchema,
} from "@medbrains/schemas";
import { useFieldAccess, useHasPermission } from "@medbrains/stores";
import type {
  MlcCase,
  MlcDocument,
  MlcDocumentationPrintData,
  MlcPoliceIntimation,
  MlcPoliceIntimationPrintData,
  MlcRegisterPrintData,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import {
  IconAlertOctagon,
  IconAlertTriangle,
  IconBell,
  IconCheck,
  IconFileText,
  IconGavel,
  IconInfoCircle,
  IconPrinter,
  IconScale,
  IconShieldCheck,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { DataTable, TableValueBadge } from "@/components";
import { useClinicalEmit } from "@/components/ClinicalEventProvider";
import type { BadgeTone } from "@/components/ui";
import { Alert, Badge, Button, IconButton, toast } from "@/components/ui";
import { emergencyMlcPoliceSentViaOptions, emergencyOptionalText } from "@/forms/emergency.form";
import type {
  ConfirmPoliceReceiptInput,
  CreateMlcDocumentInput,
  CreatePoliceIntimationInput,
} from "@/services/emergency.service";
import { emergencyService } from "@/services/emergency.service";
import {
  buildCopyPrintHtml,
  copyPrintStyles,
  PRINT_COPY_PACKETS,
  type PrintCopyRoute,
  printCopyRouteLabel,
} from "@/utils/printCopies";
import {
  MlcDocumentationPrintPreview,
  MlcPoliceIntimationPrintPreview,
  MlcRegisterPrintPreview,
} from "./mlc-print-previews";
import {
  canEditSensitiveField,
  canViewSensitiveField,
  mlcDocumentSensitiveBoolean,
  mlcDocumentSensitiveText,
  mlcDocumentText,
  renderSensitiveValue,
} from "./shared";

function printHtmlElement(
  title: string,
  element: HTMLElement | null,
  copies: readonly PrintCopyRoute[],
) {
  if (!element) {
    return;
  }
  const popup = window.open("", "_blank", "width=820,height=920");
  if (!popup) {
    return;
  }
  popup.document.write(`
    <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: Inter, Arial, sans-serif; margin: 24px; color: #18201b; }
          .print-page { max-width: 820px; margin: 0 auto; }
          .print-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 16px; }
          .print-label { font-size: 11px; color: #66736b; text-transform: uppercase; letter-spacing: .04em; }
          .print-value { font-size: 14px; font-weight: 600; white-space: pre-wrap; }
          .print-section { margin-top: 18px; padding-top: 12px; border-top: 1px solid #dfe7e2; }
          .duplicate { color: #b45309; font-weight: 700; }
          ${copyPrintStyles()}
        </style>
      </head>
      <body onload="window.print(); window.close();">
        ${buildCopyPrintHtml(element.innerHTML, copies)}
      </body>
    </html>
  `);
  popup.document.close();
}

function mlcPoliceIntimationClinicalPayload(
  mlcCase: MlcCase,
  intimation: MlcPoliceIntimation,
): Record<string, unknown> {
  return {
    source_record_id: intimation.id,
    intimation_id: intimation.id,
    intimation_number: intimation.intimation_number,
    mlc_case_id: mlcCase.id,
    mlc_number: mlcCase.mlc_number,
    patient_id: mlcCase.patient_id,
    er_visit_id: mlcCase.er_visit_id,
    sent_at: intimation.sent_at,
    sent_via: intimation.sent_via,
    receipt_confirmed: intimation.receipt_confirmed,
  };
}

const EMPTY_SBAR: MlcSbarFormInput = {
  situation: "",
  background: "",
  assessment: "",
  recommendation: "",
};
const EMPTY_AGE_EST: MlcAgeEstimationFormInput = {
  ossification_center_findings: "",
  dental_examination: "",
  secondary_sexual_characteristics: "",
  estimated_age_range: "",
  examiner_opinion: "",
};
const EMPTY_POCSO: MlcPocsoReportFormInput = {
  child_age: "",
  guardian_details: "",
  statement_summary: "",
  injuries_documented: "",
  psych_assessment_needed: false,
};
const EMPTY_SUMMONS: MlcCourtSummonsFormInput = {
  date: "",
  court_name: "",
  case_number: "",
  status: "pending",
  notes: "",
};
const EMPTY_POLICE_INTIMATION: MlcPoliceIntimationFormInput = {
  police_station: "",
  officer_name: "",
  officer_designation: "",
  officer_contact: "",
  sent_via: "phone",
  notes: "",
};
const EMPTY_POLICE_RECEIPT_CONFIRMATION: MlcPoliceReceiptConfirmationFormInput = {
  receipt_number: "",
  notes: "",
};
const EMPTY_MLC_PRINT_REPRINT: MlcPrintReprintFormInput = {
  packet_type: "documentation",
  reprint_reason: "",
};

const MLC_PRINT_PACKET_OPTIONS: Array<{ value: MlcPrintPacketTypeFormValue; label: string }> = [
  { value: "documentation", label: "Documentation packet" },
  { value: "register", label: "Register extract" },
];

type MlcPrintPreview =
  | { packetType: "documentation"; data: MlcDocumentationPrintData }
  | { packetType: "register"; data: MlcRegisterPrintData }
  | { packetType: "police-intimation"; data: MlcPoliceIntimationPrintData };

type MlcPrintAction = "print" | "reprint";

const MLC_PACKET_PRINT_COPIES: readonly PrintCopyRoute[] = PRINT_COPY_PACKETS.mlcPacket;
const MLC_POLICE_INTIMATION_PRINT_COPIES: readonly PrintCopyRoute[] =
  PRINT_COPY_PACKETS.mlcPoliceIntimation;
const MLC_REPRINT_COPIES: readonly PrintCopyRoute[] = PRINT_COPY_PACKETS.mlcReprint;

function mlcPrintCopies(packetType: MlcPrintPreview["packetType"], action: MlcPrintAction) {
  if (action === "reprint") return MLC_REPRINT_COPIES;
  return packetType === "police-intimation"
    ? MLC_POLICE_INTIMATION_PRINT_COPIES
    : MLC_PACKET_PRINT_COPIES;
}

function isMlcPrintPacketType(value: string | null): value is MlcPrintPacketTypeFormValue {
  return value === "documentation" || value === "register";
}

export function MlcCaseDetail({
  mlcCase,
  canViewPatientRecord,
}: {
  mlcCase: MlcCase;
  canViewPatientRecord: boolean;
}) {
  const qc = useQueryClient();
  const emit = useClinicalEmit();
  const canCreateSbar = useHasPermission(P.EMERGENCY.MLC_DOCUMENTS.SBAR_CREATE);
  const canCreateAgeEstimation = useHasPermission(P.EMERGENCY.MLC_DOCUMENTS.AGE_ESTIMATION_CREATE);
  const canCreatePocsoDocument = useHasPermission(P.EMERGENCY.MLC_DOCUMENTS.POCSO_CREATE);
  const canCreateCourtSummons = useHasPermission(P.EMERGENCY.MLC_DOCUMENTS.COURT_SUMMONS_CREATE);
  const canListMlcDocuments = useHasPermission(P.EMERGENCY.MLC_LIST);
  const canPrintMlc = useHasPermission(P.EMERGENCY.MLC_PRINT);
  const canReprintMlc = useHasPermission(P.EMERGENCY.MLC_REPRINT);
  const canListPoliceIntimations = useHasPermission(P.EMERGENCY.MLC_POLICE_INTIMATIONS.LIST);
  const canRecordPoliceIntimationPermission = useHasPermission(
    P.EMERGENCY.MLC_POLICE_INTIMATIONS.CREATE,
  );
  const canConfirmPoliceReceipt = useHasPermission(P.EMERGENCY.MLC_POLICE_INTIMATIONS.CONFIRM);
  const canPrintPoliceIntimation = useHasPermission(P.EMERGENCY.MLC_POLICE_INTIMATIONS.PRINT);
  const canReprintPoliceIntimation = useHasPermission(P.EMERGENCY.MLC_POLICE_INTIMATIONS.REPRINT);
  const canPrintMlcPacket = canPrintMlc && canViewPatientRecord;
  const canReprintMlcPacket = canReprintMlc && canViewPatientRecord;
  const canPrintPoliceIntimationPacket = canPrintPoliceIntimation && canViewPatientRecord;
  const canReprintPoliceIntimationPacket = canReprintPoliceIntimation && canViewPatientRecord;
  const firNumberAccess = useFieldAccess("emergency.mlc.fir_number");
  const policeStationAccess = useFieldAccess("emergency.mlc.police_station");
  const informantNameAccess = useFieldAccess("emergency.mlc.informant_name");
  const informantRelationAccess = useFieldAccess("emergency.mlc.informant_relation");
  const informantContactAccess = useFieldAccess("emergency.mlc.informant_contact");
  const historyAccess = useFieldAccess("emergency.mlc.history_of_incident");
  const examinationAccess = useFieldAccess("emergency.mlc.examination_findings");
  const medicalOpinionAccess = useFieldAccess("emergency.mlc.medical_opinion");
  const causeOfDeathAccess = useFieldAccess("emergency.mlc.cause_of_death");
  const pocsoReportAccess = useFieldAccess("emergency.mlc.pocso_report");
  const canViewPocsoReport = canViewSensitiveField(pocsoReportAccess);
  const canRecordPoliceIntimation =
    canRecordPoliceIntimationPermission && canEditSensitiveField(policeStationAccess);
  const canReviewPoliceIntimations =
    canListPoliceIntimations ||
    canRecordPoliceIntimation ||
    canConfirmPoliceReceipt ||
    canPrintPoliceIntimation ||
    canReprintPoliceIntimation;
  const canUsePoliceIntimations =
    canReviewPoliceIntimations ||
    canRecordPoliceIntimation ||
    canConfirmPoliceReceipt ||
    canPrintPoliceIntimation ||
    canReprintPoliceIntimation;
  const canCreatePocsoReport =
    canCreatePocsoDocument && mlcCase.is_pocso && canEditSensitiveField(pocsoReportAccess);
  const hasMlcDocumentActions =
    canCreateSbar ||
    canCreateAgeEstimation ||
    canCreatePocsoReport ||
    canCreateCourtSummons ||
    canRecordPoliceIntimation ||
    canConfirmPoliceReceipt ||
    canPrintPoliceIntimationPacket ||
    canReprintPoliceIntimationPacket ||
    canPrintMlcPacket ||
    canReprintMlcPacket;
  const canReviewMlcDocuments =
    canListMlcDocuments ||
    canCreateSbar ||
    canCreateAgeEstimation ||
    canCreatePocsoReport ||
    canCreateCourtSummons ||
    canPrintMlcPacket ||
    canReprintMlcPacket;

  // Sub-drawer state
  const [sbarOpened, { open: openSbar, close: closeSbar }] = useDisclosure(false);
  const [ageEstOpened, { open: openAgeEst, close: closeAgeEst }] = useDisclosure(false);
  const [pocsoOpened, { open: openPocso, close: closePocso }] = useDisclosure(false);
  const [summonsOpened, { open: openSummons, close: closeSummons }] = useDisclosure(false);
  const [policeIntimationOpened, { open: openPoliceIntimation, close: closePoliceIntimation }] =
    useDisclosure(false);
  const [policeReceiptOpened, { open: openPoliceReceipt, close: closePoliceReceipt }] =
    useDisclosure(false);
  const [mlcReprintOpened, { open: openMlcReprint, close: closeMlcReprint }] = useDisclosure(false);
  const [
    policeIntimationReprintOpened,
    { open: openPoliceIntimationReprint, close: closePoliceIntimationReprint },
  ] = useDisclosure(false);
  const [
    mlcPrintPreviewOpened,
    { open: openMlcPrintPreview, close: closeMlcPrintPreviewDisclosure },
  ] = useDisclosure(false);
  const [receiptTarget, setReceiptTarget] = useState<MlcPoliceIntimation | null>(null);
  const [policePrintTarget, setPolicePrintTarget] = useState<MlcPoliceIntimation | null>(null);
  const [mlcPrintPreview, setMlcPrintPreview] = useState<MlcPrintPreview | null>(null);
  const [lastMlcPrintAction, setLastMlcPrintAction] = useState<"print" | "reprint">("print");
  const mlcPrintRef = useRef<HTMLDivElement>(null);

  const {
    formState: { errors: sbarErrors },
    handleSubmit: handleSbarSubmit,
    register: registerSbar,
    reset: resetSbar,
  } = useForm<MlcSbarFormInput>({
    resolver: zodResolver(mlcSbarFormSchema),
    defaultValues: EMPTY_SBAR,
  });
  const {
    formState: { errors: ageEstErrors },
    handleSubmit: handleAgeEstSubmit,
    register: registerAgeEst,
    reset: resetAgeEst,
  } = useForm<MlcAgeEstimationFormInput>({
    resolver: zodResolver(mlcAgeEstimationFormSchema),
    defaultValues: EMPTY_AGE_EST,
  });
  const {
    control: pocsoControl,
    formState: { errors: pocsoErrors },
    handleSubmit: handlePocsoSubmit,
    register: registerPocso,
    reset: resetPocso,
  } = useForm<MlcPocsoReportFormInput>({
    resolver: zodResolver(mlcPocsoReportFormSchema),
    defaultValues: EMPTY_POCSO,
  });
  const {
    control: summonsControl,
    formState: { errors: summonsErrors },
    handleSubmit: handleSummonsSubmit,
    register: registerSummons,
    reset: resetSummons,
  } = useForm<MlcCourtSummonsFormInput>({
    resolver: zodResolver(mlcCourtSummonsFormSchema),
    defaultValues: EMPTY_SUMMONS,
  });
  const {
    control: policeIntimationControl,
    formState: { errors: policeIntimationErrors },
    handleSubmit: handlePoliceIntimationSubmit,
    register: registerPoliceIntimation,
    reset: resetPoliceIntimation,
  } = useForm<MlcPoliceIntimationFormInput>({
    resolver: zodResolver(mlcPoliceIntimationFormSchema),
    defaultValues: {
      ...EMPTY_POLICE_INTIMATION,
      police_station: mlcCase.police_station ?? "",
    },
  });
  const {
    formState: { errors: policeReceiptErrors },
    handleSubmit: handlePoliceReceiptSubmit,
    register: registerPoliceReceipt,
    reset: resetPoliceReceipt,
  } = useForm<MlcPoliceReceiptConfirmationFormInput>({
    resolver: zodResolver(mlcPoliceReceiptConfirmationFormSchema),
    defaultValues: EMPTY_POLICE_RECEIPT_CONFIRMATION,
  });
  const mlcReprintForm = useForm<MlcPrintReprintFormInput>({
    resolver: zodResolver(mlcPrintReprintFormSchema),
    defaultValues: EMPTY_MLC_PRINT_REPRINT,
  });
  const policeIntimationReprintForm = useForm<MlcPrintReprintFormInput>({
    resolver: zodResolver(mlcPrintReprintFormSchema),
    defaultValues: EMPTY_MLC_PRINT_REPRINT,
  });

  // Fetch documents for this MLC case
  const { data: documents = [] } = useQuery({
    queryKey: ["mlc-documents", mlcCase.id],
    queryFn: () => emergencyService.listMlcDocuments(mlcCase.id),
    enabled: canReviewMlcDocuments,
  });
  const { data: policeIntimations = [], isLoading: policeIntimationsLoading } = useQuery({
    queryKey: ["mlc-police-intimations", mlcCase.id],
    queryFn: () => emergencyService.listPoliceIntimations(mlcCase.id),
    enabled: canReviewPoliceIntimations,
  });

  const createDocMut = useMutation({
    mutationFn: (data: CreateMlcDocumentInput) =>
      emergencyService.createMlcDocument(mlcCase.id, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["mlc-documents", mlcCase.id] });
      notifications.show({ title: "Document Created", message: "MLC document saved successfully" });
    },
    onError: (e: Error) =>
      notifications.show({
        title: "Could not save MLC document",
        message: e.message,
        color: "red",
      }),
  });
  const createPoliceIntimationMut = useMutation({
    mutationFn: (data: CreatePoliceIntimationInput) =>
      emergencyService.createPoliceIntimation(mlcCase.id, data),
    onSuccess: (row) => {
      void qc.invalidateQueries({ queryKey: ["mlc-police-intimations", mlcCase.id] });
      emit(
        "emergency.mlc_police_intimation.created",
        mlcPoliceIntimationClinicalPayload(mlcCase, row),
      );
      closePoliceIntimation();
      resetPoliceIntimation({
        ...EMPTY_POLICE_INTIMATION,
        police_station: mlcCase.police_station ?? "",
      });
      notifications.show({
        title: "Police Intimation Saved",
        message: "MLC police intimation has been recorded",
      });
    },
    onError: (e: Error) =>
      notifications.show({
        title: "Could not save police intimation",
        message: e.message,
        color: "red",
      }),
  });
  const confirmPoliceReceiptMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ConfirmPoliceReceiptInput }) =>
      emergencyService.confirmPoliceReceipt(id, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["mlc-police-intimations", mlcCase.id] });
      closePoliceReceipt();
      setReceiptTarget(null);
      resetPoliceReceipt(EMPTY_POLICE_RECEIPT_CONFIRMATION);
      notifications.show({
        title: "Receipt Confirmed",
        message: "Police receipt confirmation has been recorded",
      });
    },
    onError: (e: Error) =>
      notifications.show({ title: "Could not confirm receipt", message: e.message, color: "red" }),
  });
  const mlcPrintMut = useMutation({
    mutationFn: async (variables: {
      packetType: MlcPrintPacketTypeFormValue;
      reprintReason?: string;
    }): Promise<MlcPrintPreview> => {
      const params = variables.reprintReason
        ? { reprint_reason: variables.reprintReason }
        : undefined;
      if (variables.packetType === "register") {
        return {
          packetType: "register",
          data: await emergencyService.getMlcRegisterPrintData(mlcCase.id, params),
        };
      }
      return {
        packetType: "documentation",
        data: await emergencyService.getMlcDocumentationPrintData(mlcCase.id, params),
      };
    },
    onSuccess: (preview, variables) => {
      setMlcPrintPreview(preview);
      setLastMlcPrintAction(variables.reprintReason ? "reprint" : "print");
      closeMlcReprint();
      mlcReprintForm.reset(EMPTY_MLC_PRINT_REPRINT);
      openMlcPrintPreview();
      notifications.show({
        title: variables.reprintReason ? "MLC reprint prepared" : "MLC print prepared",
        message:
          preview.packetType === "register"
            ? "MLC register extract is ready to print"
            : "MLC documentation packet is ready to print",
      });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to prepare MLC print packet", {
        title: "MLC print failed",
      });
    },
  });
  const policeIntimationPrintMut = useMutation({
    mutationFn: async (variables: {
      intimationId: string;
      reprintReason?: string;
    }): Promise<MlcPrintPreview> => {
      const params = variables.reprintReason
        ? { reprint_reason: variables.reprintReason }
        : undefined;
      return {
        packetType: "police-intimation",
        data: await emergencyService.getMlcPoliceIntimationPrintData(
          variables.intimationId,
          params,
        ),
      };
    },
    onSuccess: (preview, variables) => {
      setMlcPrintPreview(preview);
      setLastMlcPrintAction(variables.reprintReason ? "reprint" : "print");
      closePoliceIntimationReprint();
      setPolicePrintTarget(null);
      policeIntimationReprintForm.reset(EMPTY_MLC_PRINT_REPRINT);
      openMlcPrintPreview();
      notifications.show({
        title: variables.reprintReason
          ? "Police intimation reprint prepared"
          : "Police intimation print prepared",
        message: "MLC police intimation is ready to print",
      });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Unable to prepare police intimation print",
        { title: "Police intimation print failed" },
      );
    },
  });

  const submitSbar = handleSbarSubmit((values) => {
    if (!canCreateSbar) return;
    createDocMut.mutate({
      document_type: "sbar_handover",
      title: `SBAR Handover - ${mlcCase.mlc_number}`,
      content: values,
    });
    closeSbar();
    resetSbar(EMPTY_SBAR);
  });

  const submitAgeEst = handleAgeEstSubmit((values) => {
    if (!canCreateAgeEstimation) return;
    createDocMut.mutate({
      document_type: "age_estimation",
      title: `Age Estimation - ${mlcCase.mlc_number}`,
      content: values,
    });
    closeAgeEst();
    resetAgeEst(EMPTY_AGE_EST);
  });

  const submitPocso = handlePocsoSubmit((values) => {
    if (!canCreatePocsoReport) return;
    createDocMut.mutate({
      document_type: "pocso_report",
      title: `POCSO Report - ${mlcCase.mlc_number}`,
      content: values,
    });
    closePocso();
    resetPocso(EMPTY_POCSO);
  });

  const submitSummons = handleSummonsSubmit((values) => {
    if (!canCreateCourtSummons) return;
    createDocMut.mutate({
      document_type: "court_summons",
      title: `Court Summons - ${values.court_name}`,
      content: values,
    });
    closeSummons();
    resetSummons(EMPTY_SUMMONS);
  });
  const submitPoliceIntimation = handlePoliceIntimationSubmit((values) => {
    if (!canRecordPoliceIntimation) return;
    createPoliceIntimationMut.mutate({
      police_station: values.police_station.trim(),
      officer_name: emergencyOptionalText(values.officer_name),
      officer_designation: emergencyOptionalText(values.officer_designation),
      officer_contact: emergencyOptionalText(values.officer_contact),
      sent_via: values.sent_via,
      notes: emergencyOptionalText(values.notes),
    });
  });
  const openReceiptConfirmation = (row: MlcPoliceIntimation) => {
    setReceiptTarget(row);
    resetPoliceReceipt(EMPTY_POLICE_RECEIPT_CONFIRMATION);
    openPoliceReceipt();
  };
  const closeReceiptConfirmation = () => {
    closePoliceReceipt();
    setReceiptTarget(null);
    resetPoliceReceipt(EMPTY_POLICE_RECEIPT_CONFIRMATION);
  };
  const submitPoliceReceipt = handlePoliceReceiptSubmit((values) => {
    if (!canConfirmPoliceReceipt || !receiptTarget) return;
    confirmPoliceReceiptMut.mutate({
      id: receiptTarget.id,
      data: {
        receipt_number: values.receipt_number.trim(),
        notes: emergencyOptionalText(values.notes),
      },
    });
  });
  const prepareMlcPrint = (packetType: MlcPrintPacketTypeFormValue) => {
    if (!canPrintMlcPacket) return;
    mlcPrintMut.mutate({ packetType });
  };
  const prepareMlcReprint = mlcReprintForm.handleSubmit((values) => {
    if (!canReprintMlcPacket) return;
    mlcPrintMut.mutate({
      packetType: values.packet_type,
      reprintReason: values.reprint_reason.trim(),
    });
  });
  const preparePoliceIntimationPrint = (row: MlcPoliceIntimation) => {
    if (!canPrintPoliceIntimationPacket) return;
    policeIntimationPrintMut.mutate({ intimationId: row.id });
  };
  const openPoliceIntimationReprintModal = (row: MlcPoliceIntimation) => {
    setPolicePrintTarget(row);
    policeIntimationReprintForm.reset(EMPTY_MLC_PRINT_REPRINT);
    openPoliceIntimationReprint();
  };
  const closePoliceIntimationReprintModal = () => {
    closePoliceIntimationReprint();
    setPolicePrintTarget(null);
    policeIntimationReprintForm.reset(EMPTY_MLC_PRINT_REPRINT);
  };
  const preparePoliceIntimationReprint = policeIntimationReprintForm.handleSubmit((values) => {
    if (!canReprintPoliceIntimationPacket || !policePrintTarget) return;
    policeIntimationPrintMut.mutate({
      intimationId: policePrintTarget.id,
      reprintReason: values.reprint_reason.trim(),
    });
  });
  const closeMlcPrintPreviewModal = () => {
    closeMlcPrintPreviewDisclosure();
    setMlcPrintPreview(null);
  };

  // Filter documents by type
  const sbarDocs = documents.filter((d) => d.document_type === "sbar_handover");
  const ageEstDocs = documents.filter((d) => d.document_type === "age_estimation");
  const pocsoDocs = documents.filter((d) => d.document_type === "pocso_report");
  const courtSummonsDocs = documents.filter((d) => d.document_type === "court_summons");
  const mlcPrintPreviewTitle =
    mlcPrintPreview?.packetType === "police-intimation"
      ? "MLC Police Intimation"
      : mlcPrintPreview?.packetType === "register"
        ? "MLC Register Extract"
        : "MLC Documentation Packet";
  const mlcActivePrintCopies = mlcPrintPreview
    ? mlcPrintCopies(mlcPrintPreview.packetType, lastMlcPrintAction)
    : [];

  return (
    <>
      <Stack>
        {/* POCSO Banner */}
        {mlcCase.is_pocso && (
          <Alert
            tone="danger"
            variant="filled"
            icon={<IconAlertOctagon size={20} />}
            title="POCSO Case"
          >
            This is a POCSO (Protection of Children from Sexual Offences) case. All documentation
            must comply with POCSO Act, 2012. Ensure child-friendly procedures and mandatory
            reporting to police/SJPU within 24 hours.
          </Alert>
        )}

        {/* Case Info */}
        <Card withBorder p="md">
          <Group justify="space-between" mb="xs">
            <Title order={5}>{mlcCase.mlc_number}</Title>
            <Group gap="xs">
              {mlcCase.is_pocso && (
                <Badge tone="danger" size="lg">
                  POCSO
                </Badge>
              )}
              {mlcCase.is_death_case && (
                <Badge tone="neutral" size="lg">
                  Death Case
                </Badge>
              )}
              <Badge tone={mlcCase.status === "closed" ? "success" : "warning"} size="lg">
                {mlcCase.status}
              </Badge>
            </Group>
          </Group>
          <Text size="sm">
            <Text span fw={600}>
              Type:
            </Text>{" "}
            {mlcCase.case_type ?? "---"}
          </Text>
          <Text size="sm">
            <Text span fw={600}>
              Registered:
            </Text>{" "}
            {new Date(mlcCase.registered_at).toLocaleString()}
          </Text>
          {(mlcCase.fir_number || !canViewSensitiveField(firNumberAccess)) && (
            <Text size="sm">
              <Text span fw={600}>
                FIR #:
              </Text>{" "}
              {renderSensitiveValue(firNumberAccess, mlcCase.fir_number)}
            </Text>
          )}
          {(mlcCase.police_station || !canViewSensitiveField(policeStationAccess)) && (
            <Text size="sm">
              <Text span fw={600}>
                Police Station:
              </Text>{" "}
              {renderSensitiveValue(policeStationAccess, mlcCase.police_station)}
            </Text>
          )}
          {(mlcCase.history_of_incident || !canViewSensitiveField(historyAccess)) && (
            <Text size="sm">
              <Text span fw={600}>
                History:
              </Text>{" "}
              {renderSensitiveValue(historyAccess, mlcCase.history_of_incident)}
            </Text>
          )}
          {(mlcCase.informant_name || !canViewSensitiveField(informantNameAccess)) && (
            <Text size="sm">
              <Text span fw={600}>
                Informant:
              </Text>{" "}
              {renderSensitiveValue(informantNameAccess, mlcCase.informant_name)}
            </Text>
          )}
          {(mlcCase.informant_relation || !canViewSensitiveField(informantRelationAccess)) && (
            <Text size="sm">
              <Text span fw={600}>
                Informant relation:
              </Text>{" "}
              {renderSensitiveValue(informantRelationAccess, mlcCase.informant_relation)}
            </Text>
          )}
          {(mlcCase.informant_contact || !canViewSensitiveField(informantContactAccess)) && (
            <Text size="sm">
              <Text span fw={600}>
                Informant contact:
              </Text>{" "}
              {renderSensitiveValue(informantContactAccess, mlcCase.informant_contact)}
            </Text>
          )}
          {(mlcCase.examination_findings || !canViewSensitiveField(examinationAccess)) && (
            <Text size="sm">
              <Text span fw={600}>
                Examination:
              </Text>{" "}
              {renderSensitiveValue(examinationAccess, mlcCase.examination_findings)}
            </Text>
          )}
          {(mlcCase.medical_opinion || !canViewSensitiveField(medicalOpinionAccess)) && (
            <Text size="sm">
              <Text span fw={600}>
                Medical opinion:
              </Text>{" "}
              {renderSensitiveValue(medicalOpinionAccess, mlcCase.medical_opinion)}
            </Text>
          )}
          {(mlcCase.cause_of_death || !canViewSensitiveField(causeOfDeathAccess)) && (
            <Text size="sm">
              <Text span fw={600}>
                Cause of death:
              </Text>{" "}
              {renderSensitiveValue(causeOfDeathAccess, mlcCase.cause_of_death)}
            </Text>
          )}
        </Card>

        {/* Action Buttons */}
        {hasMlcDocumentActions && (
          <Group>
            {canCreateSbar && (
              <Button
                tone="secondary"
                leftSection={<IconShieldCheck size={16} />}
                onClick={openSbar}
              >
                SBAR Handover
              </Button>
            )}
            {canCreateAgeEstimation && (
              <Button tone="secondary" leftSection={<IconScale size={16} />} onClick={openAgeEst}>
                Age Estimation
              </Button>
            )}
            {canCreatePocsoReport && (
              <Button
                tone="subtle-danger"
                leftSection={<IconAlertOctagon size={16} />}
                onClick={openPocso}
              >
                POCSO Report
              </Button>
            )}
            {canCreateCourtSummons && (
              <Button tone="secondary" leftSection={<IconGavel size={16} />} onClick={openSummons}>
                Add Court Summons
              </Button>
            )}
            {canRecordPoliceIntimation && (
              <Button
                tone="secondary"
                leftSection={<IconBell size={16} />}
                onClick={() => {
                  resetPoliceIntimation({
                    ...EMPTY_POLICE_INTIMATION,
                    police_station: mlcCase.police_station ?? "",
                  });
                  openPoliceIntimation();
                }}
              >
                Police Intimation
              </Button>
            )}
            {canPrintMlcPacket && (
              <Menu position="bottom-end" withinPortal shadow="md">
                <Menu.Target>
                  <Button
                    tone="secondary"
                    leftSection={<IconPrinter size={16} />}
                    loading={mlcPrintMut.isPending}
                  >
                    Print MLC
                  </Button>
                </Menu.Target>
                <Menu.Dropdown>
                  {MLC_PRINT_PACKET_OPTIONS.map((option) => (
                    <Menu.Item
                      key={option.value}
                      leftSection={<IconFileText size={14} />}
                      onClick={() => prepareMlcPrint(option.value)}
                    >
                      {option.label}
                    </Menu.Item>
                  ))}
                </Menu.Dropdown>
              </Menu>
            )}
            {canReprintMlcPacket && (
              <Button
                tone="secondary"
                leftSection={<IconPrinter size={16} />}
                disabled={mlcPrintMut.isPending}
                onClick={() => {
                  mlcReprintForm.reset(EMPTY_MLC_PRINT_REPRINT);
                  openMlcReprint();
                }}
              >
                Reprint MLC
              </Button>
            )}
          </Group>
        )}

        <Divider />

        {canUsePoliceIntimations && (
          <Box>
            <Group justify="space-between" mb="xs">
              <Title order={6}>Police Intimations</Title>
              {canReviewPoliceIntimations && (
                <Badge tone="neutral">{policeIntimations.length} record(s)</Badge>
              )}
            </Group>
            {canReviewPoliceIntimations ? (
              <Paper withBorder>
                <DataTable
                  columns={[
                    {
                      key: "intimation_number",
                      label: "Intimation #",
                      render: (row: MlcPoliceIntimation) => (
                        <Text fw={600}>{row.intimation_number}</Text>
                      ),
                    },
                    {
                      key: "sent_at",
                      label: "Sent",
                      render: (row: MlcPoliceIntimation) => new Date(row.sent_at).toLocaleString(),
                    },
                    {
                      key: "police_station",
                      label: "Police Station",
                      render: (row: MlcPoliceIntimation) =>
                        renderSensitiveValue(policeStationAccess, row.police_station),
                    },
                    {
                      key: "officer",
                      label: "Officer",
                      render: (row: MlcPoliceIntimation) => (
                        <Stack gap={0}>
                          <Text size="sm">{row.officer_name ?? "---"}</Text>
                          {(row.officer_designation || row.officer_contact) && (
                            <Text size="xs" c="dimmed">
                              {[row.officer_designation, row.officer_contact]
                                .filter(Boolean)
                                .join(" · ")}
                            </Text>
                          )}
                        </Stack>
                      ),
                    },
                    {
                      key: "sent_via",
                      label: "Mode",
                      render: (row: MlcPoliceIntimation) =>
                        row.sent_via ? (
                          <TableValueBadge value={row.sent_via} kind="category" />
                        ) : (
                          "---"
                        ),
                    },
                    {
                      key: "receipt",
                      label: "Receipt",
                      render: (row: MlcPoliceIntimation) => (
                        <Stack gap={0}>
                          <Badge tone={row.receipt_confirmed ? "success" : "warning"} size="sm">
                            {row.receipt_confirmed ? "Confirmed" : "Pending"}
                          </Badge>
                          {row.receipt_number && (
                            <Text size="xs" c="dimmed">
                              Ref: {row.receipt_number}
                            </Text>
                          )}
                          {row.receipt_confirmed_at && (
                            <Text size="xs" c="dimmed">
                              {new Date(row.receipt_confirmed_at).toLocaleString()}
                            </Text>
                          )}
                        </Stack>
                      ),
                    },
                    {
                      key: "actions",
                      label: "Actions",
                      render: (row: MlcPoliceIntimation) => (
                        <Group gap={4} wrap="nowrap" justify="flex-end">
                          {canPrintPoliceIntimationPacket && (
                            <Tooltip label="Print police intimation">
                              <IconButton
                                tone="success"
                                aria-label="Print police intimation"
                                disabled={policeIntimationPrintMut.isPending}
                                onClick={() => preparePoliceIntimationPrint(row)}
                              >
                                <IconPrinter size={16} />
                              </IconButton>
                            </Tooltip>
                          )}
                          {canReprintPoliceIntimationPacket && (
                            <Tooltip label="Reprint police intimation">
                              <IconButton
                                aria-label="Reprint police intimation"
                                disabled={policeIntimationPrintMut.isPending}
                                onClick={() => openPoliceIntimationReprintModal(row)}
                              >
                                <IconPrinter size={16} />
                              </IconButton>
                            </Tooltip>
                          )}
                          {canConfirmPoliceReceipt && !row.receipt_confirmed && (
                            <Tooltip label="Confirm police receipt">
                              <IconButton
                                tone="success"
                                aria-label="Confirm police receipt"
                                disabled={confirmPoliceReceiptMut.isPending}
                                onClick={() => openReceiptConfirmation(row)}
                              >
                                <IconCheck size={16} />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Group>
                      ),
                    },
                  ]}
                  data={policeIntimations}
                  loading={policeIntimationsLoading}
                  rowKey={(row) => row.id}
                />
              </Paper>
            ) : (
              <Text size="sm" c="dimmed">
                Police intimation history is restricted for this role.
              </Text>
            )}
          </Box>
        )}

        {/* SBAR Handover Documents */}
        {sbarDocs.length > 0 && (
          <Box>
            <Title order={6} mb="xs">
              SBAR Handover Records
            </Title>
            <Stack gap="xs">
              {sbarDocs.map((doc) => {
                return (
                  <Card key={doc.id} withBorder p="sm">
                    <Text size="xs" c="dimmed" mb="xs">
                      {new Date(doc.created_at).toLocaleString()}
                    </Text>
                    <Text size="sm">
                      <Text span fw={600}>
                        S:
                      </Text>{" "}
                      {mlcDocumentText(doc.content, "situation")}
                    </Text>
                    <Text size="sm">
                      <Text span fw={600}>
                        B:
                      </Text>{" "}
                      {mlcDocumentText(doc.content, "background")}
                    </Text>
                    <Text size="sm">
                      <Text span fw={600}>
                        A:
                      </Text>{" "}
                      {mlcDocumentText(doc.content, "assessment")}
                    </Text>
                    <Text size="sm">
                      <Text span fw={600}>
                        R:
                      </Text>{" "}
                      {mlcDocumentText(doc.content, "recommendation")}
                    </Text>
                  </Card>
                );
              })}
            </Stack>
          </Box>
        )}

        {/* Age Estimation Documents */}
        {ageEstDocs.length > 0 && (
          <Box>
            <Title order={6} mb="xs">
              Age Estimation Reports
            </Title>
            <Stack gap="xs">
              {ageEstDocs.map((doc) => {
                return (
                  <Card key={doc.id} withBorder p="sm">
                    <Text size="xs" c="dimmed" mb="xs">
                      {new Date(doc.created_at).toLocaleString()}
                    </Text>
                    <Text size="sm">
                      <Text span fw={600}>
                        Ossification:
                      </Text>{" "}
                      {mlcDocumentText(doc.content, "ossification_center_findings")}
                    </Text>
                    <Text size="sm">
                      <Text span fw={600}>
                        Dental:
                      </Text>{" "}
                      {mlcDocumentText(doc.content, "dental_examination")}
                    </Text>
                    <Text size="sm">
                      <Text span fw={600}>
                        Secondary Sexual:
                      </Text>{" "}
                      {mlcDocumentText(doc.content, "secondary_sexual_characteristics")}
                    </Text>
                    <Text size="sm">
                      <Text span fw={600}>
                        Estimated Range:
                      </Text>{" "}
                      {mlcDocumentText(doc.content, "estimated_age_range")}
                    </Text>
                    <Text size="sm">
                      <Text span fw={600}>
                        Opinion:
                      </Text>{" "}
                      {mlcDocumentText(doc.content, "examiner_opinion")}
                    </Text>
                  </Card>
                );
              })}
            </Stack>
          </Box>
        )}

        {/* POCSO Reports */}
        {pocsoDocs.length > 0 && !canViewPocsoReport && (
          <Alert tone="neutral" icon={<IconAlertTriangle size={16} />}>
            POCSO report content is restricted for this role.
          </Alert>
        )}
        {pocsoDocs.length > 0 && canViewPocsoReport && (
          <Box>
            <Title order={6} mb="xs">
              POCSO Reports
            </Title>
            <Stack gap="xs">
              {pocsoDocs.map((doc) => (
                <Card key={doc.id} withBorder p="sm">
                  <Text size="xs" c="dimmed" mb="xs">
                    {new Date(doc.created_at).toLocaleString()}
                  </Text>
                  <Text size="sm">
                    <Text span fw={600}>
                      Child Age:
                    </Text>{" "}
                    {mlcDocumentSensitiveText(pocsoReportAccess, doc.content, "child_age")}
                  </Text>
                  <Text size="sm">
                    <Text span fw={600}>
                      Guardian:
                    </Text>{" "}
                    {mlcDocumentSensitiveText(pocsoReportAccess, doc.content, "guardian_details")}
                  </Text>
                  <Text size="sm">
                    <Text span fw={600}>
                      Statement:
                    </Text>{" "}
                    {mlcDocumentSensitiveText(pocsoReportAccess, doc.content, "statement_summary")}
                  </Text>
                  <Text size="sm">
                    <Text span fw={600}>
                      Injuries:
                    </Text>{" "}
                    {mlcDocumentSensitiveText(
                      pocsoReportAccess,
                      doc.content,
                      "injuries_documented",
                    )}
                  </Text>
                  <Text size="sm">
                    <Text span fw={600}>
                      Psych Assessment Needed:
                    </Text>{" "}
                    {mlcDocumentSensitiveBoolean(
                      pocsoReportAccess,
                      doc.content,
                      "psych_assessment_needed",
                    )}
                  </Text>
                </Card>
              ))}
            </Stack>
          </Box>
        )}

        {/* Court Summons */}
        <Box>
          <Group justify="space-between" mb="xs">
            <Title order={6}>Court Summons</Title>
            <Badge tone="neutral">{courtSummonsDocs.length} record(s)</Badge>
          </Group>
          {courtSummonsDocs.length > 0 ? (
            <Paper withBorder>
              <DataTable
                columns={[
                  {
                    key: "date",
                    label: "Date",
                    render: (d: MlcDocument) => {
                      const date = mlcDocumentText(d.content, "date");
                      return date === "---" ? date : new Date(date).toLocaleDateString();
                    },
                  },
                  {
                    key: "court_name",
                    label: "Court",
                    render: (d: MlcDocument) => mlcDocumentText(d.content, "court_name"),
                  },
                  {
                    key: "case_number",
                    label: "Case #",
                    render: (d: MlcDocument) => mlcDocumentText(d.content, "case_number"),
                  },
                  {
                    key: "status",
                    label: "Status",
                    render: (d: MlcDocument) => {
                      const status = mlcDocumentText(d.content, "status");
                      const s = status === "---" ? "pending" : status;
                      const tone: BadgeTone =
                        s === "attended"
                          ? "success"
                          : s === "adjourned"
                            ? "warning"
                            : s === "pending"
                              ? "primary"
                              : "neutral";
                      return (
                        <Badge tone={tone} size="sm">
                          {s}
                        </Badge>
                      );
                    },
                  },
                  {
                    key: "created_at",
                    label: "Created",
                    render: (d: MlcDocument) => new Date(d.created_at).toLocaleString(),
                  },
                ]}
                data={courtSummonsDocs}
                loading={false}
                rowKey={(r) => r.id}
              />
            </Paper>
          ) : (
            <Text size="sm" c="dimmed">
              No court summons recorded.
            </Text>
          )}
        </Box>
      </Stack>

      <Modal
        opened={mlcReprintOpened}
        onClose={() => {
          closeMlcReprint();
          mlcReprintForm.reset(EMPTY_MLC_PRINT_REPRINT);
        }}
        title="MLC reprint"
        centered
      >
        <form onSubmit={prepareMlcReprint}>
          <Stack gap="sm">
            <Controller
              name="packet_type"
              control={mlcReprintForm.control}
              render={({ field, fieldState }) => (
                <Select
                  label="Packet"
                  data={MLC_PRINT_PACKET_OPTIONS}
                  value={field.value}
                  onChange={(value) => {
                    if (isMlcPrintPacketType(value)) {
                      field.onChange(value);
                    }
                  }}
                  error={fieldState.error?.message}
                  required
                />
              )}
            />
            <Controller
              name="reprint_reason"
              control={mlcReprintForm.control}
              render={({ field, fieldState }) => (
                <Textarea
                  label="Reason"
                  placeholder="Example: original legal copy damaged or duplicate requested by police"
                  minRows={3}
                  error={fieldState.error?.message}
                  required
                  {...field}
                />
              )}
            />
            <Alert tone="warning" icon={<IconAlertTriangle size={16} />}>
              Reprints are audited and require a reason. First prints should use Print MLC.
            </Alert>
            <Group justify="flex-end">
              <Button
                tone="secondary"
                onClick={() => {
                  closeMlcReprint();
                  mlcReprintForm.reset(EMPTY_MLC_PRINT_REPRINT);
                }}
              >
                Cancel
              </Button>
              <Button tone="primary" type="submit" loading={mlcPrintMut.isPending}>
                Prepare reprint
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      <Modal
        opened={policeIntimationReprintOpened}
        onClose={closePoliceIntimationReprintModal}
        title="Police intimation reprint"
        centered
      >
        <form onSubmit={preparePoliceIntimationReprint}>
          <Stack gap="sm">
            {policePrintTarget && (
              <Alert tone="info" icon={<IconInfoCircle size={16} />}>
                Reprinting {policePrintTarget.intimation_number} for{" "}
                {renderSensitiveValue(policeStationAccess, policePrintTarget.police_station)}.
              </Alert>
            )}
            <Controller
              name="reprint_reason"
              control={policeIntimationReprintForm.control}
              render={({ field, fieldState }) => (
                <Textarea
                  label="Reason"
                  placeholder="Example: duplicate copy requested by police station"
                  minRows={3}
                  error={fieldState.error?.message}
                  required
                  {...field}
                />
              )}
            />
            <Alert tone="warning" icon={<IconAlertTriangle size={16} />}>
              Police intimation reprints are audited and require a reason.
            </Alert>
            <Group justify="flex-end">
              <Button tone="secondary" onClick={closePoliceIntimationReprintModal}>
                Cancel
              </Button>
              <Button tone="primary" type="submit" loading={policeIntimationPrintMut.isPending}>
                Prepare reprint
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      <Modal
        opened={mlcPrintPreviewOpened}
        onClose={closeMlcPrintPreviewModal}
        title={
          lastMlcPrintAction === "reprint"
            ? `${mlcPrintPreviewTitle} Reprint`
            : mlcPrintPreviewTitle
        }
        size="xl"
      >
        {mlcPrintPreview && (
          <Stack gap="md">
            <Box ref={mlcPrintRef} className="print-page">
              <Stack gap="md">
                <Group justify="space-between" align="flex-start">
                  <Box>
                    <Title order={4}>{mlcPrintPreviewTitle}</Title>
                    <Text size="sm" c="dimmed">
                      {mlcPrintPreview.packetType === "police-intimation"
                        ? "Police intimation print record"
                        : mlcPrintPreview.packetType === "register"
                          ? "Medico-legal register extract"
                          : "Consolidated medico-legal documentation packet"}
                    </Text>
                  </Box>
                  {lastMlcPrintAction === "reprint" && (
                    <Badge className="duplicate" tone="warning">
                      Duplicate
                    </Badge>
                  )}
                </Group>
                {mlcPrintPreview.packetType === "police-intimation" ? (
                  <MlcPoliceIntimationPrintPreview data={mlcPrintPreview.data} />
                ) : mlcPrintPreview.packetType === "register" ? (
                  <MlcRegisterPrintPreview data={mlcPrintPreview.data} />
                ) : (
                  <MlcDocumentationPrintPreview data={mlcPrintPreview.data} />
                )}
              </Stack>
            </Box>
            <Group gap={6}>
              {mlcActivePrintCopies.map((copy) => (
                <Badge key={copy.label} tone="accent">
                  {printCopyRouteLabel(copy)}
                </Badge>
              ))}
            </Group>
            <Group justify="flex-end">
              <Button tone="secondary" onClick={closeMlcPrintPreviewModal}>
                Close
              </Button>
              <Button
                tone="primary"
                leftSection={<IconPrinter size={14} />}
                onClick={() =>
                  printHtmlElement(mlcPrintPreviewTitle, mlcPrintRef.current, mlcActivePrintCopies)
                }
              >
                {lastMlcPrintAction === "reprint" ? "Print Duplicate" : "Print"}
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>

      {/* SBAR Handover Drawer */}
      <Drawer
        opened={sbarOpened}
        onClose={() => {
          closeSbar();
          resetSbar(EMPTY_SBAR);
        }}
        title="SBAR Handover"
        position="right"
        size="lg"
      >
        <Stack component="form" onSubmit={submitSbar}>
          <Alert tone="info" icon={<IconShieldCheck size={16} />}>
            SBAR (Situation-Background-Assessment-Recommendation) is a standardized communication
            tool for clinical handovers as recommended by WHO and NABH.
          </Alert>
          <Textarea
            label="Situation"
            description="Concise statement of the problem: who is the patient, what is the current concern?"
            error={sbarErrors.situation?.message}
            {...registerSbar("situation")}
            minRows={3}
            required
          />
          <Textarea
            label="Background"
            description="Pertinent history, context: relevant medical history, current medications, allergies, lab results"
            error={sbarErrors.background?.message}
            {...registerSbar("background")}
            minRows={3}
            required
          />
          <Textarea
            label="Assessment"
            description="Your clinical assessment: what you think the problem is"
            error={sbarErrors.assessment?.message}
            {...registerSbar("assessment")}
            minRows={3}
            required
          />
          <Textarea
            label="Recommendation"
            description="What you need: specific request, action needed, timeline"
            error={sbarErrors.recommendation?.message}
            {...registerSbar("recommendation")}
            minRows={3}
            required
          />
          <Button tone="primary" type="submit" loading={createDocMut.isPending}>
            Save SBAR Handover
          </Button>
        </Stack>
      </Drawer>

      {/* Age Estimation Drawer */}
      <Drawer
        opened={ageEstOpened}
        onClose={() => {
          closeAgeEst();
          resetAgeEst(EMPTY_AGE_EST);
        }}
        title="Age Estimation Documentation"
        position="right"
        size="lg"
      >
        <Stack component="form" onSubmit={submitAgeEst}>
          <Alert tone="info" icon={<IconScale size={16} />}>
            Age estimation is a medico-legal procedure. Document all findings carefully. Ensure the
            examination is conducted by an authorized medical officer.
          </Alert>
          <Textarea
            label="Ossification Center Findings"
            description="X-ray findings of wrist, elbow, pelvis, and other ossification centers"
            error={ageEstErrors.ossification_center_findings?.message}
            {...registerAgeEst("ossification_center_findings")}
            minRows={3}
            required
          />
          <Textarea
            label="Dental Examination"
            description="Eruption of teeth, third molar status, dental age assessment"
            error={ageEstErrors.dental_examination?.message}
            {...registerAgeEst("dental_examination")}
            minRows={3}
            required
          />
          <Textarea
            label="Secondary Sexual Characteristics"
            description="Development stage as per Tanner staging"
            error={ageEstErrors.secondary_sexual_characteristics?.message}
            {...registerAgeEst("secondary_sexual_characteristics")}
            minRows={3}
            required
          />
          <TextInput
            label="Estimated Age Range"
            description="e.g., 16-18 years"
            error={ageEstErrors.estimated_age_range?.message}
            {...registerAgeEst("estimated_age_range")}
            required
          />
          <Textarea
            label="Examiner Opinion"
            description="Final opinion on probable age with reasoning"
            error={ageEstErrors.examiner_opinion?.message}
            {...registerAgeEst("examiner_opinion")}
            minRows={3}
            required
          />
          <Button tone="primary" type="submit" loading={createDocMut.isPending}>
            Save Age Estimation
          </Button>
        </Stack>
      </Drawer>

      {/* POCSO Report Drawer */}
      <Drawer
        opened={pocsoOpened}
        onClose={() => {
          closePocso();
          resetPocso(EMPTY_POCSO);
        }}
        title="POCSO Report"
        position="right"
        size="lg"
      >
        <Stack component="form" onSubmit={submitPocso}>
          <Alert tone="danger" variant="filled" icon={<IconAlertOctagon size={16} />}>
            POCSO Act, 2012 mandates mandatory reporting. This report is a legal document. Ensure
            child-friendly language and procedures throughout.
          </Alert>
          <TextInput
            label="Child Age"
            description="Age of the child victim"
            error={pocsoErrors.child_age?.message}
            {...registerPocso("child_age")}
            required
          />
          <Textarea
            label="Guardian Details"
            description="Name, relation, contact of guardian/parent accompanying the child"
            error={pocsoErrors.guardian_details?.message}
            {...registerPocso("guardian_details")}
            minRows={2}
            required
          />
          <Textarea
            label="Statement Summary"
            description="Summary of statement in the child's own words (do not lead or suggest)"
            error={pocsoErrors.statement_summary?.message}
            {...registerPocso("statement_summary")}
            minRows={4}
            required
          />
          <Textarea
            label="Injuries Documented"
            description="Clinical findings: injuries, marks, physical examination findings"
            error={pocsoErrors.injuries_documented?.message}
            {...registerPocso("injuries_documented")}
            minRows={3}
            required
          />
          <Controller
            name="psych_assessment_needed"
            control={pocsoControl}
            render={({ field }) => (
              <Checkbox
                label="Psychological assessment needed"
                checked={field.value}
                onChange={(event) => field.onChange(event.currentTarget.checked)}
              />
            )}
          />
          <Button tone="danger" type="submit" loading={createDocMut.isPending}>
            Save POCSO Report
          </Button>
        </Stack>
      </Drawer>

      {/* Court Summons Drawer */}
      <Drawer
        opened={summonsOpened}
        onClose={() => {
          closeSummons();
          resetSummons(EMPTY_SUMMONS);
        }}
        title="Add Court Summons"
        position="right"
        size="md"
      >
        <Stack component="form" onSubmit={submitSummons}>
          <TextInput
            label="Date"
            type="date"
            error={summonsErrors.date?.message}
            {...registerSummons("date")}
            required
          />
          <TextInput
            label="Court Name"
            error={summonsErrors.court_name?.message}
            {...registerSummons("court_name")}
            required
          />
          <TextInput
            label="Case Number"
            error={summonsErrors.case_number?.message}
            {...registerSummons("case_number")}
            required
          />
          <Controller
            name="status"
            control={summonsControl}
            render={({ field }) => (
              <Select
                label="Status"
                data={[
                  { value: "pending", label: "Pending" },
                  { value: "attended", label: "Attended" },
                  { value: "adjourned", label: "Adjourned" },
                  { value: "cancelled", label: "Cancelled" },
                ]}
                value={field.value}
                onChange={field.onChange}
                error={summonsErrors.status?.message}
              />
            )}
          />
          <Textarea
            label="Notes"
            error={summonsErrors.notes?.message}
            {...registerSummons("notes")}
          />
          <Button tone="primary" type="submit" loading={createDocMut.isPending}>
            Save Court Summons
          </Button>
        </Stack>
      </Drawer>

      {/* Police Intimation Drawer */}
      <Drawer
        opened={policeIntimationOpened}
        onClose={() => {
          closePoliceIntimation();
          resetPoliceIntimation({
            ...EMPTY_POLICE_INTIMATION,
            police_station: mlcCase.police_station ?? "",
          });
        }}
        title="Record Police Intimation"
        position="right"
        size="md"
      >
        <Stack component="form" onSubmit={submitPoliceIntimation}>
          <Alert tone="info" icon={<IconBell size={16} />}>
            Record the mandatory police intimation details for this medico-legal case. The
            police-station field follows MLC field-access restrictions.
          </Alert>
          <Controller
            name="police_station"
            control={policeIntimationControl}
            render={({ field }) => (
              <TextInput
                label="Police Station"
                disabled={!canEditSensitiveField(policeStationAccess)}
                error={policeIntimationErrors.police_station?.message}
                required
                {...field}
              />
            )}
          />
          <TextInput
            label="Officer Name"
            error={policeIntimationErrors.officer_name?.message}
            {...registerPoliceIntimation("officer_name")}
          />
          <TextInput
            label="Officer Designation"
            error={policeIntimationErrors.officer_designation?.message}
            {...registerPoliceIntimation("officer_designation")}
          />
          <TextInput
            label="Officer Contact"
            error={policeIntimationErrors.officer_contact?.message}
            {...registerPoliceIntimation("officer_contact")}
          />
          <Controller
            name="sent_via"
            control={policeIntimationControl}
            render={({ field }) => (
              <Select
                label="Sent Via"
                data={emergencyMlcPoliceSentViaOptions}
                value={field.value}
                onChange={field.onChange}
                error={policeIntimationErrors.sent_via?.message}
                required
              />
            )}
          />
          <Textarea
            label="Notes"
            error={policeIntimationErrors.notes?.message}
            {...registerPoliceIntimation("notes")}
            minRows={3}
          />
          <Button tone="primary" type="submit" loading={createPoliceIntimationMut.isPending}>
            Save Police Intimation
          </Button>
        </Stack>
      </Drawer>

      <Modal
        opened={policeReceiptOpened}
        onClose={closeReceiptConfirmation}
        title="Confirm Police Receipt"
        centered
      >
        <Stack component="form" onSubmit={submitPoliceReceipt}>
          {receiptTarget && (
            <Alert tone="success" icon={<IconCheck size={16} />}>
              Confirming receipt for {receiptTarget.intimation_number}
            </Alert>
          )}
          <TextInput
            label="Receipt / reference number"
            error={policeReceiptErrors.receipt_number?.message}
            {...registerPoliceReceipt("receipt_number")}
            required
          />
          <Textarea
            label="Receipt notes"
            error={policeReceiptErrors.notes?.message}
            {...registerPoliceReceipt("notes")}
            minRows={3}
          />
          <Group justify="flex-end">
            <Button tone="ghost" onClick={closeReceiptConfirmation}>
              Cancel
            </Button>
            <Button tone="primary" type="submit" loading={confirmPoliceReceiptMut.isPending}>
              Confirm Receipt
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
