import type { LocaleProfile } from "@medbrains/types";
import { beforeEach, describe, expect, it } from "vitest";
import { useLocaleStore } from "./locale-store.js";

const dubai: LocaleProfile = {
  pack: "world",
  values: { country: "AE", currency: "AED", locale: "ar-AE", timezone: "Asia/Dubai" },
  sources: { country: "hospital", currency: "hospital" },
  missing: [],
  units: { weight_unit: "lbs" },
  date_format: "YYYY-MM-DD",
};

describe("locale store", () => {
  beforeEach(() => useLocaleStore.setState({ profile: null, profileStatus: "loading" }));

  it("holds no country, currency or zone of its own", () => {
    const config = useLocaleStore.getState().config as unknown as Record<string, unknown>;
    expect(config.currency).toBeUndefined();
    expect(config.timezone).toBeUndefined();
  });

  it("takes the profile and its units from /auth/me", () => {
    useLocaleStore.getState().setProfile(dubai);
    const s = useLocaleStore.getState();
    expect(s.profileStatus).toBe("ready");
    expect(s.profile?.values.currency).toBe("AED");
    expect(s.config.weight_unit).toBe("lbs");
    expect(s.config.date_format).toBe("YYYY-MM-DD");
  });

  it("says a failed load failed instead of guessing", () => {
    useLocaleStore.getState().setProfile(null);
    expect(useLocaleStore.getState().profileStatus).toBe("failed");
    expect(useLocaleStore.getState().profile).toBeNull();
  });
});
