export type DiscussionMessage = {
  from: string;
  to: string;
  content: string;
  at: string;
};

export type Verdict = {
  rootCause: string;
  confidence: number;
  peerReviewed?: boolean;
  evidenceChain: { claim: string; spl: string; result: string }[];
};

export type Incident = {
  id: string;
  status?: "in_progress" | "resolved";
  alert: { searchName: string; receivedAt: string };
  severity: "SEV-1" | "SEV-2" | "SEV-3" | "unknown";
  blastRadius: string[];
  verdict: Verdict | null;
  discussion: DiscussionMessage[];
  timeline: string[];
  postmortem: string | null;
  files?: {
    triage: string | null;
    investigation: string | null;
    skeptic: string | null;
    postmortem: string | null;
  };
};
