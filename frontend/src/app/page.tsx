import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { IncidentPoller } from "@/components/IncidentPoller";
import type { Incident } from "@/lib/types";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function getIncidents(): Promise<Incident[]> {
  try {
    const res = await fetch(`${API}/api/incidents`, { cache: "no-store" });
    return res.ok ? res.json() : [];
  } catch {
    return [];
  }
}

function sevVariant(sev: string): "sev1" | "sev2" | "sev3" | "outline" {
  if (sev === "SEV-1") return "sev1";
  if (sev === "SEV-2") return "sev2";
  if (sev === "SEV-3") return "sev3";
  return "outline";
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default async function HomePage() {
  const incidents = await getIncidents();

  return (
    <div className="min-h-screen bg-neutral-950">
      <IncidentPoller />
      <header className="border-b border-neutral-800 px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-white" />
          <span className="text-sm font-semibold tracking-tight text-white">SignalDesk AI</span>
        </div>
        <span className="text-xs text-neutral-500">Incident War Room</span>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-white">Incidents</h1>
          <p className="text-sm text-neutral-500 mt-1">
            {incidents.length === 0
              ? "No completed incidents yet."
              : `${incidents.length} incident${incidents.length !== 1 ? "s" : ""} processed`}
          </p>
        </div>

        {incidents.length === 0 ? (
          <div className="border border-dashed border-neutral-800 rounded-lg p-12 text-center">
            <p className="text-neutral-500 text-sm">Fire a webhook to start the war room.</p>
            <code className="block mt-3 text-xs bg-neutral-900 border border-neutral-800 rounded px-3 py-2 text-neutral-400 w-fit mx-auto">
              POST /webhook
            </code>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {incidents.map((inc) => (
              <Link key={inc.id} href={`/incidents/${inc.id}`}>
                <Card className="hover:border-neutral-600 transition-colors cursor-pointer">
                  <CardContent className="flex items-start justify-between gap-4 py-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={sevVariant(inc.severity)}>{inc.severity}</Badge>
                        <span className="text-xs text-neutral-500">
                          {timeAgo(inc.alert.receivedAt)}
                        </span>
                        {inc.status === "in_progress" && (
                          <span className="text-xs text-yellow-500 animate-pulse font-mono">● live</span>
                        )}
                        {inc.verdict?.peerReviewed && (
                          <span className="text-xs text-neutral-600">· peer-reviewed</span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-white truncate">{inc.alert.searchName}</p>
                      {inc.verdict?.rootCause && (
                        <p className="text-xs text-neutral-400 mt-1 line-clamp-2">
                          {inc.verdict.rootCause}
                        </p>
                      )}
                      {inc.blastRadius?.length > 0 && (
                        <div className="flex gap-1 mt-2 flex-wrap">
                          {inc.blastRadius.map((s) => (
                            <span
                              key={s}
                              className="text-xs border border-neutral-700 rounded px-1.5 py-0.5 text-neutral-400 font-mono"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <span className="text-neutral-600 text-lg mt-1">›</span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
