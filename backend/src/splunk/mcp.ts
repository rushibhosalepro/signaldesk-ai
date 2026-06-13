import { MultiServerMCPClient } from "@langchain/mcp-adapters";

// Splunk's management port (8089) uses a self-signed cert in local dev.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const MCP_URL = process.env.SPLUNK_MCP_ENDPOINT ?? process.env.SPLUNK_MCP_URL;
const MCP_TOKEN = process.env.SPLUNK_MCP_TOKEN;

if (!MCP_URL || !MCP_TOKEN) {
  throw new Error("Missing SPLUNK_MCP_URL or SPLUNK_MCP_TOKEN");
}

const MCP_CONFIG = {
  splunk: {
    transport: "http" as const,
    url: MCP_URL,
    headers: {
      Authorization: `Bearer ${MCP_TOKEN}`,
    },
  },
};

// Returns fresh tool instances on every call so wrapTools() patches in
// eventBus.ts don't chain across agents sharing the same objects.
export async function getSplunkTools() {
  const client = new MultiServerMCPClient(MCP_CONFIG);
  return await client.getTools();
}
