import { useDebouncedValue } from "@tanstack/react-pacer";

export function usePacedQueryValue<T>(value: T, wait = 350): T {
  const [pacedValue] = useDebouncedValue(value, { wait });
  return pacedValue;
}
