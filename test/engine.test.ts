import { describe, it, expect } from "vitest";
import { SecretVault } from "../src/utils/vault.js";
import { SecurityEngine } from "../src/rules/engine.js";

describe("SecretVault (Reversible Tokenization)", () => {
  it("replaces sensitive secrets with synthetic references and detokenizes back perfectly", () => {
    const vault = new SecretVault();
    const rawSecret = "sk-abcdef1234567890abcdef12345";
    const originalText = `Authorization: Bearer ${rawSecret}`;

    // 1. Tokenize (Outbound to LLM)
    const { sanitizedText, count } = vault.tokenizeString(originalText);
    expect(count).toBeGreaterThan(0);
    expect(sanitizedText).not.toContain(rawSecret);
    expect(sanitizedText).toContain("[[MCP_SHIELD_REF_");

    // 2. Detokenize (Inbound from LLM to Target Tool)
    const restoredText = vault.detokenizeString(sanitizedText);
    expect(restoredText).toBe(originalText);
  });

  it("tokenizes and restores nested objects", () => {
    const vault = new SecretVault();
    const payload = {
      credentials: {
        apiKey: "sk-proj-test1234567890abcdef12345",
        password: "SecretDatabasePassword999!"
      },
      metadata: {
        host: "db.internal"
      }
    };

    const { sanitizedObj, count } = vault.tokenizeObject(payload);
    expect(count).toBe(2);
    expect(sanitizedObj.credentials.apiKey).toContain("[[MCP_SHIELD_REF_");
    expect(sanitizedObj.credentials.password).toContain("[[MCP_SHIELD_REF_");
    expect(sanitizedObj.metadata.host).toBe("db.internal");

    const restoredObj = vault.detokenizeObject(sanitizedObj);
    expect(restoredObj).toEqual(payload);
  });
});

describe("SecurityEngine", () => {
  const engine = new SecurityEngine({
    blockedTools: ["danger_exec"],
    maskSecrets: true
  });

  it("blocks tools on the blocklist", () => {
    const req = {
      jsonrpc: "2.0" as const,
      id: 1,
      method: "tools/call",
      params: { name: "danger_exec", arguments: {} }
    };
    const decision = engine.evaluateRequest(req);
    expect(decision.action).toBe("block");
    expect(decision.reason).toContain("blocked by security policy");
  });

  it("blocks dangerous destructive commands", () => {
    const req = {
      jsonrpc: "2.0" as const,
      id: 2,
      method: "tools/call",
      params: {
        name: "bash",
        arguments: { command: "rm -rf /tmp/data" }
      }
    };
    const decision = engine.evaluateRequest(req);
    expect(decision.action).toBe("block");
    expect(decision.ruleName).toBe("dangerous_command");
  });

  it("blocks sensitive path / credential access", () => {
    const req = {
      jsonrpc: "2.0" as const,
      id: 3,
      method: "tools/call",
      params: {
        name: "read_file",
        arguments: { path: "/Users/admin/.ssh/id_rsa" }
      }
    };
    const decision = engine.evaluateRequest(req);
    expect(decision.action).toBe("block");
    expect(decision.ruleName).toBe("sensitive_path_access");
  });
});
