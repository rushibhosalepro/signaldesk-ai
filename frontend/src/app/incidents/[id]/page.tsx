import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { WarRoomLive } from "@/components/WarRoomLive";
import type { Incident } from "@/lib/types";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function getIncident(id: string): Promise<Incident | null> {
  try {
    const res = await fetch(`${API}/api/incidents/${id}`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

function sevVariant(sev: string): "sev1" | "sev2" | "sev3" | "outline" {
  if (sev === "SEV-1") return "sev1";
  if (sev === "SEV-2") return "sev2";
  if (sev === "SEV-3") return "sev3";
  return "outline";
}

function Postmortem({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1 text-sm leading-7">
      {lines.map((line, i) => {
        if (line.startsWith("# "))
          return <h1 key={i} className="text-lg font-bold text-white mt-4 mb-1">{line.slice(2)}</h1>;
        if (line.startsWith("## "))
          return <h2 key={i} className="text-xs font-semibold text-neutral-400 uppercase tracking-widest mt-6 mb-2 border-b border-neutral-800 pb-1">{line.slice(3)}</h2>;
        if (line.startsWith("### "))
          return <h3 key={i} className="text-xs font-semibold text-neutral-300 mt-3 mb-1">{line.slice(4)}</h3>;
        if (line.startsWith("- ") || line.startsWith("* "))
          return (
            <div key={i} className="flex gap-2 text-neutral-300">
              <span className="text-neutral-700 shrink-0">—</span>
              <span>{renderInline(line.slice(2))}</span>
            </div>
          );
        if (/^\d+\. /.test(line)) {
          const num = line.match(/^(\d+)\. /)?.[1];
          return (
            <div key={i} className="flex gap-2 text-neutral-300">
              <span className="text-neutral-700 shrink-0 w-4 text-right">{num}.</span>
              <span>{renderInline(line.replace(/^\d+\. /, ""))}</span>
            </div>
          );
        }
        if (line.startsWith("```") || line.trim() === "")
          return <div key={i} className="h-1" />;
        return <p key={i} className="text-neutral-300">{renderInline(line)}</p>;
      })}
    </div>
  );
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**")
      ? <strong key={i} className="text-white font-semibold">{part.slice(2, -2)}</strong>
      : part
  );
}

export default async function IncidentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const inc = await getIncident(id);
  if (!inc) notFound();

  const isComplete = !!inc.files?.postmortem;
  const confidence = inc.verdict?.confidence;
  const confPct = confidence != null
    ? Math.round(confidence > 1 ? confidence : confidence * 100)
    : null;

  return (
    <div className="min-h-screen bg-neutral-950">
      <header className="border-b border-neutral-800 px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-neutral-500 hover:text-white text-sm transition-colors">← Back</Link>
          <span className="text-neutral-700">|</span>
          <span className="text-sm font-semibold tracking-tight text-white">SignalDesk AI</span>
        </div>
        <div className="flex items-center gap-3">
          {isComplete
            ? <span className="text-xs text-green-400 font-mono">● RESOLVED</span>
            : <span className="text-xs text-yellow-400 font-mono animate-pulse">● IN PROGRESS</span>
          }
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10 flex flex-col gap-6">

        {/* Title */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Badge variant={sevVariant(inc.severity ?? "unknown")}>{inc.severity ?? "UNKNOWN"}</Badge>
            {inc.verdict?.peerReviewed && <Badge variant="outline">peer-reviewed</Badge>}
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">{inc.alert.searchName}</h1>
          <p className="text-xs text-neutral-500 mt-1">{new Date(inc.alert.receivedAt).toLocaleString()}</p>
        </div>

        {/* War Room Live Feed — always shown */}
        <WarRoomLive incidentId={id} />

        {/* Completed: scribe report + meta */}
        {isComplete && inc.files?.postmortem && (
          <>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-widest text-neutral-500">Incident Report</span>
                  <div className="flex items-center gap-3">
                    {confPct != null && (
                      <span className="text-xs text-neutral-500">
                        {confPct}% confidence{inc.verdict?.peerReviewed ? " · peer-reviewed" : ""}
                      </span>
                    )}
                    <span className="text-xs text-green-400 font-mono">✓ War Room Closed</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Postmortem text={inc.files.postmortem} />
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-4">
              {inc.blastRadius?.length > 0 && (
                <Card>
                  <CardHeader>
                    <span className="text-xs font-semibold uppercase tracking-widest text-neutral-500">Blast Radius</span>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {inc.blastRadius.map((s) => (
                        <span key={s} className="text-xs border border-neutral-700 rounded px-2 py-1 text-neutral-300 font-mono">{s}</span>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {inc.timeline?.length > 0 && (
                <Card>
                  <CardHeader>
                    <span className="text-xs font-semibold uppercase tracking-widest text-neutral-500">Timeline</span>
                  </CardHeader>
                  <CardContent>
                    <ol className="flex flex-col gap-1.5">
                      {inc.timeline.map((step, i) => (
                        <li key={i} className="flex gap-3 items-start">
                          <span className="text-xs text-neutral-700 mt-0.5 w-4 shrink-0 text-right">{i + 1}</span>
                          <span className="text-xs text-neutral-400">{step}</span>
                        </li>
                      ))}
                    </ol>
                  </CardContent>
                </Card>
              )}
            </div>
          </>
        )}

        {/* In-progress: placeholder while agents run */}
        {!isComplete && (
          <div className="border border-dashed border-neutral-800 rounded-lg p-8 text-center">
            <p className="text-xs text-neutral-600">Agents are working — report will appear here when complete.</p>
          </div>
        )}
      </main>
    </div>
  );
}
