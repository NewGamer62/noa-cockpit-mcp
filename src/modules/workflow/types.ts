export interface PrivacyViolation {
  file: string;
  line: number;
  rule: 'pii_user_path' | 'pii_phone' | 'pii_forbidden_file' | 'secret_token';
  severity: 'BLOCKER' | 'HIGH' | 'MEDIUM';
  message: string;
  snippet: string;
}

export interface PrivacyScanResult {
  clean: boolean;
  repo_path: string;
  scanned_files_count: number;
  violations_count: number;
  violations: PrivacyViolation[];
}

export interface BranchCleanupResult {
  dry_run: boolean;
  base_branch: string;
  deleted_branches: string[];
  skipped_branches: string[];
  message: string;
}

export interface DashboardBriefingResult {
  date: string | null;
  title: string | null;
  message: string | null;
  bilan_tasks: string[];
  server_running: boolean;
  dashboard_url: string | null;
}
