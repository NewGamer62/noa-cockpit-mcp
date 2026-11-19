import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isProtectedProcess, inspectPort, freePort } from "../src/modules/system/ports.js";
import { resolveRepoDoctorBinary, runGitHealthAudit } from "../src/modules/system/repodoctor.js";

describe("System & Dev Module Tests", () => {
  describe("Process Protection Guard", () => {
    it("should identify critical system PIDs as protected", () => {
      assert.equal(isProtectedProcess(0), true);
      assert.equal(isProtectedProcess(4), true);
    });

    it("should identify protected Windows services by name", () => {
      assert.equal(isProtectedProcess(999, "svchost.exe"), true);
      assert.equal(isProtectedProcess(999, "explorer.exe"), true);
      assert.equal(isProtectedProcess(999, "csrss.exe"), true);
      assert.equal(isProtectedProcess(999, "services.exe"), true);
    });

    it("should allow developer processes to be managed", () => {
      assert.equal(isProtectedProcess(12345, "node.exe"), false);
      assert.equal(isProtectedProcess(12346, "python.exe"), false);
      assert.equal(isProtectedProcess(12347, "vite.exe"), false);
      assert.equal(isProtectedProcess(12348, "repo-doctor.exe"), false);
    });
  });

  describe("Port Inspection & Safety", () => {
    it("should reject invalid port numbers", async () => {
      await assert.rejects(async () => {
        await inspectPort(0);
      });
      await assert.rejects(async () => {
        await inspectPort(70000);
      });
    });

    it("should report an unused high port as not occupied", async () => {
      const res = await inspectPort(59876);
      assert.equal(res.port, 59876);
      assert.equal(res.occupied, false);
    });

    it("should report freePort as already free if port is not in use", async () => {
      const res = await freePort(59877);
      assert.equal(res.port, 59877);
      assert.equal(res.freed, true);
      assert.ok(res.message.includes("déjà libre"));
    });
  });

  describe("Repo-Doctor Bridge", () => {
    it("should resolve the repo-doctor binary on the system", () => {
      const bin = resolveRepoDoctorBinary();
      assert.ok(bin.length > 0);
    });

    it("should fail gracefully when targeting a non-existent directory", async () => {
      await assert.rejects(async () => {
        await runGitHealthAudit("C:\\non_existent_repo_dir_12345");
      });
    });

    it("should execute audit and return typed health score on current repo", async () => {
      const report = await runGitHealthAudit(".", 80);
      assert.ok(typeof report.overall_score === "number");
      assert.ok(report.overall_score >= 0 && report.overall_score <= 100);
      assert.ok(report.grade.length > 0);
      assert.ok(typeof report.passed === "boolean");
      assert.ok(report.pillars["Security & Secrets"] !== undefined);
      assert.ok(report.pillars["Tree & Stash"] !== undefined);
    });
  });
});
