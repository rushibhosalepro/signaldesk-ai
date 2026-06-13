import { MultiServerMCPClient } from "@langchain/mcp-adapters";

// Splunk's management port (8089) uses a self-signed cert in local dev.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const MCP_URL = process.env.SPLUNK_MCP_ENDPOINT ?? process.env.SPLUNK_MCP_URL;
const MCP_TOKEN = process.env.SPLUNK_MCP_TOKEN;

if (!MCP_URL || !MCP_TOKEN) {
  throw new Error("Missing SPLUNK_MCP_URL or SPLUNK_MCP_TOKEN");
}

export const mcpClient = new MultiServerMCPClient({
  splunk: {
    transport: "http",
    url: MCP_URL,
    headers: {
      Authorization: `Bearer ${MCP_TOKEN}`,
    },
  },
});

export async function getSplunkTools() {
  return await mcpClient.getTools();
}
