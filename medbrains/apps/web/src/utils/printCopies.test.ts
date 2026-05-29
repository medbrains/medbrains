import { describe, expect, it } from "vitest";
import {
  buildCopyPrintHtml,
  getPrintCopyPacketGaps,
  PRINT_COPY_PACKET_POLICIES,
  PRINT_COPY_PACKETS,
  type PrintCopyPacketName,
} from "./printCopies";

const PACKET_NAMES = [
  "billingInvoice",
  "billingReceipt",
  "ipdAdmission",
  "labReport",
  "mlcPacket",
  "mlcPoliceIntimation",
  "mlcReprint",
  "mrdCaseSheet",
  "mrdCaseSheetReprint",
  "patientCard",
  "pharmacyLabel",
  "prescription",
  "radiologyReport",
  "visitSummary",
  "wristband",
] satisfies PrintCopyPacketName[];

describe("print copy routing", () => {
  it("covers every declared packet with copy and printer routes", () => {
    expect(PACKET_NAMES).toHaveLength(Object.keys(PRINT_COPY_PACKETS).length);

    for (const packetName of PACKET_NAMES) {
      const gaps = getPrintCopyPacketGaps(packetName);
      expect(gaps.missingCopies, packetName).toEqual([]);
      expect(gaps.missingPrinterProfiles, packetName).toEqual([]);
      expect(gaps.missingCustomerOffice, packetName).toBe(false);
    }
  });

  it("keeps customer-facing packets on both customer and office copies", () => {
    for (const packetName of PACKET_NAMES) {
      const policy = PRINT_COPY_PACKET_POLICIES[packetName];
      const copyTypes = PRINT_COPY_PACKETS[packetName].map((copy) => copy.copyType);

      if (policy.customerOfficeRequired) {
        expect(copyTypes, packetName).toContain("customer");
        expect(copyTypes, packetName).toContain("office");
      }
    }
  });

  it("documents why internal or legal packets do not issue customer copies", () => {
    for (const packetName of PACKET_NAMES) {
      const policy = PRINT_COPY_PACKET_POLICIES[packetName];
      const copyTypes = PRINT_COPY_PACKETS[packetName].map((copy) => copy.copyType);

      if (!copyTypes.includes("customer")) {
        expect(policy.customerOfficeRequired, packetName).toBe(false);
        expect(policy.exemptionReason?.length, packetName).toBeGreaterThan(0);
      }
    }
  });

  it("prints copy headers with logical printer profile codes", () => {
    const html = buildCopyPrintHtml("<p>Receipt body</p>", PRINT_COPY_PACKETS.billingReceipt);

    expect(html).toContain("Customer copy");
    expect(html).toContain("Office copy");
    expect(html).toContain("Billing receipt 80mm (billing-receipt-80mm)");
    expect(html).toContain("Billing A4 / accounts printer (billing-a4)");
  });
});
