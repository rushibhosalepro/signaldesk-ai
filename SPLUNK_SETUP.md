# Splunk Setup Guide

Everything you need to configure Splunk Enterprise from scratch for SignalDesk AI.

---

## 1. Create the Three Indexes

SignalDesk AI uses three custom indexes. Create them before seeding data or running the demo.

### Steps

1. Go to **Settings → Indexes → New Index**
2. Create each index below with default settings (leave bucket sizes, retention as default):

| Index Name      | Description                              |
| --------------- | ---------------------------------------- |
| `app_logs`      | Per-service error rates and request counts (sampled every 30s) |
| `infra_metrics` | Per-host CPU and memory metrics (sampled every 60s) |
| `deploy_events` | One event per production deployment      |

3. Click **Save** after each one.

To verify they exist, run in Search:
```spl
| eventcount summarize=false index=app_logs index=infra_metrics index=deploy_events
```

---

## 2. Enable HTTP Event Collector (HEC)

HEC is how the seed script pushes demo data into Splunk.

1. Go to **Settings → Data Inputs → HTTP Event Collector**
2. Click **Global Settings** → set **All Tokens** to **Enabled** → Save
3. Click **New Token**:
   - Name: `signaldesk-seed`
   - Source type: `_json`
   - Allowed indexes: select `app_logs`, `infra_metrics`, `deploy_events`
4. Click **Submit** — copy the token value
5. Add to `backend/.env`:
   ```env
   SPLUNK_HEC_URL=http://localhost:8088/services/collector/event
   SPLUNK_HEC_TOKEN=<paste token here>
   ```

---

## 3. Grant `delete_by_keyword` Capability (for seed cleanup)

The seed script runs `| delete` to wipe old demo data before each run. This requires a special capability.

Without it, re-running `bun run src/seed.ts` stacks duplicate events on top of old ones, which produces wrong results during the demo.

### Steps

1. Go to **Settings → Access Controls → Roles**
2. Click your role (e.g. `admin` or create a new role `signaldesk`)
3. Under **Capabilities**, find and check **`delete_by_keyword`**
4. Under **Indexes searched by default**, add: `app_logs`, `infra_metrics`, `deploy_events`
5. Under **Indexes allowed for deletion** (`deleteIndexesAllowed`), add the same three indexes
6. Click **Save**

> **Why this is needed:** Splunk treats `| delete` as a privileged operation. Even admin accounts need the capability explicitly enabled, and deletion is only allowed on indexes listed in `deleteIndexesAllowed` — adding the capability alone is not enough.

To verify it works, run the seed script and check for no cleanup errors:
```bash
cd backend
bun run src/seed.ts
```
Expected output: `Cleanup verified: all three indexes empty.`

---

## 4. Install & Enable the MCP Server

The MCP Server is what lets the four AI agents call `splunk_run_query` at runtime.

### Install the app (if not already present)

Splunk's MCP Server ships as a separate Splunkbase app — it is **not** built into Splunk Enterprise by default.

