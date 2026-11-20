import { Button } from "@/components/ui";

/** A stand-in patient picker for counter tests: two buttons instead of a search. */
export function PatientPicker({ onChange }: { onChange: (id: string) => void }) {
  return (
    <>
      <Button onClick={() => onChange("pA")}>Pick patient A</Button>
      <Button onClick={() => onChange("pB")}>Pick patient B</Button>
    </>
  );
}
