import type { CreateConsultationRequest, UpdateConsultationRequest } from "@medbrains/types";

/** Strip update-only fields when seeding a consultation from update input. */
export function toCreateConsultationPayload(
  data: UpdateConsultationRequest,
): CreateConsultationRequest {
  const { snomed_codes: _snomedCodes, ...payload } = data;
  return payload;
}
