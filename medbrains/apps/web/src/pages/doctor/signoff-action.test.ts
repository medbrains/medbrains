import type { SignableTypeInfo } from "@medbrains/types";
import { describe, expect, it } from "vitest";
import { canSignType, type SignableTypes } from "@/hooks/useSignableTypes";
import { signoffAction, signoffLabel } from "./signoff-action";

/** The server's list, as `GET /api/signatures/types` answers it. */
function typesOf(
  ...infos: Array<Partial<SignableTypeInfo> & { record_type: string }>
): SignableTypes {
  return new Map(
    infos.map((i) => [
      i.record_type,
      {
        label: i.record_type,
        signer: "doctor",
        legal_class: "clinical",
        step_up: true,
        ...i,
      } as SignableTypeInfo,
    ]),
  );
}

const SERVER = typesOf(
  { record_type: "prescription", label: "Prescription" },
  { record_type: "medical_certificate", label: "Medical or fitness certificate" },
  { record_type: "vitals", label: "Vitals entry", signer: "nurse" },
);

describe("the sign-off inbox", () => {
  it("offers a signature only for a type the server signs", () => {
    expect(signoffAction("prescription", SERVER)).toBe("sign");
    expect(signoffAction("medical_certificate", SERVER)).toBe("sign");
    // The inbox used to offer these; the server refused every one.
    expect(signoffAction("progress_note", SERVER)).toBe("none");
    expect(signoffAction("operative_note", SERVER)).toBe("none");
  });

  it("offers nothing while the list is unknown, rather than a button that may be refused", () => {
    expect(signoffAction("prescription", undefined)).toBe("none");
  });

  it("keeps its own two decisions whatever the list says", () => {
    expect(signoffAction("refill_request", undefined)).toBe("refill");
    expect(signoffAction("store_substitution", SERVER)).toBe("substitution");
  });

  it("names a type the way the server does", () => {
    expect(signoffLabel("medical_certificate", SERVER)).toBe("Medical or fitness certificate");
    expect(signoffLabel("some_new_type", SERVER)).toBe("some new type");
  });
});

describe("the shared Sign control", () => {
  const doctor = { canSignAsDoctor: true, canSignAsNurse: false };
  const nurse = { canSignAsDoctor: false, canSignAsNurse: true };

  it("lets a nurse sign nursing entries and nothing a doctor signs", () => {
    expect(canSignType(SERVER.get("vitals"), nurse)).toBe(true);
    expect(canSignType(SERVER.get("medical_certificate"), nurse)).toBe(false);
  });

  it("lets a doctor sign both, since doctors chart too", () => {
    expect(canSignType(SERVER.get("vitals"), doctor)).toBe(true);
    expect(canSignType(SERVER.get("prescription"), doctor)).toBe(true);
  });

  it("shows nothing for a type the server does not sign", () => {
    expect(canSignType(SERVER.get("progress_note"), doctor)).toBe(false);
  });
});
