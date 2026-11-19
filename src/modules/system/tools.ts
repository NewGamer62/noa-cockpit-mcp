import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { inspectPort, freePort } from "./ports.js";
import { runGitHealthAudit } from "./repodoctor.js";

export function registerSystemTools(server: McpServer) {
  // 1. system_inspect_port
  server.tool(
    "system_inspect_port",
    "Inspecte quel processus (PID et nom) écoute sur un port TCP local donné",
    {
      port: z.number().int().min(1).max(65535).describe("Numéro du port TCP à inspecter (ex: 3000, 5000, 8080)"),
    },
    async (args) => {
      try {
        const result = await inspectPort(args.port);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Erreur d'inspection du port ${args.port} : ${err.message}` }],
        };
      }
    }
  );

  // 2. system_free_port
  server.tool(
    "system_free_port",
    "Arrête proprement le processus bloquant un port TCP local (avec garde-fou de sécurité protégeant les processus système vitaux)",
    {
      port: z.number().int().min(1).max(65535).describe("Numéro du port TCP à libérer"),
      force: z.boolean().default(false).describe("Si true, force l'arrêt immédiat (/F)"),
    },
    async (args) => {
      try {
        const result = await freePort(args.port, args.force);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Impossible de libérer le port ${args.port} : ${err.message}` }],
        };
      }
    }
  );

  // 3. git_health_audit
  server.tool(
    "git_health_audit",
    "Déclenche un audit de santé et d'hygiène complet d'un dépôt Git local via repo-doctor (score 0-100, grade, piliers et remédiations)",
    {
      repo_path: z.string().describe("Chemin local du dépôt Git à auditer"),
      min_score: z.number().int().min(0).max(100).default(80).describe("Score de passage minimal requis (défaut : 80)"),
    },
    async (args) => {
      try {
        const report = await runGitHealthAudit(args.repo_path, args.min_score);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(report, null, 2),
            },
          ],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Erreur d'audit du dépôt : ${err.message}` }],
        };
      }
    }
  );
}
