import { test, expect } from "../fixtures/identity";
import { BACKEND_URL } from "../helpers/identities";

test("provisions a fresh identity per test and it can log in", async ({ asRole, request }) => {
  const nurse = await asRole("nurse");
  expect(nurse.username).toMatch(/^t_nurse_/);
  const me = await request.get(`${BACKEND_URL}/api/auth/me`, {
    headers: { Cookie: nurse.session.cookieHeader },
  });
  expect(me.status()).toBe(200);
  expect((await me.json()).role).toBe("nurse");
});

test("a second test gets a different nurse", async ({ asRole }) => {
  const nurse = await asRole("nurse");
  expect(nurse.role).toBe("nurse");
});

test("the run admin is not the seeded admin", async ({ asRole }) => {
  const admin = await asRole("super_admin");
  expect(admin.username).not.toBe("admin");
});
