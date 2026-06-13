"use client";

import { useEffect, useRef, useState } from "react";

type AgentEvent = {
  type: string;
  agent?: string;
  incidentId: string;
  message: string;
  timestamp: string;
};

const AGENT_COLOR: Record<string, string> = {
  triage: "text-yellow-400",
  investigation: "text-blue-400",
  skeptic: "text-orange-400",
  scribe: "text-green-400",
  orchestrator: "text-neutral-500",
};

const AGENT_LABEL: Record<string, string> = {
  triage: "Triage",
  investigation: "Investigation",
  skeptic: "Skeptic",
  scribe: "Scribe",
  orchestrator: "Orchestrator",
};

const AGENT_TAG: Record<string, string> = {
  triage: "TRIAGE",
  investigation: "INVEST",
  skeptic: "SKEPTIC",
  scribe: "SCRIBE",
  orchestrator: "ORCH",
};

const ALL_AGENTS = ["triage", "investigation", "skeptic", "scribe"] as const;

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:3001";

export function WarRoomLive({ incidentId }: { incidentId: string }) {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [activeAgent, setActiveAgent] = useState<string | null>(null);
  const [doneAgents, setDoneAgents] = useState<string[]>([]);
  const [pipelineStarted, setPipelineStarted] = useState(false);
  const [pipelineDone, setPipelineDone] = useState(false);
  const [wsStatus, setWsStatus] = useState<"connecting" | "live" | "disconnected">("connecting");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let ws: WebSocket;
    let dead = false;

    ws = new WebSocket(WS_URL);
    ws.onopen = () => { if (!dead) setWsStatus("live"); };
    ws.onclose = () => { if (!dead) setWsStatus("disconnected"); };
    ws.onmessage = (msg) => {
      try {
        const event = JSON.parse(msg.data as string) as AgentEvent;
        if (event.incidentId !== incidentId) return;

        setEvents((prev) => [...prev, event]);

        if (event.type === "pipeline_start") setPipelineStarted(true);

        if (event.type === "agent_start" && event.agent) {
          setActiveAgent(event.agent);
        }

        if (event.type === "agent_done" && event.agent) {
          setDoneAgents((prev) => [...prev, event.agent!]);
          setActiveAgent(null);
        }

        if (event.type === "pipeline_done") {
          setPipelineDone(true);
          setActiveAgent(null);
          setTimeout(() => window.location.reload(), 2000);
        }
      } catch {}
    };

    return () => { dead = true; ws?.close(); };
  }, [incidentId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events]);

  const dot =
    wsStatus === "live" ? "bg-green-500 animate-pulse" :
    wsStatus === "disconnected" ? "bg-red-500" :
    "bg-neutral-600 animate-pulse";

  return (
    <div className="border border-neutral-800 rounded-lg bg-neutral-950 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-neutral-800 flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${dot}`} />
        <span className="text-xs font-semibold uppercase tracking-widest text-neutral-500">War Room Feed</span>
        <span className={`ml-auto text-xs font-mono ${wsStatus === "live" ? "text-green-400" : "text-neutral-600"}`}>
          {pipelineDone ? "DONE — reloading…" : wsStatus === "live" ? "LIVE" : wsStatus.toUpperCase()}
        </span>
      </div>

      {/* Agent pipeline tracker */}
      {pipelineStarted && (
        <div className="px-5 py-3 border-b border-neutral-800 flex items-center gap-2">
          {ALL_AGENTS.map((agent, i) => {
            const isDone = doneAgents.includes(agent);
            const isActive = activeAgent === agent;
            const isPending = !isDone && !isActive;
            return (
              <div key={agent} className="flex items-center gap-2">
                <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-mono font-medium transition-all ${
                  isActive ? `${AGENT_COLOR[agent]} border border-current bg-neutral-900 animate-pulse` :
                  isDone ? "text-neutral-500 border border-neutral-800" :
                  "text-neutral-700 border border-neutral-900"
                }`}>
                  {isDone && <span>✓</span>}
                  {isActive && <span className="animate-spin inline-block">◌</span>}
                  <span>{AGENT_LABEL[agent]}</span>
                </div>
                {i < ALL_AGENTS.length - 1 && (
                  <span className={`text-xs ${isDone ? "text-neutral-600" : "text-neutral-800"}`}>→</span>
                )}
              </div>
            );
          })}
          {pipelineDone && (
            <span className="ml-auto text-xs text-green-400 font-mono">✓ Complete</span>
          )}
        </div>
      )}

      {/* Event log */}
      <div className="px-4 py-4 h-72 overflow-y-auto font-mono text-xs space-y-0.5">
        {events.length === 0 ? (
          <p className="text-neutral-700">
            {wsStatus === "live" ? "Connected — waiting for Splunk to trigger the pipeline…" : "Connecting to war room…"}
          </p>
        ) : (
          events.map((e, i) => {
            const isHighlight = e.type === "agent_start" || e.type === "agent_done" || e.type === "pipeline_start" || e.type === "pipeline_done";
            return (
              <div key={i} className={`flex gap-3 leading-5 ${isHighlight ? "mt-2 mb-1" : ""}`}>
                <span className="text-neutral-700 shrink-0 tabular-nums">
                  {new Date(e.timestamp).toLocaleTimeString()}
                </span>
                {e.agent && (
                  <span className={`shrink-0 w-14 font-bold ${AGENT_COLOR[e.agent] ?? "text-neutral-400"}`}>
                    [{AGENT_TAG[e.agent] ?? e.agent.slice(0, 6).toUpperCase()}]
                  </span>
                )}
                <span className={
                  e.type === "agent_start" ? `font-semibold ${AGENT_COLOR[e.agent ?? ""] ?? "text-white"}` :
                  e.type === "agent_done" ? "text-green-400 font-semibold" :
                  e.type === "pipeline_done" ? "text-green-300 font-bold" :
                  e.type === "pipeline_start" ? "text-white" :
                  e.type === "tool_result" ? "text-neutral-600" :
                  e.type === "error" ? "text-red-400" :
                  "text-neutral-400"
                }>
                  {e.message}
                </span>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
