import { tool } from "@langchain/core/tools";
import { z } from "zod";
import * as fs from "fs/promises";
import * as path from "path";

// Placed outside backend/ so bun --watch doesn't restart on every .md write
const INCIDENTS_ROOT = path.resolve(process.cwd(), "..", "incidents");

export async function createIncidentDir(label: string): Promise<string> {
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .slice(0, 40);
  const dir = path.join(INCIDENTS_ROOT, `${ts}_${slug}`);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export function makeFileTools(incidentDir: string) {
  const writeFindings = tool(
    async ({ filename, content }) => {
      const filePath = path.join(incidentDir, filename);
      await fs.writeFile(filePath, content, "utf-8");
      return `Written ${content.length} chars to ${filePath}`;
    },
    {
      name: "write_findings",
      description:
        "Write raw findings or a report section to a markdown file inside the incident directory. Use this to persist every significant finding.",
      schema: z.object({
        filename: z.string().describe("Filename, e.g. triage.md or investigation.md"),
        content: z.string().describe("Full markdown content to write (overwrites if exists)"),
      }),
    },
  );

  const readFindings = tool(
    async ({ filename }) => {
      const filePath = path.join(incidentDir, filename);
      try {
        return await fs.readFile(filePath, "utf-8");
      } catch {
        return `[file not found: ${filename}]`;
      }
    },
    {
      name: "read_findings",
      description:
        "Read a previously written findings file from the incident directory. Use this to review earlier agents' notes.",
      schema: z.object({
        filename: z.string().describe("Filename to read, e.g. triage.md"),
      }),
    },
  );

  const listFindings = tool(
    async () => {
      try {
        const files = await fs.readdir(incidentDir);
        return files.length ? files.join("\n") : "(no files yet)";
      } catch {
        return "(incident directory not found)";
      }
    },
    {
      name: "list_findings",
      description: "List all files written so far in the incident directory.",
      schema: z.object({}),
    },
  );

  return [writeFindings, readFindings, listFindings];
}

/** Extract the last valid JSON object from an LLM response using bracket-depth matching. */
export function extractLastJson(text: string): Record<string, unknown> | null {
  let last: Record<string, unknown> | null = null;

  for (let i = 0; i < text.length; i++) {
    if (text[i] !== "{") continue;
    let depth = 0;
    let inStr = false;
    let esc = false;
    let j = i;

    for (; j < text.length; j++) {
      const c = text[j];
      if (esc) { esc = false; continue; }
      if (c === "\\" && inStr) { esc = true; continue; }
      if (c === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (c === "{") depth++;
      else if (c === "}") { depth--; if (depth === 0) break; }
    }

    if (depth === 0) {
      try {
        const obj = JSON.parse(text.slice(i, j + 1));
        if (obj && typeof obj === "object" && !Array.isArray(obj)) last = obj;
        i = j; // skip past this match so nested objects don't re-register
      } catch {}
    }
  }

  return last;
}
