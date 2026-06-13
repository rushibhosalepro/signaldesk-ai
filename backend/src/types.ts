// Shared war-room state passed between agents. Each agent reads what the
// previous one wrote and appends its own findings (plan.md "LangGraph State Object").

export type AlertContext = {
  searchName: string;
  receivedAt: string; // ISO timestamp
  raw: Record<string, unknown>; // full Splunk webhook payload
  result: Record<string, unknown>; // fields from the triggering row
};

export type HypothesisStatus =
  | "pending"
  | "testing"
  | "confirmed"
  | "discarded";

export type EvidenceItem = {
  claim: string; // human-readable fact, e.g. "v2.4.1 deployed 6 min before alert"
  spl: string; // the exact query that produced it
  result: unknown; // raw MCP query result backing the claim
};

export type Hypothesis = {
  name: string;
  status: HypothesisStatus;
  evidence: EvidenceItem[];
  confidence: number; // 0-100
};

export type Verdict = {
  rootCause: string;
  confidence: number;
  evidenceChain: EvidenceItem[];
  // true once the Skeptic agent reviewed the verdict (and any challenge
  // queries were run and answered)
  peerReviewed?: boolean;
};

export type DiscussionMessage = {
  from: "Triage" | "Investigation" | "Skeptic" | "Scribe" | "War Room";
  to: string;
  content: string;
  at: string; // ISO timestamp
};

export type WarRoomState = {
  alert: AlertContext;
  blastRadius: string[]; // affected services, origin first
  severity: "SEV-1" | "SEV-2" | "SEV-3" | "unknown";
  hypotheses: Hypothesis[];
  verdict: Verdict | null;
  discussion: DiscussionMessage[]; // inter-agent channel shown in the UI
  timeline: string[]; // scribe's running log: "[T+5s] Triage: ..."
  postmortem: string | null;
};

export function newWarRoomState(alert: AlertContext): WarRoomState {
  return {
    alert,
    blastRadius: [],
    severity: "unknown",
    hypotheses: [],
    verdict: null,
    discussion: [],
    timeline: [],
    postmortem: null,
  };
}
