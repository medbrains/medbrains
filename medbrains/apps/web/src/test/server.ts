/**
 * MSW server for Vitest. Use `server.use(...)` inside a test to
 * override a default handler for that test only.
 */

import { setupServer } from "msw/node";
import { handlers } from "./handlers";

export const server = setupServer(...handlers);
