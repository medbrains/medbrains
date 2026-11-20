/**
 * The option a form can use without asking: the only one on offer, so a
 * single-department hospital never has to pick its department. Null when there
 * are none (still loading, or the look-up failed) or several, and when the form
 * already holds a different value, so a picker stays on screen to show it.
 */
export function soleOption<T extends { value: string }>(
  options: readonly T[],
  current?: string | null,
): T | null {
  const [only] = options;
  if (options.length !== 1 || !only) return null;
  return !current || current === only.value ? only : null;
}

/** The department id a form submits: the hospital's only one when the picker is hidden, else the picked one. */
export function pickDepartment<C extends string | null | undefined>(
  options: readonly { value: string }[],
  current: C,
): string | C {
  return soleOption(options, current)?.value ?? current;
}
