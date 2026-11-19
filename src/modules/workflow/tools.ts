import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { scanPrivacyGuard } from "./privacy.js";
import { cleanupMergedBranches } from "./gitbranches.js";
import { getDashboardContext } from "./dashboard.js";

export function registerWorkflowTools(server: McpServer) {
  // 1. privacy_guard_scan
  server.tool(
    "privacy_guard_scan",
    "Garde-fou impitoyable de confidentialité (règle poucave-pas-tout) : audite un dépôt Git ou dossier pour détecter toute fuite de chemin machine utilisateur, numéro de téléphone, secrets ou fichiers sensibles avant commit/push",
    {
      repo_path: z
        .string()
        .optional()
        .describe("Chemin local du dépôt à scanner (défaut : répertoire courant)"),
      staged_only: z
        .boolean()
        .default(false)
        .describe("Si true, analyse uniquement les fichiers indexés pour commit (git diff --cached)"),
    },
    async (args) => {
      try {
        const result = scanPrivacyGuard(args.repo_path, args.staged_only);
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
          content: [{ type: "text", text: `Erreur d'audit de confidentialité : ${err.message}` }],
        };
      }
    }
  );

  // 2. git_cleanup_branches
  server.tool(
    "git_cleanup_branches",
    "Nettoie et supprime de façon sécurisée les branches locales déjà mergées dans master/main (protège les branches actives et principales, dry_run=true par défaut)",
    {
      repo_path: z.string().describe("Chemin du dépôt Git"),
      dry_run: z
        .boolean()
        .default(true)
        .describe("Si true (défaut), prévisualise les branches supprimables sans les effacer"),
      base_branch: z
        .string()
        .optional()
        .describe("Branche de référence de merge ('master' ou 'main'). Détectée automatiquement si omise"),
    },
    async (args) => {
      try {
        const result = cleanupMergedBranches(args.repo_path, args.dry_run, args.base_branch);
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
          content: [{ type: "text", text: `Erreur lors du nettoyage des branches : ${err.message}` }],
        };
      }
    }
  );

  // 3. dashboard_get_briefing
  server.tool(
    "dashboard_get_briefing",
    "Récupère le briefing matinal, les 3 priorités du jour consignées dans bilan_tasks.json et vérifie si le serveur Dashboard local (port 5050) est actif",
    {
      custom_dir: z
        .string()
        .optional()
        .describe("Chemin personnalisé vers le dossier Dashboard (optionnel)"),
    },
    async (args) => {
      try {
        const result = await getDashboardContext(args.custom_dir);
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
          content: [{ type: "text", text: `Erreur de récupération du Dashboard : ${err.message}` }],
        };
      }
    }
  );
}
