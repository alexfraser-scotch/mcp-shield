import * as fs from "node:fs";
import chalk from "chalk";
import type { AuditLogEntry, SecurityAction } from "./types.js";

export class AuditLogger {
  private logFilePath?: string;
  private silent: boolean;

  constructor(options?: { logFile?: string; silent?: boolean }) {
    this.logFilePath = options?.logFile;
    this.silent = options?.silent ?? false;
  }

  public log(entry: AuditLogEntry): void {
    // 1. Write structured JSON line to audit log file if configured
    if (this.logFilePath) {
      try {
        fs.appendFileSync(this.logFilePath, JSON.stringify(entry) + "\n", "utf8");
      } catch (err) {
        if (!this.silent) {
          process.stderr.write(`[mcp-audit] Failed to write to log file: ${(err as Error).message}\n`);
        }
      }
    }

    // 2. Interactive Terminal Reporting (Written to stderr so stdio JSON-RPC on stdout is not corrupted)
    if (!this.silent) {
      this.renderTerminal(entry);
    }
  }

  private renderTerminal(entry: AuditLogEntry): void {
    const time = chalk.dim(new Date(entry.timestamp).toLocaleTimeString());
    const direction = entry.direction === "inbound" ? chalk.cyan("➜ IN ") : chalk.magenta("✔ OUT");
    
    let statusBadge: string;
    switch (entry.decision) {
      case "allow":
        statusBadge = chalk.bgGreen.black(" ALLOW ");
        break;
      case "block":
        statusBadge = chalk.bgRed.white.bold(" BLOCKED ");
        break;
      case "mask":
        statusBadge = chalk.bgYellow.black(" MASKED ");
        break;
    }

    const tool = entry.toolName ? chalk.bold.yellow(entry.toolName) : chalk.dim(entry.method);
    const reason = entry.reason ? chalk.dim(`(${entry.reason})`) : "";
    const latency = entry.durationMs !== undefined ? chalk.dim(`${entry.durationMs}ms`) : "";

    process.stderr.write(
      `[${time}] ${direction} ${statusBadge} ${tool} ${latency} ${reason}\n`
    );
  }
}
