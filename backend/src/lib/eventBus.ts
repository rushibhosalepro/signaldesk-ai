import { EventEmitter } from "events";
import type { StructuredTool } from "@langchain/core/tools";

export type AgentName = "triage" | "investigation" | "skeptic" | "scribe" | "orchestrator";
export type EventType =
  | "pipeline_start"
  | "agent_start"
  | "tool_call"
  | "tool_result"
  | "agent_done"
  | "pipeline_done"
  | "error";

export type AgentEvent = {
  type: EventType;
  agent?: AgentName;
  incidentId: string;
  message: string;
  timestamp: string;
};

const bus = new EventEmitter();
bus.setMaxListeners(100);

export function emitAgentEvent(event: AgentEvent) {
  bus.emit("agent", event);
}

export function onAgentEvent(cb: (event: AgentEvent) => void): () => void {
  bus.on("agent", cb);
  return () => bus.off("agent", cb);
}

export function wrapTools(
  tools: StructuredTool[],
  agent: AgentName,
  incidentId: string,
): StructuredTool[] {
  return tools.map((tool) => {
    const original = (tool as { _call: (input: unknown) => Promise<string> })._call.bind(tool);
    (tool as { _call: (input: unknown) => Promise<string> })._call = async (input: unknown) => {
      const inputStr = JSON.stringify(input);
      emitAgentEvent({
        type: "tool_call",
        agent,
        incidentId,
        message: `→ ${tool.name}(${inputStr.slice(0, 200)}${inputStr.length > 200 ? "…" : ""})`,
        timestamp: new Date().toISOString(),
      });
      const result = await original(input);
      const raw = typeof result === "string" ? result : JSON.stringify(result);
      const preview = raw.replace(/\n/g, " ").slice(0, 150);
      emitAgentEvent({
        type: "tool_result",
        agent,
        incidentId,
        message: `← ${tool.name}: ${preview}${raw.length > 150 ? "…" : ""}`,
        timestamp: new Date().toISOString(),
      });
      return result;
    };
    return tool;
  });
}
