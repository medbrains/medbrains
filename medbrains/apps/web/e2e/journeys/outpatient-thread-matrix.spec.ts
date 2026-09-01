/**
 * One patient, one number, all the way through.
 *
 * A patient walks registration → OPD → lab → pharmacy → billing. The slip in
 * their hand says one number, and every desk they reach must call that number
 * — while each desk keeps its own queue position, because the lab's third
 * patient is not the pharmacy's third patient.
 *
 * That is `number_for_visit`: the number is shared per visit, `seq` is per
 * queue. Both halves are load-bearing and this file asserts each against the
 * running server. Getting it wrong either relabels a patient mid-journey, or
 * makes every board call the same position at once.
 */
import { expect, test } from "@playwright/test";
import { type AuthContext, api, getAuthContextFromCookies } from "../helpers/api";
import { createEncounter, createPatientApi } from "../helpers/journey-steps";

interface Token {
  id: string;
  module: string;
  number: string;
  seq: number;
  status: string;
  priority: string;
  visit_id: string | null;
  scope: string;
  scope_id: string | null;
  entity_type: string | null;
  entity_id: string | null;
}

/** The modules a patient passes through, in the order they meet them. */
const MODULES = ["registration", "opd", "lab", "pharmacy", "billing", "radiology"] as const;

/** The prefix each module stamps on a number it mints itself. */
const MODULE_PREFIX: Record<string, string> = {
  registration: "R",
  opd: "T",
  pharmacy: "P",
  billing: "B",
  lab: "L",
  radiology: "X",
  dispatch: "D",
};

async function departmentId(ctx: AuthContext): Promise<string> {
  const rows = await api<Array<{ id: string; code?: string; is_active?: boolean }>>(
    ctx,
    "GET",
    "/api/setup/departments",
  );
  const active = rows.filter((d) => d.is_active !== false);
  const preferred = active.find((d) => d.code === "GEN-MEDICINE") ?? active[0];
  if (!preferred) throw new Error("tenant has no department");
  return preferred.id;
}

/** Issue a token, optionally tying it to a visit already under way. */
async function issue(
  ctx: AuthContext,
  args: {
    module: string;
    scopeId?: string;
    visitId?: string;
    patientId?: string;
    priority?: string;
  },
): Promise<Token> {
  const body: Record<string, unknown> = {
    module: args.module,
    priority: args.priority ?? "normal",
  };
  if (args.scopeId) {
    body.scope = "department";
    body.scope_id = args.scopeId;
  } else {
    body.scope = "global";
  }
  if (args.visitId) body.visit_id = args.visitId;
  if (args.patientId) body.patient_id = args.patientId;
  return api<Token>(ctx, "POST", "/api/tokens/issue", body);
}

test.describe("the number follows the patient", () => {
  // Registration mints the visit. Every later desk must call the same number.
  for (const module of MODULES.filter((m) => m !== "registration")) {
    test(`${module} calls the number registration gave the patient`, async ({ request }) => {
      const ctx = await getAuthContextFromCookies(request);
      const patient = await createPatientApi(ctx);
      const visitId = crypto.randomUUID();

      const atRegistration = await issue(ctx, {
        module: "registration",
        visitId,
        patientId: patient.id,
      });
      const later = await issue(ctx, {
        module,
        visitId,
        patientId: patient.id,
        scopeId: module === "opd" ? await departmentId(ctx) : undefined,
      });

      expect(
        later.number,
        `the slip in the patient's hand says ${atRegistration.number}; ${module} must not relabel them`,
      ).toBe(atRegistration.number);
    });
  }

  test("a visit that starts at registration keeps its R- prefix throughout", async ({
    request,
  }) => {
    const ctx = await getAuthContextFromCookies(request);
    const patient = await createPatientApi(ctx);
    const visitId = crypto.randomUUID();

    const first = await issue(ctx, {
      module: "registration",
      visitId,
      patientId: patient.id,
    });
    expect(first.number.startsWith(MODULE_PREFIX.registration ?? "R")).toBe(true);

    for (const module of ["lab", "pharmacy", "billing"]) {
      const later = await issue(ctx, { module, visitId, patientId: patient.id });
      expect(
        later.number,
        `${module} minted its own number instead of reusing the visit's`,
      ).toBe(first.number);
    }
  });

  test("two different visits get two different numbers", async ({ request }) => {
    const ctx = await getAuthContextFromCookies(request);
    const first = await createPatientApi(ctx);
    const second = await createPatientApi(ctx);

    const a = await issue(ctx, {
      module: "registration",
      visitId: crypto.randomUUID(),
      patientId: first.id,
    });
    const b = await issue(ctx, {
      module: "registration",
      visitId: crypto.randomUUID(),
      patientId: second.id,
    });

    expect(a.number, "two patients sharing a number is the whole failure").not.toBe(b.number);
  });

  test("a token with no visit mints its own module-prefixed number", async ({ request }) => {
    const ctx = await getAuthContextFromCookies(request);
    // Not every token belongs to a visit — a walk-in at the pharmacy counter
    // buying over the counter has no OPD journey behind them.
    const standalone = await issue(ctx, { module: "pharmacy" });
    expect(standalone.number.startsWith(MODULE_PREFIX.pharmacy ?? "P")).toBe(true);
    expect(standalone.number).toMatch(/^P-\d{3}$/);
  });
});

