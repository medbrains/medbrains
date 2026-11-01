// A MedBrains extension: receives signed events, then reads the record with
// the permissions the hospital granted. Env: MEDBRAINS_URL, MEDBRAINS_CLIENT_ID,
// MEDBRAINS_CLIENT_SECRET, MEDBRAINS_WEBHOOK_SECRET (all from Admin → Connected apps).
import { createServer } from "node:http";
import { MedBrainsClient, verifySignature } from "@medbrains/sdk";

const env = (k) => process.env[k] ?? (() => { throw new Error(`${k} is not set`); })();
const client = new MedBrainsClient({
  baseUrl: env("MEDBRAINS_URL"),
  clientId: env("MEDBRAINS_CLIENT_ID"),
  clientSecret: env("MEDBRAINS_CLIENT_SECRET"),
});
const seen = new Set(); // ponytail: in-memory dedupe; use your database in production

createServer(async (req, res) => {
  let body = "";
  for await (const chunk of req) body += chunk;
  const check = verifySignature({ secret: env("MEDBRAINS_WEBHOOK_SECRET"), header: req.headers["x-medbrains-signature"], body });
  if (!check.ok) {
    res.writeHead(401).end(check.reason);
    return;
  }
  const event = JSON.parse(body);
  res.writeHead(200).end("ok"); // answer fast; retries reuse event.id
  if (seen.has(event.id)) return;
  if (seen.size > 10_000) seen.clear(); // bounded: a retry older than this is rare and harmless to re-read
  seen.add(event.id);
  if (event.type === "patient.created") {
    const patient = await client.readFhir("Patient", event.data.patient_id);
    console.log("new patient", patient.id, patient.name?.[0]?.text ?? "");
  }
}).listen(Number(process.env.PORT ?? 8787));
