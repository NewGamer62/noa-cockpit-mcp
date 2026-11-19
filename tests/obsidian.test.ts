import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { ObsidianService } from "../src/modules/obsidian/service.js";

describe("ObsidianService Unit Tests", () => {
  let tempVault: string;
  let service: ObsidianService;

  beforeEach(() => {
    tempVault = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-vault-test-"));
    service = new ObsidianService(tempVault);

    // Create folder structure
    fs.mkdirSync(path.join(tempVault, "01 - Projets"), { recursive: true });
    fs.mkdirSync(path.join(tempVault, "03 - Vie Perso"), { recursive: true });
    fs.mkdirSync(path.join(tempVault, "06 - Stack & Outils"), { recursive: true });

    // Seed mock project note
    const projectContent = `---
title: Repo-Doctor
tags: [projet, cli, go, golang]
status: termine
---
# 🩺 Repo-Doctor — Git Health Auditor
Description of tool.
> 🔗 [[Index-Projets]]
`;
    fs.writeFileSync(path.join(tempVault, "01 - Projets", "Repo-Doctor.md"), projectContent, "utf-8");

    // Seed mock MOC note
    const mocContent = `---
title: Index Central des Projets
tags: [moc, index, projets]
---
# 🚀 Index Central
- [[Repo-Doctor]]
- [[AutoHunter]]
`;
    fs.writeFileSync(path.join(tempVault, "01 - Projets", "Index-Projets.md"), mocContent, "utf-8");

    // Seed mock Journal note
    const journalContent = `---
title: Journal de Bilan
---
# 📓 Journal de Bilan

<!-- Les entrées quotidiennes et hebdomadaires sont consignées ci-dessous par ordre antéchronologique (les plus récentes en haut). -->

### 2026-11-17 — Bilan Quotidien
- **Ce qui a marché :**
  - Séance Upper A validée.
`;
    fs.writeFileSync(path.join(tempVault, "03 - Vie Perso", "Journal de Bilan.md"), journalContent, "utf-8");

    // Seed mock Backlog note
    const backlogContent = `---
title: Backlog des Tâches
---
# 🎯 Backlog Maître

## 🔴 P1 — Priorités Immédiates

### 🚀 Projets Dev & Portfolio
- [ ] Tâche existante

## 🟡 P2 — Important
`;
    fs.writeFileSync(path.join(tempVault, "03 - Vie Perso", "Backlog.md"), backlogContent, "utf-8");
  });

  afterEach(() => {
    fs.rmSync(tempVault, { recursive: true, force: true });
  });

  it("should search notes by query text and find Repo-Doctor", async () => {
    const results = await service.searchNotes({ query: "Health Auditor" });
    assert.equal(results.length, 1);
    assert.equal(results[0].title, "Repo-Doctor");
    assert.equal(results[0].pole, "01 - Projets");
  });

  it("should search notes by tag", async () => {
    const results = await service.searchNotes({ tag: "golang" });
    assert.equal(results.length, 1);
    assert.equal(results[0].title, "Repo-Doctor");
  });

  it("should read note and parse frontmatter accurately", async () => {
    const doc = await service.readNote("01 - Projets/Repo-Doctor.md");
    assert.equal(doc.title, "Repo-Doctor");
    assert.equal(doc.frontmatter.status, "termine");
    assert.ok(doc.frontmatter.tags?.includes("go"));
    assert.ok(doc.content.includes("Git Health Auditor"));
  });

  it("should append journal entry in antichronological order", async () => {
    await service.appendJournal({
      date: "2026-11-18",
      subtitle: "Session MCP & Go",
      successBullets: ["Serveur MCP implémenté", "100% tests unitaires"],
      improvementsBullets: ["Relancer candidature stage"],
    });

    const updated = fs.readFileSync(path.join(tempVault, "03 - Vie Perso", "Journal de Bilan.md"), "utf-8");
    assert.ok(updated.includes("### 2026-11-18 — Session MCP & Go"));
    assert.ok(updated.indexOf("2026-11-18") < updated.indexOf("2026-11-17"));
    assert.ok(updated.includes("Serveur MCP implémenté"));
  });

  it("should add task to backlog under specified priority and domain", async () => {
    await service.addBacklogTask({
      priority: "P1",
      domain: "🚀 Projets Dev & Portfolio",
      task: "Nouvelle tâche de test prioritaire",
    });

    const updated = fs.readFileSync(path.join(tempVault, "03 - Vie Perso", "Backlog.md"), "utf-8");
    assert.ok(updated.includes("- [ ] Nouvelle tâche de test prioritaire"));
  });

  it("should parse MOC and extract linked notes", async () => {
    const moc = await service.getMoc("Index-Projets");
    assert.equal(moc.name, "Index-Projets");
    assert.ok(moc.linkedNotes.includes("Repo-Doctor"));
    assert.ok(moc.linkedNotes.includes("AutoHunter"));
  });
});
