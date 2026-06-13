import { createAgent } from "langchain";
import * as fs from "fs/promises";
import * as path from "path";
import { model } from "../lib/model";
import { makeFileTools, extractLastJson } from "../lib/fileTools";
import { SPLUNK_SCHEMA } from "../lib/splunkSchema";
import { wrapTools } from "../lib/eventBus";
import { getSplunkTools } from "../splunk/mcp";
import type { WarRoomState } from "../types";

const SYSTEM = `You are the Skeptic Agent in an incident war room.
${SPLUNK_SCHEMA}
Your job: peer-review the investigation verdict with adversarial Splunk queries.

Steps you MUST take:
1. Read investigation.md to understand the proposed verdict and evidence chain.
2. For each piece of evidence, run a challenge SPL query — try to DISPROVE the claim.
3. Consider at least one alternative hypothesis and check if Splunk data supports it.
4. Return a JSON object EXACTLY matching:
   {
     "verdictConfirmed": true | false,
     "adjustedConfidence": 0-100,
     "challengeFindings": [{ "claim": "...", "challengeSpl": "...", "result": "...", "holds": true|false }],
     "peerReviewNotes": "..."
   }`;

export async function runSkepticAgent(
  state: WarRoomState,
  incidentDir: string,
  incidentId: string,
): Promise<Partial<WarRoomState>> {
  const splunkTools = await getSplunkTools();
  const fileTools = makeFileTools(incidentDir);
  const tools = wrapTools([...splunkTools, ...fileTools], "skeptic", incidentId);

  const agent = createAgent({ model, systemPrompt: SYSTEM, tools });

  const context = JSON.stringify(
    {
      verdict: state.verdict,
      hypotheses: state.hypotheses,
      discussion: state.discussion.filter((d) => d.from === "Investigation"),
    },
    null,
    2,
  );

  const result = await agent.invoke({
    messages: [
      {
        role: "user",
        content: `War room state:\n\`\`\`json\n${context}\n\`\`\`\n\nRead investigation.md, run challenge queries, then return the JSON result.`,
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

  // guaranteed write
  const mdContent = `# Skeptic Review Findings\n\n${agentLog}`;
  await fs.writeFile(path.join(incidentDir, "skeptic.md"), mdContent, "utf-8");

  const report = extractLastJson(text) as {
    verdictConfirmed: boolean;
    adjustedConfidence: number;
    challengeFindings: unknown[];
    peerReviewNotes: string;
  } | null;
  if (!report) {
    const peerReviewedVerdict = state.verdict ? { ...state.verdict, peerReviewed: false } : null;
    return {
      verdict: peerReviewedVerdict,
      discussion: [
        ...state.discussion,
        {
          from: "Skeptic",
          to: "War Room",
          content: `Skeptic could not produce structured output. Verdict proceeds unreviewed.`,
          at: new Date().toISOString(),
        },
      ],
    };
  }

  const peerReviewedVerdict = state.verdict
    ? { ...state.verdict, confidence: report.adjustedConfidence ?? state.verdict.confidence, peerReviewed: true }
    : null;

  return {
    verdict: peerReviewedVerdict,
    discussion: [
      ...state.discussion,
      {
        from: "Skeptic",
        to: "War Room",
        content: `Peer review ${report.verdictConfirmed ? "CONFIRMED" : "CHALLENGED"} (adjusted confidence: ${report.adjustedConfidence}%). ${report.peerReviewNotes}`,
        at: new Date().toISOString(),
      },
      {
        from: "Skeptic",
        to: "Scribe",
        content: `Verdict is peer-reviewed. ${report.verdictConfirmed ? "Proceed to postmortem." : "Note challenges in postmortem."}`,
        at: new Date().toISOString(),
      },
    ],
    timeline: [
      ...state.timeline,
      `[Skeptic] Peer review ${report.verdictConfirmed ? "confirmed" : "challenged"} verdict at ${report.adjustedConfidence}% confidence.`,
    ],
  };
}
