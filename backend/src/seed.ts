const HEC_URL =
  process.env.SPLUNK_HEC_URL ??
  "http://localhost:8088/services/collector/event";
const HEC_TOKEN = process.env.SPLUNK_HEC_TOKEN;
const SPLUNK_API = process.env.SPLUNK_API_URL ?? "https://localhost:8089";
const SPLUNK_USER = process.env.SPLUNK_USERNAME;
const SPLUNK_PASS = process.env.SPLUNK_PASSWORD;

// Splunk's local management port uses a self-signed cert.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

if (!HEC_TOKEN) {
  throw new Error("Missing SPLUNK_HEC_TOKEN");
}

// Delete previous seed data so re-runs don't stack up duplicate events.
const INDEXES = ["app_logs", "infra_metrics", "deploy_events"];
const auth =
  SPLUNK_USER && SPLUNK_PASS
    ? "Basic " + btoa(`${SPLUNK_USER}:${SPLUNK_PASS}`)
    : null;

async function splunkSearch(
  spl: string,
): Promise<{ body: string; results: Array<Record<string, string>> }> {
  const res = await fetch(`${SPLUNK_API}/services/search/jobs`, {
    method: "POST",
    headers: {
      Authorization: auth!,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      search: spl,
      earliest_time: "-7d",
      latest_time: "+1h",
      exec_mode: "oneshot",
      output_mode: "json",
    }),
  });
  const body = await res.text();
  let results: Array<Record<string, string>> = [];
  try {
    results = JSON.parse(body).results ?? [];
  } catch {}
  return { body, results };
}

async function countAll(): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const idx of INDEXES) {
    const { results } = await splunkSearch(`search index=${idx} | stats count`);
    counts[idx] = Number(results[0]?.count ?? -1);
  }
  return counts;
}

if (auth) {
  console.log("Cleaning old seed data from indexes...");
  const { body } = await splunkSearch(
    `search index=app_logs OR index=infra_metrics OR index=deploy_events | delete`,
  );
  const errors = [...body.matchAll(/"type":"ERROR","text":"([^"]+)"/g)].map(
    (m) => m[1],
  );
  for (const e of errors) {
    console.warn(`  cleanup error: ${e}`);
  }
  if (errors.length > 0) {
    console.warn(
      "Hint: the user's role needs the delete_by_keyword capability AND the indexes listed in deleteIndexesAllowed.",
    );
  }
  const after = await countAll();
  const leftovers = Object.entries(after).filter(([, n]) => n !== 0);
  if (leftovers.length === 0) {
    console.log("Cleanup verified: all three indexes empty.");
  } else {
    console.warn(
      `Cleanup incomplete, events remain: ${leftovers.map(([i, n]) => `${i}=${n}`).join(", ")}`,
    );
  }
} else {
  console.warn(
    "SPLUNK_USERNAME/SPLUNK_PASSWORD not set — skipping cleanup; old seed data will remain and can pollute results.",
  );
}

type SeedEvent = {
  time: number;
  index: string;
  host?: string;
  event: Record<string, unknown>;
};
const events: SeedEvent[] = [];
const now = Math.floor(Date.now() / 1000);
const T0 = now - 10 * 60; // spike started 10 minutes ago

// deploy 6 min before the spike, with enterprise-real
events.push({
  time: T0 - 6 * 60,
  index: "deploy_events",
  host: "deploy-01",
  event: {
    service: "checkout-service",
    version: "v2.4.1",
    action: "deploy",
    commit_sha: "9f3acb2e",
    environment: "production",
    deployer: "priya.nair",
    change_ticket: "CHG-4172",
    rollback_to: "v2.4.0",
  },
});

// Staggered delays let you trace the error back to checkout-service as the origin.
const services = [
  {
    name: "checkout-service",
    host: "checkout-host-01",
    normal: 0.2,
    spike: 18,
    delay: 0,
    rpm: 2300,
    error: "NullPointerException in PaymentValidator",
  },
  {
    name: "payment-api",
    host: "payment-host-01",
    normal: 0.1,
    spike: 12,
    delay: 60,
    rpm: 1750,
    error: "upstream_timeout from checkout-service",
  },
  {
    name: "order-service",
    host: "order-host-01",
    normal: 0.1,
    spike: 8,
    delay: 120,
    rpm: 940,
    error: "upstream_timeout from payment-api",
  },
];

for (let t = T0 - 60 * 60; t <= now; t += 30) {
  for (const s of services) {
    const spiking = t >= T0 + s.delay;
    // traffic dips slightly during the incident (retries + users bailing)
    const rpm = Math.round(
      s.rpm * (spiking ? 0.88 : 1) * (0.93 + Math.random() * 0.14),
    );
    events.push({
      time: t,
      index: "app_logs",
      host: s.host,
      event: {
        service: s.name,
        error_rate: +(
          (spiking ? s.spike : s.normal) *
          (0.9 + Math.random() * 0.2)
        ).toFixed(2),
        request_count: rpm,
        ...(spiking ? { error: s.error } : {}),
      },
    });
  }
}

// Infra metrics are flat except for a red herring: payment-host-01 has a CPU spike
// from a batch job that ends before the incident starts — something to rule out.
for (let t = T0 - 60 * 60; t <= now; t += 60) {
  for (const s of services) {
    const batchWindow =
      s.host === "payment-host-01" && t >= T0 - 18 * 60 && t <= T0 - 8 * 60;
    events.push({
      time: t,
      index: "infra_metrics",
      host: s.host,
      event: {
        cpu_pct: +(
          batchWindow ? 60 + Math.random() * 8 : 32 + Math.random() * 4
        ).toFixed(1),
        mem_pct: +(41 + Math.random() * 4).toFixed(1),
        ...(batchWindow ? { note: "scheduled_batch_reconciliation" } : {}),
      },
    });
  }
}

// Send all events to Splunk HEC in one batched request.
const body = events
  .map((e) => JSON.stringify({ ...e, sourcetype: "_json" }))
  .join("\n");
const res = await fetch(HEC_URL, {
  method: "POST",
  headers: { Authorization: `Splunk ${HEC_TOKEN}` },
  body,
});
const hecText = await res.text();
console.log(`HEC response: ${res.status} ${hecText}`);
console.log(
  `Seeded ${events.length} events. T0 (spike start) = ${new Date(T0 * 1000).toISOString()}`,
);

// Verify the events are searchable — HEC indexing happens asynchronously.
if (auth) {
  const expected: Record<string, number> = {
    app_logs: events.filter((e) => e.index === "app_logs").length,
    infra_metrics: events.filter((e) => e.index === "infra_metrics").length,
    deploy_events: 1,
  };
  let ok = false;
  for (let attempt = 0; attempt < 12 && !ok; attempt++) {
    await new Promise((r) => setTimeout(r, 5000));
    const counts = await countAll();
    ok = INDEXES.every((i) => counts[i] === expected[i]);
    console.log(
      `Index counts (attempt ${attempt + 1}): ${INDEXES.map((i) => `${i}=${counts[i]}/${expected[i]}`).join(", ")}`,
    );
  }
  if (ok) {
    console.log("Seed verified — data is searchable and counts match.");
  } else {
    console.warn(
      "Counts never matched expected values — investigate before demoing.",
    );
  }
}
