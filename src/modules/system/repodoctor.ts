import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import type { RepoDoctorReport } from "./types.js";

const execFileAsync = promisify(execFile);

/**
 * Resolves the location of the compiled repo-doctor binary on the host machine.
 */
export function resolveRepoDoctorBinary(): string {
  if (process.env.REPO_DOCTOR_BIN && fs.existsSync(process.env.REPO_DOCTOR_BIN)) {
    return process.env.REPO_DOCTOR_BIN;
  }

  const standardDesktopPath = path.join(
    os.homedir(),
    "Desktop",
    "GitHub",
    "repo-doctor",
    "repo-doctor.exe"
  );
  if (fs.existsSync(standardDesktopPath)) {
    return standardDesktopPath;
  }

  const scratchPath = path.join(
    os.homedir(),
    ".gemini",
    "antigravity",
    "scratch",
    "repo-doctor",
    "repo-doctor.exe"
  );
  if (fs.existsSync(scratchPath)) {
    return scratchPath;
  }

  return "repo-doctor.exe";
}

/**
 * Executes repo-doctor against the given repository path and returns the structured JSON report.
 */
export async function runGitHealthAudit(
  repoPath: string,
  minScore = 80
): Promise<RepoDoctorReport> {
  const binary = resolveRepoDoctorBinary();
  const resolvedTarget = path.resolve(repoPath);

  if (!fs.existsSync(resolvedTarget)) {
    throw new Error(`Dépôt introuvable : chemin inexistant '${repoPath}'`);
  }

  try {
    const { stdout } = await execFileAsync(binary, [
      "--path",
      resolvedTarget,
      "--json",
      "--min-score",
      String(minScore),
    ]);

    const report = JSON.parse(stdout) as RepoDoctorReport;
    return report;
  } catch (err: any) {
    // If repo-doctor exited with code 1 (failing CI score), it still outputs valid JSON to stdout!
    if (err.stdout) {
      try {
        const report = JSON.parse(err.stdout) as RepoDoctorReport;
        return report;
      } catch {
        // Fall through to general error
      }
    }
    throw new Error(`Échec de l'exécution de repo-doctor : ${err.message}`);
  }
}
