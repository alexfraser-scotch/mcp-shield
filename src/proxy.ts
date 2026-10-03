import { spawn, type ChildProcess } from "node:child_process";
import * as readline from "node:readline";
import type { JSONRPCRequest, JSONRPCResponse } from "./types.js";
import { SecurityEngine } from "./rules/engine.js";
import { AuditLogger } from "./logger.js";

export class StdioProxy {
  private childProcess: ChildProcess;
  private engine: SecurityEngine;
  private logger: AuditLogger;
  private pendingRequests = new Map<string | number, { method: string; startTime: number; toolName?: string }>();

  constructor(
    command: string,
    args: string[],
    engine: SecurityEngine,
    logger: AuditLogger
  ) {
    this.engine = engine;
    this.logger = logger;

    // Spawn downstream MCP target process
    this.childProcess = spawn(command, args, {
      stdio: ["pipe", "pipe", "inherit"],
      shell: false
    });

    this.childProcess.on("error", (err) => {
      process.stderr.write(`[mcp-audit] Subprocess error: ${err.message}\n`);
      process.exit(1);
    });

    this.childProcess.on("exit", (code) => {
      process.exit(code ?? 0);
    });

    this.setupPipes();
  }

  private setupPipes(): void {
    // 1. Client to Target (stdin -> childProcess.stdin)
    const clientReader = readline.createInterface({
      input: process.stdin,
      terminal: false
    });

    clientReader.on("line", (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      try {
        const req = JSON.parse(trimmed) as JSONRPCRequest;
        this.handleClientMessage(req);
      } catch {
        // Not valid JSON-RPC, pass through raw
        this.forwardToChild(trimmed + "\n");
      }
    });

    // 2. Target to Client (childProcess.stdout -> stdout)
    if (this.childProcess.stdout) {
      const targetReader = readline.createInterface({
        input: this.childProcess.stdout,
        terminal: false
      });

      targetReader.on("line", (line) => {
        const trimmed = line.trim();
        if (!trimmed) return;

        try {
          const res = JSON.parse(trimmed) as JSONRPCResponse;
          this.handleTargetMessage(res);
        } catch {
          // Pass through raw output
          process.stdout.write(trimmed + "\n");
        }
      });
    }
  }

  private handleClientMessage(req: JSONRPCRequest): void {
    const toolName = req.params?.name;
    const reqId = req.id;

    if (reqId !== undefined && reqId !== null) {
      this.pendingRequests.set(reqId, {
        method: req.method,
        startTime: Date.now(),
        toolName
      });
    }

    const decision = this.engine.evaluateRequest(req);

    this.logger.log({
      timestamp: new Date().toISOString(),
      direction: "inbound",
      method: req.method,
      toolName,
      decision: decision.action,
      reason: decision.reason,
      payloadSize: JSON.stringify(req).length
    });

    if (decision.action === "block") {
      // Synthesize JSON-RPC error response back to client immediately
      if (reqId !== undefined && reqId !== null) {
        const errorResponse: JSONRPCResponse = {
          jsonrpc: "2.0",
          id: reqId,
          error: {
            code: -32600, // Invalid Request / Security Policy Block
            message: `[mcp-audit] BLOCKED by security policy: ${decision.reason}`
          }
        };
        process.stdout.write(JSON.stringify(errorResponse) + "\n");
      }
      return;
    }

    const payloadToSend = decision.action === "mask" && decision.modifiedPayload
      ? decision.modifiedPayload
      : req;

    this.forwardToChild(JSON.stringify(payloadToSend) + "\n");
  }

  private handleTargetMessage(res: JSONRPCResponse): void {
    const reqId = res.id;
    let durationMs: number | undefined;
    let toolName: string | undefined;
    let method = "response";

    if (reqId !== undefined && reqId !== null && this.pendingRequests.has(reqId)) {
      const meta = this.pendingRequests.get(reqId)!;
      durationMs = Date.now() - meta.startTime;
      toolName = meta.toolName;
      method = meta.method;
      this.pendingRequests.delete(reqId);
    }

    const decision = this.engine.evaluateResponse(res);

    this.logger.log({
      timestamp: new Date().toISOString(),
      direction: "outbound",
      method,
      toolName,
      decision: decision.action,
      reason: decision.reason,
      durationMs,
      payloadSize: JSON.stringify(res).length
    });

    const payloadToSend = decision.action === "mask" && decision.modifiedPayload
      ? decision.modifiedPayload
      : res;

    process.stdout.write(JSON.stringify(payloadToSend) + "\n");
  }

  private forwardToChild(data: string): void {
    if (this.childProcess.stdin && !this.childProcess.stdin.destroyed) {
      this.childProcess.stdin.write(data);
    }
  }
}
