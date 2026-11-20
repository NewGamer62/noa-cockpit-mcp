import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import type { PrivacyViolation, PrivacyScanResult } from './types.js';

const FORBIDDEN_FILE_PATTERNS = [
  /^\.env(?:\..+)?$/i,
  /^credentials.*\.json$/i,
  /^token.*\.json$/i,
  /^workouts\.json$/i,
  /^body_measurements\.json$/i,
  /\.(?:pem|key|pkcs12|pfx)$/i,
  /^id_rsa$/i,
];

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  '.nuxt',
  'coverage',
  '.cache',
]);

const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.webp',
  '.mp4', '.mp3', '.pdf', '.exe', '.dll', '.zip', '.tar', '.gz',
  '.woff', '.woff2', '.ttf', '.eot',
]);

const PLACEHOLDER_REGEX = /(?:your_|votre_|example|placeholder|dummy|fake|sample|xxxx)/i;

const PII_RULES = [
  {
    rule: 'pii_user_path' as const,
    severity: 'BLOCKER' as const,
    message: 'Chemin machine absolu exposant le profil utilisateur détecté (violation poucave-pas-tout)',
    regex: /(?:[A-Za-z]:)?(?:\\+|\/+)Users(?:\\+|\/+)noaga\b/i,
  },
  {
    rule: 'pii_phone' as const,
    severity: 'BLOCKER' as const,
    message: 'Numéro de téléphone personnel détecté',
    regex: /(?:(?:\+|00)33|0)\s*7[\s.-]*71[\s.-]*16[\s.-]*11[\s.-]*96/i,
  },
  {
    rule: 'secret_token' as const,
    severity: 'BLOCKER' as const,
    message: 'Clé API AWS détectée',
    regex: /\bAKIA[0-9A-Z]{16}\b/,
  },
  {
    rule: 'secret_token' as const,
    severity: 'BLOCKER' as const,
    message: 'Token personnel GitHub (PAT) détecté',
    regex: /\bgh[pousr]_[A-Za-z0-9_]{36,255}\b/,
  },
  {
    rule: 'secret_token' as const,
    severity: 'BLOCKER' as const,
    message: 'Clé API Google / Gemini détectée',
    regex: /\bAIza[0-9A-Za-z\-_]{35}\b/,
  },
  {
    rule: 'secret_token' as const,
    severity: 'BLOCKER' as const,
    message: 'Clé privée RSA / SSH non chiffrée détectée',
    regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  },
];

export function scanPrivacyGuard(
  repoPath: string = process.cwd(),
  stagedOnly: boolean = false
): PrivacyScanResult {
  const resolvedPath = path.resolve(repoPath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Dossier introuvable : ${resolvedPath}`);
  }

  const violations: PrivacyViolation[] = [];
  const filesToScan: string[] = [];

  const isGitRepo = fs.existsSync(path.join(resolvedPath, '.git'));

  if (isGitRepo) {
    try {
      if (stagedOnly) {
        const out = execSync('git diff --cached --name-only', {
          cwd: resolvedPath,
          encoding: 'utf-8',
          stdio: ['ignore', 'pipe', 'ignore'],
        });
        const lines = out.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
        filesToScan.push(...lines);
      } else {
        const tracked = execSync('git ls-files', {
          cwd: resolvedPath,
          encoding: 'utf-8',
          stdio: ['ignore', 'pipe', 'ignore'],
        }).split(/\r?\n/).map((s) => s.trim()).filter(Boolean);

        const untracked = execSync('git status --porcelain', {
          cwd: resolvedPath,
          encoding: 'utf-8',
          stdio: ['ignore', 'pipe', 'ignore'],
        }).split(/\r?\n/)
          .map((s) => s.trim())
          .filter((s) => s.startsWith('??'))
          .map((s) => s.substring(2).trim());

        const set = new Set([...tracked, ...untracked]);
        filesToScan.push(...set);
      }
    } catch {
      // Si git échoue, fallback sur parcours de fichiers
      collectFiles(resolvedPath, '', filesToScan);
    }
  } else {
    collectFiles(resolvedPath, '', filesToScan);
  }

  let scannedCount = 0;

  for (const relFile of filesToScan) {
    const fullPath = path.join(resolvedPath, relFile);
    if (!fs.existsSync(fullPath)) continue;

    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) continue;

    const baseName = path.basename(relFile);
    const ext = path.extname(relFile).toLowerCase();

    // 1. Vérification nom de fichier interdit
    const isTemplate = /\.(?:example|sample|template|dist)$/i.test(baseName);
    const isDesignTokens = /tokens\.json$/i.test(baseName) && /(?:design|theme|styles?|tokens)/i.test(relFile);

    if (!isTemplate && !isDesignTokens) {
      for (const pattern of FORBIDDEN_FILE_PATTERNS) {
        if (pattern.test(baseName)) {
          violations.push({
            file: relFile,
            line: 1,
            rule: 'pii_forbidden_file',
            severity: 'BLOCKER',
            message: `Fichier sensible ou dump personnel interdit de commit (${baseName})`,
            snippet: baseName,
          });
          break;
        }
      }
    }

    // 2. Scan du contenu (fichiers texte uniquement)
    if (BINARY_EXTENSIONS.has(ext) || baseName === 'package-lock.json') {
      continue;
    }

    // Ignorer les fichiers de test ou les fixtures de test pour les fausses alertes de secrets
    const isTestFile = /\.(?:test|spec)\.[jt]sx?$/i.test(relFile) || /_test\.go$/i.test(relFile);

    try {
      const content = fs.readFileSync(fullPath, 'utf-8');
      scannedCount++;
      const lines = content.split(/\r?\n/);

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes('poucave-ignore')) continue;

        for (const rule of PII_RULES) {
          if (rule.rule === 'secret_token' && isTestFile) {
            // Ne pas lever d'alerte de faux secret dans les fichiers de test
            continue;
          }

          if (rule.regex.test(line)) {
            // Ignorer les placeholders de documentation
            if (rule.rule === 'secret_token' && PLACEHOLDER_REGEX.test(line)) {
              continue;
            }

            // Pour les chemins utilisateur dans privacy.ts ou ses tests, ne pas s'auto-détecter sur la définition de la regex
            if (rule.rule === 'pii_user_path' && (line.includes('regex:') || line.includes('PII_RULES'))) {
              continue;
            }

            violations.push({
              file: relFile,
              line: i + 1,
              rule: rule.rule,
              severity: rule.severity,
              message: rule.message,
              snippet: line.trim().slice(0, 120),
            });
          }
        }
      }
    } catch {
      // Fichier non lisible en UTF-8 (probablement binaire), ignorer
    }
  }

  return {
    clean: violations.length === 0,
    repo_path: resolvedPath,
    scanned_files_count: scannedCount,
    violations_count: violations.length,
    violations,
  };
}

function collectFiles(baseDir: string, currentRel: string, acc: string[]): void {
  const currentFull = path.join(baseDir, currentRel);
  const entries = fs.readdirSync(currentFull, { withFileTypes: true });

  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name)) continue;

    const relPath = currentRel ? path.join(currentRel, entry.name) : entry.name;
    if (entry.isDirectory()) {
      collectFiles(baseDir, relPath, acc);
    } else {
      acc.push(relPath);
    }
  }
}
