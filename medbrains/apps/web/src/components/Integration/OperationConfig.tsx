import { NumberInput, Textarea, TextInput } from "@mantine/core";
import type { MappingOperationConfig, MappingOperationType } from "@medbrains/types";

interface OperationConfigProps {
  operation: MappingOperationType;
  config: MappingOperationConfig;
  onChange: (config: MappingOperationConfig) => void;
}

export function OperationConfig({ operation, config, onChange }: OperationConfigProps) {
  switch (operation) {
    // ── String: no-config ops ──
    case "uppercase":
    case "lowercase":
    case "trim":
    case "capitalize":
    case "camel_case":
    case "snake_case":
    case "kebab_case":
    case "slug":
    case "encode_base64":
    case "decode_base64":
    // ── Array: no-config ops ──
    case "flatten":
    case "unique":
    case "sort_array":
    case "reverse":
    case "first":
    case "last":
    case "count":
    case "sum":
    case "avg":
    case "array_min":
    case "array_max":
    case "concat_arrays":
    // ── Number: no-config ops ──
    case "to_number":
    case "ceil":
    case "floor":
    case "abs":
    // ── Date: no-config ops ──
    case "date_diff":
    case "now":
    case "extract_year":
    case "extract_month":
    case "extract_day":
    // ── Conversion: no-config ops ──
    case "to_string":
    case "to_boolean":
    case "to_array":
    case "parse_json":
    case "to_json":
    case "coalesce":
    case "is_null":
    case "is_empty":
    case "typeof":
    case "none":
      return null;

    // ── Separator ops ──
    case "split":
    case "join":
      return (
        <TextInput
          size="xs"
          label="Separator"
          placeholder=","
          value={config.separator ?? ""}
          onChange={(e) => onChange({ ...config, separator: e.currentTarget.value })}
        />
      );

    // ── Substring ──
    case "substring":
      return (
        <>
          <NumberInput
            size="xs"
            label="Start"
            placeholder="0"
            value={config.start ?? ""}
            onChange={(v) => onChange({ ...config, start: typeof v === "number" ? v : 0 })}
          />
          <NumberInput
            size="xs"
            label="End"
            placeholder=""
            value={config.end ?? ""}
            onChange={(v) =>
              onChange({
                ...config,
                end: typeof v === "number" ? v : undefined,
              })
            }
          />
        </>
      );

    // ── Slice (array) ──
    case "slice":
      return (
        <>
          <NumberInput
            size="xs"
            label="Start"
            placeholder="0"
            value={config.start ?? ""}
            onChange={(v) => onChange({ ...config, start: typeof v === "number" ? v : 0 })}
          />
          <NumberInput
            size="xs"
            label="End"
            placeholder=""
            value={config.end ?? ""}
            onChange={(v) =>
              onChange({
                ...config,
                end: typeof v === "number" ? v : undefined,
              })
            }
          />
        </>
      );

    // ── Replace ──
    case "replace":
      return (
        <>
          <TextInput
            size="xs"
            label="Find"
            placeholder="search text"
            value={config.find ?? ""}
            onChange={(e) => onChange({ ...config, find: e.currentTarget.value })}
          />
          <TextInput
            size="xs"
            label="Replace With"
            placeholder="replacement"
            value={config.replaceWith ?? ""}
            onChange={(e) => onChange({ ...config, replaceWith: e.currentTarget.value })}
          />
        </>
      );

    // ── Regex ops ──
    case "regex_replace":
      return (
        <>
          <TextInput
            size="xs"
            label="Pattern"
            placeholder="[a-z]+"
            value={config.regex ?? ""}
            onChange={(e) => onChange({ ...config, regex: e.currentTarget.value })}
          />
          <TextInput
            size="xs"
            label="Flags"
            placeholder="gi"
            value={config.regexFlags ?? ""}
            onChange={(e) => onChange({ ...config, regexFlags: e.currentTarget.value })}
          />
          <TextInput
            size="xs"
            label="Replace With"
            placeholder="replacement"
            value={config.replaceWith ?? ""}
            onChange={(e) => onChange({ ...config, replaceWith: e.currentTarget.value })}
          />
        </>
      );

    case "regex_extract":
      return (
        <>
          <TextInput
            size="xs"
            label="Pattern"
            placeholder="(\d+)"
            value={config.regex ?? ""}
            onChange={(e) => onChange({ ...config, regex: e.currentTarget.value })}
          />
          <TextInput
            size="xs"
            label="Flags"
            placeholder="gi"
            value={config.regexFlags ?? ""}
            onChange={(e) => onChange({ ...config, regexFlags: e.currentTarget.value })}
          />
        </>
      );

    // ── Pad ──
    case "pad_start":
    case "pad_end":
      return (
        <>
          <TextInput
            size="xs"
            label="Pad Character"
            placeholder="0"
            value={config.padChar ?? ""}
            onChange={(e) => onChange({ ...config, padChar: e.currentTarget.value })}
          />
          <NumberInput
            size="xs"
            label="Target Length"
            placeholder="10"
            value={config.padLength ?? ""}
            onChange={(v) =>
              onChange({
                ...config,
                padLength: typeof v === "number" ? v : undefined,
              })
            }
          />
        </>
      );

    // ── Truncate ──
    case "truncate":
      return (
        <>
          <NumberInput
            size="xs"
            label="Max Length"
            placeholder="100"
            value={config.maxLength ?? ""}
            onChange={(v) =>
              onChange({
                ...config,
                maxLength: typeof v === "number" ? v : undefined,
              })
            }
          />
          <TextInput
            size="xs"
            label="Suffix"
            placeholder="..."
            value={config.suffix ?? ""}
            onChange={(e) => onChange({ ...config, suffix: e.currentTarget.value })}
          />
        </>
      );

    // ── Template ──
    case "template":
      return (
        <Textarea
          size="xs"
          label="Template"
          placeholder="Hello {{value}}"
          rows={2}
          value={config.templateString ?? ""}
          onChange={(e) => onChange({ ...config, templateString: e.currentTarget.value })}
        />
      );

    // ── Nth / Index ──
    case "nth":
      return (
        <NumberInput
          size="xs"
          label="Index"
          placeholder="0"
          value={config.index ?? ""}
          onChange={(v) => onChange({ ...config, index: typeof v === "number" ? v : 0 })}
        />
      );

    // ── Chunk ──
    case "chunk":
      return (
        <NumberInput
          size="xs"
          label="Chunk Size"
          placeholder="2"
          min={1}
          value={config.chunkSize ?? ""}
          onChange={(v) =>
            onChange({
              ...config,
              chunkSize: typeof v === "number" ? v : undefined,
            })
          }
        />
      );

    // ── Filter / Condition ──
    case "filter":
      return (
        <TextInput
          size="xs"
          label="Condition"
          placeholder="value > 0"
          value={config.condition ?? ""}
          onChange={(e) => onChange({ ...config, condition: e.currentTarget.value })}
        />
      );

    // ── Pluck / Map Each ──
    case "pluck":
    case "map_each":
      return (
        <TextInput
          size="xs"
          label="Field"
          placeholder="name"
          value={config.field ?? ""}
          onChange={(e) => onChange({ ...config, field: e.currentTarget.value })}
        />
      );

    // ── Push ──
    case "push":
      return (
        <TextInput
          size="xs"
          label="Value to Push"
          placeholder="new_item"
          value={config.defaultValue ?? ""}
          onChange={(e) => onChange({ ...config, defaultValue: e.currentTarget.value })}
        />
      );

    // ── Numeric operand ──
    case "add":
    case "subtract":
    case "multiply":
    case "divide":
    case "mod":
      return (
        <NumberInput
          size="xs"
          label="Operand"
          placeholder="0"
          value={config.operand ?? ""}
          onChange={(v) => onChange({ ...config, operand: typeof v === "number" ? v : 0 })}
        />
      );

    // ── Round ──
    case "round":
      return (
        <NumberInput
          size="xs"
          label="Decimal Places"
          placeholder="0"
          min={0}
          value={config.decimalPlaces ?? ""}
          onChange={(v) =>
            onChange({
              ...config,
              decimalPlaces: typeof v === "number" ? v : 0,
            })
          }
        />
      );

    // ── Clamp ──
    case "clamp":
      return (
        <>
          <NumberInput
            size="xs"
            label="Min"
            placeholder="0"
            value={config.minValue ?? ""}
            onChange={(v) =>
              onChange({
                ...config,
                minValue: typeof v === "number" ? v : undefined,
              })
            }
          />
          <NumberInput
            size="xs"
            label="Max"
            placeholder="100"
            value={config.maxValue ?? ""}
            onChange={(v) =>
              onChange({
                ...config,
                maxValue: typeof v === "number" ? v : undefined,
              })
            }
          />
        </>
      );

    // ── Format number ──
    case "format_number":
      return (
        <>
          <NumberInput
            size="xs"
            label="Decimal Places"
            placeholder="2"
            min={0}
            value={config.decimalPlaces ?? ""}
            onChange={(v) =>
              onChange({
                ...config,
                decimalPlaces: typeof v === "number" ? v : 2,
              })
            }
          />
          <TextInput
            size="xs"
            label="Locale"
            placeholder="en-US"
            value={config.locale ?? ""}
            onChange={(e) => onChange({ ...config, locale: e.currentTarget.value })}
          />
        </>
      );

    // ── Date format ops ──
    case "to_date":
    case "format_date":
    case "parse_date":
      return (
        <TextInput
          size="xs"
          label="Date Format"
          placeholder="YYYY-MM-DD"
          value={config.dateFormat ?? ""}
          onChange={(e) => onChange({ ...config, dateFormat: e.currentTarget.value })}
        />
      );

    // ── Add/subtract days ──
    case "add_days":
    case "subtract_days":
      return (
        <NumberInput
          size="xs"
          label="Days"
          placeholder="1"
          value={config.days ?? ""}
          onChange={(v) => onChange({ ...config, days: typeof v === "number" ? v : 0 })}
        />
      );

    // ── Add hours ──
    case "add_hours":
      return (
        <NumberInput
          size="xs"
          label="Hours"
          placeholder="1"
          value={config.hours ?? ""}
          onChange={(v) => onChange({ ...config, hours: typeof v === "number" ? v : 0 })}
        />
      );

    // ── Default value ──
    case "default_value":
      return (
        <TextInput
          size="xs"
          label="Default Value"
          placeholder="fallback value"
          value={config.defaultValue ?? ""}
          onChange={(e) => onChange({ ...config, defaultValue: e.currentTarget.value })}
        />
      );

    default:
      return null;
  }
}
