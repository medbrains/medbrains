/**
 * Starting data the screens cannot make: a summary signed a week ago, a
 * signature by someone with no doctor profile. Written straight to the
 * database the server under test uses (`E2E_DATABASE_URL`), never to read
 * back what a screen should show.
 */
import { execFileSync } from "node:child_process";

/** Runs one SQL statement against the server's database and returns its text output. */
export function dbExec(sql: string): string {
  const url = process.env.E2E_DATABASE_URL;
  if (!url) throw new Error("E2E_DATABASE_URL must name the database the server under test uses");
  return execFileSync("psql", [url, "-v", "ON_ERROR_STOP=1", "-tAc", sql], { encoding: "utf8" }).trim();
}

/** A value fit to splice into SQL as an id: refuses anything that is not a UUID. */
export function sqlId(value: string): string {
  if (!/^[0-9a-f-]{36}$/.test(value)) throw new Error(`not an id: ${value}`);
  return `'${value}'`;
}
