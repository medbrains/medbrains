#!/usr/bin/env python3
"""Extract the NRCeS FHIR IG rules the HIP bundles and the NHCX messages must
satisfy into the small
fixture `crates/medbrains-fhir/src/nrces/profiles.json`, read by
`medbrains_fhir::nrces::conformance`.

Usage: python3 -I scripts/nrces_profile_fixture.py <ndhm.in-6.5.0 package.tgz> <out.json>

The package is the NRCeS IG `ndhm.in#6.5.0` (https://nrces.in/ndhm/fhir/r4/package.tgz,
also pinned in NHA's docs catalogue as `nrces-ndhm.in-6.5.0.tgz`). Its sha256
is checked, so a different or tampered package is refused.
"""
import hashlib
import json
import sys
import tarfile

PINNED_SHA256 = "41fa99955adbd1983a235d7c7136b30f423ce34ff541d86b354d95b7704527d4"

COMPOSITIONS = ["OPConsultRecord", "PrescriptionRecord", "DiagnosticReportRecord", "DischargeSummaryRecord",
                "ImmunizationRecord", "WellnessRecord", "HealthDocumentRecord", "InvoiceRecord"]
RESOURCES = ["Patient", "Practitioner", "Organization", "Encounter", "Condition",
             "MedicationRequest", "Observation", "DiagnosticReportLab", "Immunization",
             "ObservationVitalSigns", "ObservationBodyMeasurement", "DocumentReference", "Invoice",
             # NHCX (same package)
             "Claim", "CoverageEligibilityRequest", "Coverage", "Task", "Communication"]
# NHCX message bundles: a `collection` whose entries are sliced by the focal
# resource's profile.
BUNDLES = ["ClaimBundle", "CoverageEligibilityRequestBundle", "TaskBundle"]


def load(src, name):
    member = src.extractfile(f"package/StructureDefinition-{name}.json")
    if member is None:
        sys.exit(f"{name} is not in the package")
    return json.load(member)


def elements(sd):
    return {e["id"]: e for e in sd["snapshot"]["element"]}


def required(sd):
    root = sd["type"]
    return [e["id"][len(root) + 1:] for e in sd["snapshot"]["element"]
            if e["id"].count(".") == 1 and ":" not in e["id"] and e["min"] > 0]


def target_types(e):
    return sorted({p.rsplit("/", 1)[-1] for t in e.get("type", []) for p in t.get("targetProfile", [])})


def composition(sd):
    el = elements(sd)
    section = el["Composition.section"]
    out = {
        "version": sd["version"],
        "type_code": el.get("Composition.type.coding.code", {}).get("fixedCode")
        or el["Composition.type"].get("patternCodeableConcept", {}).get("coding", [{}])[0].get("code"),
        "required": required(sd),
        "section_max": section["max"],
        "section_rules": (section.get("slicing") or {}).get("rules"),
        "slices": [],
        "entry_slices": [],
    }
    for e in sd["snapshot"]["element"]:
        i = e["id"]
        if i.startswith("Composition.section:") and i.count(".") == 1:
            n = e["sliceName"]
            p = f"Composition.section:{n}"
            # Sliced by section code (OP consult, discharge) or by title (wellness).
            out["slices"].append({
                "name": n, "max": e["max"],
                "code": el.get(f"{p}.code.coding.code", {}).get("fixedCode"),
                "display": el.get(f"{p}.code.coding.display", {}).get("fixedString"),
                "title": el.get(f"{p}.title", {}).get("fixedString"),
                "entry_types": target_types(el[f"{p}.entry"]),
            })
        if i.startswith("Composition.section.entry:") and i.count(".") == 2:
            out["entry_slices"].append({"type": el[f"{i}.type"]["fixedUri"], "max": e["max"]})
    if not out["slices"]:
        # One section: its entries sliced by type, or open to the types the
        # profile names (HealthDocumentRecord: DocumentReference only).
        entry = el["Composition.section.entry"]
        out["entry_min"], out["entry_max"] = entry["min"], entry["max"]
        out["entry_types"] = target_types(entry)
        out["section_system"] = el.get("Composition.section.code.coding.system", {}).get("fixedUri")
        out["section_code"] = el.get("Composition.section.code.coding.code", {}).get("fixedCode")
    return out


def resource(sd):
    el = elements(sd)
    root = sd["type"]
    codings, identifier = [], []
    for i, e in el.items():
        rel = i[len(root) + 1:]
        # code.coding:LOINC.system fixed -> codings of that system need code + display
        if rel.count(".") == 2 and ".coding:" in rel and rel.endswith(".system") and "fixedUri" in e:
            base = rel.rsplit(".", 1)[0]
            needs = [c for c in ("code", "display") if el.get(f"{root}.{base}.{c}", {}).get("min", 0) > 0]
            codings.append({"path": rel.split(".coding")[0], "system": e["fixedUri"], "requires": needs})
        # code.coding.system fixed (no slice) -> every coding must use it
        if rel.count(".") == 2 and rel.endswith(".coding.system") and "fixedUri" in e and rel.count(".") == 2:
            codings.append({"path": rel.split(".coding")[0], "only_system": e["fixedUri"]})
        # code.coding sliced closed by system -> no other system may appear
        if rel.endswith(".coding") and rel.count(".") == 1 and (e.get("slicing") or {}).get("rules") == "closed":
            systems = sorted(x["fixedUri"] for k, x in el.items()
                             if k.startswith(f"{i}:") and k.endswith(".system") and "fixedUri" in x)
            codings.append({"path": rel.split(".coding")[0], "closed_systems": systems})
        if rel.startswith("identifier.") and rel.count(".") == 1 and e["min"] > 0:
            identifier.append(rel.split(".", 1)[1])
    return {"type": root, "required": required(sd), "codings": codings, "identifier_requires": identifier}


def bundle(sd):
    el = elements(sd)
    focal = next(e for i, e in el.items() if i.startswith("Bundle.entry:") and i.count(".") == 1)
    resource = el[f"{focal['id']}.resource"]
    profile = next(p for t in resource["type"] for p in t.get("profile", []))
    return {
        "version": sd["version"],
        "type": el["Bundle.type"].get("fixedCode"),
        "focal": profile.rsplit("/", 1)[-1],
        "focal_min": focal["min"],
        "focal_max": focal["max"],
    }


def main(tgz, dst):
    with open(tgz, "rb") as f:
        digest = hashlib.sha256(f.read()).hexdigest()
    if digest != PINNED_SHA256:
        sys.exit(f"{tgz}: sha256 {digest} is not the pinned ndhm.in 6.5.0 package")
    src = tarfile.open(tgz, "r:gz")
    out = {
        "source": f"ndhm.in#6.5.0 package (sha256 {PINNED_SHA256}), extracted by scripts/nrces_profile_fixture.py",
        "compositions": {n: composition(load(src, n)) for n in COMPOSITIONS},
        "resources": {n: resource(load(src, n)) for n in RESOURCES},
        "bundles": {n: bundle(load(src, n)) for n in BUNDLES},
    }
    with open(dst, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=1, sort_keys=True)
        f.write("\n")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
