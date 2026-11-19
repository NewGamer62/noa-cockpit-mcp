import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { PortInspectionResult, FreePortResult } from "./types.js";

const execAsync = promisify(exec);

export const PROTECTED_PIDS = new Set([0, 4]);

export const PROTECTED_PROCESS_NAMES = new Set([
  "system",
  "registry",
  "smss.exe",
  "csrss.exe",
  "wininit.exe",
  "services.exe",
  "lsass.exe",
  "svchost.exe",
  "explorer.exe",
  "spoolsv.exe",
  "dwm.exe",
  "idle",
]);

/**
 * Checks whether a given PID and process name belongs to a protected system process.
 */
export function isProtectedProcess(pid: number, processName?: string): boolean {
  if (PROTECTED_PIDS.has(pid)) {
    return true;
  }
  if (processName && PROTECTED_PROCESS_NAMES.has(processName.toLowerCase())) {
    return true;
  }
  return false;
}

/**
 * Inspects what process (PID and name) is currently listening on a specific TCP port.
 */
export async function inspectPort(port: number): Promise<PortInspectionResult> {
  if (port < 1 || port > 65535) {
    throw new Error(`Port invalide : ${port} (doit être entre 1 et 65535).`);
  }

  try {
    const { stdout } = await execAsync("netstat -ano -p tcp");
    const lines = stdout.split(/\r?\n/);

    // Matches: TCP 0.0.0.0:3000 ... LISTENING 12345
    const regex = new RegExp(`^\\s*TCP\\s+(\\S+:${port})\\s+\\S+\\s+LISTENING\\s+(\\d+)`, "i");

    for (const line of lines) {
      const match = line.match(regex);
      if (match) {
        const localAddress = match[1];
        const pid = parseInt(match[2], 10);
        const processName = await getProcessNameByPid(pid);

        return {
          port,
          occupied: true,
          pid,
          processName,
          state: "LISTENING",
          localAddress,
        };
      }
    }

    return {
      port,
      occupied: false,
    };
  } catch (err: any) {
    throw new Error(`Échec de l'inspection du port ${port} : ${err.message}`);
  }
}

/**
 * Gracefully or forcefully terminates the process occupying a port, respecting system protection rules.
 */
export async function freePort(port: number, force = false): Promise<FreePortResult> {
  const inspection = await inspectPort(port);

  if (!inspection.occupied || !inspection.pid) {
    return {
      port,
      freed: true,
      message: `Le port ${port} est déjà libre. Aucun processus à arrêter.`,
    };
  }

  const pid = inspection.pid;
  const procName = inspection.processName || "Inconnu";

  // Critical Safety Guard
  if (isProtectedProcess(pid, procName)) {
    throw new Error(
      `[Sécurité Système] Interdiction d'arrêter le processus critique '${procName}' (PID: ${pid}) sur le port ${port}.`
    );
  }

  try {
    // Terminate process tree using taskkill on Windows
    const forceFlag = force ? "/F" : "";
    await execAsync(`taskkill /PID ${pid} /T ${forceFlag}`);

    return {
      port,
      freed: true,
      killedPid: pid,
      processName: procName,
      message: `Processus '${procName}' (PID ${pid}) arrêté avec succès. Port ${port} libéré.`,
    };
  } catch (err: any) {
    // If graceful termination failed and force was not set, advise force
    if (!force) {
      return freePort(port, true);
    }
    throw new Error(`Échec de l'arrêt du processus '${procName}' (PID ${pid}) : ${err.message}`);
  }
}

async function getProcessNameByPid(pid: number): Promise<string> {
  if (pid === 4) return "System";
  if (pid === 0) return "Idle";

  try {
    const { stdout } = await execAsync(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`);
    // Output format: "node.exe","12345","Console","1","50,000 K"
    const cleaned = stdout.trim();
    if (!cleaned || cleaned.startsWith("INFO:")) {
      return "Unknown";
    }
    const match = cleaned.match(/^"([^"]+)"/);
    return match ? match[1] : "Unknown";
  } catch {
    return "Unknown";
  }
}
