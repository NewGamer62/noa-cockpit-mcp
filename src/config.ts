import path from "node:path";
import os from "node:os";

const defaultVaultPath = path.join(os.homedir(), "Documents", "Obsidian Vault");

export const CONFIG = {
  // Vault root directory (configurable via env var, defaults to standard user documents directory)
  VAULT_ROOT: process.env.OBSIDIAN_VAULT_PATH || defaultVaultPath,

  // Recognized vault poles
  POLES: [
    "01 - Projets",
    "02 - Sport & Santé",
    "03 - Vie Perso",
    "04 - Paperasse",
    "05 - Archives",
    "06 - Stack & Outils",
    "07 - Académique & BUT 3",
  ] as const,

  // Recognized Hubs / MOCs
  MOCS: [
    "Index-Projets",
    "Index-Stack",
    "Index-Perso",
    "Index-Sport",
    "Index-Paperasse",
    "Index-Archives",
    "Index-Academique",
  ] as const,

  // Key system files
  JOURNAL_FILE: path.join("03 - Vie Perso", "Journal de Bilan.md"),
  BACKLOG_FILE: path.join("03 - Vie Perso", "Backlog.md"),
} as const;

export type Pole = (typeof CONFIG.POLES)[number];
export type MocName = (typeof CONFIG.MOCS)[number];
