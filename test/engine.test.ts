import { describe, it, expect } from "vitest";
import { maskSecretsInString, maskSecretsInObject } from "../src/utils/sanitizer.js";
import { SecurityEngine } from "../src/rules/engine.js";

describe("Sanitizer", () => {
  it("masks OpenAI API keys and tokens in string", () => {
    const input = "Connecting with key sk-1234567890abcdef1234567890 and Bearer eyJhbGciOiJIUzI1NiJ9.test.sig";
    const res = maskSecretsInString(input);
    expect(res.count).toBeGreaterThan(0);
    expect(res.maskedText).not.toContain("sk-1234567890abcdef1234567890");
    expect(res.maskedText).toContain("[REDACTED_SECRET]");
  });

  it("masks nested object properties", () => {
    const payload = {
      user: "alice",
      auth: {
        password: "SuperSecretPassword123!",
        apikey: "sk-abcdef1234567890abcdef"
      }
    };
    const { maskedObj, count } = maskSecretsInObject(payload);
    expect(count).toBe(2);
    expect(maskedObj.auth.password).toBe("[REDACTED_SECRET]");
    expect(maskedObj.auth.apikey).toBe("[REDACTED_SECRET]");
    expect(maskedObj.user).toBe("alice");
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

  it("redacts secrets inside arguments", () => {
    const req = {
      jsonrpc: "2.0" as const,
      id: 4,
      method: "tools/call",
      params: {
        name: "send_http_request",
        arguments: {
          headers: {
            Authorization: "Bearer sk-proj-12345678901234567890"
          }
        }
      }
    };
    const decision = engine.evaluateRequest(req);
    expect(decision.action).toBe("mask");
    expect(JSON.stringify(decision.modifiedPayload)).toContain("[REDACTED_SECRET]");
  });

  it("allows safe standard calls", () => {
    const req = {
      jsonrpc: "2.0" as const,
      id: 5,
      method: "tools/call",
      params: {
        name: "calculate_sum",
        arguments: { a: 10, b: 20 }
      }
    };
    const decision = engine.evaluateRequest(req);
    expect(decision.action).toBe("allow");
  });
});
