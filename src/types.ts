export interface JSONRPCRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, any>;
}

export interface JSONRPCResponse {
  jsonrpc: "2.0";
  id?: string | number | null;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export type SecurityAction = "allow" | "block" | "mask";

export interface AuditDecision {
  action: SecurityAction;
  ruleName?: string;
  reason?: string;
  modifiedPayload?: any;
}

export interface AuditLogEntry {
  timestamp: string;
  direction: "inbound" | "outbound";
  method: string;
  toolName?: string;
  decision: SecurityAction;
  reason?: string;
  durationMs?: number;
  payloadSize: number;
}

export interface AuditConfig {
  logFile?: string;
  silent?: boolean;
  maskSecrets?: boolean;
  blockedTools?: string[];
  blockedPaths?: string[];
  customRulesFile?: string;
}
