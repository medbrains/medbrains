import { Box, Group, UnstyledButton } from "@mantine/core";
import type { AllergyConflict, DrugInteractionAlert } from "@medbrains/types";
import { IconAlertTriangle, IconCheck, IconExclamationCircle } from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { Button, SegmentedControl } from "@/components/ui";
import { Input } from "@/components/ui/Input";
import classes from "./prescription.module.scss";
import { type ComposeValues, type Prescriber, RxCompose } from "./RxCompose";
import { RxTable } from "./RxTable";
import { type FormularyDrug, type RxItem, searchFormulary } from "./rxModel";

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
  /** Default prescriber persona; the toggle still lets the user switch. */
  prescriber: Prescriber;
  canSave: boolean;
  saving: boolean;
  /** True when editing an existing prescription (changes the save label). */
  editing: boolean;
  /** Live safety from the backend drug-safety check. */
  safety: RxSafety;
  signer: { name: string; reg: string; nurseName: string; nurseReg: string };
  /** Notify upstream so it can re-run the safety check. */
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
  onItemsChange,
  onSave,
  onPrint,
}: Props) {
  const [prescriber, setPrescriber] = useState<Prescriber>(prescriberDefault);
  const [items, setItems] = useState<RxItem[]>(initialItems);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<FormularyDrug | null>(null);
  const [editingUid, setEditingUid] = useState<number | null>(null);

  const results = useMemo(() => searchFormulary(formulary, query), [formulary, query]);

  const commit = (next: RxItem[]) => {
    setItems(next);
    onItemsChange?.(next);
  };
  const addItem = (vals: ComposeValues) => {
    UID += 1;
    commit([...items, { uid: UID, ...vals }]);
    setPicked(null);
    setQuery("");
  };
  const saveEdit = (vals: ComposeValues) => {
    commit(items.map((it) => (it.uid === editingUid ? { ...it, ...vals } : it)));
    setEditingUid(null);
  };
  const remove = (uid: number) => commit(items.filter((it) => it.uid !== uid));

  // ── safety rail (real backend results + formulary-derived signals) ──
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
  const pendingCount = items.filter((it) => it.pendingMD).length;

  const reviewCount = major.length + conflicts.length;

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
          <Box className={classes.prescriberNote}>
            {prescriber === "doctor" ? (
              <>
                <b>{signer.name}</b> can prescribe and sign anything in formulary.
              </>
            ) : (
              <>
                <b>{signer.nurseName}</b> can add OTC &amp; protocol drugs; Rx-only items route to a
                doctor.
              </>
            )}
          </Box>
        </Group>

        <Group justify="space-between" align="flex-end" wrap="wrap" className={classes.sectionHead}>
          <Box>
            <h2>
              Composing the <em>prescription</em>.
            </h2>
            <p>
              Search the formulary to add a drug, set strength · frequency · duration, edit or
              remove any line. Safety runs as you write.
            </p>
          </Box>
          <Group gap="xs" className={classes.shActions}>
            {onPrint && (
              <Button tone="secondary" onClick={onPrint} disabled={items.length === 0}>
                Print preview
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
          <Group gap="sm" className={classes.rxSheetHead}>
            <span className={classes.rxSymbol}>℞</span>
            <span className={classes.rxSheetTitle}>Prescription</span>
            <span className={classes.rxSheetMeta}>
              {items.length} medication{items.length !== 1 ? "s" : ""}
            </span>
          </Group>

          {items.length === 0 && (
            <Box className={classes.rxEmpty}>
              No medications yet — search below to add the first.
            </Box>
          )}

          {items.length > 0 && (
            <RxTable
              items={items}
              formularyById={formularyById}
              onEdit={(uid) => {
                setEditingUid(uid);
                setPicked(null);
              }}
              onRemove={remove}
            />
          )}

          {editingUid !== null &&
            (() => {
              const it = items.find((x) => x.uid === editingUid);
              const drug = it ? formularyById[it.id] : undefined;
              if (!it || !drug) return null;
              return (
                <RxCompose
                  drug={drug}
                  init={it}
                  prescriber={prescriber}
                  patientName={patientName}
                  patientAllergies={patientAllergies}
                  onSave={saveEdit}
                  onCancel={() => setEditingUid(null)}
                />
              );
            })()}

          {picked && (
            <RxCompose
              drug={picked}
              prescriber={prescriber}
              patientName={patientName}
              patientAllergies={patientAllergies}
              onSave={addItem}
              onCancel={() => {
                setPicked(null);
                setQuery("");
              }}
            />
          )}

          {!picked && (
            <Box className={classes.rxSearch}>
              <Input
                value={query}
                onChange={(e) => setQuery(e.currentTarget.value)}
                placeholder="Search drug to add — name, salt, or brand…"
                aria-label="Search formulary"
                leftSection={<span className={classes.rxAddIcon}>+</span>}
              />
              {results.length > 0 && (
                <Box className={classes.rxDd}>
                  {results.map((d) => (
                    <UnstyledButton
                      className={classes.ddItem}
                      key={d.id}
                      onClick={() => {
                        setPicked(d);
                        setEditingUid(null);
                      }}
                    >
                      <Box className={classes.ddMid}>
                        <Box className={classes.ddName}>{d.name}</Box>
                        <Box className={classes.ddSalt}>
                          {d.salt}
                          {d.strengths.length ? ` · ${d.strengths.join(" / ")}` : ""}
                        </Box>
                      </Box>
                      <Box className={classes.ddCls}>{d.cls}</Box>
                      {d.kind === "otc" ? (
                        <span className={cx(classes.ddTag, classes.otc)}>OTC</span>
                      ) : (
                        <span className={cx(classes.ddTag, classes.rx)}>Rx</span>
                      )}
                    </UnstyledButton>
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
          )}
        </Box>
      </Box>

      <Box component="aside" className={classes.colRail}>
        <Box className={classes.panel}>
          <Group justify="space-between" className={classes.panelHead}>
            <span className={classes.phTitle}>Safety check · live</span>
            {reviewCount ? (
              <span className={cx(classes.pill, classes.red)}>
                <span className={classes.pdot} />
                {reviewCount} to review
              </span>
            ) : (
              <span className={cx(classes.pill, classes.green)}>
                <span className={classes.pdot} />
                all clear
              </span>
            )}
          </Group>
          <SafetyRow
            state={conflicts.length ? "flag" : "ok"}
            label="Allergy screen"
            detail={
              conflicts[0]
                ? `${conflicts.map((c) => `${c.drug_name} × ${c.allergen_name}`).join(", ")}`
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
            state={dupes.length ? "warn" : "ok"}
            label="Duplicate therapy"
            detail={
              dupes.length
                ? dupes.map(([c, n]) => `${n}× ${c}`).join(", ")
                : "No overlapping drug classes"
            }
          />
        </Box>

        <Box className={classes.signCard}>
          <Box className={classes.signLine} />
          <Box className={classes.signMeta}>
            <b>{prescriber === "nurse" ? signer.nurseName : signer.name}</b>
            {prescriber === "nurse"
              ? `Nursing · ${signer.nurseReg}${pendingCount ? ` · ${pendingCount} item(s) await MD` : ""}`
              : signer.reg}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
