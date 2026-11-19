import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ObsidianService } from "./service.js";
import { CONFIG } from "../../config.js";

export function registerObsidianTools(server: McpServer, service: ObsidianService) {
  // 1. obsidian_search_notes
  server.tool(
    "obsidian_search_notes",
    "Recherche ciblée et filtrée à travers les notes du coffre Obsidian de Noa",
    {
      query: z.string().optional().describe("Terme textuel à rechercher dans le titre, tags ou contenu"),
      tag: z.string().optional().describe("Tag sans le dièse (ex: 'projet', 'golang', 'vuejs')"),
      pole: z.enum(CONFIG.POLES).optional().describe("Pôle thématique spécifique pour restreindre la recherche"),
      limit: z.number().int().min(1).max(25).default(10).describe("Nombre maximum de résultats"),
    },
    async (args) => {
      try {
        const results = await service.searchNotes(args);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ count: results.length, results }, null, 2),
            },
          ],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Erreur lors de la recherche : ${err.message}` }],
        };
      }
    }
  );

  // 2. obsidian_read_note
  server.tool(
    "obsidian_read_note",
    "Lit et extrait le contenu complet d'une note Obsidian avec séparation du frontmatter YAML",
    {
      relative_path: z.string().describe("Chemin relatif depuis la racine du coffre (ex: '01 - Projets/Repo-Doctor.md')"),
    },
    async (args) => {
      try {
        const doc = await service.readNote(args.relative_path);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  title: doc.title,
                  relativePath: doc.relativePath,
                  frontmatter: doc.frontmatter,
                  content: doc.content,
                  modifiedAt: doc.modifiedAt,
                  sizeBytes: doc.sizeBytes,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Erreur de lecture de note : ${err.message}` }],
        };
      }
    }
  );

  // 3. obsidian_append_journal
  server.tool(
    "obsidian_append_journal",
    "Insère une entrée quotidienne structurée dans 03 - Vie Perso/Journal de Bilan.md en tête de l'historique",
    {
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Date au format YYYY-MM-DD"),
      subtitle: z.string().describe("Sous-titre (ex: 'Bilan Quotidien', 'Session Code & Musculation')"),
      success_bullets: z.array(z.string()).min(1).describe("Liste des points 'Ce qui a marché'"),
      improvements_bullets: z.array(z.string()).optional().describe("Liste des points 'Ce qui n'a pas marché & Pourquoi'"),
      priorities_bullets: z.array(z.string()).optional().describe("Liste des points 'Priorités fixées pour demain'"),
    },
    async (args) => {
      try {
        const res = await service.appendJournal({
          date: args.date,
          subtitle: args.subtitle,
          successBullets: args.success_bullets,
          improvementsBullets: args.improvements_bullets,
          prioritiesBullets: args.priorities_bullets,
        });
        return {
          content: [
            {
              type: "text",
              text: `Entrée de bilan ajoutée avec succès pour le ${args.date} dans ${res.filePath}`,
            },
          ],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Erreur d'insertion dans le journal : ${err.message}` }],
        };
      }
    }
  );

  // 4. obsidian_add_backlog_task
  server.tool(
    "obsidian_add_backlog_task",
    "Ajoute une action à cocher dans 03 - Vie Perso/Backlog.md sous le niveau de priorité et le domaine choisis",
    {
      priority: z.enum(["P1", "P2", "P3"]).describe("Niveau de priorité (P1: Immédiat, P2: Important, P3: Fond)"),
      domain: z
        .enum([
          "🎓 Études, BUT 3 & Stage",
          "🚀 Projets Dev & Portfolio",
          "🏋️ Sport & Santé",
          "🏠 Logistique, Quotidien & Paperasse",
        ])
        .describe("Compartiment de vie cible"),
      task: z.string().describe("Description de la tâche concrète à accomplir"),
    },
    async (args) => {
      try {
        const res = await service.addBacklogTask({
          priority: args.priority,
          domain: args.domain,
          task: args.task,
        });
        return {
          content: [
            {
              type: "text",
              text: `Tâche [${args.priority}] ajoutée dans ${args.domain} (${res.filePath})`,
            },
          ],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Erreur d'ajout au backlog : ${err.message}` }],
        };
      }
    }
  );

  // 5. obsidian_get_moc
  server.tool(
    "obsidian_get_moc",
    "Extrait les notes interconnectées depuis l'un des 7 Hubs/MOCs du coffre",
    {
      moc: z.enum(CONFIG.MOCS).describe("Nom du MOC central à consulter (ex: 'Index-Projets', 'Index-Stack')"),
    },
    async (args) => {
      try {
        const moc = await service.getMoc(args.moc);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(moc, null, 2),
            },
          ],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Erreur de consultation MOC : ${err.message}` }],
        };
      }
    }
  );
}
