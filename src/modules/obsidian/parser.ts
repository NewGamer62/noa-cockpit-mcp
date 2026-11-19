import matter from "gray-matter";
import type { NoteDocument, NoteMetadata, JournalEntryInput, BacklogTaskInput } from "./types.js";

/**
 * Parses markdown file content and extracts YAML frontmatter, title, and body.
 */
export function parseNoteContent(rawContent: string, relPath: string, absPath: string, stat: { mtime: Date; size: number }): NoteDocument {
  const parsed = matter(rawContent);
  const data = (parsed.data || {}) as NoteMetadata;

  // Derive title: frontmatter title -> first H1 -> filename without .md
  let title = data.title;
  if (!title) {
    const h1Match = parsed.content.match(/^#\s+(.+)$/m);
    if (h1Match) {
      title = h1Match[1].replace(/^[^\w\s]+/, "").trim(); // Strip leading emojis if any
    } else {
      const base = relPath.split(/[/\\]/).pop() || relPath;
      title = base.replace(/\.md$/i, "");
    }
  }

  return {
    relativePath: relPath.replace(/\\/g, "/"),
    absolutePath: absPath,
    title,
    frontmatter: data,
    content: parsed.content,
    modifiedAt: stat.mtime,
    sizeBytes: stat.size,
  };
}

/**
 * Inserts a new journal entry at the top of the chronological history in Journal de Bilan.md.
 */
export function insertJournalEntry(currentContent: string, entry: JournalEntryInput): string {
  const markerComment = "<!-- Les entrées quotidiennes et hebdomadaires sont consignées ci-dessous par ordre antéchronologique (les plus récentes en haut). -->";
  const headerMarker = "## 📝 Historique des Bilans";

  let insertIndex = -1;
  const commentIdx = currentContent.indexOf(markerComment);
  if (commentIdx !== -1) {
    insertIndex = commentIdx + markerComment.length;
  } else {
    const headerIdx = currentContent.indexOf(headerMarker);
    if (headerIdx !== -1) {
      insertIndex = headerIdx + headerMarker.length;
    }
  }

  if (insertIndex === -1) {
    throw new Error("Impossible de localiser la section 'Historique des Bilans' dans Journal de Bilan.md.");
  }

  // Format new block
  let block = `\n\n### ${entry.date} — ${entry.subtitle}\n`;
  block += "- **Ce qui a marché :**\n";
  for (const b of entry.successBullets) {
    block += `  - ${b}\n`;
  }

  if (entry.improvementsBullets && entry.improvementsBullets.length > 0) {
    block += "- **Ce qui n'a pas marché & Pourquoi :**\n";
    for (const b of entry.improvementsBullets) {
      block += `  - ${b}\n`;
    }
  }

  if (entry.prioritiesBullets && entry.prioritiesBullets.length > 0) {
    block += "- **Priorité fixée pour demain :**\n";
    for (const b of entry.prioritiesBullets) {
      block += `  - ${b}\n`;
    }
  }

  return currentContent.slice(0, insertIndex) + block + currentContent.slice(insertIndex);
}

/**
 * Inserts a new task item under the specified priority and domain in Backlog.md.
 */
export function insertBacklogTask(currentContent: string, input: BacklogTaskInput): string {
  // Find priority section
  const priorityPatterns: Record<string, RegExp> = {
    P1: /##\s+🔴\s+P1\s+—/i,
    P2: /##\s+🟡\s+P2\s+—/i,
    P3: /##\s+🟢\s+P3\s+—/i,
  };

  const priorityRegex = priorityPatterns[input.priority];
  const priorityMatch = currentContent.match(priorityRegex);
  if (!priorityMatch || priorityMatch.index === undefined) {
    throw new Error(`Section de priorité '${input.priority}' introuvable dans Backlog.md.`);
  }

  const priorityStart = priorityMatch.index;

  // Find next section boundary (## ...) to scope domain search
  const nextSectionMatch = currentContent.slice(priorityStart + 5).search(/\n##\s+/);
  const priorityEnd = nextSectionMatch === -1 ? currentContent.length : priorityStart + 5 + nextSectionMatch;

  const prioritySlice = currentContent.slice(priorityStart, priorityEnd);

  // Clean domain string for regex matching
  const domainEscaped = input.domain.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const domainRegex = new RegExp(`(###\\s+${domainEscaped}[^\\n]*\\n)`, "i");
  const domainMatch = prioritySlice.match(domainRegex);

  const taskLine = `- [ ] ${input.task}\n`;

  if (domainMatch && domainMatch.index !== undefined) {
    // Insert directly under the domain heading
    const insertPoint = priorityStart + domainMatch.index + domainMatch[0].length;
    return currentContent.slice(0, insertPoint) + taskLine + currentContent.slice(insertPoint);
  } else {
    // Domain heading not found in this priority section, append new domain subsection
    const newDomainBlock = `\n### ${input.domain}\n${taskLine}`;
    const insertPoint = priorityEnd;
    return currentContent.slice(0, insertPoint) + newDomainBlock + currentContent.slice(insertPoint);
  }
}

/**
 * Extracts all unique [[WikiLink]] targets from MOC content.
 */
export function parseMocLinks(content: string): string[] {
  const wikiLinkRegex = /\[\[([^[\]|]+)(?:\|[^[\]]+)?\]\]/g;
  const links = new Set<string>();
  let match: RegExpExecArray | null;

  while ((match = wikiLinkRegex.exec(content)) !== null) {
    const target = match[1].trim();
    if (target && target !== "Accueil") {
      links.add(target);
    }
  }

  return Array.from(links);
}
