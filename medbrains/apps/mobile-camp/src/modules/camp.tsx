import type { Module } from "@medbrains/mobile-shell";
import {
  type Camp,
  type CampPacketDepartmentRef,
  type CampPacketDiagnosisHistory,
  type CampPacketLabTestRef,
  type CampPacketMedicationHistory,
  type CampPacketPatientSummary,
  type CampPacketRegistrationHistory,
  type CampPacketResponse,
  type CampPacketVisitHistory,
  type CampPacketVital,
  type CampRegistration,
  type CampRemoteChecklistItem,
  type CampSupplyItem,
  type CampSyncInboundEvent,
  P,
  type Patient,
  type PatientContext,
} from "@medbrains/types";
import { Card, COLORS, EcgLoader, Empty, MobileTextField, SPACING } from "@medbrains/ui-mobile";
import * as Crypto from "expo-crypto";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { Button, Menu, Text } from "react-native-paper";
import {
  getCampPacket,
  getPatientContext,
  listCamps,
  listPatients,
  syncCampInbound,
} from "../api/camp.js";
import { EntityRow } from "../components/entity-row.js";
import type { ModuleAction } from "../components/module-home.js";
import { ModuleHome } from "../components/module-home.js";
import { ModuleRouter, useModuleRouter } from "../components/module-router.js";
import { ScreenHeader } from "../components/screen-header.js";
import type { CampHistoryState, CampTestState } from "../components/screening-clinical-fields.js";
import {
  CAMP_HISTORY_QUESTIONS,
  CAMP_TEST_FIELDS,
  CampHistoryFields,
  CampTestFields,
  campHistoryAnswerToBool,
} from "../components/screening-clinical-fields.js";
import { useFetch } from "../lib/use-fetch.js";
import type { CampOperationMode } from "../state/camp-session.js";
import { useCampSession } from "../state/camp-session.js";
import {
  type CampPacketMeta,
  loadActiveCampPacket,
  loadCampPacket,
  loadCampPacketMeta,
  markCampEventsFailed,
  queueCampEvent,
  readCampOutbox,
  removeSyncedCampEvents,
  type StoredCampEvent,
  saveCampPacket,
  wipeCampPacket,
} from "../storage/camp-local-store.js";

type PatientChartTab =
  | "summary"
  | "actions"
  | "registrations"
  | "vitals"
  | "visits"
  | "diagnosis"
  | "medicines"
  | "current";

interface CampPatientPayload {
  packet: CampPacketResponse;
  registrationId: string;
  patientId: string | null;
}

interface LivePatientPayload {
  camp: Camp;
  patient: Patient;
}

interface PacketPatientRow {
  key: string;
  registration: CampRegistration;
  patient: CampPacketPatientSummary | null;
  searchText: string;
}

function CampHome(): ReactNode {
  const router = useModuleRouter();
  const selectedCamp = useCampSession((state) => state.selectedCamp);
  const packet = useCampSession((state) => state.packet);
  const pendingEvents = useCampSession((state) => state.pendingEvents);
  const operationMode = useCampSession((state) => state.operationMode);
  const setSessionPacket = useCampSession((state) => state.setPacket);
  const setSessionPendingEvents = useCampSession((state) => state.setPendingEvents);
  const [packetMeta, setPacketMeta] = useState<CampPacketMeta | null>(null);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (selectedCamp || packet) {
      setRestoring(false);
      return () => {
        cancelled = true;
      };
    }
    setRestoring(true);
    loadActiveCampPacket()
      .then(async (restoredPacket) => {
        if (!restoredPacket) {
          return;
        }
        const outbox = await readCampOutbox(restoredPacket.camp.id);
        if (!cancelled) {
          setSessionPacket(restoredPacket);
          setSessionPendingEvents(outbox.length);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setRestoring(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedCamp, packet, setSessionPacket, setSessionPendingEvents]);

  useEffect(() => {
    let cancelled = false;
    if (!selectedCamp) {
      setPacketMeta(null);
      return () => {
        cancelled = true;
      };
    }
    loadCampPacketMeta(selectedCamp.id).then((meta) => {
      if (!cancelled) {
        setPacketMeta(meta);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [selectedCamp]);

  const packetExpired = packetMeta?.expired ?? false;
  const packetReady = !!packet && !packetExpired;
  const onlineMode = operationMode === "hospital_online" || operationMode === "hybrid";
  const workflowActions: ModuleAction[] = selectedCamp
    ? [
        {
          id: "intake",
          label: "Camp registration",
          description:
            "OPD-style camp registration for walk-ins and pre-listed patients, usable offline.",
          permission: P.CAMP.REGISTRATIONS_CREATE,
          badge: { label: "OFFLINE", tone: "neutral" },
          onPress: () => router.push("intake"),
        },
        {
          id: "opd",
          label: "OPD consultation",
          description:
            packetReady || onlineMode
              ? onlineMode
                ? "Use live hospital EMR search for all patients; keep a packet only when leaving the network."
                : "Search the local packet, open the patient mini-EMR, record vitals, diagnosis, labs and referral."
              : "Choose hospital online or download a local patient packet before starting OPD consultation.",
          permission: P.CAMP.REGISTRATIONS_LIST,
          badge: {
            label: onlineMode
              ? "LIVE EMR"
              : packetReady
                ? "LOCAL EMR"
                : packetExpired
                  ? "EXPIRED"
                  : "MODE",
            tone: packetReady || onlineMode ? "success" : packetExpired ? "alert" : "warn",
          },
          onPress:
            packetReady || onlineMode ? () => router.push("patients") : () => router.push("packet"),
        },
        {
          id: "fieldOps",
          label: "Readiness, supplies and safety",
          description: "NABH checklist, infection control, BMW, supplies and paper fallback.",
          permission: P.CAMP.LIST,
          badge: { label: "NABH", tone: "neutral" },
          onPress: packetReady ? () => router.push("fieldOps") : () => router.push("packet"),
        },
        {
          id: "sync",
          label: "Sync center",
          description: "Review queued records and sync when network returns.",
          permission: P.CAMP.LIST,
          badge: { label: String(pendingEvents), tone: pendingEvents > 0 ? "warn" : "success" },
          onPress: () => router.push("sync"),
        },
      ]
    : [
        {
          id: "selectCamp",
          label: "Select camp workspace",
          description: "Choose today's camp once, then the app stays inside that workspace.",
          permission: P.CAMP.LIST,
          badge: { label: "SETUP", tone: "warn" },
          onPress: () => router.push("camps"),
        },
      ];
  return (
    <ModuleHome
      eyebrow="FIELD"
      title={selectedCamp ? selectedCamp.name : "Camp Mode"}
      description={
        selectedCamp
          ? `${selectedCamp.camp_code} · ${selectedCamp.scheduled_date} · ${selectedCamp.venue_city ?? "Remote site"}`
          : "Select today's camp once. The app then stays inside that camp workspace."
      }
      tags={["Mobile-Camp", "offline packet", "patient roster", "sync"]}
      trailing={
        selectedCamp ? (
          <View style={{ alignItems: "flex-end", gap: SPACING.xs }}>
            <Button compact mode="outlined" onPress={() => router.push("packet")}>
              Mode / Packet
            </Button>
            <Button compact mode="text" onPress={() => router.push("camps")}>
              Switch
            </Button>
          </View>
        ) : undefined
      }
      loading={restoring}
      summaries={[
        { eyebrow: "CAMP", count: selectedCamp ? "1" : "0", title: "Active workspace" },
        {
          eyebrow: "MODE",
          count: operationModeLabel(operationMode),
          title: "Camp setup",
        },
        {
          eyebrow: "PACKET",
          count: packet ? packet.registrations.length : "—",
          title: "Local records",
        },
        { eyebrow: "SYNC", count: pendingEvents, title: "Pending outbox" },
      ]}
      actions={workflowActions}
    />
  );
}

function CampListScreen(): ReactNode {
  const router = useModuleRouter();
  const setSelectedCamp = useCampSession((state) => state.setSelectedCamp);
  const { data, loading, error, refetch } = useFetch(() => listCamps(), []);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const camps = data ?? [];
  const filteredCamps = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) {
      return camps;
    }
    return camps.filter((camp) => campSearchText(camp).includes(q));
  }, [camps, search]);

  useEffect(() => {
    if (!loading) {
      setRefreshing(false);
    }
  }, [loading]);

  function refreshCampList(): void {
    setRefreshing(true);
    refetch();
  }

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.canvas }}>
      <ScreenHeader
        eyebrow="Camp settings"
        title="Select Camp"
        description="Pick the active camp workspace once. You can switch from the home header."
        loadingLabel={refreshing ? "Refreshing camp workspaces" : undefined}
        trailing={
          <Button compact mode="text" loading={refreshing} onPress={refreshCampList}>
            Refresh
          </Button>
        }
      />
      <ScrollView
        contentContainerStyle={{ padding: SPACING.md, gap: SPACING.sm }}
        refreshControl={<EcgPullRefresh refreshing={refreshing} onRefresh={refreshCampList} />}
      >
        <MobileTextField
          label="Search by camp code, name, village, district or pincode"
          value={search}
          onChangeText={setSearch}
        />
        {loading && !refreshing && <LoadingCard title="Loading camp workspaces" />}
        {!loading && error && (
          <Empty
            title="Couldn't load camps"
            description={error}
            actionLabel="Retry"
            onAction={refetch}
          />
        )}
        {!loading && !error && (
          <Text variant="bodySmall" style={{ color: COLORS.brandDeep, opacity: 0.75 }}>
            {filteredCamps.length} of {camps.length} camps
          </Text>
        )}
        {!loading && !error && filteredCamps.length === 0 && (
          <Empty
            title="No camp found"
            description="Try camp code, camp name, village, district, state, pincode, or status."
          />
        )}
        {!loading &&
          !error &&
          filteredCamps.map((camp) => (
            <EntityRow
              key={camp.id}
              title={camp.name}
              subtitle={campSubtitle(camp)}
              badge={{
                label: camp.status,
                tone: camp.status === "active" ? "success" : "neutral",
              }}
              onPress={() => {
                setSelectedCamp(camp);
                router.replace("packet", camp);
              }}
            />
          ))}
      </ScrollView>
    </View>
  );
}

