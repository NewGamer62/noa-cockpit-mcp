import { execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import type { BranchCleanupResult } from './types.js';

const PROTECTED_BRANCHES = new Set(['main', 'master', 'develop', 'dev']);

export function cleanupMergedBranches(
  repoPath: string = process.cwd(),
  dryRun: boolean = true,
  baseBranch?: string
): BranchCleanupResult {
  const resolvedPath = path.resolve(repoPath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Dossier introuvable : ${resolvedPath}`);
  }
  if (!fs.existsSync(path.join(resolvedPath, '.git'))) {
    throw new Error(`Le chemin spécifié n'est pas un dépôt Git valide : ${resolvedPath}`);
  }

  // 1. Détection de la branche de base
  let targetBase = baseBranch;
  if (!targetBase) {
    try {
      const branchesOut = execSync('git branch --list', {
        cwd: resolvedPath,
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      const localBranches = branchesOut
        .split(/\r?\n/)
        .map((b) => b.replace(/^\*?\s+/, '').trim())
        .filter(Boolean);

      if (localBranches.includes('master')) {
        targetBase = 'master';
      } else if (localBranches.includes('main')) {
        targetBase = 'main';
      } else {
        targetBase = localBranches[0] || 'master';
      }
    } catch (e: any) {
      throw new Error(`Impossible de lister les branches Git : ${e.message}`);
    }
  }

  // 2. Détection de la branche active actuelle (HEAD)
  let currentBranch = '';
  try {
    currentBranch = execSync('git rev-parse --abbrev-ref HEAD', {
      cwd: resolvedPath,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    // ignoré si HEAD détaché
  }

  // 3. Récupération des branches mergées dans targetBase
  let mergedOut = '';
  try {
    mergedOut = execSync(`git branch --merged ${targetBase}`, {
      cwd: resolvedPath,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch (e: any) {
    throw new Error(`Erreur lors de la détection des branches mergées dans '${targetBase}' : ${e.message}`);
  }

  const mergedBranches = mergedOut
    .split(/\r?\n/)
    .map((b) => b.replace(/^\*?\s+/, '').trim())
    .filter(Boolean);

  const candidates: string[] = [];
  const skipped: string[] = [];

  for (const branch of mergedBranches) {
    const isProtected = PROTECTED_BRANCHES.has(branch.toLowerCase());
    const isCurrent = branch === currentBranch;

    if (isProtected || isCurrent) {
      skipped.push(branch);
    } else {
      candidates.push(branch);
    }
  }

  // 4. Suppression ou simulation
  const deleted: string[] = [];

  if (dryRun) {
    return {
      dry_run: true,
      base_branch: targetBase,
      deleted_branches: candidates,
      skipped_branches: skipped,
      message: `${candidates.length} branche(s) mergée(s) candidate(s) à la suppression (simulation active, dry_run=true).`,
    };
  }

  for (const candidate of candidates) {
    try {
      // Sécurité absolue : -d (refuse de supprimer si non mergée), jamais de -D
      execSync(`git branch -d ${candidate}`, {
        cwd: resolvedPath,
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      deleted.push(candidate);
    } catch {
      skipped.push(candidate);
    }
  }

  return {
    dry_run: false,
    base_branch: targetBase,
    deleted_branches: deleted,
    skipped_branches: skipped,
    message: `${deleted.length} branche(s) supprimée(s) avec succès dans ${resolvedPath}.`,
  };
}
