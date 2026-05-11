import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outDir = join(root, "apps", "web", "public", "demo", "dicom");

const SOP_CLASS_BY_MODALITY = {
  CT: "1.2.840.10008.5.1.4.1.1.2",
  MR: "1.2.840.10008.5.1.4.1.1.4",
  US: "1.2.840.10008.5.1.4.1.1.6.1",
  CR: "1.2.840.10008.5.1.4.1.1.1",
  DX: "1.2.840.10008.5.1.4.1.1.1.1",
};

const samples = [
  {
    file: "ct-brain-plain-demo.dcm",
    html: "ct-brain-plain-demo.html",
    patientName: "DEMO^RAJESH",
    patientId: "DEMO-00001",
    patientSex: "M",
    patientBirthDate: "19850315",
    modality: "CT",
    studyDate: "20260501",
    studyTime: "103000",
    accession: "RAD-DEMO-CT-0001",
    description: "CT Brain Plain - Synthetic Demo",
    studyUid: "1.2.826.0.1.3680043.10.543.2026051101",
    seriesUid: "1.2.826.0.1.3680043.10.543.2026051101.1",
    seed: 11,
  },
  {
    file: "us-abdomen-demo.dcm",
    html: "us-abdomen-demo.html",
    patientName: "DEMO^PRIYA",
    patientId: "DEMO-00002",
    patientSex: "F",
    patientBirthDate: "19900722",
    modality: "US",
    studyDate: "20260502",
    studyTime: "113000",
    accession: "RAD-DEMO-US-0002",
    description: "US Abdomen - Synthetic Demo",
    studyUid: "1.2.826.0.1.3680043.10.543.2026051102",
    seriesUid: "1.2.826.0.1.3680043.10.543.2026051102.1",
    seed: 23,
  },
  {
    file: "chest-xray-pa-demo.dcm",
    html: "chest-xray-pa-demo.html",
    patientName: "DEMO^ARUN",
    patientId: "DEMO-00003",
    patientSex: "M",
    patientBirthDate: "19781108",
    modality: "CR",
    studyDate: "20260503",
    studyTime: "121500",
    accession: "RAD-DEMO-CR-0003",
    description: "Chest X-Ray PA - Synthetic Demo",
    studyUid: "1.2.826.0.1.3680043.10.543.2026051103",
    seriesUid: "1.2.826.0.1.3680043.10.543.2026051103.1",
    seed: 37,
  },
  {
    file: "mri-right-knee-demo.dcm",
    html: "mri-right-knee-demo.html",
    patientName: "DEMO^LAKSHMI",
    patientId: "DEMO-00004",
    patientSex: "F",
    patientBirthDate: "19650130",
    modality: "MR",
    studyDate: "20260504",
    studyTime: "154000",
    accession: "RAD-DEMO-MR-0004",
    description: "MRI Right Knee - Synthetic Demo",
    studyUid: "1.2.826.0.1.3680043.10.543.2026051104",
    seriesUid: "1.2.826.0.1.3680043.10.543.2026051104.1",
    seed: 41,
  },
  {
    file: "left-hand-xray-demo.dcm",
    html: "left-hand-xray-demo.html",
    patientName: "DEMO^MOHAMMED",
    patientId: "DEMO-00005",
    patientSex: "M",
    patientBirthDate: "20000912",
    modality: "DX",
    studyDate: "20260505",
    studyTime: "165500",
    accession: "RAD-DEMO-DX-0005",
    description: "Left Hand X-Ray - Synthetic Demo",
    studyUid: "1.2.826.0.1.3680043.10.543.2026051105",
    seriesUid: "1.2.826.0.1.3680043.10.543.2026051105.1",
    seed: 53,
  },
];

function padEven(buffer, padByte = 0x20) {
  if (buffer.length % 2 === 0) return buffer;
  return Buffer.concat([buffer, Buffer.from([padByte])]);
}

function textValue(value, padByte = 0x20) {
  return padEven(Buffer.from(String(value), "ascii"), padByte);
}

function usValue(value) {
  const buffer = Buffer.alloc(2);
  buffer.writeUInt16LE(value, 0);
  return buffer;
}

function ulValue(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value, 0);
  return buffer;
}

function element(group, tag, vr, value) {
  const valueBuffer = Buffer.isBuffer(value)
    ? padEven(value, vr === "UI" || vr === "OB" || vr === "OW" ? 0x00 : 0x20)
    : textValue(value, vr === "UI" ? 0x00 : 0x20);
  const header = Buffer.alloc(["OB", "OW", "OF", "SQ", "UT", "UN"].includes(vr) ? 12 : 8);
  header.writeUInt16LE(group, 0);
  header.writeUInt16LE(tag, 2);
  header.write(vr, 4, 2, "ascii");
  if (header.length === 12) {
    header.writeUInt16LE(0, 6);
    header.writeUInt32LE(valueBuffer.length, 8);
  } else {
    header.writeUInt16LE(valueBuffer.length, 6);
  }
  return Buffer.concat([header, valueBuffer]);
}

function pixelData(seed) {
  const rows = 64;
  const cols = 64;
  const buffer = Buffer.alloc(rows * cols * 2);
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const wave = Math.sin((x + seed) / 8) * 180 + Math.cos((y + seed) / 7) * 140;
      const radial = Math.max(0, 900 - Math.hypot(x - 32, y - 32) * 22);
      const value = Math.max(0, Math.min(4095, Math.round(620 + radial + wave)));
      buffer.writeUInt16LE(value, (y * cols + x) * 2);
    }
  }
  return buffer;
}

