import { createAgent } from "langchain";
import type { StructuredTool } from "@langchain/core/tools";
import * as fs from "fs/promises";
import * as path from "path";
import { model } from "../lib/model";
import { makeFileTools, extractLastJson } from "../lib/fileTools";
import { SPLUNK_SCHEMA } from "../lib/splunkSchema";
import { wrapTools } from "../lib/eventBus";
import type { WarRoomState, Hypothesis, Verdict } from "../types";

const SYSTEM = `You are the Investigation Agent in an incident war room.
${SPLUNK_SCHEMA}
Your job: form root-cause hypotheses and validate them with Splunk data.

Steps you MUST take:
1. Read triage.md to understand blast radius, severity, and the triage agent's suggestion.
2. Form 2-3 hypotheses for root cause (e.g. recent deploy, traffic spike, dependency failure).
3. For EACH hypothesis run Splunk MCP queries to confirm or discard it.
4. Return a JSON object EXACTLY matching:
   {
     "hypotheses": [
       { "name": "...", "status": "confirmed|discarded|pending", "confidence": 0-100,
         "evidence": [{ "claim": "...", "spl": "...", "result": "..." }] }
     ],
     "verdict": {
       "rootCause": "...",
       "confidence": 0-100,
       "evidenceChain": [{ "claim": "...", "spl": "...", "result": "..." }]
     }
   }`;

export async function runInvestigationAgent(
  state: WarRoomState,
  incidentDir: string,
  splunkTools: StructuredTool[],
  incidentId: string,
): Promise<Partial<WarRoomState>> {
  const fileTools = makeFileTools(incidentDir);
  const tools = wrapTools([...splunkTools, ...fileTools], "investigation", incidentId);

  const agent = createAgent({ model, systemPrompt: SYSTEM, tools });

  const context = JSON.stringify(
    {
      alert: state.alert,
      blastRadius: state.blastRadius,
      severity: state.severity,
      discussion: state.discussion.filter((d) => d.from === "Triage"),
    },
    null,
    2,
  );

  const result = await agent.invoke({
    messages: [
      {
        role: "user",
        content: `War room state:\n\`\`\`json\n${context}\n\`\`\`\n\nRead triage.md, query Splunk for each hypothesis, then return the JSON result.`,
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

  // guaranteed write — even if the agent skipped calling write_findings
  const mdContent = `# Investigation Findings\n\n${agentLog}`;
  await fs.writeFile(path.join(incidentDir, "investigation.md"), mdContent, "utf-8");

  const report = extractLastJson(text) as { hypotheses: Hypothesis[]; verdict: Verdict } | null;
  if (!report) {
    return {
      discussion: [
        ...state.discussion,
        {
          from: "Investigation",
          to: "War Room",
          content: `Investigation could not produce structured output. Raw: ${text.slice(0, 500)}`,
          at: new Date().toISOString(),
        },
      ],
    };
  }

  const verdictSummary = report.verdict?.rootCause ?? "Unknown root cause";
  return {
    hypotheses: report.hypotheses ?? [],
    verdict: report.verdict ?? null,
    discussion: [
      ...state.discussion,
      {
        from: "Investigation",
        to: "War Room",
        content: `Verdict (${report.verdict?.confidence ?? "?"}% confidence): ${verdictSummary}`,
        at: new Date().toISOString(),
      },
      {
        from: "Investigation",
        to: "Skeptic",
        content: `Please peer-review this verdict: ${verdictSummary}`,
        at: new Date().toISOString(),
      },
    ],
    timeline: [
      ...state.timeline,
      `[Investigation] Root cause identified: ${verdictSummary} (confidence: ${report.verdict?.confidence ?? "?"})`,
    ],
  };
}
