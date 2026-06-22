import { Box, Group, Menu } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import type { AllergyConflict, DrugInteractionAlert, PrescriptionTemplate } from "@medbrains/types";
import {
  IconAlertTriangle,
  IconCheck,
  IconExclamationCircle,
  IconShieldCheck,
  IconTemplate,
} from "@tabler/icons-react";
import { type KeyboardEvent, type ReactNode, useMemo, useRef, useState } from "react";
import { Button, Drawer, Modal, SegmentedControl } from "@/components/ui";
import { Input } from "@/components/ui/Input";
import classes from "./prescription.module.scss";
import { type ComposeValues, type Prescriber, RxCompose } from "./RxCompose";
import { RxTable } from "./RxTable";
import {
  type FormularyDrug,
  maxDoseExceeded,
  prescribingCautions,
  quickRxDefaults,
  type RxItem,
  searchFormulary,
  stockStatus,
} from "./rxModel";

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
  formularyById: Record<string, FormularyDrug>;
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
  /** Digital-sign control rendered in the card footer (provided when a saved Rx exists). */
  signAction?: ReactNode;
  /** Catalog ids already prescribed on this visit — warns (doesn't block) on re-add. */
  priorDrugIds?: string[];
  onItemsChange?: (items: RxItem[]) => void;
  onSave: (items: RxItem[]) => void;
  onPrint?: () => void;
}

let UID = 1000;

export function RxDoctor({
  formulary,
  formularyById,
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
  signAction,
  priorDrugIds,
  onItemsChange,
  onSave,
  onPrint,
}: Props) {
  const [prescriber, setPrescriber] = useState<Prescriber>(prescriberDefault);
  const [items, setItems] = useState<RxItem[]>(initialItems);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [expandedUid, setExpandedUid] = useState<number | null>(null);
  const [saveOpen, saveModal] = useDisclosure(false);
  const [safetyOpen, safetyPanel] = useDisclosure(false);
  const [setName, setSetName] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => searchFormulary(formulary, query), [formulary, query]);

  const commit = (next: RxItem[]) => {
    setItems(next);
    onItemsChange?.(next);
  };

  const addDrug = (drug: FormularyDrug) => {
    setQuery("");
    setHighlight(0);
    searchRef.current?.focus();
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

  const onSearchKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!results.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => (h + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => (h - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const drug = results[Math.min(highlight, results.length - 1)] ?? results[0];
      if (drug) addDrug(drug);
    } else if (e.key === "Escape") {
      setQuery("");
    }
  };

  const patchItem = (uid: number, patch: Partial<RxItem>) =>
    commit(items.map((it) => (it.uid === uid ? { ...it, ...patch } : it)));
  const removeItem = (uid: number) => {
    if (expandedUid === uid) setExpandedUid(null);
    commit(items.filter((it) => it.uid !== uid));
  };
  const loadTemplate = (tpl: PrescriptionTemplate) => {
    const fresh = templateToItems(tpl).map((it) => {
      UID += 1;
      return { ...it, uid: UID };
    });
    commit([...items, ...fresh]);
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
  const pendingCount = items.filter((it) => it.pendingMD).length;
  const reviewCount = major.length + conflicts.length + overMax.length + seriousCautions.length;

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
              <Input
                ref={searchRef}
                size="md"
                value={query}
                onChange={(e) => {
                  setQuery(e.currentTarget.value);
                  setHighlight(0);
                }}
                onKeyDown={onSearchKey}
                placeholder="Search a drug, press Enter to add — name, salt, or brand…"
                aria-label="Search formulary"
                leftSection={<span className={classes.rxAddIcon}>+</span>}
              />
              {results.length > 0 && (
                <Box className={classes.rxDd}>
                  {results.map((drug, idx) => (
                    <button
                      type="button"
                      className={cx(classes.ddItem, idx === highlight && classes.ddActive)}
                      key={drug.id}
                      onMouseEnter={() => setHighlight(idx)}
                      onClick={() => addDrug(drug)}
                    >
                      <Box className={classes.ddMid}>
                        <Box className={classes.ddName}>{drug.name}</Box>
                        <Box className={classes.ddSalt}>
                          {drug.salt}
                          {drug.strengths.length ? ` · ${drug.strengths.join(" / ")}` : ""}
                        </Box>
                      </Box>
                      <Box className={classes.ddCls}>{drug.cls}</Box>
                      {stockStatus(drug) === "out" && (
                        <span className={cx(classes.ddTag, classes.pen)}>out of stock</span>
                      )}
                      {stockStatus(drug) === "low" && (
                        <span className={cx(classes.ddTag, classes.lowStock)}>low stock</span>
                      )}
                      {drug.kind === "otc" ? (
                        <span className={cx(classes.ddTag, classes.otc)}>OTC</span>
                      ) : (
                        <span className={cx(classes.ddTag, classes.rx)}>Rx</span>
                      )}
                    </button>
                  ))}
                </Box>
              )}
              {query.trim() && results.length === 0 && (
                <Box className={classes.rxDd}>
                  <Box className={classes.ddEmpty}>
                    No match for “{query}”. Try a salt or brand name.
                  </Box>
                </Box>
              )}
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
      <Drawer
        opened={safetyOpen}
        onClose={safetyPanel.close}
        position="right"
        size={360}
        title="Safety check · live"
        classNames={{ body: classes.safetyDrawer }}
      >
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
      </Drawer>

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
