import { usePermissionStore } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent } from "@/test/test-utils";
import { LocalNameRow } from "./LocalNameRow";

const transliterate = vi.fn();
vi.mock("@/services/patients.service", () => ({
  patientsService: { transliterateName: (text: string, to: string) => transliterate(text, to) },
}));

beforeEach(() => {
  transliterate.mockReset();
  usePermissionStore.getState().setPermissions("receptionist", [P.PATIENTS.CREATE]);
});

describe("the desk is offered the name in the patient's script, and back", () => {
  it("offers an English name in the chosen script and fills the field on a click", async () => {
    transliterate.mockResolvedValue({ suggestions: ["रमेश कुमार"] });
    const onChange = vi.fn();
    render(
      <LocalNameRow
        englishName="Ramesh Kumar"
        value=""
        onChange={onChange}
        onUseEnglish={vi.fn()}
      />,
    );
    await userEvent.click(await screen.findByText("रमेश कुमार", {}, { timeout: 2000 }));
    expect(transliterate).toHaveBeenCalledWith("Ramesh Kumar", "devanagari");
    expect(onChange).toHaveBeenCalledWith("रमेश कुमार");
  });

  it("offers the English spelling of a name typed in Tamil", async () => {
    transliterate.mockResolvedValue({ suggestions: ["Murugan"] });
    const onUseEnglish = vi.fn();
    render(
      <LocalNameRow englishName="" value="முருகன்" onChange={vi.fn()} onUseEnglish={onUseEnglish} />,
    );
    await userEvent.click(await screen.findByText("Murugan", {}, { timeout: 2000 }));
    expect(transliterate).toHaveBeenCalledWith("முருகன்", "latin");
    expect(onUseEnglish).toHaveBeenCalledWith("Murugan");
  });

  it("asks nothing of a user who may not register patients", async () => {
    usePermissionStore.getState().setPermissions("nurse", []);
    render(
      <LocalNameRow englishName="Ramesh" value="" onChange={vi.fn()} onUseEnglish={vi.fn()} />,
    );
    await new Promise((r) => setTimeout(r, 500));
    expect(transliterate).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/name in the patient's script/i)).toBeInTheDocument();
  });
});
