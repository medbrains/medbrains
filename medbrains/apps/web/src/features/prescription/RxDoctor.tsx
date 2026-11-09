import { Box, Group, Menu, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import type { BuyOutsideLineFormInput } from "@medbrains/schemas";
import type {
  AllergyConflict,
  ClinicalConclusion,
  DrugInteractionAlert,
  HepaticAlert,
  IngredientAlert,
  PregnancyAlert,
  PrescriptionTemplate,
  RenalDoseAlert,
  WeightDoseAlert,
} from "@medbrains/types";
import {
  IconAlertTriangle,
  IconCheck,
  IconExclamationCircle,
  IconMicrophone,
  IconRepeat,
  IconShieldCheck,
  IconTemplate,
} from "@tabler/icons-react";
import { type ReactNode, useRef, useState } from "react";
import { Alert, Button, Modal, SegmentedControl } from "@/components/ui";
import { Input } from "@/components/ui/Input";
import { BuyOutsideModal } from "./BuyOutsideModal";
import { FormularySearch } from "./FormularySearch";
import classes from "./prescription.module.scss";
import { type ComposeValues, type Prescriber, RxCompose } from "./RxCompose";
import { RxTable } from "./RxTable";
import { buyOutsideItem } from "./rxBuyOutside";
import {
  type FormularyDrug,
  maxDoseExceeded,
  prescribingCautions,
  quickRxDefaults,
  type RxItem,
} from "./rxModel";
import type { LastPrescription } from "./useLastPrescription";

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(" ");

type SafetyState = "ok" | "warn" | "flag";

const SAFETY_ICON = {
  ok: IconCheck,
  warn: IconAlertTriangle,
  flag: IconExclamationCircle,
} as const;

export interface RxSafety {
  interactions: DrugInteractionAlert[];
  allergy_conflicts: AllergyConflict[];
  weight_alerts: WeightDoseAlert[];
  renal_alerts: RenalDoseAlert[];
  hepatic_alerts: HepaticAlert[];
  ingredient_alerts: IngredientAlert[];
  pregnancy_alerts: PregnancyAlert[];
  conclusion: ClinicalConclusion;
}

function SafetyRow({
  state,
  label,
  detail,
}: {
  state: SafetyState;
  label: string;
  detail: string;
}) {
  const Icon = SAFETY_ICON[state];
  return (
    <Group
      gap="sm"
      wrap="nowrap"
      align="flex-start"
      className={cx(classes.safetyRow, classes[state])}
    >
      <span className={classes.srIcon}>
        <Icon size={16} stroke={1.8} aria-hidden="true" />
      </span>
      <Box className={classes.srText}>
        <b>{label}</b>
        <span>{detail}</span>
      </Box>
    </Group>
  );
}

interface Props {
  formulary: FormularyDrug[];
  /** The formulary is still loading; the search says so rather than "no match". */
  formularyLoading: boolean;
  formularyById: Record<string, FormularyDrug>;
  /** Lowercased NLEM (government-essential) generic names — tags essential drugs. */
  nlemGenerics: ReadonlySet<string>;
  initialItems: RxItem[];
  patientName: string;
  patientAllergies: string[];
  prescriber: Prescriber;
  canSave: boolean;
  saving: boolean;
  editing: boolean;
  safety: RxSafety;
  signer: { name: string; reg: string; nurseName: string; nurseReg: string };
  templates: PrescriptionTemplate[];
  /** Convert a saved set into rx-suite rows (uses the live formulary). */
  templateToItems: (tpl: PrescriptionTemplate) => RxItem[];
  onSaveTemplate: (name: string, items: RxItem[]) => void;
  /** The patient's last prescription from another visit, if any. */
  lastRx?: LastPrescription | null;
  /** Medicines the doctor accepted from a dictation, waiting to be loaded. */
  dictated?: { items: RxItem[]; waiting: string[]; onLoaded: () => void } | null;
  /** Digital-sign control rendered in the card footer (provided when a saved Rx exists). */
  signAction?: ReactNode;
  /** Catalog ids already prescribed on this visit — warns (doesn't block) on re-add. */
  priorDrugIds?: string[];
  onItemsChange?: (items: RxItem[]) => void;
  /** A drug picked from the server-side search joins the formulary the checks read. */
  onDrugFound?: (drug: FormularyDrug) => void;
  onSave: (items: RxItem[]) => void;
  onPrint?: () => void;
}

let UID = 1000;

export function RxDoctor({
  formulary,
  formularyLoading,
  formularyById,
  nlemGenerics,
  initialItems,
  patientName,
  patientAllergies,
  prescriber: prescriberDefault,
  canSave,
  saving,
  editing,
  safety,
  signer,
  templates,
  templateToItems,
  onSaveTemplate,
  lastRx,
  dictated,
  signAction,
  priorDrugIds,
  onItemsChange,
  onDrugFound,
  onSave,
  onPrint,
}: Props) {
  const [prescriber, setPrescriber] = useState<Prescriber>(prescriberDefault);
  const [items, setItems] = useState<RxItem[]>(initialItems);
  const [expandedUid, setExpandedUid] = useState<number | null>(null);
  const [saveOpen, saveModal] = useDisclosure(false);
  const [safetyOpen, safetyPanel] = useDisclosure(false);
  const [setName, setSetName] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const [outsideName, setOutsideName] = useState<string | null>(null);

  const commit = (next: RxItem[]) => {
    setItems(next);
    onItemsChange?.(next);
  };

  const addDrug = (drug: FormularyDrug) => {
    searchRef.current?.focus();
    onDrugFound?.(drug);
    if (items.some((it) => it.id === drug.id)) {
      notifications.show({
        title: "Already added",
        message: `${drug.name} is already in this prescription`,
        color: "yellow",
      });
      return;
    }
    if (priorDrugIds?.includes(drug.id)) {
      notifications.show({
        title: "Already prescribed this visit",
        message: `${drug.name} is on an earlier prescription — adding anyway`,
        color: "yellow",
      });
    }
    UID += 1;
    const item: RxItem = {
      uid: UID,
      ...quickRxDefaults(drug),
      pendingMD: prescriber === "nurse" && drug.kind === "rx",
    };
    commit([...items, item]);
  };

  /** Adds a line the prescriber chose to have bought outside. */
  const addOutside = (line: BuyOutsideLineFormInput) => {
    setOutsideName(null);
    searchRef.current?.focus();
    UID += 1;
    commit([...items, { ...buyOutsideItem(UID, line), pendingMD: prescriber === "nurse" }]);
  };

  const patchItem = (uid: number, patch: Partial<RxItem>) =>
    commit(items.map((it) => (it.uid === uid ? { ...it, ...patch } : it)));
  const removeItem = (uid: number) => {
    if (expandedUid === uid) setExpandedUid(null);
    commit(items.filter((it) => it.uid !== uid));
  };
  const loadItems = (incoming: RxItem[]) => {
    // A drug already on the pad stays as written; it is not added twice.
    const fresh = incoming
      .filter((it) => !items.some((have) => have.id === it.id))
      .map((it) => {
        UID += 1;
        return { ...it, uid: UID };
      });
    commit([...items, ...fresh]);
  };
  const loadTemplate = (tpl: PrescriptionTemplate) => loadItems(templateToItems(tpl));
  const repeatLast = () => {
    if (!lastRx) return;
    loadItems(lastRx.items);
    if (lastRx.skipped.length > 0) {
      notifications.show({
        title: "Not repeated",
        message: `No longer in the formulary: ${lastRx.skipped.join(", ")}`,
        color: "yellow",
      });
    }
  };
  /** Load the dictated lines onto the pad, saying which still need a drug picked. */
  const loadDictated = () => {
    if (!dictated) return;
    loadItems(dictated.items);
    if (dictated.waiting.length > 0) {
      notifications.show({
        title: "Not in the formulary",
        message: `Pick the drug above for: ${dictated.waiting.join(", ")}`,
        color: "yellow",
      });
    }
    dictated.onLoaded();
  };
  const saveTemplate = () => {
    if (!setName.trim()) return;
    onSaveTemplate(setName.trim(), items);
    setSetName("");
    saveModal.close();
  };

  // ── safety rail ──
  const drugObjs = items.map((it) => formularyById[it.id]).filter(Boolean) as FormularyDrug[];
  const controlledItems = items.filter((it) => {
    const d = formularyById[it.id];
    return d?.controlled || d?.schedule === "X" || d?.schedule === "H1";
  });
  const interactions = safety.interactions;
  const major = interactions.filter(
    (x) => x.severity === "major" || x.severity === "contraindicated",
  );
  const conflicts = safety.allergy_conflicts;
  const classCount: Record<string, number> = {};
  for (const d of drugObjs) {
    if (d.cls) classCount[d.cls] = (classCount[d.cls] || 0) + 1;
  }
  const dupes = Object.entries(classCount).filter(([, n]) => n > 1);
  const overMax = items
    .map((it) => {
      const d = formularyById[it.id];
      const hit = d ? maxDoseExceeded(it, d) : null;
      return hit ? { name: it.name, label: hit.totalLabel } : null;
    })
    .filter(Boolean) as { name: string; label: string }[];
  const cautions = prescribingCautions(drugObjs);
  const seriousCautions = cautions.filter((c) => c.serious);
  const weightAlerts = safety.weight_alerts;
  const renalAlerts = safety.renal_alerts;
  const hepaticAlerts = safety.hepatic_alerts;
  const ingredientAlerts = safety.ingredient_alerts;
  const pregnancyAlerts = safety.pregnancy_alerts;
  const seriousIngredient = ingredientAlerts.filter((a) => a.kind === "incompatible");
  const pendingCount = items.filter((it) => it.pendingMD).length;
  const reviewCount =
    major.length +
    conflicts.length +
    overMax.length +
    seriousCautions.length +
    weightAlerts.length +
    renalAlerts.length +
    hepaticAlerts.length +
    ingredientAlerts.length +
    pregnancyAlerts.length;

  return (
    <Box className={classes.view}>
      <Box className={classes.colMain}>
        <Group justify="space-between" align="center" wrap="wrap" className={classes.prescriberBar}>
          <SegmentedControl
            className={classes.ptog}
            value={prescriber}
            onChange={(v) => setPrescriber(v as Prescriber)}
            data={[
              {
                value: "doctor",
                label: (
                  <span className={classes.ptogLabel}>
                    Doctor<small>full prescribing rights</small>
                  </span>
                ),
              },
              {
                value: "nurse",
                label: (
                  <span className={classes.ptogLabel}>
                    Nurse<small>OTC / protocol · MD countersign</small>
                  </span>
                ),
              },
            ]}
          />
          <Group gap="xs" className={classes.shActions}>
            <Button
              tone="ghost"
              leftSection={<IconShieldCheck size={15} />}
              onClick={safetyPanel.open}
            >
              Safety
              <span
                className={cx(
                  classes.pill,
                  reviewCount ? classes.red : classes.green,
                  classes.safetyChipPill,
                )}
              >
                <span className={classes.pdot} />
                {reviewCount ? reviewCount : "clear"}
              </span>
            </Button>
            {dictated && dictated.items.length > 0 && (
              <Button
                tone="accent"
                leftSection={<IconMicrophone size={15} aria-hidden />}
                onClick={loadDictated}
              >
                Add dictated medicines ({dictated.items.length})
              </Button>
            )}
            {lastRx && lastRx.items.length > 0 && (
              <Button
                tone="ghost"
                leftSection={<IconRepeat size={15} />}
                title={`Last prescription: ${lastRx.label}`}
                onClick={repeatLast}
              >
                Repeat last prescription
              </Button>
            )}
            <Menu shadow="md" width={240} position="bottom-end">
              <Menu.Target>
                <Button tone="ghost" leftSection={<IconTemplate size={15} />}>
                  Order sets
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>Load a saved set</Menu.Label>
                {templates.length === 0 && <Menu.Item disabled>No saved sets yet</Menu.Item>}
                {templates.map((tpl) => (
                  <Menu.Item key={tpl.id} onClick={() => loadTemplate(tpl)}>
                    {tpl.name} · {tpl.items.length}
                  </Menu.Item>
                ))}
                <Menu.Divider />
                <Menu.Item disabled={items.length === 0} onClick={saveModal.open}>
                  Save current as set…
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
            {onPrint && (
              <Button tone="secondary" onClick={onPrint} disabled={items.length === 0}>
                Print
              </Button>
            )}
            <Button
              tone="primary"
              loading={saving}
              disabled={!canSave || items.length === 0}
              onClick={() => onSave(items)}
            >
              {prescriber === "nurse" ? "Send to doctor" : editing ? "Save changes" : "Sign & save"}
            </Button>
          </Group>
        </Group>

        <Box className={classes.rxSheet}>
          <Group gap="sm" wrap="nowrap" className={classes.rxSheetHead}>
            <span className={classes.rxSymbol}>℞</span>
            <span className={classes.rxSheetTitle}>Prescription</span>
            {/* search — centered in the header: type · ↑/↓ · Enter to add */}
            <Box className={classes.rxSearch}>
              <FormularySearch
                formulary={formulary}
                loading={formularyLoading}
                onPick={addDrug}
                onBuyOutside={setOutsideName}
                inputRef={searchRef}
              />
            </Box>
            <span className={classes.rxSheetMeta}>
              {items.length} medication{items.length !== 1 ? "s" : ""}
            </span>
          </Group>

          {items.length === 0 ? (
            <Box className={classes.rxEmpty}>
              No medications yet — search above to add the first.
            </Box>
          ) : (
            <RxTable
              items={items}
              formularyById={formularyById}
              nlemGenerics={nlemGenerics}
              onChange={patchItem}
              onOpenDetails={setExpandedUid}
              onRemove={removeItem}
            />
          )}

          {/* signature — in the card footer */}
          <Group justify="space-between" wrap="wrap" className={classes.rxSheetFoot}>
            <Box className={classes.signMeta}>
              <Box className={classes.signLine} />
              <b>{prescriber === "nurse" ? signer.nurseName : signer.name}</b>
              <span>
                {prescriber === "nurse"
                  ? `Nursing · ${signer.nurseReg}${pendingCount ? ` · ${pendingCount} item(s) await MD` : ""}`
                  : signer.reg}
              </span>
            </Box>
            {signAction}
          </Group>
        </Box>
      </Box>

      {/* safety — horizontal slide-in drawer */}
      <Modal
        opened={safetyOpen}
        onClose={safetyPanel.close}
        size={360}
        title="Safety check · live"
        classNames={{ body: classes.safetyDrawer }}
      >
        {safety.conclusion.summary && (
          <Alert
            tone={
              safety.conclusion.severity === "critical"
                ? "danger"
                : safety.conclusion.severity === "warning"
                  ? "warning"
                  : "success"
            }
            title="Clinical review"
          >
            <Text size="sm">{safety.conclusion.summary}</Text>
            <Text size="xs" c="dimmed">
              {safety.conclusion.recommendation}
            </Text>
          </Alert>
        )}
        <SafetyRow
          state={conflicts.length ? "flag" : "ok"}
          label="Allergy screen"
          detail={
            conflicts[0]
              ? conflicts.map((c) => `${c.drug_name} × ${c.allergen_name}`).join(", ")
              : patientAllergies.length
                ? `On file: ${patientAllergies.join(", ")} · no conflict in order`
                : "No allergies on file"
          }
        />
        <SafetyRow
          state={major.length ? "flag" : interactions.length ? "warn" : "ok"}
          label="Interactions"
          detail={
            interactions[0]
              ? `${interactions.length} found — ${interactions[0].drug_a} × ${interactions[0].drug_b}: ${interactions[0].description}`
              : "No drug–drug interactions among current items"
          }
        />
        <SafetyRow
          state={controlledItems.length ? "warn" : "ok"}
          label="Schedule & controlled"
          detail={
            controlledItems.length
              ? `${controlledItems.map((i) => i.name).join(", ")} — needs written Rx + register entry on dispense`
              : "No Schedule X / H1 / NDPS drugs in order"
          }
        />
        <SafetyRow
          state={overMax.length ? "flag" : "ok"}
          label="Max dose · 24h"
          detail={
            overMax.length
              ? overMax.map((m) => `${m.name}: ${m.label}`).join(", ")
              : "Within catalog daily ceilings"
          }
        />
        <SafetyRow
          state={dupes.length ? "warn" : "ok"}
          label="Duplicate therapy"
          detail={
            dupes.length
              ? dupes.map(([c, n]) => `${n}× ${c}`).join(", ")
              : "No overlapping drug classes"
          }
        />
        <SafetyRow
          state={seriousCautions.length ? "flag" : cautions.length ? "warn" : "ok"}
          label="Stewardship & warnings"
          detail={
            cautions.length
              ? cautions.map((c) => `${c.label}: ${c.detail}`).join(" · ")
              : "No AWaRe Reserve/Watch antibiotics or boxed warnings in order"
          }
        />
        <SafetyRow
          state={
            weightAlerts.some((w) => w.direction === "over")
              ? "flag"
              : weightAlerts.length
                ? "warn"
                : "ok"
          }
          label="Paediatric dose · mg/kg"
          detail={
            weightAlerts.length
              ? weightAlerts
                  .map(
                    (w) =>
                      `${w.drug_name}: ${w.prescribed_per_day_label}/day is ${w.direction} the ~${w.recommended_per_day_label}/day for ${w.weight_kg} kg`,
                  )
                  .join(" · ")
              : "Within weight-based range (or not a paediatric patient)"
          }
        />
        <SafetyRow
          state={renalAlerts.length ? "flag" : "ok"}
          label="Renal dose · eGFR"
          detail={
            renalAlerts.length
              ? renalAlerts
                  .map((r) => `${r.drug_name}: ${r.rule} (eGFR ${r.egfr} < ${r.threshold})`)
                  .join(" · ")
              : "No renal dose adjustment flagged"
          }
        />
        <SafetyRow
          state={hepaticAlerts.length ? "warn" : "ok"}
          label="Hepatic caution"
          detail={
            hepaticAlerts.length
              ? hepaticAlerts.map((h) => `${h.drug_name}: ${h.caution}`).join(" · ")
              : "No hepatic cautions in order"
          }
        />
        <SafetyRow
          state={
            pregnancyAlerts.some((p) => p.severity === "contraindicated")
              ? "flag"
              : pregnancyAlerts.length
                ? "warn"
                : "ok"
          }
          label="Pregnancy safety"
          detail={
            pregnancyAlerts.length
              ? pregnancyAlerts
                  .map((p) => `${p.drug_name}: category ${p.pregnancy_category}`)
                  .join(" · ")
              : "No pregnancy-category concerns"
          }
        />
        <SafetyRow
          state={seriousIngredient.length ? "flag" : ingredientAlerts.length ? "warn" : "ok"}
          label="Combination chemistry"
          detail={
            ingredientAlerts.length
              ? ingredientAlerts
                  .map((a) =>
                    a.kind === "duplicate"
                      ? `Duplicate ${a.label} — ${a.detail}`
                      : `${a.label}: ${a.detail}`,
                  )
                  .join(" · ")
              : "No duplicate ingredients or incompatible combinations"
          }
        />
      </Modal>

      <BuyOutsideModal name={outsideName} onAdd={addOutside} onClose={() => setOutsideName(null)} />

      <Modal opened={saveOpen} onClose={saveModal.close} title="Save as order set" size="sm">
        <Input
          value={setName}
          onChange={(e) => setSetName(e.currentTarget.value)}
          placeholder="e.g. URTI starter pack"
          aria-label="Set name"
          data-autofocus
        />
        <Group justify="flex-end" mt="md">
          <Button tone="ghost" onClick={saveModal.close}>
            Cancel
          </Button>
          <Button tone="primary" disabled={!setName.trim()} onClick={saveTemplate}>
            Save set
          </Button>
        </Group>
      </Modal>

      {/* Shared detailed-dose modal — reused for whichever row's adjust icon is clicked. */}
      {(() => {
        const item = expandedUid != null ? items.find((it) => it.uid === expandedUid) : undefined;
        const drug = item ? formularyById[item.id] : undefined;
        return (
          <Modal
            opened={Boolean(item && drug)}
            onClose={() => setExpandedUid(null)}
            title={item ? `Dose details · ${item.name}` : "Dose details"}
            size="lg"
          >
            {item && drug && (
              <RxCompose
                drug={drug}
                init={item}
                prescriber={prescriber}
                patientName={patientName}
                patientAllergies={patientAllergies}
                onSave={(vals: ComposeValues) => {
                  patchItem(item.uid, vals);
                  setExpandedUid(null);
                }}
                onCancel={() => setExpandedUid(null)}
              />
            )}
          </Modal>
        );
      })()}
    </Box>
  );
}