function campSearchText(camp: Camp): string {
  return [
    camp.camp_code,
    camp.name,
    camp.camp_type,
    camp.status,
    camp.scheduled_date,
    camp.venue_name,
    camp.venue_city,
    camp.venue_state,
    camp.venue_pincode,
    camp.venue_address,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function campSubtitle(camp: Camp): string {
  return [
    camp.camp_code,
    formatDate(camp.scheduled_date),
    camp.venue_city ?? "Remote site",
    camp.venue_state,
    camp.venue_pincode,
  ]
    .filter(Boolean)
    .join(" · ");
}

function PacketScreen({ camp: routeCamp }: { camp?: Camp }): ReactNode {
  const router = useModuleRouter();
  const selectedCamp = useCampSession((state) => state.selectedCamp);
  const sessionPacket = useCampSession((state) => state.packet);
  const sessionPendingEvents = useCampSession((state) => state.pendingEvents);
  const operationMode = useCampSession((state) => state.operationMode);
  const setSessionCamp = useCampSession((state) => state.setSelectedCamp);
  const setSessionPacket = useCampSession((state) => state.setPacket);
  const setSessionPendingEvents = useCampSession((state) => state.setPendingEvents);
  const setOperationMode = useCampSession((state) => state.setOperationMode);
  const clearCurrentCamp = useCampSession((state) => state.clearCurrentCamp);
  const camp = routeCamp ?? selectedCamp;
  const [packet, setPacket] = useState<CampPacketResponse | null>(
    camp && sessionPacket?.camp.id === camp.id ? sessionPacket : null,
  );
  const [pendingEvents, setPendingEvents] = useState(sessionPendingEvents);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (!camp) {
      return;
    }
    let cancelled = false;
    setSessionCamp(camp);
    Promise.all([loadCampPacket(camp.id), readCampOutbox(camp.id), loadCampPacketMeta(camp.id)])
      .then(([cachedPacket, outbox, meta]) => {
        if (cancelled) return;
        setPendingEvents(outbox.length);
        setSessionPendingEvents(outbox.length);
        setExpired(meta?.expired ?? false);
        if (cachedPacket) {
          setPacket(cachedPacket);
          setSessionPacket(cachedPacket);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPendingEvents(0);
          setSessionPendingEvents(0);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [camp, setSessionCamp, setSessionPacket, setSessionPendingEvents]);

  if (!camp) {
    return (
      <MissingCampScreen
        title="No active camp"
        description="Select today's camp once. The app will keep that camp as the active workspace."
      />
    );
  }
  const activeCamp = camp;
  const onlineMode = operationMode === "hospital_online" || operationMode === "hybrid";
  const packetMode = operationMode === "remote_offline" || operationMode === "hybrid";

  async function downloadPacket(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const downloaded = await getCampPacket(activeCamp.id);
      await saveCampPacket(downloaded);
      setPacket(downloaded);
      setSessionPacket(downloaded);
      setExpired(false);
      const outboxCount = (await readCampOutbox(activeCamp.id)).length;
      setPendingEvents(outboxCount);
      setSessionPendingEvents(outboxCount);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Packet download failed");
    } finally {
      setLoading(false);
    }
  }

  async function refreshPacket(): Promise<void> {
    setRefreshing(true);
    try {
      await downloadPacket();
    } finally {
      setRefreshing(false);
    }
  }

  async function wipeCurrentPacket(): Promise<void> {
    await wipeCampPacket(activeCamp.id);
    clearCurrentCamp();
    router.push("home");
  }

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.canvas }}>
      <ScreenHeader
        eyebrow="Packet"
        title={activeCamp.name}
        description="Choose how this camp will run: live hospital EMR, remote offline packet, or hybrid."
        loadingLabel={refreshing ? "Refreshing camp packet" : undefined}
      />
      {error && (
        <Empty
          title="Packet unavailable"
          description={error}
          actionLabel="Retry"
          onAction={downloadPacket}
        />
      )}
      {!error && (
        <ScrollView
          contentContainerStyle={{ padding: SPACING.md, gap: SPACING.sm }}
          refreshControl={<EcgPullRefresh refreshing={refreshing} onRefresh={refreshPacket} />}
        >
          <OperationModeChooser
            mode={operationMode}
            packetReady={!!packet}
            onChange={setOperationMode}
          />
          {loading && !refreshing && <LoadingCard title="Downloading local camp packet" />}
          {!packet && !loading && onlineMode && (
            <Card eyebrow="Hospital online" title="Live EMR ready" pattern="success">
              <Text variant="bodyMedium" style={{ color: COLORS.ink, marginBottom: SPACING.sm }}>
                Use this for camps inside the hospital or on trusted hospital Wi-Fi. The app
                searches the live patient registry instead of limiting staff to the downloaded camp
                segment.
              </Text>
              <View style={{ gap: SPACING.xs }}>
                <Button mode="contained" onPress={() => router.push("patients")}>
                  Open Live Patient Search
                </Button>
                <Button mode="contained-tonal" onPress={() => router.push("intake")}>
                  Register Camp Walk-in
                </Button>
              </View>
            </Card>
          )}
          {!packet && !loading && packetMode && (
            <Card
              eyebrow="Local packet"
              title={expired ? "Expired and wiped" : "Not downloaded"}
              pattern={expired ? "alert" : "aqua"}
            >
              <Text variant="bodyMedium" style={{ color: COLORS.ink, marginBottom: SPACING.sm }}>
                {expired
                  ? "The old packet crossed its expiry window and the app deleted its encryption key. Re-download with network before field use."
                  : "Download camp data, assigned patient records, allergies, vitals, registration history, diagnoses, and medicines before travelling to the village."}
              </Text>
              <Button
                mode="contained"
                loading={loading}
                disabled={loading}
                onPress={downloadPacket}
              >
                Download Local Camp Packet
              </Button>
              {expired && (
                <Button mode="text" textColor={COLORS.red} onPress={wipeCurrentPacket}>
                  Leave Camp Workspace
                </Button>
              )}
            </Card>
          )}
          {packet && (
            <PacketSummary
              packet={packet}
              pendingEvents={pendingEvents}
              refreshing={loading || refreshing}
              onRefresh={refreshPacket}
              onOpenPatients={() => router.push("patients")}
              onStartIntake={() => router.push("intake")}
              onOpenFieldOps={() => router.push("fieldOps")}
              onOpenSync={() => router.push("sync")}
            />
          )}
        </ScrollView>
      )}
    </View>
  );
}

function PacketSummary({
  packet,
  pendingEvents,
  refreshing,
  onRefresh,
  onOpenPatients,
  onStartIntake,
  onOpenFieldOps,
  onOpenSync,
}: {
  packet: CampPacketResponse;
  pendingEvents: number;
  refreshing: boolean;
  onRefresh: () => void;
  onOpenPatients: () => void;
  onStartIntake: () => void;
  onOpenFieldOps: () => void;
  onOpenSync: () => void;
}): ReactNode {
  const registrations = packet.registrations ?? [];
  const screenings = packet.screenings ?? [];
  const labSamples = packet.lab_samples ?? [];
  const patients = packet.patient_summaries ?? [];
  const visits = packet.visit_history ?? [];
  const medicines = packet.medication_history ?? [];
  const checklist = packet.remote_checklist ?? [];
  const supplies = packet.supplies ?? [];
  const departments = packet.department_refs ?? [];
  const doctors = packet.doctor_refs ?? [];
  const labTests = packet.lab_test_refs ?? [];
  const pharmacyStock = packet.pharmacy_stock_refs ?? [];

  return (
    <View style={{ gap: SPACING.sm }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm }}>
        <Metric label="Registrations" value={registrations.length} />
        <Metric label="Screenings" value={screenings.length} />
        <Metric label="Lab samples" value={labSamples.length} />
        <Metric label="Linked patients" value={patients.length} />
        <Metric label="Past visits" value={visits.length} />
        <Metric label="Medicines" value={medicines.length} />
        <Metric label="Departments" value={departments.length} />
        <Metric label="Doctors" value={doctors.length} />
        <Metric label="Lab catalog" value={labTests.length} />
        <Metric label="Pharmacy stock" value={pharmacyStock.length} />
        <Metric label="Readiness items" value={checklist.length} />
        <Metric label="Supplies" value={supplies.length} />
        <Metric label="Outbox pending" value={pendingEvents} />
      </View>
      <Card eyebrow="Packet" title={packet.packet_revision} pattern="aqua">
        <Text variant="bodyMedium" style={{ color: COLORS.ink }}>
          Expires {new Date(packet.expires_at).toLocaleString()}
        </Text>
        <Text variant="bodySmall" style={{ color: COLORS.brandDeep, opacity: 0.75, marginTop: 4 }}>
          Includes camp data, team, intake records, patient search, registration history, prior
          visits, vitals, diagnosis history, medicines, active allergy warnings, departments,
          doctors, lab catalog, and pharmacy stock refs for linked patients and field work.
        </Text>
      </Card>
      <View style={{ gap: SPACING.sm }}>
        <Card eyebrow="Existing patients" title="Patient Search / OPD Mini-EMR" pattern="clinical">
          <Text variant="bodyMedium" style={{ color: COLORS.ink, marginBottom: SPACING.sm }}>
            Search downloaded UHID, walk-in, phone, village, complaint, or history. Open the patient
            chart to see prior visits, vitals, diagnosis, medicines, allergies and current camp
            actions without network.
          </Text>
          <Button mode="contained" onPress={onOpenPatients}>
            Open Existing Patients
          </Button>
        </Card>
        <Card eyebrow="New walk-in" title="Camp Patient Registration" pattern="aqua">
          <Text variant="bodyMedium" style={{ color: COLORS.ink, marginBottom: SPACING.sm }}>
            Register a new village patient first, then continue vitals, provisional diagnosis, lab
            sample and referral in the same offline queue.
          </Text>
          <Button mode="contained-tonal" onPress={onStartIntake}>
            Register New Patient
          </Button>
        </Card>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm }}>
        <Button mode="outlined" onPress={onOpenFieldOps}>
          Field Readiness
        </Button>
        <Button mode="outlined" onPress={onOpenSync}>
          Sync Center
        </Button>
        <Button mode="text" loading={refreshing} disabled={refreshing} onPress={onRefresh}>
          Re-download
        </Button>
      </View>
      <Card
        eyebrow="Remote setup"
        title={packet.remote_setup?.status ?? "Not initialized"}
        pattern="copper"
      >
        <Text variant="bodyMedium" style={{ color: COLORS.ink }}>
          Village/site readiness, IPC/BMW controls, referral route, staff briefing, and paper
          fallback must be completed before field use.
        </Text>
      </Card>
    </View>
  );
}

