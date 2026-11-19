import type { Pole, MocName } from "../../config.js";

export interface NoteMetadata {
  title?: string;
  date?: string;
  tags?: string[];
  status?: string;
  [key: string]: unknown;
}

export interface NoteDocument {
  relativePath: string;
  absolutePath: string;
  title: string;
  frontmatter: NoteMetadata;
  content: string;
  modifiedAt: Date;
  sizeBytes: number;
}

export interface NoteSearchResult {
  title: string;
  relativePath: string;
  pole?: Pole;
  tags: string[];
  status?: string;
  snippet?: string;
}

export interface JournalEntryInput {
  date: string; // YYYY-MM-DD
  subtitle: string;
  successBullets: string[];
  improvementsBullets?: string[];
  prioritiesBullets?: string[];
}

export type BacklogPriority = "P1" | "P2" | "P3";

export type BacklogDomain =
  | "🎓 Études, BUT 3 & Stage"
  | "🚀 Projets Dev & Portfolio"
  | "🏋️ Sport & Santé"
  | "🏠 Logistique, Quotidien & Paperasse";

export interface BacklogTaskInput {
  priority: BacklogPriority;
  domain: BacklogDomain;
  task: string;
}

export interface MocDetail {
  name: MocName;
  relativePath: string;
  title: string;
  linkedNotes: string[];
}
