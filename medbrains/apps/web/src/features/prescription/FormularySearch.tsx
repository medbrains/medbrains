import { Box, Combobox, useCombobox } from "@mantine/core";
import { type Ref, useMemo, useState } from "react";
import { Input } from "@/components/ui/Input";
import classes from "./prescription.module.scss";
import { type FormularyDrug, searchFormulary, stockStatus } from "./rxModel";

interface FormularySearchProps {
  formulary: FormularyDrug[];
  /** The formulary has not arrived yet: say so instead of "no match". */
  loading: boolean;
  onPick: (drug: FormularyDrug) => void;
  inputRef?: Ref<HTMLInputElement>;
}

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(" ");

/**
 * The prescriber's drug search: type, arrow through the matches, Enter adds
 * the highlighted one. A Mantine combobox, so the matches are a listbox a
 * screen reader announces and the keyboard walks. It replaced a list of bare
 * buttons whose Enter, pressed before the formulary had loaded, did nothing
 * and said nothing.
 */
export function FormularySearch({ formulary, loading, onPick, inputRef }: FormularySearchProps) {
  const [query, setQuery] = useState("");
  const combobox = useCombobox({ onDropdownClose: () => combobox.resetSelectedOption() });
  const results = useMemo(() => searchFormulary(formulary, query), [formulary, query]);
  const byId = useMemo(() => new Map(results.map((d) => [d.id, d])), [results]);
  const hasQuery = query.trim().length > 0;

  const pick = (id: string) => {
    const drug = byId.get(id);
    if (!drug) return;
    setQuery("");
    combobox.closeDropdown();
    onPick(drug);
  };

  return (
    <Combobox store={combobox} onOptionSubmit={pick} withinPortal={false}>
      <Combobox.Target>
        <Input
          ref={inputRef}
          size="md"
          value={query}
          onChange={(e) => {
            setQuery(e.currentTarget.value);
            combobox.openDropdown();
            // Enter adds the top match without an arrow key first.
            combobox.updateSelectedOptionIndex();
            requestAnimationFrame(() => combobox.selectFirstOption());
          }}
          onFocus={() => hasQuery && combobox.openDropdown()}
          onBlur={() => combobox.closeDropdown()}
          placeholder="Search a drug, press Enter to add — name, salt, or brand…"
          aria-label="Search formulary"
          leftSection={
            <Box component="span" className={classes.rxAddIcon}>
              +
            </Box>
          }
        />
      </Combobox.Target>
      <Combobox.Dropdown hidden={!hasQuery} className={classes.rxDd}>
        <Combobox.Options aria-label="Formulary matches">
          {loading ? (
            <Combobox.Empty className={classes.ddEmpty}>
              Loading the formulary. Your search will match as soon as it arrives.
            </Combobox.Empty>
          ) : results.length === 0 ? (
            <Combobox.Empty className={classes.ddEmpty}>
              No match for “{query}”. Try a salt or brand name.
            </Combobox.Empty>
          ) : (
            results.map((drug) => (
              <Combobox.Option key={drug.id} value={drug.id} className={classes.ddItem}>
                <FormularyOption drug={drug} />
              </Combobox.Option>
            ))
          )}
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  );
}

function FormularyOption({ drug }: { drug: FormularyDrug }) {
  const stock = stockStatus(drug);
  return (
    <>
      <Box className={classes.ddMid}>
        <Box className={classes.ddName}>{drug.name}</Box>
        <Box className={classes.ddSalt}>
          {drug.salt}
          {drug.strengths.length ? ` · ${drug.strengths.join(" / ")}` : ""}
        </Box>
      </Box>
      <Box className={classes.ddCls}>{drug.cls}</Box>
      {stock === "out" && (
        <Box component="span" className={cx(classes.ddTag, classes.pen)}>
          out of stock
        </Box>
      )}
      {stock === "low" && (
        <Box component="span" className={cx(classes.ddTag, classes.lowStock)}>
          low stock
        </Box>
      )}
      <Box
        component="span"
        className={cx(classes.ddTag, drug.kind === "otc" ? classes.otc : classes.rx)}
      >
        {drug.kind === "otc" ? "OTC" : "Rx"}
      </Box>
    </>
  );
}
