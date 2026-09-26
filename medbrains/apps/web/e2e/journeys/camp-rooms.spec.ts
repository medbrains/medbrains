/**
 * Two doctors, and a patient who needs no medicine
 * (RFCs/modules/RFC-MODULE-token-queues.md, P4b).
 *
 * The coordinator adds a second doctor's room to the camp's Doctor step. The
 * doctor in room 2 calls the next patient from the one Doctor queue, and the
 * call names room 2. The patient needs no medicine, so the doctor finishes
 * them there — they never join the Pharmacy queue.
 */
import { api } from "../helpers/api";
import { TokenConsole } from "./pages/token-console";
import { expect, test } from "./support/world";

test("a second doctor's room shares the queue, and a patient can finish early", async ({
  hospital,
}) => {
  test.setTimeout(180_000);
  const dept = await hospital.department("Rooms OPD");
  const campName = `Rooms camp ${dept.name.split(" ").at(-1)}`;
  const camp = await api<{ id: string }>(hospital.admin, "POST", "/api/camp/camps", {
    name: campName,
    camp_type: "general_health",
    scheduled_date: new Date().toISOString().slice(0, 10),
    organizing_department_id: dept.id,
  });
  const route = await api<{ counter_id: string; name: string }[]>(
    hospital.admin,
    "POST",
    `/api/camp/camps/${camp.id}/route-template`,
    { template: "general" },
  );
  const stationId = (name: string) => route.find((s) => s.name === name)?.counter_id;

  // The coordinator adds room 2 to the Doctor step.
  const coordinator = await hospital.as("camp_coordinator");
  await coordinator.goto(`/camp/${camp.id}`);
  await coordinator.getByTestId("field-counter-name").fill("Doctor room 2");
  await coordinator.getByTestId("picker-counter-department").click();
  await coordinator.getByTestId("picker-counter-department").fill(dept.name);
  await coordinator.getByRole("option", { name: dept.name, exact: true }).click();
  await coordinator.getByTestId("picker-counter-step").click();
  await coordinator.getByRole("option", { name: "3 · Doctor", exact: true }).click();
  await coordinator.getByTestId("btn-add-counter").click();
  await expect(coordinator.getByRole("cell", { name: "Doctor room 2", exact: true })).toBeVisible();

  // Starting data: a patient who has had their vitals taken.
  const reg = await api<{ token_number: string }>(hospital.admin, "POST", "/api/camp/registrations", {
    camp_id: camp.id,
    person_name: "Ravi Kumar",
  });
  const number = reg.token_number;
  // Every camp numbers from C-001, so a token is found by its station, not its number.
  const tokenAt = async (station: string) => {
    const tokens = await api<{ id: string; number: string; counter_label: string | null }[]>(
      hospital.admin,
      "GET",
      `/api/tokens/board?module=camp&scope=counter&scope_id=${stationId(station)}`,
    );
    return tokens.find((t) => t.number === number);
  };
  const atVitals = await tokenAt("Vitals");
  await api(hospital.admin, "POST", `/api/tokens/${atVitals?.id}/call`, {});
  await api(hospital.admin, "POST", `/api/tokens/${atVitals?.id}/complete`, {});

  // The doctor in room 2.
  const doctorPage = await hospital.as("doctor");
  const doctor = new TokenConsole(doctorPage);
  await doctor.openCampStation(`${campName} · 3. Doctor`);
  await doctorPage.getByTestId("picker-room").click();
  await doctorPage.getByRole("option", { name: "Doctor room 2", exact: true }).click();
  await doctor.callNext();
  await doctor.expectStatus(number, "Called");
  const called = await tokenAt("Doctor");
  expect(called?.counter_label, "the call names the room").toBe("Doctor room 2");
  await doctor.act(number, "finish");

  // Pharmacy never sees them.
  await doctor.openCampStation(`${campName} · 4. Pharmacy`);
  await expect(doctorPage.getByTestId(`row-token-${number}`)).toHaveCount(0);
});
