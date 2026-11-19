import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { inspectPort } from '../system/ports.js';
import type { DashboardBriefingResult } from './types.js';

export async function getDashboardContext(customDir?: string): Promise<DashboardBriefingResult> {
  const dashboardDir =
    customDir ||
    process.env.DASHBOARD_DIR ||
    path.join(os.homedir(), 'Desktop', 'GitHub', 'Dashboard');

  let date: string | null = null;
  let title: string | null = null;
  let message: string | null = null;
  let dashboardUrl: string | null = 'http://localhost:5050';
  const bilanTasks: string[] = [];

  // 1. Lecture de briefing.json
  const briefingPath = path.join(dashboardDir, 'briefing.json');
  if (fs.existsSync(briefingPath)) {
    try {
      const raw = fs.readFileSync(briefingPath, 'utf-8');
      const data = JSON.parse(raw);
      date = data.date || null;
      title = data.title || null;
      message = data.message || null;
      if (data.url) dashboardUrl = data.url;
    } catch {
      // JSON invalide, ignoré
    }
  }

  // 2. Lecture de data/bilan_tasks.json
  const tasksPath = path.join(dashboardDir, 'data', 'bilan_tasks.json');
  if (fs.existsSync(tasksPath)) {
    try {
      const raw = fs.readFileSync(tasksPath, 'utf-8');
      const data = JSON.parse(raw);
      if (Array.isArray(data.tasks)) {
        for (const t of data.tasks) {
          if (typeof t === 'string') {
            bilanTasks.push(t);
          } else if (t && typeof t.title === 'string') {
            bilanTasks.push(t.title);
          }
        }
      }
    } catch {
      // JSON invalide, ignoré
    }
  }

  // 3. Inspection du port 5050 pour vérifier si le serveur Dashboard tourne
  let serverRunning = false;
  try {
    const portResult = await inspectPort(5050);
    serverRunning = portResult.occupied;
  } catch {
    serverRunning = false;
  }

  return {
    date,
    title,
    message,
    bilan_tasks: bilanTasks,
    server_running: serverRunning,
    dashboard_url: dashboardUrl,
  };
}
