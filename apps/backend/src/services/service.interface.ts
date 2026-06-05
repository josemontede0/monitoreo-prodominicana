export interface CheckLog {
  timestamp: string;
  status: "up" | "down";
  response: number | null;
  httpCode: number | null;
}

export interface MonitorService {
  id: number;
  name: string;
  url: string;
  interval: number;
  status: "up" | "down" | "checking";
  response: number | null;
  uptime: number;
  downSince: string | null;
  notified: boolean;
  history: string[];
  logs: CheckLog[];
  privateIp?: string | null;
  notes?: string | null;
}