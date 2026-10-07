import type { AuditDecision, JSONRPCRequest } from "../types.js";
import { SecretVault } from "../utils/vault.js";

const DANGEROUS_COMMANDS = [
  /\brm\s+(-rf?|-fr?)\b/i,
  /\bformat\b/i,
  /\bmkfs\b/i,
  /\bdd\s+if=/i,
  /\b:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/, // fork bomb
  /\bchmod\s+(-R\s+)?777\b/i,
  /\bdrop\s+database\b/i,
  /\bdrop\s+table\b/i,
  /\btruncate\s+table\b/i,
  /\bdocker\s+(system\s+prune|volume\s+prune|rm\s+-f)\b/i,
  /\bkubectl\s+delete\s+(all|namespace|ns)\b/i,
  /\bgit\s+push\s+.*(--force|-f)\b/i
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
  private vault: SecretVault;
  private useVault: boolean;

  constructor(options?: { blockedTools?: string[]; maskSecrets?: boolean }) {
    this.blockedTools = new Set(options?.blockedTools ?? []);
    this.useVault = options?.maskSecrets ?? true;
    this.vault = new SecretVault();
  }

  public evaluateRequest(request: JSONRPCRequest): AuditDecision {
    const method = request.method;

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

      // 4. Inbound Re-hydration: If the LLM sent back a placeholder, re-hydrate with real secret for downstream tool
      if (this.useVault) {
        const rehydratedArgs = this.vault.detokenizeObject(args);
        return {
          action: "allow",
          modifiedPayload: {
            ...request,
            params: {
              ...request.params,
              arguments: rehydratedArgs
            }
          }
        };
      }
    }

    return { action: "allow" };
  }

  public evaluateResponse(response: any): AuditDecision {
    if (this.useVault && response?.result) {
      const { sanitizedObj, count } = this.vault.tokenizeObject(response.result);
      if (count > 0) {
        return {
          action: "mask",
          ruleName: "vault_tokenized_secrets",
          reason: `Stored ${count} secret(s) in local vault and replaced with synthetic references`,
          modifiedPayload: {
            ...response,
            result: sanitizedObj
          }
        };
      }
    }

    return { action: "allow" };
  }
}
