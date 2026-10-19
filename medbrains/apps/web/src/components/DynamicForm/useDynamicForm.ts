import { zodResolver } from "@hookform/resolvers/zod";
import type { FormAnswers, FormDefinition } from "@medbrains/types";
import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { buildAnswersSchema, type DraftAnswers, emptyAnswers } from "./schema";

/** A React Hook Form instance validated by the form's own rules. */
export function useDynamicForm(definition: FormDefinition, given?: FormAnswers) {
  const schema = useMemo(() => buildAnswersSchema(definition), [definition]);
  const values = useMemo(() => emptyAnswers(definition, given), [definition, given]);
  return useForm<DraftAnswers>({
    resolver: zodResolver(schema) as never,
    values,
    mode: "onTouched",
  });
}