function dicomFile(sample) {
  const sopClassUid = SOP_CLASS_BY_MODALITY[sample.modality];
  const sopInstanceUid = `${sample.studyUid}.1`;
  const metaTail = Buffer.concat([
    element(0x0002, 0x0001, "OB", Buffer.from([0x00, 0x01])),
    element(0x0002, 0x0002, "UI", sopClassUid),
    element(0x0002, 0x0003, "UI", sopInstanceUid),
    element(0x0002, 0x0010, "UI", "1.2.840.10008.1.2.1"),
    element(0x0002, 0x0012, "UI", "1.2.826.0.1.3680043.10.543.1"),
  ]);
  const meta = Buffer.concat([element(0x0002, 0x0000, "UL", ulValue(metaTail.length)), metaTail]);
  const dataset = Buffer.concat([
    element(0x0008, 0x0008, "CS", "ORIGINAL\\PRIMARY"),
    element(0x0008, 0x0016, "UI", sopClassUid),
    element(0x0008, 0x0018, "UI", sopInstanceUid),
    element(0x0008, 0x0020, "DA", sample.studyDate),
    element(0x0008, 0x0030, "TM", sample.studyTime),
    element(0x0008, 0x0050, "SH", sample.accession),
    element(0x0008, 0x0060, "CS", sample.modality),
    element(0x0008, 0x0070, "LO", "MedBrains Synthetic Fixtures"),
    element(0x0008, 0x1030, "LO", sample.description),
    element(0x0010, 0x0010, "PN", sample.patientName),
    element(0x0010, 0x0020, "LO", sample.patientId),
    element(0x0010, 0x0030, "DA", sample.patientBirthDate),
    element(0x0010, 0x0040, "CS", sample.patientSex),
    element(0x0020, 0x000d, "UI", sample.studyUid),
    element(0x0020, 0x000e, "UI", sample.seriesUid),
    element(0x0020, 0x0010, "SH", sample.accession),
    element(0x0020, 0x0011, "IS", "1"),
    element(0x0020, 0x0013, "IS", "1"),
    element(0x0028, 0x0002, "US", usValue(1)),
    element(0x0028, 0x0004, "CS", "MONOCHROME2"),
    element(0x0028, 0x0010, "US", usValue(64)),
    element(0x0028, 0x0011, "US", usValue(64)),
    element(0x0028, 0x0030, "DS", "0.75\\0.75"),
    element(0x0028, 0x0100, "US", usValue(16)),
    element(0x0028, 0x0101, "US", usValue(12)),
    element(0x0028, 0x0102, "US", usValue(11)),
    element(0x0028, 0x0103, "US", usValue(0)),
    element(0x0028, 0x1050, "DS", "900"),
    element(0x0028, 0x1051, "DS", "1800"),
    element(0x7fe0, 0x0010, "OW", pixelData(sample.seed)),
  ]);
  const preamble = Buffer.alloc(128);
  return Buffer.concat([preamble, Buffer.from("DICM", "ascii"), meta, dataset]);
}

function htmlPage(sample, size) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${sample.description}</title>
  <style>
    body { margin: 0; font-family: Inter, system-ui, sans-serif; background: #0f172a; color: #e5e7eb; }
    main { max-width: 960px; margin: 0 auto; padding: 32px; }
    .panel { border: 1px solid #334155; border-radius: 12px; padding: 20px; background: #111827; }
    .preview { height: 340px; border-radius: 10px; border: 1px solid #475569; margin: 18px 0; background:
      radial-gradient(circle at 52% 48%, #f8fafc 0 6%, #94a3b8 7% 20%, #334155 21% 42%, #020617 43% 100%);
    }
    a { color: #67e8f9; }
    dl { display: grid; grid-template-columns: 180px 1fr; gap: 8px 16px; }
    dt { color: #94a3b8; }
    dd { margin: 0; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  </style>
</head>
<body>
  <main>
    <section class="panel">
      <h1>${sample.description}</h1>
      <p>Synthetic de-identified DICOM fixture for MedBrains local development. Not for diagnosis.</p>
      <div class="preview" aria-label="Synthetic imaging preview"></div>
      <p><a href="./${sample.file}">Download DICOM Part 10 fixture</a></p>
      <dl>
        <dt>Patient ID</dt><dd>${sample.patientId}</dd>
        <dt>Modality</dt><dd>${sample.modality}</dd>
        <dt>Accession</dt><dd>${sample.accession}</dd>
        <dt>Study UID</dt><dd>${sample.studyUid}</dd>
        <dt>Transfer Syntax</dt><dd>Explicit VR Little Endian</dd>
        <dt>Fixture size</dt><dd>${size} bytes</dd>
      </dl>
    </section>
  </main>
</body>
</html>
`;
}

function indexPage(rows) {
  const links = rows
    .map(
      (row) =>
        `<li><a href="./${row.html}">${row.description}</a> - <a href="./${row.file}">DICOM</a></li>`,
    )
    .join("\n");
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>MedBrains Demo DICOM Fixtures</title></head>
<body>
  <h1>MedBrains Demo DICOM Fixtures</h1>
  <p>Synthetic de-identified fixtures for local testing only.</p>
  <ul>
${links}
  </ul>
</body>
</html>
`;
}

mkdirSync(outDir, { recursive: true });

for (const sample of samples) {
  const dicom = dicomFile(sample);
  writeFileSync(join(outDir, sample.file), dicom);
  writeFileSync(join(outDir, sample.html), htmlPage(sample, dicom.length));
}

writeFileSync(join(outDir, "index.html"), indexPage(samples));
console.log(`Generated ${samples.length} DICOM fixtures in ${outDir}`);
