import type { PrintSignatureData } from "@medbrains/types";
import { describe, expect, it } from "vitest";
import { signatureArea } from "@/components/Lab/LabReportPrint";
import { render, screen } from "@/test/test-utils";
import { PrintSignatureBlock, signedInWords } from "./PrintSignatureBlock";

const signed: PrintSignatureData = {
  signed_at: "2026-08-21T11:22:00Z",
  signer_name: "Dr Meera Nair",
  signer_registration: "TNMC 51234",
  display_image_url: null,
  display_block: null,
  verify_ref: "abcdef0123456789",
  verify_url: null,
  legal_class: "clinical",
};
const withImage = { ...signed, display_image_url: "data:image/png;base64,AAAA" };

describe("a printed signature area", () => {
  it("says Not signed, in words, when nobody signed", () => {
    render(<PrintSignatureBlock signatures={[]} label="Pathologist" />);
    expect(screen.getByText(/^Not signed\./)).toBeVisible();
    expect(signatureArea([])).toContain("Not signed");
  });

  it("prints who signed, their registration number and when, in words, when there is no image", () => {
    render(<PrintSignatureBlock signatures={[signed]} />);
    const words = screen.getByText(/^Digitally signed by Dr Meera Nair, Reg\. no\. TNMC 51234, /);
    expect(words).toHaveTextContent(new Date(signed.signed_at).toLocaleDateString());
    // The name is plain text: never drawn in a script font.
    expect(words).not.toHaveStyle({ fontFamily: "cursive" });
    expect(signedInWords({ ...signed, signer_registration: null })).not.toContain("Reg. no.");
    expect(signatureArea([signed, signed]).match(/Digitally signed by/g)).toHaveLength(1);
  });

  it("prints the signer's own image when they have one", () => {
    render(<PrintSignatureBlock signatures={[withImage]} />);
    expect(screen.getByRole("img", { name: "Signature of Dr Meera Nair" })).toBeVisible();
    expect(screen.queryByText(/Digitally signed by/)).not.toBeInTheDocument();
    expect(signatureArea([withImage])).toContain(
      '<img class="sigimg" src="data:image/png;base64,AAAA"',
    );
  });
});
