# SignalDesk AI — Devpost Submission

---

## The Problem

Incident response is one of the most stressful moments in engineering — an alert fires, something is broken, users are affected, and the on-call engineer has to figure out what happened from scratch. Every time.

The manual process is always the same: open Splunk, run error queries, check recent deploys, form a hypothesis, validate it with more queries, cross-check with a colleague, then write a postmortem while exhausted. This takes 15–30 minutes of focused work under pressure — and it happens every single time an alert fires, even if it's the same type of incident you've seen before.

The workflow is predictable enough that it shouldn't require a human to do it cold every time. Triage the affected services. Check for recent deploys. Run the error queries. Form a hypothesis. Challenge it. Write it up. That's a pipeline — and pipelines can be automated.

SignalDesk AI automates that pipeline. When Splunk fires an alert, four AI agents open a war room instantly: one triages, one investigates, one adversarially challenges the verdict, one writes the postmortem. By the time an engineer looks at their screen, the report is ready.

---

## What It Does

SignalDesk AI receives a Splunk webhook and runs a fully automated incident investigation pipeline:

1. **Triage Agent** — queries Splunk for error rates and request volumes across all services, classifies severity (SEV-1/2/3), and maps the blast radius with the origin service first
2. **Investigation Agent** — reads the triage findings, forms 2–3 hypotheses (deploy gone wrong? traffic spike? dependency failure?), runs targeted SPL queries for each one via Splunk MCP, and produces a root-cause verdict with a confidence score
3. **Skeptic Agent** — adversarially challenges the verdict by running queries specifically designed to *disprove* it, adjusts the confidence score, and marks the verdict peer-reviewed
4. **Scribe Agent** — synthesizes all agent findings into a structured postmortem: executive summary, timeline, root cause, evidence chain, blast radius, action items, and lessons learned

The entire pipeline streams live to a dark-theme Next.js UI via WebSocket — every `splunk_run_query` call, every result, every agent transition appears in real time. When the pipeline finishes, the page reloads automatically and the full report is there.

---

## How I Built It

### Agent Architecture

Four LangChain ReAct agents (`createReactAgent`), each with a distinct system prompt, tool set, and responsibility. They run **sequentially** — each reads the previous agent's output files before starting. The orchestrator passes shared `WarRoomState` between them, building up a picture of the incident across the pipeline.

The agents don't share tool instances — each agent calls `getSplunkTools()` independently to get fresh MCP tool instances. This was a critical fix: sharing tool objects caused monkey-patched event wrappers to chain across agents, making Investigation queries appear as Triage events in the UI.

### Splunk MCP Integration

Every agent connects to the **Splunk MCP Server** via `@langchain/mcp-adapters` (`MultiServerMCPClient`). The `splunk_run_query` tool is called like any other LangChain tool — the agent decides what SPL to run, when to run it, and what to do with the result. No custom RAG pipeline, no pre-computed summaries. Every hypothesis is validated against live Splunk data at query time.

A key constraint discovered during development: the Splunk MCP tool silently returns empty results when `earliest=` or `latest=` time modifiers are included in the query. All SPL queries had to be written without time filters — which required careful system prompt design to ensure agents didn't add them.

### Real-Time Event Feed

An `EventBus` (Node.js `EventEmitter`) sits between the agents and the WebSocket server. Every tool call and result is intercepted by wrapping `_call` on each tool — the wrapper emits the call with input parameters, awaits the original, then emits the result with a preview. The WebSocket server broadcasts all events to connected clients, filtered by `incidentId` on the frontend.

### Incident Store

Each incident gets its own directory under `incidents/<id>/` with:
- `state.json` — written immediately on webhook receipt (status: `in_progress`) and updated after each agent, so the UI shows the incident live while agents are still running
- `triage.md`, `investigation.md`, `skeptic.md`, `postmortem.md` — each agent writes its findings as a file, which the next agent reads

### Deduplication

The webhook handler checks for any existing `in_progress` incident before starting a new pipeline. Since Splunk's cron fires every minute, without this check each minute would spawn a new parallel pipeline while agents were still running.

### Frontend

Next.js 15 with a `WarRoomLive` client component that connects to WebSocket and tracks `activeAgent`, `doneAgents`, and `pipelineStarted` state. A pipeline progress tracker shows Triage → Investigation → Skeptic → Scribe with color-coded active/done/pending states. The `IncidentPoller` component calls `router.refresh()` every 5 seconds on the homepage so new incidents appear automatically.

---

## Challenges

**The MCP tool sharing bug.** The biggest technical problem was discovering that `MultiServerMCPClient.getTools()` returns cached tool instances. When `wrapTools()` monkey-patches `_call` on those objects, each subsequent agent wraps the previous agent's patch — creating a chain. Every Investigation query emitted both `[INVEST]` and `[TRIAGE]` events. The fix was to create a fresh `MultiServerMCPClient` inside each agent rather than sharing one at the orchestrator level.

**Splunk MCP time filter constraint.** The `splunk_run_query` tool silently returns empty results when SPL queries include `earliest=` or `latest=` time modifiers. This took significant debugging — queries looked correct but returned nothing. The fix was adding an explicit instruction to every agent's system prompt: do not use time modifiers. The seed data is always available without filters.

**Getting agents to produce structured output reliably.** LLMs don't always return valid JSON at the end of a long reasoning trace. Each agent uses `extractLastJson()` — a function that scans backwards through the response to find the last valid JSON block — with a fallback path that still writes a markdown file even when the structured output fails.

**State.json visibility during pipeline.** Initially, `state.json` was only written at the end of the pipeline. The UI had no way to show an incident while agents were running. The fix was writing `state.json` immediately after the incident directory was created (with `status: "in_progress"`), then updating it after each agent completed.

**WebSocket staying open on resolved incidents.** The `WarRoomLive` component was always rendered, even on resolved incidents — keeping a WebSocket connection open indefinitely and showing "LIVE" on closed incidents. The fix was conditionally rendering it only when `!isComplete`, and showing a static "closed" pipeline tracker for resolved incidents.

---

## What I Learned

- **MCP tool instances are stateful objects** — sharing them across agents that wrap `_call` creates hidden chains. Each agent needs its own fresh instances.
- **Sequential agents beat a single large prompt for multi-step investigation** — each agent having a focused system prompt and reading only the previous agent's output produces more reliable, traceable results than asking one LLM to do everything.
- **The Skeptic agent changes the output quality significantly** — without adversarial review, the Investigation agent's first hypothesis often becomes the verdict regardless of how strong the evidence is. The Skeptic forces the system to actively look for counter-evidence.
- **Writing `state.json` immediately is essential for live UI** — the temptation is to write state only when there's something meaningful to show, but the UI needs to know an incident exists the moment it starts.
- **Splunk MCP makes live data grounding trivial** — connecting an agent to live operational data without building a custom integration is genuinely powerful. The agent decides what to query and when; Splunk handles execution.

---

## What's Next

- **Slack / PagerDuty integration** — post the postmortem to the incident Slack channel automatically when the pipeline completes
- **Runbook matching** — embed past postmortems and match new incidents against them; if the same root cause was seen before, surface the previous remediation steps
- **Auto-rollback trigger** — if the Skeptic confirms a deploy-caused incident with >90% confidence, automatically trigger a rollback via the deployment API
- **Multi-tenant support** — route incoming webhooks to isolated war rooms per team, with separate Splunk indexes and notification channels
- **Splunk hosted model support** — replace OpenRouter with Splunk's native hosted models for fully on-premise deployments with no external API dependency
