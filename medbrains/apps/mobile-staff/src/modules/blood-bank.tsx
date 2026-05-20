/**
 * Blood bank handheld surface — donor camp safety, component
 * availability, crossmatch status, and transfusion/hemovigilance
 * visibility for doctors, nurses, and lab staff.
 */

import type { Module } from "@medbrains/mobile-shell";
import { P } from "@medbrains/types";
import type { IntentTone } from "@medbrains/ui-mobile";
import type { ReactNode } from "react";
import {
  getHemovigilanceReport,
  getTtiReport,
  listBloodComponents,
  listBloodDonors,
  listCrossmatchRequests,
  listTransfusions,
} from "../api/blood-bank.js";
import { EntityListScreen } from "../components/entity-list.js";
import { EntityRow } from "../components/entity-row.js";
import { ModuleHome } from "../components/module-home.js";
import { ModuleRouter, useModuleRouter } from "../components/module-router.js";

const COMPONENT_TONE: Record<string, IntentTone> = {
  available: "success",
  reserved: "warn",
  crossmatched: "info",
  issued: "info",
  transfused: "success",
  expired: "alert",
  discarded: "alert",
};

const CROSSMATCH_TONE: Record<string, IntentTone> = {
  requested: "warn",
  testing: "info",
  compatible: "success",
  incompatible: "alert",
  issued: "info",
  cancelled: "neutral",
};

function BloodBankHome(): ReactNode {
  const router = useModuleRouter();
  return (
    <ModuleHome
      eyebrow="MODULE"
      title="Blood Bank"
      description="Donors, component inventory, crossmatch and transfusion safety."
      tags={["Mobile-LabTech", "Mobile-Nurse", "Mobile-Doctor", "blood-safety", "NACO"]}
      summaries={[
        { eyebrow: "STOCK", count: "—", title: "Available units" },
        { eyebrow: "XMATCH", count: "—", title: "Pending crossmatches" },
      ]}
      actions={[
        {
          id: "inventory",
          label: "Component inventory",
          description: "Blood group, expiry, TTI status and issue state.",
          permission: P.BLOOD_BANK.INVENTORY_LIST,
          onPress: () => router.push("inventory"),
        },
        {
          id: "crossmatch",
          label: "Crossmatch requests",
          description: "Compatibility status before issue or transfusion.",
          permission: P.BLOOD_BANK.CROSSMATCH_LIST,
          onPress: () => router.push("crossmatch"),
        },
        {
          id: "transfusions",
          label: "Transfusions",
          description: "Bedside checks, reaction watch and documentation.",
          permission: P.BLOOD_BANK.TRANSFUSION_LIST,
          onPress: () => router.push("transfusions"),
        },
        {
          id: "donors",
          label: "Donors",
          description: "Camp donor registry and deferral visibility.",
          permission: P.BLOOD_BANK.DONORS_LIST,
          onPress: () => router.push("donors"),
        },
        {
          id: "tti",
          label: "TTI report",
          description: "HIV, HBsAg, HCV, malaria and VDRL safety summary.",
          permission: P.BLOOD_BANK.INVENTORY_LIST,
          onPress: () => router.push("tti"),
        },
      ]}
    />
  );
}

function InventoryScreen(): ReactNode {
  return (
    <EntityListScreen
      eyebrow="BLOOD BANK"
      title="Component inventory"
      description="Use FIFO/expiry watch; do not issue expired or untested components."
      fetcher={() => listBloodComponents({})}
      rowKey={(row) => row.id}
      renderRow={(row) => (
        <EntityRow
          title={`${row.blood_group} · ${row.component_type}`}
          subtitle={`${row.bag_number} · expires ${new Date(row.expiry_at).toLocaleDateString()} · TTI ${
            row.tti_status ?? "pending"
          }`}
          badge={{ label: row.status, tone: COMPONENT_TONE[row.status] ?? "neutral" }}
          accent={row.status === "expired" || row.status === "discarded"}
        />
      )}
      emptyTitle="No blood components"
    />
  );
}

