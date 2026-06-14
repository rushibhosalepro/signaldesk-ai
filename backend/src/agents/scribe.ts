import { createAgent } from "langchain";
import * as fs from "fs/promises";
import * as path from "path";
import { model, withRetry } from "../lib/model";
import { makeFileTools, extractLastJson } from "../lib/fileTools";
import { SPLUNK_SCHEMA } from "../lib/splunkSchema";
import { wrapTools } from "../lib/eventBus";
import { getSplunkTools } from "../splunk/mcp";
import type { WarRoomState } from "../types";

const SYSTEM = `You are the Scribe Agent in an incident war room.
${SPLUNK_SCHEMA}
Your job: synthesize all findings into a final incident postmortem report.

Steps you MUST take:
1. Read triage.md, investigation.md, and skeptic.md to gather all findings.
2. Produce a complete postmortem with these sections:
   - # Incident Postmortem: <alert name>
   - **Date/Severity/Status**
   - ## Executive Summary (2-3 sentences)
   - ## Timeline (ordered key events)
   - ## Root Cause (confirmed verdict + evidence chain)
   - ## Blast Radius
   - ## Skeptic Review
   - ## Action Items (3-5 concrete follow-ups)
   - ## Lessons Learned
3. Return a JSON object EXACTLY matching:
   { "postmortem": "<full markdown text>" }`;

export async function runScribeAgent(
  state: WarRoomState,
  incidentDir: string,
  incidentId: string,
): Promise<Partial<WarRoomState>> {
  const splunkTools = await getSplunkTools();
  const fileTools = makeFileTools(incidentDir);
  const tools = wrapTools([...splunkTools, ...fileTools], "scribe", incidentId);

  const agent = createAgent({ model, systemPrompt: SYSTEM, tools });

  const context = JSON.stringify(
    {
      alert: state.alert,
      severity: state.severity,
      blastRadius: state.blastRadius,
      verdict: state.verdict,
      timeline: state.timeline,
      discussion: state.discussion,
    },
    null,
    2,
  );

  const result = await withRetry(
    () =>
      agent.invoke({
        messages: [
          {
            role: "user",
            content: `Final war room state:\n\`\`\`json\n${context}\n\`\`\`\n\nRead all findings files, then return the JSON with the full postmortem text.`,
          },
        ],
      }),
    "scribe.invoke",
  );

  const lastMsg = result.messages[result.messages.length - 1]?.content ?? "";
  const text = typeof lastMsg === "string" ? lastMsg : JSON.stringify(lastMsg);

  const parsed = extractLastJson(text) as { postmortem?: string } | null;
  const postmortem = parsed?.postmortem ?? text;

  // guaranteed write — always produce the postmortem file
  await fs.writeFile(path.join(incidentDir, "postmortem.md"), postmortem, "utf-8");

  return {
    postmortem,
    discussion: [
      ...state.discussion,
      {
        from: "Scribe",
        to: "War Room",
        content: "Postmortem written. Incident closed.",
        at: new Date().toISOString(),
      },
    ],
    timeline: [
      ...state.timeline,
      `[Scribe] Postmortem written to postmortem.md. Incident closed.`,
    ],
  };
}
