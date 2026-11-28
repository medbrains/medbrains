import { ApiError } from "@medbrains/api";

/** The notice once an unmerge went through. */
export const UNMERGED_NOTICE = {
  title: "Unmerged",
  message: "Patient records separated",
  color: "success",
};

/**
 * The notice for an unmerge the server refused. A 404 is the server saying one
 * of the two records is outside the caller's access (an unmerge needs both, as
 * a merge does), not that the merge is missing; anything else is a plain failure.
 */
export function unmergeRefusal(error: unknown) {
  const outsideAccess = error instanceof ApiError && error.status === 404;
  return {
    title: "Not unmerged",
    message: outsideAccess
      ? "You can only undo a merge when you can open both records. Ask the medical records officer."
      : "The records could not be separated. Try again.",
    color: "danger",
  };
}
