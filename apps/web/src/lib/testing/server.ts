import { setupServer } from "msw/node";
import { handlers } from "./handlers";

/** Shared MSW server for component tests — wired up (listen/reset/close) in src/test/setup.ts. */
export const server = setupServer(...handlers);
