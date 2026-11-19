#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CONFIG } from "./config.js";
import { ObsidianService } from "./modules/obsidian/service.js";
import { registerObsidianTools } from "./modules/obsidian/tools.js";
import { registerSystemTools } from "./modules/system/tools.js";
import { registerWorkflowTools } from "./modules/workflow/tools.js";

async function run() {
  const server = new McpServer({
    name: "noa-cockpit-mcp",
    version: "1.2.0",
  });

  // Module 1: Obsidian Brain (5 tools)
  const obsidianService = new ObsidianService(CONFIG.VAULT_ROOT);
  registerObsidianTools(server, obsidianService);

  // Module 2: System & Dev Tooling (3 tools)
  registerSystemTools(server);

  // Module 3: Workflow, Privacy & Git Hygiene (3 tools)
  registerWorkflowTools(server);

  // Connect via stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Log on stderr to leave stdout strictly reserved for JSON-RPC messages
  console.error(`[noa-cockpit-mcp] Server v1.2.0 running on stdio (Vault: ${CONFIG.VAULT_ROOT})`);
}

run().catch((error) => {
  console.error("[noa-cockpit-mcp] Fatal error starting server:", error);
  process.exit(1);
});
