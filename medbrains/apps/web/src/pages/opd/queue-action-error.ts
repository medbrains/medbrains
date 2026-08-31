/**
 * Did a queue action fail because the row had already moved on?
 *
 * `AppError::NotFound` serialises as `{ error: "not found", detail: "not
 * found" }` — lower case, with no status code in the text — and the API
 * client surfaces `detail` as the Error's message. Matching "Not Found" or
 * "404" therefore matches nothing, which is worth a named function and a
 * test rather than a comparison inline in a handler.
 *
 * The distinction is worth drawing at all because this is much the most
 * common failure here: two people work the same queue, and the row one of
 * them is looking at was called by the other a moment ago. That deserves an
 * explanation, not the server's bare wording.
 */
export function isStaleRowError(error: Error): boolean {
  return error.message.trim().toLowerCase() === "not found";
}
