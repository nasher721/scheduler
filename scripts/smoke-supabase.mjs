import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local" });

const url = process.env.SUPABASE_URL;
const anon = process.env.SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anon || !service) {
  console.error("missing env");
  process.exit(1);
}

const anonClient = createClient(url, anon);
const admin = createClient(url, service);

const failures = [];

const check = (label, ok, detail = "") => {
  if (ok) {
    console.log(`ok  ${label}`);
  } else {
    failures.push(label);
    console.log(`fail  ${label}${detail ? ` — ${detail}` : ""}`);
  }
};

const { data: anonProviders, error: anonError } = await anonClient.from("providers").select("id");
check("anon cannot read providers without jwt", Boolean(anonError) || !anonProviders || anonProviders.length === 0, anonError?.message || `rows=${anonProviders?.length ?? "null"}`);

const { data: providers, error: providerError } = await admin.from("providers").select("id,email,role").order("id");
check("service role lists seeded providers", !providerError && providers?.length === 3, providerError?.message);

const slotId = `smoke-slot-${Date.now()}`;
const { error: slotError } = await admin.from("slots").insert({
  id: slotId,
  date: "2026-08-17",
  type: "DAY",
  provider_id: "1",
  location: "G20",
  location_group: "MAIN_CAMPUS_UNIT",
  service_priority: "CRITICAL",
  service_location: "G20",
  required_skill: "NEURO_CRITICAL",
});
check("insert slot", !slotError, slotError?.message);

const { error: requestError } = await admin.from("shift_requests").insert({
  provider_id: "2",
  provider_name: "Dr. Baker",
  provider_email: "baker@hospital.org",
  type: "time_off",
  date: "2026-08-20",
  notes: "smoke",
});
check("insert shift request", !requestError, requestError?.message);

const { error: notifyError } = await admin.from("notifications").insert({
  title: "Smoke",
  body: "Notification insert works",
  severity: "info",
  recipient_provider_id: "2",
});
check("insert notification", !notifyError, notifyError?.message);

const marketId = `msk-smoke-${Date.now()}`;
const { error: marketError } = await admin.from("marketplace_shifts").insert({
  id: marketId,
  slot_id: slotId,
  posted_by_provider_id: "1",
  date: "2026-08-17",
  shift_type: "DAY",
  location: "G20",
  lifecycle_state: "BROADCASTING",
});
check("insert marketplace shift", !marketError, marketError?.message);

const { error: broadcastError } = await admin.from("broadcast_history").insert({
  id: `bh-smoke-${Date.now()}`,
  marketplace_shift_id: marketId,
  tier: 1,
  channel: "mixed",
  status: "sent",
  recipients: [],
});
check("insert mixed-channel broadcast", !broadcastError, broadcastError?.message);

const { data: settings, error: settingsError } = await admin.from("global_settings").select("key");
check(
  "global settings keys exist",
  !settingsError && settings?.some((row) => row.key === "schedule_config") && settings?.some((row) => row.key === "escalation_config"),
  settingsError?.message
);

await admin.from("slots").delete().eq("id", slotId);

if (failures.length > 0) {
  console.error(`failed: ${failures.join(", ")}`);
  process.exit(1);
}

console.log("all supabase function checks passed");
