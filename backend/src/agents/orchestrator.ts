import * as fs from "fs/promises";
import * as path from "path";
import { createIncidentDir } from "../lib/fileTools";
import { newWarRoomState, type AlertContext, type WarRoomState } from "../types";
import { emitAgentEvent } from "../lib/eventBus";
import { runTriageAgent } from "./triage";
import { runInvestigationAgent } from "./investigation";
import { runSkepticAgent } from "./skeptic";
import { runScribeAgent } from "./scribe";

export async function runOrchestrator(
  alertPayload: Record<string, unknown>,
): Promise<WarRoomState> {
  const alert: AlertContext = {
    searchName:
      (alertPayload.search_name as string) ??
      (alertPayload.searchName as string) ??
      "Unknown Alert",
    receivedAt: new Date().toISOString(),
    raw: alertPayload,
    result: (alertPayload.result as Record<string, unknown>) ?? {},
  };

  let state = newWarRoomState(alert);
  const incidentDir = await createIncidentDir(alert.searchName);
  const incidentId = path.basename(incidentDir);

  console.log(`[Orchestrator] Incident dir: ${incidentDir}`);

  // Write initial state immediately so the UI can show the incident while it runs
  const writeState = async (extra: object = {}) => {
    await fs.writeFile(
      path.join(incidentDir, "state.json"),
      JSON.stringify({ ...state, incidentId, incidentDir, ...extra }, null, 2),
      "utf-8",
    );
  };
  await writeState({ status: "in_progress" });

  emitAgentEvent({
    type: "pipeline_start",
    agent: "orchestrator",
    incidentId,
    message: `War room opened for: ${alert.searchName}`,
    timestamp: new Date().toISOString(),
  });

  // 1. Triage
  emitAgentEvent({ type: "agent_start", agent: "triage", incidentId, message: "Assessing blast radius and severity…", timestamp: new Date().toISOString() });
  state = { ...state, ...(await runTriageAgent(state, incidentDir, incidentId)) };
  await writeState({ status: "in_progress" });
  emitAgentEvent({ type: "agent_done", agent: "triage", incidentId, message: `Severity: ${state.severity} — ${state.blastRadius.join(", ")}`, timestamp: new Date().toISOString() });
  console.log("[Orchestrator] Triage complete, severity:", state.severity);

  // 2. Investigation
  emitAgentEvent({ type: "agent_start", agent: "investigation", incidentId, message: "Forming hypotheses and querying Splunk…", timestamp: new Date().toISOString() });
  state = { ...state, ...(await runInvestigationAgent(state, incidentDir, incidentId)) };
  await writeState({ status: "in_progress" });
  emitAgentEvent({ type: "agent_done", agent: "investigation", incidentId, message: `Verdict: ${state.verdict?.rootCause?.slice(0, 100) ?? "no verdict"}`, timestamp: new Date().toISOString() });
  console.log("[Orchestrator] Investigation complete, verdict:", state.verdict?.rootCause);

  // 3. Skeptic
  if (state.verdict?.rootCause) {
    emitAgentEvent({ type: "agent_start", agent: "skeptic", incidentId, message: "Peer-reviewing verdict with adversarial queries…", timestamp: new Date().toISOString() });
    state = { ...state, ...(await runSkepticAgent(state, incidentDir, incidentId)) };
    await writeState({ status: "in_progress" });
    emitAgentEvent({ type: "agent_done", agent: "skeptic", incidentId, message: `Confidence adjusted to ${Math.round(state.verdict?.confidence ?? 0)}%`, timestamp: new Date().toISOString() });
    console.log("[Orchestrator] Skeptic review complete");
  }

  // 4. Scribe
  emitAgentEvent({ type: "agent_start", agent: "scribe", incidentId, message: "Writing postmortem report…", timestamp: new Date().toISOString() });
  state = { ...state, ...(await runScribeAgent(state, incidentDir, incidentId)) };
  emitAgentEvent({ type: "agent_done", agent: "scribe", incidentId, message: "Postmortem written.", timestamp: new Date().toISOString() });
  console.log("[Orchestrator] Scribe complete.");

  await writeState({ status: "resolved" });

  emitAgentEvent({
    type: "pipeline_done",
    agent: "orchestrator",
    incidentId,
    message: "War room closed. Incident report ready.",
    timestamp: new Date().toISOString(),
  });

  return state;
}
