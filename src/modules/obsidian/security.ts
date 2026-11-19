import path from "node:path";

export class SecurityError extends Error {
  constructor(message: string) {
    super(`[Security Sandbox Violation] ${message}`);
    this.name = "SecurityError";
  }
}

/**
 * Validates that the requested target path resides strictly within the vault root directory.
 * Throws a SecurityError if path traversal or out-of-boundary access is detected.
 */
export function assertSafeVaultPath(vaultRoot: string, relativeOrSubPath: string): string {
  if (!vaultRoot) {
    throw new SecurityError("Vault root path is not defined.");
  }

  // Reject null bytes
  if (relativeOrSubPath.includes("\0")) {
    throw new SecurityError("Invalid path containing null bytes.");
  }

  const normalizedVaultRoot = path.resolve(vaultRoot);
  const resolvedTarget = path.resolve(normalizedVaultRoot, relativeOrSubPath);

  // Must equal vaultRoot or start with vaultRoot + separator
  const rootWithSep = normalizedVaultRoot.endsWith(path.sep)
    ? normalizedVaultRoot
    : normalizedVaultRoot + path.sep;

  const isInside =
    resolvedTarget === normalizedVaultRoot || resolvedTarget.startsWith(rootWithSep);

  if (!isInside) {
    throw new SecurityError(
      `Access denied: path '${relativeOrSubPath}' resolves outside the allowed Obsidian vault boundary.`
    );
  }

  return resolvedTarget;
}
