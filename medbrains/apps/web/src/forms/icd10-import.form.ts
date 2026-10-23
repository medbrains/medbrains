import type { ImportIcd10Request } from "@medbrains/types";
import { z } from "zod";

/** Larger than any ICD-10 file; the server refuses above 64 MB too. */
export const ICD10_MAX_FILE_BYTES = 60 * 1024 * 1024;

export const icd10ImportSchema = z.object({
  format: z.enum(["claml", "csv"]),
  version: z.string().trim().min(1, "Name the edition, e.g. 2019").max(64),
  source: z.string().trim().min(1, "Say who supplied the file").max(200),
  licence_note: z
    .string()
    .trim()
    .min(1, "Record the licence the hospital holds this file under")
    .max(1000),
  file: z
    .instanceof(File, { message: "Choose the ICD-10 file" })
    .refine((f) => f.size <= ICD10_MAX_FILE_BYTES, "The file is larger than 60 MB"),
});

export type Icd10ImportForm = z.infer<typeof icd10ImportSchema>;

export const ICD10_FORMAT_OPTIONS = [
  { value: "claml", label: "WHO ClaML (XML)" },
  { value: "csv", label: "CSV: code, title, chapter" },
];

export async function toImportIcd10Request(form: Icd10ImportForm): Promise<ImportIcd10Request> {
  return {
    format: form.format,
    version: form.version.trim(),
    source: form.source.trim(),
    licence_note: form.licence_note.trim(),
    file_name: form.file.name,
    content: await form.file.text(),
  };
}