test.describe("each desk keeps its own place in its own queue", () => {
  // The number is shared; the position is not. The lab's third patient is not
  // the pharmacy's third patient, and a board that shared `seq` would call
  // every queue's third patient at once.
  for (const module of ["lab", "pharmacy", "billing"]) {
    test(`${module} numbers its own queue independently of the visit`, async ({ request }) => {
      const ctx = await getAuthContextFromCookies(request);
      const patient = await createPatientApi(ctx);
      const visitId = crypto.randomUUID();

      await issue(ctx, { module: "registration", visitId, patientId: patient.id });
      const first = await issue(ctx, { module, visitId, patientId: patient.id });

      const otherVisit = crypto.randomUUID();
      const otherPatient = await createPatientApi(ctx);
      await issue(ctx, {
        module: "registration",
        visitId: otherVisit,
        patientId: otherPatient.id,
      });
      const second = await issue(ctx, {
        module,
        visitId: otherVisit,
        patientId: otherPatient.id,
      });

      expect(
        second.seq,
        `${module} must advance its own queue position for the next patient`,
      ).toBeGreaterThan(first.seq);
      expect(first.number, "but they are different visits, so different numbers").not.toBe(
        second.number,
      );
    });
  }

  test("the same visit at two desks holds two independent positions", async ({ request }) => {
    const ctx = await getAuthContextFromCookies(request);
    const patient = await createPatientApi(ctx);
    const visitId = crypto.randomUUID();

    await issue(ctx, { module: "registration", visitId, patientId: patient.id });
    const atLab = await issue(ctx, { module: "lab", visitId, patientId: patient.id });
    const atPharmacy = await issue(ctx, { module: "pharmacy", visitId, patientId: patient.id });

    expect(atLab.number).toBe(atPharmacy.number);
    // Same number on the slip, separate rows, each with its own queue.
    expect(atLab.id).not.toBe(atPharmacy.id);
    expect(atLab.module).toBe("lab");
    expect(atPharmacy.module).toBe("pharmacy");
  });
});

test.describe("the OPD queue moves with the token", () => {
  // Calling a patient from a board used to update `tokens` and leave
  // `opd_queues` on `waiting`, so the OPD screen went on offering a Call
  // button for somebody already called. Each status is asserted end to end.
  const TRANSITIONS = [
    { token: "called", queue: "called", why: "the room has called them forward" },
    { token: "serving", queue: "in_consultation", why: "the two vocabularies differ" },
    { token: "completed", queue: "completed", why: "the consultation is finished" },
    { token: "no_show", queue: "no_show", why: "called, and did not come" },
  ] as const;

  for (const transition of TRANSITIONS) {
    test(`token ${transition.token} puts the queue row in ${transition.queue} — ${transition.why}`, async ({
      request,
    }) => {
      const ctx = await getAuthContextFromCookies(request);
      const patient = await createPatientApi(ctx);
      const deptId = await departmentId(ctx);
      const encounterId = await createEncounter(ctx, patient.id, { departmentId: deptId });

      // Check-in issues the OPD token itself, tied to the encounter.
      const queueBefore = await api<Array<{ encounter_id: string; status: string }>>(
        ctx,
        "GET",
        "/api/opd/queue",
      );
      const row = queueBefore.find((q) => q.encounter_id === encounterId);
      expect(row, "creating an encounter must put the patient in the queue").toBeTruthy();
      expect(row?.status).toBe("waiting");

      // This encounter's own token, not whichever waiting one the shared board
      // happened to return first.
      const board = await api<Token[]>(
        ctx,
        "GET",
        `/api/tokens/board?module=opd&scope=department&scope_id=${deptId}`,
      );
      const token = board.find(
        (t) => t.entity_type === "encounter" && t.entity_id === encounterId,
      );
      expect(token, "check-in must issue a token tied to the encounter").toBeTruthy();
      if (!token) return;

      await api(ctx, "POST", `/api/tokens/${token.id}/advance`, {
        status: transition.token,
      });

      // And this encounter's own queue row, by encounter id.
      const queueAfter = await api<Array<{ encounter_id: string; status: string }>>(
        ctx,
        "GET",
        `/api/opd/queue?status=${transition.queue}`,
      );
      const mine = queueAfter.find((q) => q.encounter_id === encounterId);
      expect(
        mine?.status,
        `token ${transition.token} left the queue row behind — the OPD screen would still offer Call for a patient already called`,
      ).toBe(transition.queue);
    });
  }
});
