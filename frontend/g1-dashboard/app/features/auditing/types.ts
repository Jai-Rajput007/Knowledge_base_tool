export interface AuditLog {
  id: string;
  action: string;
  endpoint: string;
  method: string;
  status: string;
  timestamp: string;
  name: string;
  email: string;
  details: any;
}

export interface AuditLogsResponse {
  total: number;
  logs: AuditLog[];
}