function OperationModeChooser({
  mode,
  packetReady,
  onChange,
}: {
  mode: CampOperationMode;
  packetReady: boolean;
  onChange: (mode: CampOperationMode) => void;
}): ReactNode {
  const options: Array<{
    id: CampOperationMode;
    title: string;
    body: string;
    badge: string;
  }> = [
    {
      id: "remote_offline",
      title: "Remote village / offline",
      body: "Download only the camp segment. Use when the team leaves hospital network coverage.",
      badge: packetReady ? "PACKET READY" : "DOWNLOAD",
    },
    {
      id: "hospital_online",
      title: "Inside hospital / online",
      body: "Use live patient registry and full hospital EMR. No packet required.",
      badge: "LIVE",
    },
    {
      id: "hybrid",
      title: "Hybrid",
      body: "Use live EMR while online, but keep a local packet ready for network loss.",
      badge: packetReady ? "LIVE + LOCAL" : "LIVE + PACKET",
    },
  ];

  return (
    <Card eyebrow="Camp operation" title={operationModeTitle(mode)} pattern="clinical">
      <Text variant="bodyMedium" style={{ color: COLORS.ink, marginBottom: SPACING.sm }}>
        Choose this before starting work. Hospital-site camps should use live EMR; rural camps
        should download a scoped encrypted packet.
      </Text>
      <View style={{ gap: SPACING.xs }}>
        {options.map((option) => {
          const selected = option.id === mode;
          return (
            <Button
              key={option.id}
              mode={selected ? "contained" : "outlined"}
              onPress={() => onChange(option.id)}
            >
              {option.title} · {option.badge}
            </Button>
          );
        })}
      </View>
      <Text variant="bodySmall" style={{ color: COLORS.brandDeep, opacity: 0.75, marginTop: 8 }}>
        {options.find((option) => option.id === mode)?.body}
      </Text>
    </Card>
  );
}

function LoadingCard({ title }: { title: string }): ReactNode {
  return (
    <Card eyebrow="Loading" title={title} pattern="clinical">
      <View style={{ alignItems: "center", paddingVertical: SPACING.sm }}>
        <EcgLoader width={220} />
      </View>
    </Card>
  );
}

function EcgPullRefresh({
  refreshing,
  onRefresh,
}: {
  refreshing: boolean;
  onRefresh: () => void;
}): ReactNode {
  return (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      tintColor={COLORS.emerald}
      colors={[COLORS.emerald, COLORS.brand]}
      progressBackgroundColor={COLORS.canvas}
    />
  );
}

function MissingCampScreen({
  title,
  description,
  actionLabel = "Select Camp",
  route = "camps",
}: {
  title: string;
  description: string;
  actionLabel?: string;
  route?: string;
}): ReactNode {
  const router = useModuleRouter();
  return (
    <View style={{ flex: 1, backgroundColor: COLORS.canvas }}>
      <ScreenHeader eyebrow="Camp workspace" title={title} description={description} />
      <View style={{ padding: SPACING.md }}>
        <Card eyebrow="Action needed" title={title} pattern="alert">
          <Text variant="bodyMedium" style={{ color: COLORS.ink, marginBottom: SPACING.sm }}>
            {description}
          </Text>
          <Button mode="contained" onPress={() => router.push(route)}>
            {actionLabel}
          </Button>
        </Card>
      </View>
    </View>
  );
}

function FieldOpsScreen({ packet: routePacket }: { packet?: CampPacketResponse }): ReactNode {
  const sessionPacket = useCampSession((state) => state.packet);
  const packet = routePacket ?? sessionPacket;
  const [checklist, setChecklist] = useState(packet?.remote_checklist ?? []);
  const [supplies, setSupplies] = useState(packet?.supplies ?? []);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const readiness = useMemo(() => calculateReadiness(checklist), [checklist]);

  useEffect(() => {
    setChecklist(packet?.remote_checklist ?? []);
    setSupplies(packet?.supplies ?? []);
  }, [packet]);

  if (!packet) {
    return (
      <MissingCampScreen
        title="Packet required"
        description="Download the active camp packet before using readiness, supplies and safety."
        actionLabel="Open Packet"
        route="packet"
      />
    );
  }
  const activePacket = packet;

  async function updateChecklist(
    item: CampRemoteChecklistItem,
    status: CampRemoteChecklistItem["status"],
  ): Promise<void> {
    setBusyKey(item.id);
    setMessage(null);
    const event = makeSyncEvent("camp.checklist.update", item.id, {
      checklist_item_id: item.id,
      status,
      notes: status === "ok" ? "Verified in field app" : "Needs attention from field team",
    });
    await queueAndPublishCampEvent(activePacket.camp.id, event);
    setChecklist((rows) =>
      rows.map((row) =>
        row.id === item.id ? { ...row, status, checked_at: new Date().toISOString() } : row,
      ),
    );
    setMessage("Checklist update queued locally");
    setBusyKey(null);
  }

  async function consumeSupply(item: CampSupplyItem): Promise<void> {
    setBusyKey(item.id);
    setMessage(null);
    const consumedQty = item.consumed_qty + 1;
    const event = makeSyncEvent("camp.supply.update", item.id, {
      supply_item_id: item.id,
      consumed_qty: consumedQty,
    });
    await queueAndPublishCampEvent(activePacket.camp.id, event);
    setSupplies((rows) =>
      rows.map((row) => (row.id === item.id ? { ...row, consumed_qty: consumedQty } : row)),
    );
    setMessage("Supply consumption queued locally");
    setBusyKey(null);
  }

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.canvas }}>
      <ScreenHeader
        eyebrow="Field ops"
        title={activePacket.camp.name}
        description="NABH-oriented site readiness, infection control, BMW, supplies, and paper fallback."
      />
      <ScrollView contentContainerStyle={{ padding: SPACING.md, gap: SPACING.sm }}>
        {message && (
          <Text variant="bodyMedium" style={{ color: COLORS.emerald }}>
            {message}
          </Text>
        )}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm }}>
          <Metric label="Readiness" value={readiness.score} />
          <Metric label="Required done" value={readiness.requiredDone} />
          <Metric label="Open issues" value={readiness.issueCount} />
          <Metric
            label="Critical supplies"
            value={supplies.filter((item) => item.is_critical).length}
          />
        </View>
        <Card
          eyebrow="Remote setup"
          title={packet.remote_setup?.status ?? "Not initialized"}
          pattern={readiness.ready ? "success" : "alert"}
        >
          <InfoLine
            label="Village"
            value={[
              packet.remote_setup?.village_name,
              packet.remote_setup?.block_name,
              packet.remote_setup?.district_name,
            ]
              .filter(Boolean)
              .join(", ")}
          />
          <InfoLine
            label="Referral facility"
            value={packet.remote_setup?.referral_facility_name ?? "Not recorded"}
          />
          <InfoLine
            label="Emergency route"
            value={packet.remote_setup?.emergency_route_notes ?? "Not recorded"}
          />
          <InfoLine
            label="BMW / IPC"
            value={
              [packet.remote_setup?.bmw_plan, packet.remote_setup?.infection_control_plan]
                .filter(Boolean)
                .join(" / ") || "Not recorded"
            }
          />
        </Card>

        <Text variant="titleMedium" style={{ color: COLORS.brand, marginTop: SPACING.sm }}>
          Readiness Checklist
        </Text>
        <HistoryList
          empty="No field checklist in this packet."
          rows={checklist}
          render={(item) => (
            <Card
              key={item.id}
              eyebrow={item.nabh_chapter}
              title={item.label}
              pattern={
                item.status === "issue" ? "alert" : item.status === "ok" ? "success" : "plain"
              }
            >
              <InfoLine label="Category" value={item.category} />
              <InfoLine label="Status" value={item.status} />
              <InfoLine label="Notes" value={item.notes ?? "No notes"} />
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACING.xs }}>
                <Button
                  mode="contained-tonal"
                  compact
                  loading={busyKey === item.id}
                  onPress={() => updateChecklist(item, "ok")}
                >
                  Mark OK
                </Button>
                <Button
                  mode="outlined"
                  compact
                  loading={busyKey === item.id}
                  onPress={() => updateChecklist(item, "issue")}
                >
                  Issue
                </Button>
              </View>
            </Card>
          )}
        />

        <Text variant="titleMedium" style={{ color: COLORS.brand, marginTop: SPACING.sm }}>
          Supplies
        </Text>
        <HistoryList
          empty="No supplies packed for this camp."
          rows={supplies}
          render={(item) => (
            <Card
              key={item.id}
              eyebrow={item.category}
              title={item.item_name}
              pattern={item.is_critical ? "copper" : "plain"}
            >
              <InfoLine
                label="Packed / planned"
                value={`${item.packed_qty}/${item.planned_qty} ${item.unit ?? ""}`.trim()}
              />
              <InfoLine
                label="Consumed / returned"
                value={`${item.consumed_qty}/${item.returned_qty} ${item.unit ?? ""}`.trim()}
              />
              <InfoLine
                label="Batch / expiry"
                value={[item.batch_no, item.expiry_date].filter(Boolean).join(" / ")}
              />
              <InfoLine label="Shortage" value={item.shortage_notes ?? "None"} />
              <Button
                mode="contained-tonal"
                compact
                loading={busyKey === item.id}
                onPress={() => consumeSupply(item)}
              >
                +1 Consumed
              </Button>
            </Card>
          )}
        />
      </ScrollView>
    </View>
  );
}

