/**
 * A camp run as a route of stations (RFCs/modules/RFC-MODULE-token-queues.md,
 * P4a, scenarios 5 and 6).
 *
 * The camp coordinator sets up the usual stations, registers a villager and
 * tells them their number. The nurse at Vitals calls them by it and sends them
 * on; the doctor's station then has the same number waiting.
 */
import { api } from "../helpers/api";
import { expectScreenAccessible, expectUsable } from "./support/a11y";
import { TokenConsole } from "./pages/token-console";
import { expect, test } from "./support/world";

test("a villager keeps one number from registration to the doctor", async ({ hospital }) => {
  test.setTimeout(180_000);
  const dept = await hospital.department("Camp OPD");
  const campName = `Village camp ${dept.name.split(" ").at(-1)}`;
  const camp = await api<{ id: string }>(hospital.admin, "POST", "/api/camp/camps", {
    name: campName,
    camp_type: "general_health",
    scheduled_date: new Date().toISOString().slice(0, 10),
    organizing_department_id: dept.id,
  });

  // The coordinator sets the camp up in one press.
  const coordinator = await hospital.as("camp_coordinator");
  await coordinator.goto(`/camp/${camp.id}`);
  const setUp = coordinator.getByTestId("btn-camp-route-template");
  await expectUsable(setUp, "Set up the usual stations");
  await setUp.click();
  await expect(coordinator.getByText("Stations set up")).toBeVisible();
  for (const station of ["Registration", "Vitals", "Doctor", "Pharmacy"]) {
    await expect(coordinator.getByRole("cell", { name: station, exact: true })).toBeVisible();
  }
  await expectScreenAccessible(coordinator, "camp-detail");

  // …and registers a villager, reading them their number.
  await coordinator.goto(`/camp/${camp.id}/work/registrations/new`);
  await coordinator.getByTestId("field-person_name").fill("Lakshmi Devi");
  await coordinator.getByTestId("btn-register").click();
  const told = coordinator.getByText(/Their number is (C-\d+)/);
  await expect(told).toBeVisible({ timeout: 15_000 });
  const number = (await told.innerText()).match(/(C-\d+)/)?.[1] ?? "";

  // The nurse at Vitals.
  const vitals = new TokenConsole(await hospital.as("nurse"));
  await vitals.openCampStation(`${campName} · 2. Vitals`);
  await vitals.act(number, "call");
  await vitals.act(number, "complete");

  // The doctor's station has the same number waiting.
  const doctor = new TokenConsole(await hospital.as("doctor"));
  await doctor.openCampStation(`${campName} · 3. Doctor`);
  await doctor.expectStatus(number, "Waiting");
});
