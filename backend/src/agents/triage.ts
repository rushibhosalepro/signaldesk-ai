import { createAgent } from "langchain";
import * as fs from "fs/promises";
import * as path from "path";
import { model } from "../lib/model";
import { makeFileTools, extractLastJson } from "../lib/fileTools";
import { SPLUNK_SCHEMA } from "../lib/splunkSchema";
import { wrapTools } from "../lib/eventBus";
import { getSplunkTools } from "../splunk/mcp";
import type { WarRoomState } from "../types";

type TriageReport = {
  blastRadius: string[];
  severity: "SEV-1" | "SEV-2" | "SEV-3";
  erroringServices: { service: string; latestErrorRate: number; requestsPerMin?: number }[];
  summary: string;
  suggestionToInvestigation: string;
};

const SYSTEM = `You are the Triage Agent in an incident war room.
${SPLUNK_SCHEMA}
Your job: assess blast radius and severity from the Splunk alert data.

Steps you MUST take:
1. Use Splunk MCP tools to query error rates, request volumes, and affected services
   for the time window around the alert.
2. Identify which services are erroring and order them (origin service first).
3. Classify severity:
   - SEV-1: >30 % errors OR >4 services affected
   - SEV-2: >10 % errors OR multiple services affected
   - SEV-3: single service, <10 % errors
4. Return a JSON object EXACTLY matching this schema:
   {
     "blastRadius": ["service-a", "service-b"],
     "severity": "SEV-1" | "SEV-2" | "SEV-3",
     "erroringServices": [{ "service": "...", "latestErrorRate": 0.0, "requestsPerMin": 0 }],
     "summary": "...",
     "suggestionToInvestigation": "..."
   }`;

export async function runTriageAgent(
  state: WarRoomState,
  incidentDir: string,
  incidentId: string,
): Promise<Partial<WarRoomState>> {
  const splunkTools = await getSplunkTools();
  const fileTools = makeFileTools(incidentDir);
  const tools = wrapTools([...splunkTools, ...fileTools], "triage", incidentId);

  const agent = createAgent({ model, systemPrompt: SYSTEM, tools });

  const alertJson = JSON.stringify(state.alert, null, 2);
  const result = await agent.invoke({
    messages: [
      {
        role: "user",
        content: `Alert payload:\n\`\`\`json\n${alertJson}\n\`\`\`\n\nUse Splunk MCP tools to gather error rates and service data, then return the JSON result.`,
      },
    ],
  });

  // collect all agent messages for the raw findings file
  const agentLog = result.messages
    .map((m: { role?: string; content?: unknown }) => {
      const role = m.role ?? "agent";
      const content =
        typeof m.content === "string" ? m.content : JSON.stringify(m.content);
      return `### ${role}\n${content}`;
    })
    .join("\n\n---\n\n");

  const lastMsg = result.messages[result.messages.length - 1]?.content ?? "";
  const text = typeof lastMsg === "string" ? lastMsg : JSON.stringify(lastMsg);
  const report = extractLastJson(text) as TriageReport | null;

  if (!report) {
    await fs.writeFile(
      path.join(incidentDir, "triage.md"),
      `# Triage Findings\n\n_No structured output produced._\n\n${agentLog}`,
      "utf-8",
    );
    return {
      severity: "unknown",
      blastRadius: [],
      discussion: [
        ...state.discussion,
        {
          from: "Triage",
          to: "War Room",
          content: `Triage could not produce structured output. Raw: ${text.slice(0, 500)}`,
          at: new Date().toISOString(),
        },
      ],
    };
  }

  const triageMd = [
    `# Triage Report`,
    ``,
    `## Blast Radius`,
    ...(report.blastRadius ?? []).map((s: string) => `- ${s}`),
    ``,
    `## Severity`,
    `${report.severity} – ${report.summary ?? ""}`,
    ``,
    `## Error Snapshot`,
    `| Service | Error Rate (%) | Requests per Min |`,
    `|---------|----------------|------------------|`,
    ...(report.erroringServices ?? []).map(
      (s) => `| ${s.service} | ${s.latestErrorRate} | ${s.requestsPerMin ?? "N/A"} |`,
    ),
    ``,
    `## Suggestion to Investigation`,
    report.suggestionToInvestigation ?? "",
    ``,
    `## Raw Agent Log`,
    agentLog,
  ].join("\n");

  await fs.writeFile(path.join(incidentDir, "triage.md"), triageMd, "utf-8");

  return {
    severity: report.severity ?? "unknown",
    blastRadius: report.blastRadius ?? [],
    discussion: [
      ...state.discussion,
      {
        from: "Triage",
        to: "War Room",
        content: report.summary ?? "Triage complete.",
        at: new Date().toISOString(),
      },
      {
        from: "Triage",
        to: "Investigation",
        content: report.suggestionToInvestigation ?? "Investigate root cause.",
        at: new Date().toISOString(),
      },
    ],
    timeline: [
      ...state.timeline,
      `[Triage] ${report.summary ?? "Triage complete"} — severity: ${report.severity}`,
    ],
  };
}