function SyncCenterScreen({ camp: routeCamp }: { camp?: Camp }): ReactNode {
  const selectedCamp = useCampSession((state) => state.selectedCamp);
  const camp = routeCamp ?? selectedCamp;
  const [events, setEvents] = useState<StoredCampEvent[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const clearCurrentCamp = useCampSession((state) => state.clearCurrentCamp);

  useEffect(() => {
    if (!camp) {
      setEvents([]);
      return;
    }
    let cancelled = false;
    readCampOutbox(camp.id).then((outbox) => {
      if (!cancelled) {
        setEvents(outbox);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [camp]);

  if (!camp) {
    return (
      <MissingCampScreen
        title="No active camp"
        description="Select today's camp before opening sync center."
      />
    );
  }
  const activeCamp = camp;

  async function load(): Promise<void> {
    setEvents(await readCampOutbox(activeCamp.id));
  }

  async function syncNow(): Promise<void> {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await flushQueuedCampEvents(activeCamp.id);
      setMessage(result);
      await load();
      const meta = await loadCampPacketMeta(activeCamp.id);
      if (meta?.expired) {
        await wipeCampPacket(activeCamp.id);
        clearCurrentCamp();
        setEvents([]);
        setMessage(`${result}. Expired packet self-destructed after sync.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function wipeLocal(): Promise<void> {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await wipeCampPacket(activeCamp.id);
      clearCurrentCamp();
      setEvents([]);
      setMessage("Local packet and outbox wiped for this camp");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Wipe failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.canvas }}>
      <ScreenHeader
        eyebrow="Sync"
        title={camp.name}
        description="Explicit offline outbox control for bad network, repeated reconnects, and audit-safe retries."
      />
      <ScrollView contentContainerStyle={{ padding: SPACING.md, gap: SPACING.sm }}>
        {message && (
          <Text variant="bodyMedium" style={{ color: COLORS.emerald }}>
            {message}
          </Text>
        )}
        <Card eyebrow="Privacy" title="Cryptographic wipe" pattern="alert">
          <Text variant="bodyMedium" style={{ color: COLORS.ink }}>
            Expired camp packets self-destruct by deleting the SecureStore AES key first. Manual
            wipe does the same for this camp's packet and queued outbox.
          </Text>
        </Card>
        {error && (
          <Text variant="bodyMedium" style={{ color: COLORS.red }}>
            {error}
          </Text>
        )}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm }}>
          <Metric label="Pending" value={events.length} />
          <Metric
            label="Failed"
            value={events.filter((event) => event.local_status === "failed").length}
          />
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm }}>
          <Button
            mode="contained"
            loading={busy}
            disabled={busy || events.length === 0}
            onPress={syncNow}
          >
            Sync Now
          </Button>
          <Button mode="outlined" loading={busy} disabled={busy} onPress={load}>
            Reload
          </Button>
          <Button
            mode="text"
            textColor={COLORS.red}
            loading={busy}
            disabled={busy}
            onPress={wipeLocal}
          >
            Wipe Local Packet
          </Button>
        </View>
        <HistoryList
          empty="No pending offline events."
          rows={events}
          render={(event) => (
            <Card
              key={event.idempotency_key}
              eyebrow={event.local_status}
              title={event.event_type}
              pattern={event.local_status === "failed" ? "alert" : "plain"}
            >
              <InfoLine label="Queued" value={formatDateTime(event.queued_at)} />
              <InfoLine label="Idempotency" value={event.idempotency_key} />
              <InfoLine label="Last error" value={event.last_error ?? "None"} />
            </Card>
          )}
        />
      </ScrollView>
    </View>
  );
}

function PatientRosterScreen({ packet: routePacket }: { packet?: CampPacketResponse }): ReactNode {
  const router = useModuleRouter();
  const selectedCamp = useCampSession((state) => state.selectedCamp);
  const sessionPacket = useCampSession((state) => state.packet);
  const operationMode = useCampSession((state) => state.operationMode);
  const packet = routePacket ?? sessionPacket;
  const [search, setSearch] = useState("");
  const onlineMode = operationMode === "hospital_online" || operationMode === "hybrid";
  const rows = useMemo(() => (packet ? buildPatientRows(packet) : []), [packet]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => row.searchText.includes(q));
  }, [rows, search]);
  const livePatientsQuery = useFetch(
    () =>
      onlineMode
        ? listPatients({ page: 1, per_page: 50, search: search.trim() || undefined })
        : Promise.resolve({ patients: [], total: 0, page: 1, per_page: 50 }),
    [onlineMode, search],
  );
  const livePatients = livePatientsQuery.data?.patients ?? [];

  if (!packet && !onlineMode) {
    return (
      <MissingCampScreen
        title="Choose online or packet"
        description="For a hospital camp, switch to Hospital Online. For a remote camp, download the local packet first."
        actionLabel="Choose Mode"
        route="packet"
      />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.canvas }}>
      <ScreenHeader
        eyebrow="Camp OPD"
        title={onlineMode ? "Patient Search / Live EMR" : "Patient Search / Local EMR"}
        description={
          onlineMode
            ? "Search the hospital registry. This is for camps inside hospital network coverage."
            : "Search downloaded patients and open the compact OPD chart without live network."
        }
      />
      <ScrollView contentContainerStyle={{ padding: SPACING.md, gap: SPACING.sm }}>
        <MobileTextField
          label="Search name, UHID, phone, village or complaint"
          value={search}
          onChangeText={setSearch}
        />
        {onlineMode && (
          <Card eyebrow="Live hospital registry" title="All patients available" pattern="success">
            <Text variant="bodySmall" style={{ color: COLORS.brandDeep, opacity: 0.75 }}>
              {livePatientsQuery.loading
                ? "Searching live EMR..."
                : `${livePatients.length} of ${livePatientsQuery.data?.total ?? 0} live matches`}
            </Text>
            {livePatientsQuery.error && (
              <Text variant="bodySmall" style={{ color: COLORS.red, marginTop: 6 }}>
                {livePatientsQuery.error}
              </Text>
            )}
            <View style={{ marginTop: SPACING.sm, gap: SPACING.xs }}>
              {livePatients.map((patient) => (
                <EntityRow
                  key={patient.id}
                  title={patientDisplayName(patient)}
                  subtitle={livePatientSubtitle(patient)}
                  badge={{ label: "LIVE UHID", tone: "success" }}
                  onPress={() =>
                    selectedCamp &&
                    router.push("livePatient", {
                      camp: selectedCamp,
                      patient,
                    } satisfies LivePatientPayload)
                  }
                />
              ))}
            </View>
            {!livePatientsQuery.loading && livePatients.length === 0 && (
              <Empty
                title="No live patient found"
                description="Try UHID, first name, last name, or phone."
                actionLabel="Refresh"
                onAction={livePatientsQuery.refetch}
              />
            )}
          </Card>
        )}
        {packet && (
          <>
            <Text variant="bodySmall" style={{ color: COLORS.brandDeep, opacity: 0.75 }}>
              {filtered.length} of {rows.length} local packet records
            </Text>
            {filtered.length === 0 && (
              <Empty
                title="No packet patient found"
                description="Try UHID, name, phone last 4 digits, age, village, or complaint."
              />
            )}
            {filtered.map((row) => (
              <EntityRow
                key={row.key}
                title={row.patient?.display_name ?? row.registration.person_name}
                subtitle={patientRosterSubtitle(row)}
                badge={{
                  label: row.patient ? "UHID" : "Walk-in",
                  tone: row.patient ? "success" : "neutral",
                }}
                onPress={() =>
                  router.push("patient", {
                    packet,
                    registrationId: row.registration.id,
                    patientId: row.registration.patient_id,
                  } satisfies CampPatientPayload)
                }
              />
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function LivePatientChartScreen({ payload }: { payload: LivePatientPayload }): ReactNode {
  const router = useModuleRouter();
  const { camp, patient } = payload;
  const {
    data: context,
    loading,
    error,
    refetch,
  } = useFetch(() => getPatientContext(patient.id), [patient.id]);

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.canvas }}>
      <ScreenHeader
        eyebrow="Live hospital EMR"
        title={patientDisplayName(patient)}
        description={`${patient.uhid} · ${camp.camp_code} · online`}
        loadingLabel={loading ? "Loading live patient chart" : undefined}
      />
      <ScrollView contentContainerStyle={{ padding: SPACING.md, gap: SPACING.sm }}>
        <Button mode="text" onPress={router.pop}>
          Back to patient search
        </Button>
        {error && (
          <Empty
            title="Live chart unavailable"
            description={error}
            actionLabel="Retry"
            onAction={refetch}
          />
        )}
        <LivePatientSummary patient={patient} context={context} />
      </ScrollView>
    </View>
  );
}

function PatientChartScreen({ payload }: { payload: CampPatientPayload }): ReactNode {
  const router = useModuleRouter();
  const { packet, registrationId, patientId } = payload;
  const [tab, setTab] = useState<PatientChartTab>("summary");
  const packetRegistrations = packet.registrations ?? [];
  const packetPatients = packet.patient_summaries ?? [];
  const packetAllergies = packet.active_allergies ?? [];
  const packetVitals = packet.recent_vitals ?? [];
  const packetRegistrationHistory = packet.registration_history ?? [];
  const packetVisitHistory = packet.visit_history ?? [];
  const packetDiagnosisHistory = packet.diagnosis_history ?? [];
  const packetMedicationHistory = packet.medication_history ?? [];
  const packetScreenings = packet.screenings ?? [];
  const packetLabSamples = packet.lab_samples ?? [];
  const registration = packetRegistrations.find((r) => r.id === registrationId);
  const patient = patientId
    ? (packetPatients.find((summary) => summary.patient_id === patientId) ?? null)
    : null;
  const allergies = filterByPatient(packetAllergies, patientId);
  const vitals = filterByPatient(packetVitals, patientId);
  const registrations = filterRegistrationHistory(
    packetRegistrationHistory,
    patientId,
    registrationId,
  );
  const visits = filterByPatient(packetVisitHistory, patientId);
  const diagnoses = filterByPatient(packetDiagnosisHistory, patientId);
  const medicines = filterByPatient(packetMedicationHistory, patientId);
  const currentScreening = packetScreenings.find(
    (screening) => screening.registration_id === registrationId,
  );
  const currentSamples = packetLabSamples.filter(
    (sample) => sample.registration_id === registrationId,
  );

  if (!registration) {
    return (
      <Empty
        title="Patient record unavailable"
        description="This registration is not in the packet."
      />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.canvas }}>
      <ScreenHeader
        eyebrow={patient?.uhid ?? registration.registration_number}
        title={patient?.display_name ?? registration.person_name}
        description={patientChartSubtitle(patient, registration)}
      />
      <ScrollView contentContainerStyle={{ padding: SPACING.md, gap: SPACING.sm }}>
        <Button mode="text" onPress={router.pop}>
          Back to packet search
        </Button>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: "row", gap: SPACING.xs }}>
            {PATIENT_CHART_TABS.map((item) => (
              <Button
                key={item.id}
                mode={tab === item.id ? "contained" : "contained-tonal"}
                compact
                onPress={() => setTab(item.id)}
              >
                {item.label}
              </Button>
            ))}
          </View>
        </ScrollView>

        {tab === "summary" && (
          <PatientSummaryTab
            patient={patient}
            registration={registration}
            allergies={allergies}
            latestVital={vitals[0] ?? null}
          />
        )}
        {tab === "actions" && (
          <PatientActionsTab packet={packet} registration={registration} patient={patient} />
        )}
        {tab === "registrations" && <RegistrationHistoryTab rows={registrations} />}
        {tab === "vitals" && <VitalsTab rows={vitals} />}
        {tab === "visits" && <VisitsTab rows={visits} />}
        {tab === "diagnosis" && <DiagnosisTab rows={diagnoses} />}
        {tab === "medicines" && <MedicinesTab rows={medicines} />}
        {tab === "current" && (
          <CurrentCampTab
            registration={registration}
            screening={currentScreening ?? null}
            samples={currentSamples}
          />
        )}
      </ScrollView>
    </View>
  );
}

const PATIENT_CHART_TABS: Array<{ id: PatientChartTab; label: string }> = [
  { id: "summary", label: "Summary" },
  { id: "actions", label: "OPD" },
  { id: "registrations", label: "Registration History" },
  { id: "vitals", label: "Vitals" },
  { id: "visits", label: "Visits" },
  { id: "diagnosis", label: "Diagnosis" },
  { id: "medicines", label: "Medicines" },
  { id: "current", label: "Current Camp" },
];

function PatientSummaryTab({
  patient,
  registration,
  allergies,
  latestVital,
}: {
  patient: CampPacketPatientSummary | null;
  registration: CampRegistration;
  allergies: CampPacketResponse["active_allergies"];
  latestVital: CampPacketVital | null;
}): ReactNode {
  return (
    <View style={{ gap: SPACING.sm }}>
      <Card
        eyebrow="Identifiers"
        title={patient?.uhid ?? registration.registration_number}
        pattern="aqua"
      >
        <InfoLine label="Name" value={patient?.display_name ?? registration.person_name} />
        <InfoLine label="Age / gender" value={patientChartSubtitle(patient, registration)} />
        <InfoLine label="Phone" value={registration.phone ?? maskedPhone(patient?.phone_last4)} />
        <InfoLine label="Blood group" value={patient?.blood_group ?? "Not recorded"} />
        <InfoLine label="Chief complaint" value={registration.chief_complaint ?? "Not recorded"} />
      </Card>
      <Card
        eyebrow="Safety"
        title={
          allergies.length > 0
            ? `${allergies.length} allergy warning(s)`
            : "No active allergy in packet"
        }
        pattern={allergies.length > 0 ? "alert" : "success"}
      >
        {allergies.length === 0 ? (
          <Text variant="bodyMedium" style={{ color: COLORS.ink }}>
            No active allergy records were downloaded for this patient.
          </Text>
        ) : (
          allergies.map((allergy) => (
            <InfoLine
              key={`${allergy.patient_id}:${allergy.allergen_name}`}
              label={allergy.severity ?? allergy.allergy_type}
              value={`${allergy.allergen_name}${allergy.reaction ? ` - ${allergy.reaction}` : ""}`}
            />
          ))
        )}
      </Card>
      <Card
        eyebrow="Latest vitals"
        title={latestVital ? formatDateTime(latestVital.recorded_at) : "Not recorded"}
        pattern="sky"
      >
        {latestVital ? (
          <>
            <InfoLine label="BP" value={formatBp(latestVital)} />
            <InfoLine
              label="Pulse / SpO2"
              value={`${displayValue(latestVital.pulse)} bpm / ${displayValue(latestVital.spo2)}%`}
            />
            <InfoLine
              label="Weight / BMI"
              value={`${displayValue(latestVital.weight_kg)} kg / ${displayValue(latestVital.bmi)}`}
            />
          </>
        ) : (
          <Text variant="bodyMedium" style={{ color: COLORS.ink }}>
            No vitals were downloaded for this patient.
          </Text>
        )}
      </Card>
    </View>
  );
}

function PatientActionsTab({
  packet,
  registration,
  patient,
}: {
  packet: CampPacketResponse;
  registration: CampRegistration;
  patient: CampPacketPatientSummary | null;
}): ReactNode {
  const [bpSystolic, setBpSystolic] = useState("");
  const [bpDiastolic, setBpDiastolic] = useState("");
  const [pulseRate, setPulseRate] = useState("");
  const [spo2, setSpo2] = useState("");
  const [temperature, setTemperature] = useState("");
  const [bloodSugar, setBloodSugar] = useState("");
  const [findings, setFindings] = useState("");
  const [advice, setAdvice] = useState("");
  const [sampleType, setSampleType] = useState("");
  const [testRequested, setTestRequested] = useState("");
  const [barcode, setBarcode] = useState("");
  const [referralFacility, setReferralFacility] = useState("");
  const [referralDepartment, setReferralDepartment] = useState("");
  const [referralReason, setReferralReason] = useState("");
  const [incidentType, setIncidentType] = useState("");
  const [incidentSeverity, setIncidentSeverity] = useState("");
  const [incidentDescription, setIncidentDescription] = useState("");
  const [immediateAction, setImmediateAction] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function queueAction(
    eventType: CampSyncInboundEvent["event_type"],
    payload: Record<string, unknown>,
    successMessage: string,
  ): Promise<void> {
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      await queueAndPublishCampEvent(packet.camp.id, makeSyncEvent(eventType, makeUuid(), payload));
      setMessage(successMessage);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to queue action");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: SPACING.sm }}>
      {message && (
        <Text variant="bodyMedium" style={{ color: COLORS.emerald }}>
          {message}
        </Text>
      )}
      {error && (
        <Text variant="bodyMedium" style={{ color: COLORS.red }}>
          {error}
        </Text>
      )}
      <Card
        eyebrow="Camp OPD"
        title={patient?.uhid ?? registration.registration_number}
        pattern="aqua"
      >
        <InfoLine label="Patient" value={patient?.display_name ?? registration.person_name} />
        <InfoLine
          label="Current complaint"
          value={registration.chief_complaint ?? "Not recorded"}
        />
        <Text variant="bodySmall" style={{ color: COLORS.brandDeep, opacity: 0.75 }}>
          This is the camp OPD workspace: record vitals, provisional diagnosis, advice, labs,
          referral and safety events. Each action queues locally with idempotency.
        </Text>
      </Card>

      <Card eyebrow="Clinical" title="Vitals and assessment" pattern="sky">
        <View style={{ gap: SPACING.sm }}>
          <MobileTextField
            label="BP systolic"
            keyboardType="number-pad"
            value={bpSystolic}
            onChangeText={setBpSystolic}
          />
          <MobileTextField
            label="BP diastolic"
            keyboardType="number-pad"
            value={bpDiastolic}
            onChangeText={setBpDiastolic}
          />
          <MobileTextField
            label="Pulse"
            keyboardType="number-pad"
            value={pulseRate}
            onChangeText={setPulseRate}
          />
          <MobileTextField
            label="SpO2"
            keyboardType="number-pad"
            value={spo2}
            onChangeText={setSpo2}
          />
          <MobileTextField
            label="Temperature"
            keyboardType="decimal-pad"
            value={temperature}
            onChangeText={setTemperature}
          />
          <MobileTextField
            label="Random blood sugar"
            keyboardType="decimal-pad"
            value={bloodSugar}
            onChangeText={setBloodSugar}
          />
          <MobileTextField
            label="Findings / diagnosis"
            value={findings}
            onChangeText={setFindings}
            multiline
          />
          <MobileTextField
            label="Advice / treatment note"
            value={advice}
            onChangeText={setAdvice}
            multiline
          />
          <Button
            mode="contained"
            loading={busy}
            disabled={busy || (!bpSystolic && !pulseRate && !spo2 && !findings)}
            onPress={() =>
              queueAction(
                "camp.screening.create",
                {
                  registration_id: registration.id,
                  bp_systolic: optionalNumber(bpSystolic),
                  bp_diastolic: optionalNumber(bpDiastolic),
                  pulse_rate: optionalNumber(pulseRate),
                  spo2: optionalNumber(spo2),
                  temperature: optionalNumber(temperature),
                  blood_sugar_random: optionalNumber(bloodSugar),
                  findings: findings || undefined,
                  diagnosis: findings || undefined,
                  advice: advice || undefined,
                  referred_to_hospital: !!referralReason,
                  referral_department: referralDepartment || undefined,
                },
                "Patient vitals/assessment queued locally",
              )
            }
          >
            Queue Vitals
          </Button>
        </View>
      </Card>

      <Card eyebrow="Diagnostics" title="Lab sample" pattern="violet">
        <View style={{ gap: SPACING.sm }}>
          <CampReferenceMenu
            title="Test from camp packet"
            rows={packet.lab_test_refs ?? []}
            selectedId={packet.lab_test_refs.find((test) => test.name === testRequested)?.id ?? ""}
            label={campLabTestLabel}
            placeholder="Select blood / urine / screening test"
            onSelect={(test) => {
              setTestRequested(test.name);
              if (test.sample_type) setSampleType(test.sample_type);
            }}
          />
          <MobileTextField label="Sample type" value={sampleType} onChangeText={setSampleType} />
          <MobileTextField
            label="Test requested"
            value={testRequested}
            onChangeText={setTestRequested}
          />
          <MobileTextField label="Barcode" value={barcode} onChangeText={setBarcode} />
          <Button
            mode="contained-tonal"
            loading={busy}
            disabled={busy || !sampleType}
            onPress={() =>
              queueAction(
                "camp.lab_sample.create",
                {
                  registration_id: registration.id,
                  sample_type: sampleType,
                  test_requested: testRequested || undefined,
                  barcode: barcode || undefined,
                },
                "Patient lab sample queued locally",
              )
            }
          >
            Queue Lab Sample
          </Button>
        </View>
      </Card>

      <Card eyebrow="Continuity" title="Referral" pattern="copper">
        <View style={{ gap: SPACING.sm }}>
          {packet.remote_setup?.referral_facility_name && (
            <Button
              mode="outlined"
              onPress={() => {
                setReferralFacility(packet.remote_setup?.referral_facility_name ?? "");
              }}
            >
              Use configured referral facility
            </Button>
          )}
          <MobileTextField
            label="Referral facility"
            value={referralFacility}
            onChangeText={setReferralFacility}
          />
          <CampReferenceMenu
            title="Referral department"
            rows={packet.department_refs ?? []}
            selectedId={
              packet.department_refs.find((department) => department.name === referralDepartment)
                ?.id ?? ""
            }
            label={campDepartmentLabel}
            placeholder="Select department"
            onSelect={(department) => setReferralDepartment(department.name)}
          />
          <MobileTextField
            label="Department"
            value={referralDepartment}
            onChangeText={setReferralDepartment}
          />
          <MobileTextField
            label="Reason"
            value={referralReason}
            onChangeText={setReferralReason}
            multiline
          />
          <Button
            mode="contained-tonal"
            loading={busy}
            disabled={busy || !referralFacility || !referralReason}
            onPress={() =>
              queueAction(
                "camp.referral.create",
                {
                  registration_id: registration.id,
                  referred_to_facility: referralFacility,
                  referral_department: referralDepartment || undefined,
                  urgency: "routine",
                  reason: referralReason,
                  ambulance_required: false,
                },
                "Patient referral queued locally",
              )
            }
          >
            Queue Referral
          </Button>
        </View>
      </Card>

      <Card eyebrow="Quality" title="Safety incident" pattern="alert">
        <View style={{ gap: SPACING.sm }}>
          <MobileTextField
            label="Incident type"
            value={incidentType}
            onChangeText={setIncidentType}
          />
          <MobileTextField
            label="Severity"
            value={incidentSeverity}
            onChangeText={setIncidentSeverity}
          />
          <MobileTextField
            label="Description"
            value={incidentDescription}
            onChangeText={setIncidentDescription}
            multiline
          />
          <MobileTextField
            label="Immediate action"
            value={immediateAction}
            onChangeText={setImmediateAction}
            multiline
          />
          <Button
            mode="contained-tonal"
            loading={busy}
            disabled={busy || !incidentDescription}
            onPress={() =>
              queueAction(
                "camp.incident.create",
                {
                  registration_id: registration.id,
                  incident_type: incidentType || "other",
                  severity: incidentSeverity || "low",
                  description: incidentDescription,
                  immediate_action: immediateAction || undefined,
                },
                "Patient incident queued locally",
              )
            }
          >
            Queue Incident
          </Button>
        </View>
      </Card>
    </View>
  );
}

function RegistrationHistoryTab({ rows }: { rows: CampPacketRegistrationHistory[] }): ReactNode {
  return (
    <HistoryList
      empty="No registration history in packet."
      rows={rows}
      render={(row) => (
        <Card
          key={row.registration_id}
          eyebrow={row.current_camp ? "Current camp" : row.camp_code}
          title={row.registration_number}
          pattern={row.current_camp ? "aqua" : "plain"}
        >
          <InfoLine label="Camp" value={row.camp_name} />
          <InfoLine label="Person" value={`${row.person_name}${row.age ? `, ${row.age}y` : ""}`} />
          <InfoLine label="Complaint" value={row.chief_complaint ?? "Not recorded"} />
          <InfoLine
            label="Place"
            value={[row.venue_city, row.venue_state].filter(Boolean).join(", ")}
          />
          <InfoLine label="Registered" value={formatDateTime(row.registered_at)} />
        </Card>
      )}
    />
  );
}

function VitalsTab({ rows }: { rows: CampPacketVital[] }): ReactNode {
  return (
    <HistoryList
      empty="No prior vitals in packet."
      rows={rows}
      render={(row) => (
        <Card
          key={`${row.encounter_id}:${row.recorded_at}`}
          eyebrow="Vitals"
          title={formatDateTime(row.recorded_at)}
          pattern="sky"
        >
          <InfoLine label="BP" value={formatBp(row)} />
          <InfoLine
            label="Pulse / RR / SpO2"
            value={`${displayValue(row.pulse)} / ${displayValue(row.respiratory_rate)} / ${displayValue(row.spo2)}%`}
          />
          <InfoLine
            label="Temp / BMI"
            value={`${displayValue(row.temperature)} C / ${displayValue(row.bmi)}`}
          />
          <InfoLine label="Notes" value={row.notes ?? "No notes"} />
        </Card>
      )}
    />
  );
}

function VisitsTab({ rows }: { rows: CampPacketVisitHistory[] }): ReactNode {
  return (
    <HistoryList
      empty="No prior visits in packet."
      rows={rows}
      render={(row) => (
        <Card
          key={row.encounter_id}
          eyebrow={row.encounter_type}
          title={formatDate(row.encounter_date)}
          pattern="plain"
        >
          <InfoLine label="Department" value={row.department_name ?? "Not recorded"} />
          <InfoLine label="Doctor" value={row.doctor_name ?? "Not recorded"} />
          <InfoLine label="Diagnosis" value={row.diagnosis_summary ?? "Not recorded"} />
          <InfoLine label="Medicines" value={row.prescription_summary ?? "Not recorded"} />
          <InfoLine label="Notes" value={row.notes ?? "No notes"} />
        </Card>
      )}
    />
  );
}

function DiagnosisTab({ rows }: { rows: CampPacketDiagnosisHistory[] }): ReactNode {
  return (
    <HistoryList
      empty="No diagnosis history in packet."
      rows={rows}
      render={(row) => (
        <Card
          key={`${row.encounter_id}:${row.description}`}
          eyebrow={row.icd_code ?? "Diagnosis"}
          title={row.description}
          pattern="copper"
        >
          <InfoLine label="Primary" value={row.is_primary ? "Yes" : "No"} />
          <InfoLine label="Severity" value={row.severity ?? "Not recorded"} />
          <InfoLine label="Certainty" value={row.certainty ?? "Not recorded"} />
          <InfoLine
            label="Onset"
            value={row.onset_date ? formatDate(row.onset_date) : "Not recorded"}
          />
        </Card>
      )}
    />
  );
}

function MedicinesTab({ rows }: { rows: CampPacketMedicationHistory[] }): ReactNode {
  return (
    <HistoryList
      empty="No medicine history in packet."
      rows={rows}
      render={(row) => (
        <Card
          key={`${row.prescription_id}:${row.drug_name}`}
          eyebrow={row.item_status}
          title={row.drug_name}
          pattern="violet"
        >
          <InfoLine label="Dose" value={`${row.dosage} - ${row.frequency}`} />
          <InfoLine label="Duration" value={row.duration} />
          <InfoLine label="Route" value={row.route ?? "Not recorded"} />
          <InfoLine label="Instructions" value={row.instructions ?? "None"} />
          <InfoLine label="Prescribed" value={formatDateTime(row.prescribed_at)} />
        </Card>
      )}
    />
  );
}

function CurrentCampTab({
  registration,
  screening,
  samples,
}: {
  registration: CampRegistration;
  screening: CampPacketResponse["screenings"][number] | null;
  samples: CampPacketResponse["lab_samples"];
}): ReactNode {
  return (
    <View style={{ gap: SPACING.sm }}>
      <Card eyebrow="Current registration" title={registration.registration_number} pattern="aqua">
        <InfoLine label="Status" value={registration.status} />
        <InfoLine label="Walk-in" value={registration.is_walk_in ? "Yes" : "No"} />
        <InfoLine label="Complaint" value={registration.chief_complaint ?? "Not recorded"} />
        <InfoLine label="Registered" value={formatDateTime(registration.created_at)} />
      </Card>
      <Card eyebrow="Current vitals" title={screening ? "Recorded" : "Not recorded"} pattern="sky">
        {screening ? (
          <>
            <InfoLine
              label="BP"
              value={`${displayValue(screening.bp_systolic)}/${displayValue(screening.bp_diastolic)} mmHg`}
            />
            <InfoLine
              label="Pulse / SpO2"
              value={`${displayValue(screening.pulse_rate)} bpm / ${displayValue(screening.spo2)}%`}
            />
            <InfoLine label="Finding" value={screening.findings ?? "Not recorded"} />
            <InfoLine label="Advice" value={screening.advice ?? "Not recorded"} />
          </>
        ) : (
          <Text variant="bodyMedium" style={{ color: COLORS.ink }}>
            Vitals not recorded for this camp registration yet.
          </Text>
        )}
      </Card>
      <HistoryList
        empty="No lab samples for this registration."
        rows={samples}
        render={(sample) => (
          <Card key={sample.id} eyebrow="Sample" title={sample.sample_type} pattern="violet">
            <InfoLine label="Barcode" value={sample.barcode ?? "Not recorded"} />
            <InfoLine
              label="Status"
              value={sample.sent_to_lab ? "Sent to lab" : "Collected locally"}
            />
            <InfoLine label="Result" value={sample.result_summary ?? "Not available in packet"} />
            <InfoLine
              label="Collected"
              value={sample.collected_at ? formatDateTime(sample.collected_at) : "Not collected"}
            />
          </Card>
        )}
      />
    </View>
  );
}

function HistoryList<T>({
  rows,
  empty,
  render,
}: {
  rows: T[];
  empty: string;
  render: (row: T) => ReactNode;
}): ReactNode {
  if (rows.length === 0) {
    return <Empty title={empty} />;
  }
  return <View style={{ gap: SPACING.sm }}>{rows.map(render)}</View>;
}

function InfoLine({ label, value }: { label: string; value: string }): ReactNode {
  return (
    <View style={{ marginBottom: 4 }}>
      <Text variant="labelSmall" style={{ color: COLORS.brandDeep, opacity: 0.7 }}>
        {label}
      </Text>
      <Text variant="bodyMedium" style={{ color: COLORS.ink }}>
        {value || "Not recorded"}
      </Text>
    </View>
  );
}

function IntakeScreen({ camp: routeCamp }: { camp?: Camp }): ReactNode {
  const selectedCamp = useCampSession((state) => state.selectedCamp);
  const camp = routeCamp ?? selectedCamp;
  const [personName, setPersonName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [phone, setPhone] = useState("");
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [createdRegistrationId, setCreatedRegistrationId] = useState<string | null>(null);
  const [bpSystolic, setBpSystolic] = useState("");
  const [bpDiastolic, setBpDiastolic] = useState("");
  const [pulseRate, setPulseRate] = useState("");
  const [spo2, setSpo2] = useState("");
  const [temperature, setTemperature] = useState("");
  // One object per group rather than eighteen hooks — bounded and cheap to reset.
  const [history, setHistory] = useState<CampHistoryState>({});
  const [tests, setTests] = useState<CampTestState>({});
  const [historyNotes, setHistoryNotes] = useState("");
  const [sampleType, setSampleType] = useState("");
  const [barcode, setBarcode] = useState("");
  const [testRequested, setTestRequested] = useState("");
  const [referralFacility, setReferralFacility] = useState("");
  const [referralDepartment, setReferralDepartment] = useState("");
  const [referralReason, setReferralReason] = useState("");
  const [incidentType, setIncidentType] = useState("");
  const [incidentSeverity, setIncidentSeverity] = useState("");
  const [incidentDescription, setIncidentDescription] = useState("");
  const [immediateAction, setImmediateAction] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!camp) {
    return (
      <MissingCampScreen
        title="No active camp"
        description="Select the camp first, then use intake from the camp dashboard."
      />
    );
  }
  const activeCamp = camp;

  async function submitRegistration(): Promise<void> {
    setBusy(true);
    setError(null);
    setMessage(null);
    const clientId = makeUuid();
    const event = makeSyncEvent("camp.registration.create", clientId, {
      camp_id: activeCamp.id,
      person_name: personName,
      age: optionalNumber(age),
      gender: gender || undefined,
      phone: phone || undefined,
      chief_complaint: chiefComplaint || undefined,
      is_walk_in: true,
    });
    try {
      await queueAndPublishCampEvent(activeCamp.id, event);
      setCreatedRegistrationId(clientId);
      setMessage("Registration queued locally");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration queue failed");
    } finally {
      setBusy(false);
    }
  }

  async function submitScreening(): Promise<void> {
    if (!createdRegistrationId) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    const event = makeSyncEvent("camp.screening.create", makeUuid(), {
      registration_id: createdRegistrationId,
      bp_systolic: optionalNumber(bpSystolic),
      bp_diastolic: optionalNumber(bpDiastolic),
      pulse_rate: optionalNumber(pulseRate),
      spo2: optionalNumber(spo2),
      temperature: optionalNumber(temperature),
      findings: chiefComplaint || undefined,
      advice: referralReason || undefined,
      referred_to_hospital: !!referralReason,
      referral_department: referralDepartment || undefined,
      medical_history_notes: historyNotes || undefined,
      ...Object.fromEntries(
        CAMP_HISTORY_QUESTIONS.map((question) => [
          question.key,
          campHistoryAnswerToBool(history[question.key] ?? ""),
        ]),
      ),
      ...Object.fromEntries(
        CAMP_TEST_FIELDS.map((test) => [
          test.key,
          test.numeric ? optionalNumber(tests[test.key] ?? "") : tests[test.key] || undefined,
        ]),
      ),
    });
    try {
      await queueAndPublishCampEvent(activeCamp.id, event);
      // Clear the clinical answers for the next patient. The screen keeps the
      // registration so a lab sample or referral can still attach, but a tick
      // box left set from the previous person would be submitted as this one's
      // history — and unlike the name field, nobody sees it happen.
      setBpSystolic("");
      setBpDiastolic("");
      setPulseRate("");
      setSpo2("");
      setTemperature("");
      setHistory({});
      setTests({});
      setHistoryNotes("");
      setMessage("Screening/vitals queued locally");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Screening queue failed");
    } finally {
      setBusy(false);
    }
  }

  async function submitLabSample(): Promise<void> {
    if (!createdRegistrationId) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    const event = makeSyncEvent("camp.lab_sample.create", makeUuid(), {
      registration_id: createdRegistrationId,
      sample_type: sampleType,
      test_requested: testRequested || undefined,
      barcode: barcode || undefined,
    });
    try {
      await queueAndPublishCampEvent(activeCamp.id, event);
      setMessage("Lab sample queued locally");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lab sample queue failed");
    } finally {
      setBusy(false);
    }
  }

  async function submitReferral(): Promise<void> {
    setBusy(true);
    setError(null);
    setMessage(null);
    const event = makeSyncEvent("camp.referral.create", makeUuid(), {
      registration_id: createdRegistrationId || undefined,
      referred_to_facility: referralFacility,
      referral_department: referralDepartment || undefined,
      urgency: "routine",
      reason: referralReason,
      ambulance_required: false,
    });
    try {
      await queueAndPublishCampEvent(activeCamp.id, event);
      setMessage("Referral queued locally");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Referral queue failed");
    } finally {
      setBusy(false);
    }
  }

  async function submitIncident(): Promise<void> {
    setBusy(true);
    setError(null);
    setMessage(null);
    const event = makeSyncEvent("camp.incident.create", makeUuid(), {
      registration_id: createdRegistrationId || undefined,
      incident_type: incidentType || "other",
      severity: incidentSeverity || "low",
      description: incidentDescription,
      immediate_action: immediateAction || undefined,
    });
    try {
      await queueAndPublishCampEvent(activeCamp.id, event);
      setMessage("Incident queued locally");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Incident queue failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.canvas }}>
      <ScreenHeader
        eyebrow="Camp registration"
        title={activeCamp.name}
        description="Register camp patients first, then continue into vitals, lab sample and referral."
      />
      <ScrollView contentContainerStyle={{ padding: SPACING.md, gap: SPACING.sm }}>
        {message && (
          <Text variant="bodyMedium" style={{ color: COLORS.emerald }}>
            {message}
          </Text>
        )}
        {error && (
          <Text variant="bodyMedium" style={{ color: COLORS.red }}>
            {error}
          </Text>
        )}

        <Card eyebrow="OPD registration" title="Camp patient" pattern="aqua">
          <View style={{ gap: SPACING.sm }}>
            <MobileTextField label="Name" value={personName} onChangeText={setPersonName} />
            <MobileTextField
              label="Age"
              value={age}
              keyboardType="number-pad"
              onChangeText={setAge}
            />
            <MobileTextField label="Gender" value={gender} onChangeText={setGender} />
            <MobileTextField
              label="Phone"
              value={phone}
              keyboardType="phone-pad"
              onChangeText={setPhone}
            />
            <MobileTextField
              label="Chief complaint"
              value={chiefComplaint}
              onChangeText={setChiefComplaint}
            />
            <Button
              mode="contained"
              loading={busy}
              disabled={!personName || busy}
              onPress={submitRegistration}
            >
              Register Patient
            </Button>
          </View>
        </Card>

        <Card eyebrow="Screening" title="Vitals" pattern="sky">
          <View style={{ gap: SPACING.sm }}>
            <MobileTextField
              label="BP systolic"
              keyboardType="number-pad"
              value={bpSystolic}
              onChangeText={setBpSystolic}
            />
            <MobileTextField
              label="BP diastolic"
              keyboardType="number-pad"
              value={bpDiastolic}
              onChangeText={setBpDiastolic}
            />
            <MobileTextField
              label="Pulse"
              keyboardType="number-pad"
              value={pulseRate}
              onChangeText={setPulseRate}
            />
            <MobileTextField
              label="SpO2"
              keyboardType="number-pad"
              value={spo2}
              onChangeText={setSpo2}
            />
            <MobileTextField
              label="Temperature"
              keyboardType="decimal-pad"
              value={temperature}
              onChangeText={setTemperature}
            />
            <Button
              mode="contained-tonal"
              loading={busy}
              disabled={!createdRegistrationId || busy}
              onPress={submitScreening}
            >
              Submit Vitals
            </Button>
          </View>
        </Card>

        <CampHistoryFields
          values={history}
          onChange={(key, value) => setHistory((prev) => ({ ...prev, [key]: value }))}
        />

        <CampTestFields
          values={tests}
          onChange={(key, value) => setTests((prev) => ({ ...prev, [key]: value }))}
          notes={historyNotes}
          onNotesChange={setHistoryNotes}
        />

        <Card eyebrow="Lab" title="Sample" pattern="violet">
          <View style={{ gap: SPACING.sm }}>
            <MobileTextField label="Sample type" value={sampleType} onChangeText={setSampleType} />
            <MobileTextField
              label="Test requested"
              value={testRequested}
              onChangeText={setTestRequested}
            />
            <MobileTextField label="Barcode" value={barcode} onChangeText={setBarcode} />
            <Button
              mode="contained-tonal"
              loading={busy}
              disabled={!createdRegistrationId || !sampleType || busy}
              onPress={submitLabSample}
            >
              Submit Sample
            </Button>
          </View>
        </Card>

        <Card eyebrow="Referral" title="Higher center / follow-up" pattern="copper">
          <View style={{ gap: SPACING.sm }}>
            <MobileTextField
              label="Referral facility"
              value={referralFacility}
              onChangeText={setReferralFacility}
            />
            <MobileTextField
              label="Department"
              value={referralDepartment}
              onChangeText={setReferralDepartment}
            />
            <MobileTextField
              label="Reason"
              value={referralReason}
              onChangeText={setReferralReason}
              multiline
            />
            <Button
              mode="contained-tonal"
              loading={busy}
              disabled={!referralFacility || !referralReason || busy}
              onPress={submitReferral}
            >
              Queue Referral
            </Button>
          </View>
        </Card>

        <Card eyebrow="Quality" title="Incident / safety" pattern="alert">
          <View style={{ gap: SPACING.sm }}>
            <MobileTextField
              label="Incident type"
              placeholder="patient_safety / infection_control / biomedical_waste / network"
              value={incidentType}
              onChangeText={setIncidentType}
            />
            <MobileTextField
              label="Severity"
              placeholder="low / moderate / high / critical"
              value={incidentSeverity}
              onChangeText={setIncidentSeverity}
            />
            <MobileTextField
              label="Description"
              value={incidentDescription}
              onChangeText={setIncidentDescription}
              multiline
            />
            <MobileTextField
              label="Immediate action"
              value={immediateAction}
              onChangeText={setImmediateAction}
              multiline
            />
            <Button
              mode="contained-tonal"
              loading={busy}
              disabled={!incidentDescription || busy}
              onPress={submitIncident}
            >
              Queue Incident
            </Button>
          </View>
        </Card>
      </ScrollView>
    </View>
  );
}

function Metric({ label, value }: { label: string; value: number }): ReactNode {
  return (
    <View style={{ minWidth: 140, flexGrow: 1 }}>
      <Card eyebrow={label.toUpperCase()} title={String(value)}>
        <Text variant="bodySmall" style={{ color: COLORS.ink }}>
          In packet
        </Text>
      </Card>
    </View>
  );
}

function operationModeLabel(mode: CampOperationMode): string {
  switch (mode) {
    case "hospital_online":
      return "Online";
    case "hybrid":
      return "Hybrid";
    case "remote_offline":
      return "Remote";
  }
}

function operationModeTitle(mode: CampOperationMode): string {
  switch (mode) {
    case "hospital_online":
      return "Inside hospital / online";
    case "hybrid":
      return "Hybrid live + local";
    case "remote_offline":
      return "Remote village / offline";
  }
}

function patientDisplayName(patient: Patient): string {
  return [
    patient.prefix,
    patient.first_name,
    patient.middle_name,
    patient.last_name,
    patient.suffix,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
}

function livePatientSubtitle(patient: Patient): string {
  return [
    patient.uhid,
    patient.date_of_birth ? `DOB ${formatDate(patient.date_of_birth)}` : null,
    patient.gender,
    patient.phone,
    patient.blood_group,
  ]
    .filter(Boolean)
    .join(" · ");
}

function LivePatientSummary({
  patient,
  context,
}: {
  patient: Patient;
  context: PatientContext | null;
}): ReactNode {
  const lastVitals = context?.last_vitals;
  const allergies = context?.known_allergies ?? [];
  return (
    <View style={{ gap: SPACING.sm }}>
      <Card eyebrow="Identity" title={patient.uhid} pattern="clinical">
        <InfoLine label="Name" value={patientDisplayName(patient)} />
        <InfoLine
          label="Age / sex"
          value={[
            context?.age_years ? `${context.age_years} years` : null,
            patient.gender,
            patient.blood_group ?? "Blood group not recorded",
          ]
            .filter(Boolean)
            .join(" · ")}
        />
        <InfoLine label="Phone" value={patient.phone || "Not recorded"} />
      </Card>
      <Card
        eyebrow="Safety"
        title={allergySummary(context)}
        pattern={allergies.length ? "alert" : "success"}
      >
        <InfoLine
          label="Drug allergies"
          value={(context?.drug_allergies ?? []).join(", ") || "Not recorded"}
        />
        <InfoLine
          label="Flags"
          value={[
            context?.is_vip ? "VIP" : null,
            context?.is_medico_legal ? `MLC ${context.mlc_number ?? ""}`.trim() : null,
            context?.is_deceased ? "Deceased" : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        />
      </Card>
      <Card
        eyebrow="Latest vitals"
        title={lastVitals ? formatDateTime(lastVitals.recorded_at) : "No vitals"}
        pattern="aqua"
      >
        <InfoLine
          label="BP / pulse / SpO2"
          value={
            lastVitals
              ? [
                  lastVitals.systolic_bp && lastVitals.diastolic_bp
                    ? `${lastVitals.systolic_bp}/${lastVitals.diastolic_bp} mmHg`
                    : null,
                  lastVitals.pulse ? `${lastVitals.pulse}/min` : null,
                  lastVitals.spo2 ? `${lastVitals.spo2}% SpO2` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")
              : "Not recorded"
          }
        />
        <InfoLine
          label="Temperature / weight"
          value={
            lastVitals
              ? [
                  lastVitals.temperature ? `${lastVitals.temperature} deg F` : null,
                  lastVitals.weight_kg ? `${lastVitals.weight_kg} kg` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")
              : "Not recorded"
          }
        />
      </Card>
      <Card eyebrow="Camp action" title="Continue OPD workflow" pattern="copper">
        <Text variant="bodyMedium" style={{ color: COLORS.ink }}>
          Live mode uses the hospital EMR for lookup. Camp vitals, lab sample and referral still
          queue through Camp Mode so the camp report and audit trail stay complete.
        </Text>
      </Card>
    </View>
  );
}

function allergySummary(context: PatientContext | null): string {
  if (!context) {
    return "Loading";
  }
  if (context.no_known_allergies) {
    return "No known allergies";
  }
  const count = context.known_allergies.length + context.drug_allergies.length;
  return count > 0 ? `${count} allergy alert(s)` : "Allergy status not confirmed";
}

function buildPatientRows(packet: CampPacketResponse): PacketPatientRow[] {
  const patients = new Map(
    (packet.patient_summaries ?? []).map((patient) => [patient.patient_id, patient]),
  );
  return (packet.registrations ?? []).map((registration) => {
    const patient = registration.patient_id
      ? (patients.get(registration.patient_id) ?? null)
      : null;
    const searchText = [
      registration.person_name,
      registration.registration_number,
      registration.age?.toString(),
      registration.gender,
      registration.phone,
      registration.phone?.slice(-4),
      registration.address,
      registration.id_proof_number,
      registration.chief_complaint,
      registration.status,
      patient?.display_name,
      patient?.uhid,
      patient?.phone_last4,
      patient?.blood_group,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return {
      key: registration.id,
      registration,
      patient,
      searchText,
    };
  });
}

function patientRosterSubtitle(row: PacketPatientRow): string {
  const patient = row.patient;
  const registration = row.registration;
  const age = registration.age ?? patient?.age_years;
  return [
    patient?.uhid ?? registration.registration_number,
    age ? `${age}y` : null,
    registration.gender ?? patient?.gender,
    registration.chief_complaint,
  ]
    .filter(Boolean)
    .join(" · ");
}

function patientChartSubtitle(
  patient: CampPacketPatientSummary | null,
  registration: CampRegistration,
): string {
  const age = registration.age ?? patient?.age_years;
  return [
    age ? `${age} years` : null,
    registration.gender ?? patient?.gender,
    patient?.blood_group,
    patient?.last_visit_date ? `last visit ${formatDate(patient.last_visit_date)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function filterByPatient<T extends { patient_id: string }>(
  rows: T[],
  patientId: string | null,
): T[] {
  if (!patientId) return [];
  return rows.filter((row) => row.patient_id === patientId);
}

function filterRegistrationHistory(
  rows: CampPacketRegistrationHistory[],
  patientId: string | null,
  registrationId: string,
): CampPacketRegistrationHistory[] {
  return rows.filter((row) =>
    patientId ? row.patient_id === patientId : row.registration_id === registrationId,
  );
}

function maskedPhone(last4: string | null | undefined): string {
  return last4 ? `******${last4}` : "Not recorded";
}

function formatBp(vital: CampPacketVital): string {
  return `${displayValue(vital.systolic_bp)}/${displayValue(vital.diastolic_bp)} mmHg`;
}

function displayValue(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "--";
  return String(value);
}

function calculateReadiness(rows: CampRemoteChecklistItem[]): {
  requiredTotal: number;
  requiredDone: number;
  issueCount: number;
  score: number;
  ready: boolean;
} {
  const required = rows.filter((row) => row.required);
  const requiredDone = required.filter((row) => row.status === "ok").length;
  const issueCount = rows.filter((row) => row.status === "issue").length;
  const score = required.length === 0 ? 0 : Math.round((requiredDone / required.length) * 100);
  return {
    requiredTotal: required.length,
    requiredDone,
    issueCount,
    score,
    ready: required.length > 0 && requiredDone === required.length && issueCount === 0,
  };
}

function CampReferenceMenu<T extends { id: string }>({
  title,
  rows,
  selectedId,
  label,
  placeholder,
  onSelect,
}: {
  title: string;
  rows: T[];
  selectedId: string;
  label: (row: T) => string;
  placeholder: string;
  onSelect: (row: T) => void;
}): ReactNode {
  const [open, setOpen] = useState(false);
  const selected = rows.find((row) => row.id === selectedId);
  const visibleRows = rows.slice(0, 24);

  if (rows.length === 0) {
    return (
      <Text variant="bodySmall" style={{ color: COLORS.brandDeep, opacity: 0.75 }}>
        {title}: not available in this packet
      </Text>
    );
  }

  return (
    <View style={{ gap: SPACING.xs }}>
      <Text variant="labelMedium" style={{ color: COLORS.ink }}>
        {title}
      </Text>
      <Menu
        visible={open}
        onDismiss={() => setOpen(false)}
        anchor={
          <Button
            mode={selected ? "contained" : "outlined"}
            onPress={() => setOpen(true)}
            contentStyle={{ justifyContent: "flex-start" }}
          >
            {selected ? label(selected) : placeholder}
          </Button>
        }
      >
        <View style={{ maxHeight: 320 }}>
          {visibleRows.map((row) => (
            <Menu.Item
              key={row.id}
              title={label(row)}
              onPress={() => {
                setOpen(false);
                onSelect(row);
              }}
            />
          ))}
          {rows.length > visibleRows.length && (
            <Menu.Item title={`Showing first ${visibleRows.length} of ${rows.length}`} disabled />
          )}
        </View>
      </Menu>
    </View>
  );
}

function campDepartmentLabel(department: CampPacketDepartmentRef): string {
  return [department.name, department.code].filter(Boolean).join(" - ");
}

function campLabTestLabel(test: CampPacketLabTestRef): string {
  return [test.name, test.code, test.sample_type].filter(Boolean).join(" - ");
}

async function flushQueuedCampEvents(campId: string): Promise<string> {
  const events = await readCampOutbox(campId);
  if (events.length === 0) {
    return "No pending events";
  }
  const response = await syncCampInbound({
    camp_id: campId,
    device_id: "mobile-camp-preview",
    events,
  });
  const syncedKeys = response.results
    .filter((result) => result.status === "applied" || result.status === "duplicate")
    .map((result) => result.idempotency_key);
  await removeSyncedCampEvents(campId, syncedKeys);
  if (response.failed > 0) {
    const firstError =
      response.results.find((result) => result.status === "failed")?.message ??
      `${response.failed} event(s) failed`;
    await markCampEventsFailed(campId, firstError);
  }
  return `Synced ${response.applied}, duplicate ${response.duplicates}, failed ${response.failed}`;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString();
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString();
}

function optionalNumber(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function makeSyncEvent(
  eventType: CampSyncInboundEvent["event_type"],
  clientEntityId: string,
  payload: Record<string, unknown>,
): CampSyncInboundEvent {
  return {
    idempotency_key: `${clientEntityId}:${eventType}`,
    event_type: eventType,
    client_entity_id: clientEntityId,
    occurred_at: new Date().toISOString(),
    payload,
  };
}

async function queueAndPublishCampEvent(
  campId: string,
  event: CampSyncInboundEvent,
): Promise<void> {
  const outbox = await queueCampEvent(campId, event);
  useCampSession.getState().setPendingEvents(outbox.length);
}

function makeUuid(): string {
  return Crypto.randomUUID();
}

function CampScreen(): ReactNode {
  return (
    <ModuleRouter
      initial="home"
      screens={{
        home: <CampHome />,
        camps: <CampListScreen />,
        packet: (payload) => <PacketScreen camp={payload as Camp | undefined} />,
        patients: (payload) => (
          <PatientRosterScreen packet={payload as CampPacketResponse | undefined} />
        ),
        patient: (payload) => <PatientChartScreen payload={payload as CampPatientPayload} />,
        livePatient: (payload) => (
          <LivePatientChartScreen payload={payload as LivePatientPayload} />
        ),
        intake: (payload) => <IntakeScreen camp={payload as Camp | undefined} />,
        fieldOps: (payload) => (
          <FieldOpsScreen packet={payload as CampPacketResponse | undefined} />
        ),
        sync: (payload) => <SyncCenterScreen camp={payload as Camp | undefined} />,
      }}
    />
  );
}

export const campModule: Module = {
  id: "camp",
  displayName: "Camp Mode",
  icon: () => null,
  requiredPermissions: [P.CAMP.LIST],
  navigator: CampScreen,
  appCodes: ["Mobile-Camp", "Mobile-Doctor", "Mobile-Nurse", "Mobile-Phlebo"],
  tags: ["camp", "offline-sync", "field-ops", "patient-roster", "registration"],
  offlineDocTypes: ["camp_registration", "camp_screening", "camp_lab_sample"],
};
