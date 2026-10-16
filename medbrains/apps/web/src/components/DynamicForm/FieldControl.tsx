import { Group, Radio } from "@mantine/core";
import { DateInput } from "@mantine/dates";
import type { FormFieldSpec } from "@medbrains/types";
import { Input, MultiSelect, NumberField, Select, TextArea } from "@/components/ui";
import type { DraftAnswers } from "./schema";

interface FieldControlProps {
  field: FormFieldSpec;
  value: DraftAnswers[string];
  onChange: (value: DraftAnswers[string]) => void;
  onBlur: () => void;
  error?: string;
  readOnly?: boolean;
}

const YES = "yes";
const NO = "no";

/** One question, drawn with the control its kind calls for. */
export function FieldControl({
  field,
  value,
  onChange,
  onBlur,
  error,
  readOnly,
}: FieldControlProps) {
  const common = {
    label: field.label,
    description: field.help ?? undefined,
    withAsterisk: field.required,
    error,
    onBlur,
    readOnly,
  };
  switch (field.kind) {
    case "text":
      return (
        <Input
          {...common}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.currentTarget.value)}
        />
      );
    case "textarea":
      return (
        <TextArea
          {...common}
          autosize
          minRows={2}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.currentTarget.value)}
        />
      );
    case "number":
      return (
        <NumberField
          {...common}
          value={typeof value === "number" ? value : ""}
          onChange={(v) => onChange(typeof v === "number" ? v : null)}
        />
      );
    case "date":
      return (
        <DateInput
          {...common}
          valueFormat="DD MMM YYYY"
          clearable
          value={typeof value === "string" && value ? value : null}
          onChange={(v) => onChange(v ?? "")}
        />
      );
    case "select":
      return (
        <Select
          {...common}
          data={field.options}
          clearable
          value={typeof value === "string" && value ? value : null}
          onChange={(v) => onChange(v ?? "")}
        />
      );
    case "multiselect":
      return (
        <MultiSelect
          {...common}
          data={field.options}
          value={Array.isArray(value) ? value : []}
          onChange={onChange}
        />
      );
    case "radio":
    case "yes_no": {
      const options = field.kind === "radio" ? field.options : [YES, NO];
      const current =
        field.kind === "yes_no"
          ? value === true
            ? YES
            : value === false
              ? NO
              : ""
          : String(value ?? "");
      const pick = (v: string) => onChange(field.kind === "yes_no" ? v === YES : v);
      return (
        <Radio.Group {...common} value={current} onChange={readOnly ? undefined : pick}>
          <Group gap="md" mt={4}>
            {options.map((option) => (
              <Radio
                key={option}
                value={option}
                label={field.kind === "yes_no" ? (option === YES ? "Yes" : "No") : option}
                disabled={readOnly}
              />
            ))}
          </Group>
        </Radio.Group>
      );
    }
  }
}
