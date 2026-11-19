import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import os from "node:os";
import { assertSafeVaultPath, SecurityError } from "../src/modules/obsidian/security.js";

describe("Security Jail: assertSafeVaultPath", () => {
  const mockVaultRoot = path.resolve(os.tmpdir(), "mock-obsidian-vault");

  it("should allow valid relative paths inside the vault", () => {
    const safePath = "01 - Projets/Repo-Doctor.md";
    const resolved = assertSafeVaultPath(mockVaultRoot, safePath);
    assert.equal(resolved, path.join(mockVaultRoot, safePath));
  });

  it("should allow nested subfolder paths inside the vault", () => {
    const safePath = "03 - Vie Perso/Journal de Bilan.md";
    const resolved = assertSafeVaultPath(mockVaultRoot, safePath);
    assert.equal(resolved, path.join(mockVaultRoot, safePath));
  });

  it("should reject parent directory traversal attacks (../)", () => {
    const maliciousPath = "../../Windows/System32/cmd.exe";
    assert.throws(() => {
      assertSafeVaultPath(mockVaultRoot, maliciousPath);
    }, SecurityError);
  });

  it("should reject deep traversal attempts inside subdirectories", () => {
    const maliciousPath = "01 - Projets/../../Desktop/secret.txt";
    assert.throws(() => {
      assertSafeVaultPath(mockVaultRoot, maliciousPath);
    }, SecurityError);
  });

  it("should reject paths containing null bytes", () => {
    const maliciousPath = "01 - Projets/test.md\0.exe";
    assert.throws(() => {
      assertSafeVaultPath(mockVaultRoot, maliciousPath);
    }, SecurityError);
  });
});