1. Download from Splunkbase: **[Splunk MCP Server (App ID 7931)](https://splunkbase.splunk.com/app/7931)**
2. In Splunk Web: **Apps → Manage Apps → Install app from file**
3. Upload the downloaded `.tgz` → click **Upload** → restart Splunk when prompted

Or install via CLI:
```bash
# Replace <splunk_home> with your Splunk install path (e.g. /opt/splunk)
<splunk_home>/bin/splunk install app splunk-mcp-server.tgz \
  -auth your_username:your_password
<splunk_home>/bin/splunk restart
```

### Enable it

1. Go to **Settings → Server Settings → MCP Server**
2. Toggle **Enable MCP Server** → On
3. Click **Save**

### Get an MCP Token

The MCP Server uses a bearer token for auth. Get one via:

**Option A — Splunk session token (quick, expires)**
```bash
curl -k -u your_username:your_password \
  https://localhost:8089/services/auth/login \
  -d output_mode=json
```
Use the `sessionKey` value from the response.

**Option B — Persistent token (recommended)**
1. In Splunk Web, go to your username (top right) → **Account Settings → Tokens**
2. Click **New Token** → set expiry → Copy

Add to `backend/.env`:
```env
SPLUNK_MCP_ENDPOINT=https://localhost:8089/services/mcp
SPLUNK_MCP_TOKEN=<your token here>
```

> The backend sets `NODE_TLS_REJECT_UNAUTHORIZED=0` to handle Splunk's self-signed management cert on localhost. Do not use this in production.

---

## 5. Create the Saved Search Alert (Webhook Trigger)

This is the Splunk alert that fires the war room. When the search finds results, it POSTs to the backend.

### Create the Saved Search

1. Go to **Search & Reporting** app → run this search:
   ```spl
   index=app_logs error_rate>5 | stats max(error_rate) as peak_err by service | where peak_err>5
   ```
2. Click **Save As → Alert**

### Alert Settings

| Field | Value |
|---|---|
| **Title** | `High Error Rate — Production` |
| **Alert type** | Scheduled |
| **Time range** | Run every minute (cron: `* * * * *`) |
| **Cron expression** | `* * * * *` |
| **Expires** | Never |
| **Trigger condition** | Number of Results — is greater than — `0` |
| **Trigger** | Once |
| **Throttle** | Check "Suppress triggers" — `1` minute *(set to 1 min for demo; default is 10 min which is too slow)* |

### Add the Webhook Action

1. Under **Add Actions**, click **Webhook**
2. Set **URL** to your ngrok tunnel + `/webhook`:
   ```
   https://<your-ngrok-id>.ngrok-free.app/webhook
   ```
3. Click **Save**

### Start ngrok

```bash
ngrok http 3001
```

Copy the `https://` forwarding URL from the ngrok output and paste it into the Splunk webhook URL field (with `/webhook` appended).

> **ngrok URL changes on every restart** unless you're on a paid plan with a static domain. If you restart ngrok, update the webhook URL in Splunk.

### Test It Manually

To trigger the war room immediately without waiting for the cron:

1. Open the saved search in Splunk
2. Click **Run** — if it returns results, the alert fires
3. Or: run `bun run src/seed.ts` first to inject error-spike data, then trigger the search

You can also POST directly to the backend to skip Splunk entirely:
```bash
curl -X POST http://localhost:3001/webhook \
  -H "Content-Type: application/json" \
  -d '{"search_name":"High Error Rate — Production","result":{"service":"checkout-service","peak_err":"18.4"}}'
```

---

## 6. Verify the Full Flow

Once everything is configured:

```
Splunk cron fires every minute
  → search finds error_rate > 5
  → alert triggers
  → POST to https://<ngrok>.ngrok-free.app/webhook
  → backend receives payload
  → orchestrator starts: Triage → Investigation → Skeptic → Scribe
  → incidents/ directory created with state.json (status: in_progress)
  → frontend shows ● live at http://localhost:3000
  → WebSocket streams agent events to incident detail page
  → pipeline_done → status: resolved → postmortem appears
```

### Checklist

- [ ] Indexes `app_logs`, `infra_metrics`, `deploy_events` exist
- [ ] HEC enabled, token added to `backend/.env`
- [ ] `delete_by_keyword` capability + `deleteIndexesAllowed` set on your role
- [ ] `bun run src/seed.ts` completes with "Seed verified"
- [ ] MCP Server enabled in Splunk settings
- [ ] MCP token added to `backend/.env` as `SPLUNK_MCP_TOKEN`
- [ ] ngrok running: `ngrok http 3001`
- [ ] Webhook action on saved search points to `https://<ngrok-url>/webhook`
- [ ] Alert throttle set to 1 minute
- [ ] Backend running: `cd backend && bun run start`
- [ ] Frontend running: `cd frontend && bun run dev`
