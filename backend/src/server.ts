import express from "express";
import cors from "cors";
import * as fs from "fs/promises";
import * as path from "path";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { runOrchestrator } from "./agents/orchestrator";
import { onAgentEvent } from "./lib/eventBus";

const app = express();
const PORT = process.env.PORT ?? 3001;
const INCIDENTS_ROOT = path.resolve(process.cwd(), "..", "incidents");

app.use(express.json());
app.use(cors());

app.post("/webhook", async (req, res) => {
  const payload = req.body as Record<string, unknown>;
  console.log("[Webhook] Received Splunk alert:", JSON.stringify(payload).slice(0, 200));

  // Reject if any incident is already in progress — prevents duplicate pipelines
  // from Splunk's per-minute cron firing while agents are still running.
  try {
    const entries = await fs.readdir(INCIDENTS_ROOT).catch(() => [] as string[]);
    for (const name of entries) {
      try {
        const raw = await fs.readFile(path.join(INCIDENTS_ROOT, name, "state.json"), "utf-8");
        const state = JSON.parse(raw);
        if (state.status === "in_progress") {
          console.log(`[Webhook] Dropped — incident ${name} already in progress.`);
          return res.status(409).json({ status: "busy", message: "A war room is already active." });
        }
      } catch {}
    }
  } catch {}

  res.status(202).json({ status: "accepted", message: "Incident war room started." });
  runOrchestrator(payload).catch((err) => {
    console.error("[Orchestrator] Fatal error:", err);
  });
});

app.get("/api/incidents", async (_req, res) => {
  try {
    const entries = await fs.readdir(INCIDENTS_ROOT);
    const incidents = await Promise.all(
      entries.map(async (name) => {
        try {
          const raw = await fs.readFile(path.join(INCIDENTS_ROOT, name, "state.json"), "utf-8");
          const state = JSON.parse(raw);
          return { id: name, ...state };
        } catch {
          return null;
        }
      }),
    );
    res.json(
      incidents
        .filter(Boolean)
        .sort((a, b) => (b.alert?.receivedAt ?? "").localeCompare(a.alert?.receivedAt ?? "")),
    );
  } catch {
    res.json([]);
  }
});

app.get("/api/incidents/:id", async (req, res) => {
  const dir = path.join(INCIDENTS_ROOT, req.params["id"] ?? "");
  try {
    const raw = await fs.readFile(path.join(dir, "state.json"), "utf-8");
    const state = JSON.parse(raw);
    const readMd = async (name: string) => {
      try { return await fs.readFile(path.join(dir, name), "utf-8"); }
      catch { return null; }
    };
    res.json({
      ...state,
      files: {
        triage: await readMd("triage.md"),
        investigation: await readMd("investigation.md"),
        skeptic: await readMd("skeptic.md"),
        postmortem: await readMd("postmortem.md"),
      },
    });
  } catch {
    res.status(404).json({ error: "Incident not found" });
  }
});

app.get("/health", (_, res) => res.send("server up and running"));

// --- WebSocket ---
const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer });

wss.on("connection", (ws) => {
  const unsub = onAgentEvent((event) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(event));
    }
  });
  ws.on("close", () => unsub());
});

httpServer.listen(PORT, () => console.log(`server up and running at ${PORT}`));