function CrossmatchScreen(): ReactNode {
  return (
    <EntityListScreen
      eyebrow="BLOOD BANK"
      title="Crossmatch requests"
      description="Compatibility and issue status before transfusion."
      fetcher={listCrossmatchRequests}
      rowKey={(row) => row.id}
      renderRow={(row) => (
        <EntityRow
          title={`${row.blood_group} · ${row.component_type} · ${row.units_requested} unit(s)`}
          subtitle={`Patient ${row.patient_id.slice(0, 8)} · ${row.clinical_indication ?? "indication not recorded"}`}
          badge={{ label: row.status, tone: CROSSMATCH_TONE[row.status] ?? "neutral" }}
          accent={row.status === "incompatible"}
        />
      )}
      emptyTitle="No crossmatch requests"
    />
  );
}

function TransfusionScreen(): ReactNode {
  return (
    <EntityListScreen
      eyebrow="BLOOD BANK"
      title="Transfusions"
      description="Identity, component and reaction documentation."
      fetcher={listTransfusions}
      rowKey={(row) => row.id}
      renderRow={(row) => (
        <EntityRow
          title={`Patient ${row.patient_id.slice(0, 8)}`}
          subtitle={`Started ${new Date(row.started_at).toLocaleString()} · volume ${
            row.volume_transfused_ml ?? "—"
          } ml`}
          badge={{
            label: row.has_reaction ? (row.reaction_severity ?? "reaction") : "no reaction",
            tone: row.has_reaction ? "alert" : "success",
          }}
          accent={row.has_reaction}
        />
      )}
      emptyTitle="No transfusions"
    />
  );
}

function DonorScreen(): ReactNode {
  return (
    <EntityListScreen
      eyebrow="BLOOD BANK"
      title="Donors"
      description="Donor camp registry with deferral visibility."
      fetcher={async () => (await listBloodDonors()).donors}
      rowKey={(row) => row.id}
      renderRow={(row) => (
        <EntityRow
          title={`${row.first_name} ${row.last_name}`}
          subtitle={`${row.donor_number} · ${row.blood_group} · donations ${row.total_donations}`}
          badge={{
            label: row.is_deferred ? "deferred" : "active",
            tone: row.is_deferred ? "alert" : "success",
          }}
          accent={row.is_deferred}
        />
      )}
      emptyTitle="No donors"
    />
  );
}

function TtiScreen(): ReactNode {
  return (
    <EntityListScreen
      eyebrow="BLOOD BANK"
      title="TTI and hemovigilance"
      description="Screening and adverse-event signals for blood safety review."
      fetcher={async () => {
        const [tti, hemo] = await Promise.all([getTtiReport(), getHemovigilanceReport()]);
        return [
          ...tti.by_status.map((row) => ({
            id: `tti:${row.tti_status}`,
            title: row.tti_status,
            subtitle: `${row.count} component(s)`,
            badge: "TTI",
            alert: row.tti_status !== "negative",
          })),
          ...hemo.reactions_by_type.map((row) => ({
            id: `hemo:${row.reaction_type ?? "unknown"}:${row.severity ?? "unknown"}`,
            title: row.severity ?? "Not graded",
            subtitle: `${row.count} reaction record(s)`,
            badge: "Reaction",
            alert: row.severity !== "mild",
          })),
        ];
      }}
      rowKey={(row) => row.id}
      renderRow={(row) => (
        <EntityRow
          title={row.title}
          subtitle={row.subtitle}
          badge={{ label: row.badge, tone: row.alert ? "alert" : "info" }}
          accent={row.alert}
        />
      )}
      emptyTitle="No blood safety report data"
    />
  );
}

function BloodBankScreen(): ReactNode {
  return (
    <ModuleRouter
      initial="home"
      screens={{
        home: <BloodBankHome />,
        inventory: <InventoryScreen />,
        crossmatch: <CrossmatchScreen />,
        transfusions: <TransfusionScreen />,
        donors: <DonorScreen />,
        tti: <TtiScreen />,
      }}
    />
  );
}

export const bloodBankModule: Module = {
  id: "blood-bank",
  displayName: "Blood Bank",
  icon: () => null,
  requiredPermissions: [P.BLOOD_BANK.INVENTORY_LIST],
  navigator: BloodBankScreen,
  appCodes: ["Mobile-LabTech", "Mobile-Nurse", "Mobile-Doctor"],
  tags: ["blood-bank", "crossmatch", "transfusion", "donor-camp", "tti"],
  offlineDocTypes: ["blood_component", "crossmatch_request", "transfusion_record"],
};
