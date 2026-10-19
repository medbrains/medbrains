import { describe, expect, it } from "vitest";
import { describe as describeResource, MAX_ITEMS, readDocument } from "./fhirSections";

const bundle = {
  resourceType: "Bundle",
  type: "document",
  entry: [
    {
      fullUrl: "urn:uuid:comp",
      resource: {
        resourceType: "Composition",
        title: "OP consultation",
        date: "2024-06-01",
        author: [{ reference: "Practitioner/dr" }],
        section: [
          { title: "Diagnoses", entry: [{ reference: "urn:uuid:c1" }] },
          { title: "Results", entry: [{ reference: "Observation/hb" }, { reference: "missing" }] },
          { title: "Documents", entry: [{ reference: "urn:uuid:doc" }] },
          { title: "Empty", entry: [] },
        ],
      },
    },
    { resource: { resourceType: "Practitioner", id: "dr", name: [{ text: "Dr. Mehta" }] } },
    {
      fullUrl: "urn:uuid:c1",
      resource: { resourceType: "Condition", code: { coding: [{ display: "Type 2 diabetes" }] } },
    },
    {
      resource: {
        resourceType: "Observation",
        id: "hb",
        code: { text: "Haemoglobin" },
        valueQuantity: { value: 9.8, unit: "g/dL" },
        referenceRange: [{ low: { value: 12, unit: "g/dL" }, high: { value: 15, unit: "g/dL" } }],
        interpretation: [{ text: "Low" }],
      },
    },
    {
      fullUrl: "urn:uuid:doc",
      resource: {
        resourceType: "DocumentReference",
        type: { text: "Discharge summary" },
        content: [
          { attachment: { contentType: "application/pdf", data: "JVBERi0=", title: "ds.pdf" } },
        ],
      },
    },
  ],
};

describe("readDocument", () => {
  it("reads the header and only sections with something in them", () => {
    const doc = readDocument(bundle);
    expect(doc).toMatchObject({
      title: "OP consultation",
      date: "2024-06-01",
      author: "Dr. Mehta",
    });
    expect(doc.sections.map((s) => s.title)).toEqual(["Diagnoses", "Results", "Documents"]);
    expect(doc.sections[0]?.items[0]?.text).toBe("Type 2 diabetes");
  });

  it("shows a result with its unit, range and flag, and skips dangling references", () => {
    const results = readDocument(bundle).sections[1];
    expect(results?.items).toEqual([
      {
        text: "Haemoglobin: 9.8 g/dL",
        detail: "Range 12 g/dL – 15 g/dL · Low",
        key: "0:Observation/hb",
      },
    ]);
  });

  it("turns an inline attachment into a download, and drops non-web links", () => {
    const link = readDocument(bundle).sections[2]?.items[0]?.link;
    expect(link).toEqual({
      href: "data:application/pdf;base64,JVBERi0=",
      label: "ds.pdf",
      download: "ds.pdf",
    });
    const unsafe = describeResource({
      resourceType: "DocumentReference",
      content: [{ attachment: { url: "javascript:alert(1)" } }],
    });
    expect(unsafe.link).toBeUndefined();
  });

  it("bounds a section and survives a bundle that is not one", () => {
    const many = Array.from({ length: MAX_ITEMS + 10 }, (_, i) => ({
      fullUrl: `urn:uuid:o${i}`,
      resource: { resourceType: "Condition", code: { text: `C${i}` } },
    }));
    const big = {
      entry: [
        {
          resource: {
            resourceType: "Composition",
            section: [{ title: "All", entry: many.map((m) => ({ reference: m.fullUrl })) }],
          },
        },
        ...many,
      ],
    };
    expect(readDocument(big).sections[0]?.items).toHaveLength(MAX_ITEMS);
    expect(readDocument("garbage")).toEqual({
      title: null,
      date: null,
      author: null,
      sections: [],
    });
  });
});
