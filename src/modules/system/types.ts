export interface PortInspectionResult {
  port: number;
  occupied: boolean;
  pid?: number;
  processName?: string;
  state?: string;
  localAddress?: string;
}

export interface FreePortResult {
  port: number;
  freed: boolean;
  killedPid?: number;
  processName?: string;
  message: string;
}

export interface RepoDoctorIssue {
  pillar: string;
  code: string;
  title: string;
  description: string;
  severity: string;
  penalty: number;
  fix_hint?: string;
}

export interface RepoDoctorPillarSummary {
  name: string;
  score: number;
  issues: RepoDoctorIssue[] | null;
}

export interface RepoDoctorReport {
  repo_path: string;
  scanned_at: string;
  overall_score: number;
  grade: string;
  total_issues: number;
  passed: boolean;
  pillars: Record<string, RepoDoctorPillarSummary>;
}
