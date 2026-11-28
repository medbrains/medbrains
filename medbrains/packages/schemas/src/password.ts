/**
 * Shortest password the server accepts when one is set or changed. The server is the
 * authority: it also refuses common passwords and ones holding the username or the
 * hospital's name or code. The client mirrors only this length.
 */
export const PASSWORD_MIN_LENGTH = 12;

/** The password rule in words, shown under every field that sets a new password. */
export const PASSWORD_RULE =
  "At least 12 characters; common passwords and your username aren't allowed.";

/** The message for a password shorter than {@link PASSWORD_MIN_LENGTH}. */
export const PASSWORD_TOO_SHORT = "Password must be at least 12 characters";
