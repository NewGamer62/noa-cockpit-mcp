import fs from "node:fs";
import path from "node:path";
import { CONFIG, type Pole, type MocName } from "../../config.js";
import { assertSafeVaultPath } from "./security.js";
import { parseNoteContent, insertJournalEntry, insertBacklogTask, parseMocLinks } from "./parser.js";
import type {
  NoteDocument,
  NoteSearchResult,
  JournalEntryInput,
  BacklogTaskInput,
  MocDetail,
} from "./types.js";

export class ObsidianService {
  constructor(private vaultRoot: string = CONFIG.VAULT_ROOT) {}

  /**
   * Searches notes across the vault with optional filters (query text, tag, specific pole).
   */
  async searchNotes(options: {
    query?: string;
    tag?: string;
    pole?: Pole;
    limit?: number;
  }): Promise<NoteSearchResult[]> {
    const limit = options.limit || 10;
    const queryLower = options.query?.toLowerCase();
    const tagLower = options.tag?.toLowerCase().replace(/^#/, "");

    const searchDir = options.pole
      ? assertSafeVaultPath(this.vaultRoot, options.pole)
      : this.vaultRoot;

    const files = this.collectMarkdownFiles(searchDir);
    const results: NoteSearchResult[] = [];

    for (const absPath of files) {
      const relPath = path.relative(this.vaultRoot, absPath).replace(/\\/g, "/");
      const stat = fs.statSync(absPath);
      const content = fs.readFileSync(absPath, "utf-8");
      const doc = parseNoteContent(content, relPath, absPath, stat);

      // Filter by tag if requested
      if (tagLower) {
        const docTags = (doc.frontmatter.tags || []).map((t) => String(t).toLowerCase());
        if (!docTags.includes(tagLower)) {
          continue;
        }
      }

      // Filter by query string if requested
      if (queryLower) {
        const titleMatch = doc.title.toLowerCase().includes(queryLower);
        const contentMatch = doc.content.toLowerCase().includes(queryLower);
        const tagMatch = (doc.frontmatter.tags || []).some((t) =>
          String(t).toLowerCase().includes(queryLower)
        );

        if (!titleMatch && !contentMatch && !tagMatch) {
          continue;
        }
      }

      // Determine pole from path
      const segments = relPath.split("/");
      const pole = CONFIG.POLES.find((p) => p === segments[0]);

      // Extract brief snippet if query was in content
      let snippet: string | undefined;
      if (queryLower) {
        const idx = doc.content.toLowerCase().indexOf(queryLower);
        if (idx !== -1) {
          const start = Math.max(0, idx - 40);
          const end = Math.min(doc.content.length, idx + queryLower.length + 40);
          snippet = "..." + doc.content.slice(start, end).replace(/\r?\n/g, " ") + "...";
        }
      }

      results.push({
        title: doc.title,
        relativePath: relPath,
        pole,
        tags: (doc.frontmatter.tags || []).map(String),
        status: doc.frontmatter.status ? String(doc.frontmatter.status) : undefined,
        snippet,
      });

      if (results.length >= limit) {
        break;
      }
    }

    return results;
  }

  /**
   * Reads and parses a single note document.
   */
  async readNote(relPath: string): Promise<NoteDocument> {
    const absPath = assertSafeVaultPath(this.vaultRoot, relPath);
    if (!fs.existsSync(absPath)) {
      throw new Error(`Note introuvable : '${relPath}'`);
    }

    const stat = fs.statSync(absPath);
    if (stat.isDirectory()) {
      throw new Error(`Le chemin '${relPath}' pointe vers un dossier, pas un fichier.`);
    }

    const content = fs.readFileSync(absPath, "utf-8");
    return parseNoteContent(content, relPath, absPath, stat);
  }

  /**
   * Inserts an entry into Journal de Bilan.md.
   */
  async appendJournal(entry: JournalEntryInput): Promise<{ success: boolean; filePath: string }> {
    const absPath = assertSafeVaultPath(this.vaultRoot, CONFIG.JOURNAL_FILE);
    if (!fs.existsSync(absPath)) {
      throw new Error(`Fichier Journal introuvable : ${CONFIG.JOURNAL_FILE}`);
    }

    const current = fs.readFileSync(absPath, "utf-8");
    const updated = insertJournalEntry(current, entry);
    fs.writeFileSync(absPath, updated, "utf-8");

    return { success: true, filePath: CONFIG.JOURNAL_FILE };
  }

  /**
   * Appends a task to Backlog.md under the specified priority and domain.
   */
  async addBacklogTask(input: BacklogTaskInput): Promise<{ success: boolean; filePath: string }> {
    const absPath = assertSafeVaultPath(this.vaultRoot, CONFIG.BACKLOG_FILE);
    if (!fs.existsSync(absPath)) {
      throw new Error(`Fichier Backlog introuvable : ${CONFIG.BACKLOG_FILE}`);
    }

    const current = fs.readFileSync(absPath, "utf-8");
    const updated = insertBacklogTask(current, input);
    fs.writeFileSync(absPath, updated, "utf-8");

    return { success: true, filePath: CONFIG.BACKLOG_FILE };
  }

  /**
   * Retrieves links and structure from an Index / MOC note.
   */
  async getMoc(mocName: MocName): Promise<MocDetail> {
    const fileName = `${mocName}.md`;
    const files = this.collectMarkdownFiles(this.vaultRoot);
    const mocFile = files.find((f) => path.basename(f).toLowerCase() === fileName.toLowerCase());

    if (!mocFile) {
      throw new Error(`MOC '${mocName}' introuvable dans le coffre.`);
    }

    const relPath = path.relative(this.vaultRoot, mocFile).replace(/\\/g, "/");
    const content = fs.readFileSync(mocFile, "utf-8");
    const stat = fs.statSync(mocFile);
    const doc = parseNoteContent(content, relPath, mocFile, stat);
    const linkedNotes = parseMocLinks(content);

    return {
      name: mocName,
      relativePath: relPath,
      title: doc.title,
      linkedNotes,
    };
  }

  /**
   * Recursively gathers markdown files, skipping .git and .obsidian.
   */
  private collectMarkdownFiles(dir: string): string[] {
    const results: string[] = [];
    if (!fs.existsSync(dir)) {
      return results;
    }

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      if (e.name.startsWith(".") || e.name === "node_modules") {
        continue;
      }
      const fullPath = path.join(dir, e.name);
      if (e.isDirectory()) {
        results.push(...this.collectMarkdownFiles(fullPath));
      } else if (e.isFile() && e.name.toLowerCase().endsWith(".md")) {
        results.push(fullPath);
      }
    }
    return results;
  }
}
