import type { AuditDecision, JSONRPCRequest } from "../types.js";
import { maskSecretsInObject } from "../utils/sanitizer.js";

const DANGEROUS_COMMANDS = [
  /\brm\s+(-rf?|-fr?)\b/i,
  /\bformat\b/i,
  /\bmkfs\b/i,
  /\bdd\s+if=/i,
  /\b:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/, // fork bomb
  /\bchmod\s+(-R\s+)?777\b/i,
  /\bdrop\s+database\b/i,
  /\bdrop\s+table\b/i,
  /\btruncate\s+table\b/i
];

const SENSITIVE_PATHS = [
  /\.env(\.[a-zA-Z0-9]+)?$/i,
  /\/\.ssh\//i,
  /\/\.gnupg\//i,
  /\/\.aws\//i,
  /id_rsa/i,
  /\/etc\/shadow/i,
  /\/etc\/passwd/i
];

export class SecurityEngine {
  private blockedTools: Set<string>;
  private maskSecrets: boolean;

  constructor(options?: { blockedTools?: string[]; maskSecrets?: boolean }) {
    this.blockedTools = new Set(options?.blockedTools ?? []);
    this.maskSecrets = options?.maskSecrets ?? true;
  }

  public evaluateRequest(request: JSONRPCRequest): AuditDecision {
    const method = request.method;

    // Check if this is an MCP tool invocation
    if (method === "tools/call") {
      const toolName = request.params?.name;
      const args = request.params?.arguments || {};

      // 1. Tool Blocklist
      if (toolName && this.blockedTools.has(toolName)) {
        return {
          action: "block",
          ruleName: "blocked_tool",
          reason: `Tool '${toolName}' is blocked by security policy.`
        };
      }

      // 2. Destructive Command Inspection
      const serializedArgs = JSON.stringify(args);
      for (const cmdPattern of DANGEROUS_COMMANDS) {
        if (cmdPattern.test(serializedArgs)) {
          return {
            action: "block",
            ruleName: "dangerous_command",
            reason: `Blocked potentially destructive command matching pattern: ${cmdPattern.source}`
          };
        }
      }

      // 3. Sensitive Path Inspection
      for (const pathPattern of SENSITIVE_PATHS) {
        if (pathPattern.test(serializedArgs)) {
          return {
            action: "block",
            ruleName: "sensitive_path_access",
            reason: `Blocked access to protected credentials or path matching: ${pathPattern.source}`
          };
        }
      }

      // 4. Secret Masking in Tool Arguments
      if (this.maskSecrets) {
        const { maskedObj, count } = maskSecretsInObject(args);
        if (count > 0) {
          const modified = {
            ...request,
            params: {
              ...request.params,
              arguments: maskedObj
            }
          };
          return {
            action: "mask",
            ruleName: "secrets_redacted",
            reason: `Masked ${count} sensitive credential(s) from arguments`,
            modifiedPayload: modified
          };
        }
      }
    }

    // Default Allow
    return { action: "allow" };
  }

  public evaluateResponse(response: any): AuditDecision {
    if (this.maskSecrets && response?.result) {
      const { maskedObj, count } = maskSecretsInObject(response.result);
      if (count > 0) {
        return {
          action: "mask",
          ruleName: "response_secrets_redacted",
          reason: `Masked ${count} credential(s) in response output`,
          modifiedPayload: {
            ...response,
            result: maskedObj
          }
        };
      }
    }

    return { action: "allow" };
  }
}
