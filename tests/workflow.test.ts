import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { scanPrivacyGuard } from '../src/modules/workflow/privacy.js';
import { cleanupMergedBranches } from '../src/modules/workflow/gitbranches.js';
import { getDashboardContext } from '../src/modules/workflow/dashboard.js';

describe('Workflow & Privacy Module Tests', () => {
  const tempBaseDir = path.join(os.tmpdir(), `cockpit-workflow-test-${Date.now()}`);

  before(() => {
    fs.mkdirSync(tempBaseDir, { recursive: true });
  });

  after(() => {
    try {
      fs.rmSync(tempBaseDir, { recursive: true, force: true });
    } catch {
      // Ignoré si un lock Windows temporaire persiste
    }
  });

  describe('Privacy Guard Scanner (poucave-pas-tout)', () => {
    it('should detect forbidden files (.env, workouts.json)', () => {
      const scanDir = path.join(tempBaseDir, 'privacy-forbidden-files');
      fs.mkdirSync(scanDir, { recursive: true });
      fs.writeFileSync(path.join(scanDir, '.env'), 'SECRET_KEY=12345');
      fs.writeFileSync(path.join(scanDir, 'workouts.json'), '{"bench": 100}');
      fs.writeFileSync(path.join(scanDir, 'clean.txt'), 'Hello world');

      const result = scanPrivacyGuard(scanDir, false);
      assert.strictEqual(result.clean, false);
      assert.ok(result.violations_count >= 2);

      const rules = result.violations.map((v) => v.rule);
      assert.ok(rules.includes('pii_forbidden_file'));
    });

    it('should detect machine user path leaks', () => {
      const scanDir = path.join(tempBaseDir, 'privacy-user-path');
      fs.mkdirSync(scanDir, { recursive: true });
      fs.writeFileSync(
        path.join(scanDir, 'script.py'),
        'path = "C:\\\\Users\\\\noaga\\\\Documents\\\\Vault"' // poucave-ignore
      );

      const result = scanPrivacyGuard(scanDir, false);
      assert.strictEqual(result.clean, false);
      const userPathViolation = result.violations.find((v) => v.rule === 'pii_user_path');
      assert.ok(userPathViolation);
      assert.strictEqual(userPathViolation?.severity, 'BLOCKER');
    });

    it('should detect phone number leaks', () => {
      const scanDir = path.join(tempBaseDir, 'privacy-phone');
      fs.mkdirSync(scanDir, { recursive: true });
      fs.writeFileSync(
        path.join(scanDir, 'contact.md'),
        'Numéro direct : 07 71 16 11 96 - disponible par SMS' // poucave-ignore
      );

      const result = scanPrivacyGuard(scanDir, false);
      assert.strictEqual(result.clean, false);
      const phoneViolation = result.violations.find((v) => v.rule === 'pii_phone');
      assert.ok(phoneViolation);
    });

    it('should ignore placeholders in documentation', () => {
      const scanDir = path.join(tempBaseDir, 'privacy-placeholders');
      fs.mkdirSync(scanDir, { recursive: true });
      fs.writeFileSync(
        path.join(scanDir, 'README.md'),
        'export AWS_KEY="AKIA1234567890EXAMPLE" # your_api_key dummy'
      );

      const result = scanPrivacyGuard(scanDir, false);
      assert.strictEqual(result.clean, true);
      assert.strictEqual(result.violations_count, 0);
    });

    it('should allow .env.example templates and design tokens.json', () => {
      const scanDir = path.join(tempBaseDir, 'privacy-allowed-templates');
      fs.mkdirSync(path.join(scanDir, 'replica', 'design'), { recursive: true });
      fs.writeFileSync(path.join(scanDir, '.env.example'), 'PORT=3000\nAPI_KEY=your_dummy_key');
      fs.writeFileSync(path.join(scanDir, 'replica', 'design', 'tokens.json'), '{"colors": {"primary": "#123456"}}');

      const result = scanPrivacyGuard(scanDir, false);
      assert.strictEqual(result.clean, true);
      assert.strictEqual(result.violations_count, 0);
    });
  });

  describe('Git Branch Cleanup Engine', () => {
    it('should detect merged branches in dry_run and delete safely when dry_run=false', () => {
      const gitDir = path.join(tempBaseDir, 'test-git-repo');
      fs.mkdirSync(gitDir, { recursive: true });

      // Config repo git temporaire
      execSync('git init -b master', { cwd: gitDir, stdio: 'ignore' });
      execSync('git config user.name "Test Bot"', { cwd: gitDir, stdio: 'ignore' });
      execSync('git config user.email "test@example.com"', { cwd: gitDir, stdio: 'ignore' });

      // Commit initial
      fs.writeFileSync(path.join(gitDir, 'base.txt'), 'base');
      execSync('git add . && git commit -m "initial commit"', { cwd: gitDir, stdio: 'ignore' });

      // Branche mergée
      execSync('git checkout -b feature-merged', { cwd: gitDir, stdio: 'ignore' });
      fs.writeFileSync(path.join(gitDir, 'feature.txt'), 'feature');
      execSync('git add . && git commit -m "feature commit"', { cwd: gitDir, stdio: 'ignore' });
      execSync('git checkout master', { cwd: gitDir, stdio: 'ignore' });
      execSync('git merge feature-merged', { cwd: gitDir, stdio: 'ignore' });

      // Branche non-mergée
      execSync('git checkout -b feature-unmerged', { cwd: gitDir, stdio: 'ignore' });
      fs.writeFileSync(path.join(gitDir, 'wip.txt'), 'wip');
      execSync('git add . && git commit -m "wip commit"', { cwd: gitDir, stdio: 'ignore' });
      execSync('git checkout master', { cwd: gitDir, stdio: 'ignore' });

      // 1. Test simulation dry_run: true
      const dryResult = cleanupMergedBranches(gitDir, true, 'master');
      assert.strictEqual(dryResult.dry_run, true);
      assert.ok(dryResult.deleted_branches.includes('feature-merged'));
      assert.ok(!dryResult.deleted_branches.includes('feature-unmerged'));
      assert.ok(dryResult.skipped_branches.includes('master'));

      // Vérifier que la branche existe toujours
      const branchesBefore = execSync('git branch', { cwd: gitDir, encoding: 'utf-8' });
      assert.ok(branchesBefore.includes('feature-merged'));

      // 2. Test suppression effective dry_run: false
      const liveResult = cleanupMergedBranches(gitDir, false, 'master');
      assert.strictEqual(liveResult.dry_run, false);
      assert.ok(liveResult.deleted_branches.includes('feature-merged'));

      const branchesAfter = execSync('git branch', { cwd: gitDir, encoding: 'utf-8' });
      assert.ok(!branchesAfter.includes('feature-merged'));
      assert.ok(branchesAfter.includes('feature-unmerged')); // Préservée !
      assert.ok(branchesAfter.includes('master')); // Protégée !
    });
  });

  describe('Dashboard Context Reader', () => {
    it('should parse briefing and bilan tasks from valid JSON', async () => {
      const mockDashDir = path.join(tempBaseDir, 'mock-dashboard');
      fs.mkdirSync(path.join(mockDashDir, 'data'), { recursive: true });

      fs.writeFileSync(
        path.join(mockDashDir, 'briefing.json'),
        JSON.stringify({
          date: '2026-11-19',
          title: 'Morning Briefing',
          message: 'Objectifs de la journée',
          url: 'http://localhost:5050',
        })
      );

      fs.writeFileSync(
        path.join(mockDashDir, 'data', 'bilan_tasks.json'),
        JSON.stringify({
          date: '2026-11-19',
          tasks: [
            { id: '1', title: 'Action 1' },
            { id: '2', title: 'Action 2' },
          ],
        })
      );

      const ctx = await getDashboardContext(mockDashDir);
      assert.strictEqual(ctx.date, '2026-11-19');
      assert.strictEqual(ctx.title, 'Morning Briefing');
      assert.strictEqual(ctx.bilan_tasks.length, 2);
      assert.strictEqual(ctx.bilan_tasks[0], 'Action 1');
    });

    it('should handle nonexistent dashboard folder gracefully', async () => {
      const fakeDir = path.join(tempBaseDir, 'nonexistent-dashboard');
      const ctx = await getDashboardContext(fakeDir);
      assert.strictEqual(ctx.date, null);
      assert.strictEqual(ctx.title, null);
      assert.strictEqual(ctx.bilan_tasks.length, 0);
    });
  });
});
