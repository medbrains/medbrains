/** A stand-in patient picker for counter tests: two buttons instead of a search. */
export function PatientPicker({ onChange }: { onChange: (id: string) => void }) {
  return (
    <>
      <button type="button" onClick={() => onChange("pA")}>
        Pick patient A
      </button>
      <button type="button" onClick={() => onChange("pB")}>
        Pick patient B
      </button>
    </>
  );
}
