#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import { SecurityEngine } from "./rules/engine.js";
import { AuditLogger } from "./logger.js";
import { StdioProxy } from "./proxy.js";

const program = new Command();

program
  .name("mcp-audit")
  .description("Zero-overhead security proxy and audit firewall for Model Context Protocol (MCP) servers")
  .version("0.1.0")
  .argument("<command>", "Target MCP server command (e.g., 'npx', 'node', 'python')")
  .argument("[args...]", "Arguments to pass to target MCP server")
  .option("-l, --log <path>", "File path to write JSON audit logs")
  .option("-s, --silent", "Suppress live terminal audit logging to stderr", false)
  .option("--no-mask", "Disable automatic secret/credential redaction")
  .option("-b, --block-tool <tools...>", "Explicit list of tool names to block completely")
  .helpOption("-h, --help", "Display help instructions")
  .action((cmd, cmdArgs, options) => {
    if (!options.silent) {
      process.stderr.write(
        chalk.cyan.bold("\n🛡️  mcp-audit v0.1.0 active\n") +
        chalk.dim(`Target: ${cmd} ${cmdArgs.join(" ")}\n`) +
        chalk.dim(`Redaction: ${options.mask ? "ON" : "OFF"}\n`) +
        (options.log ? chalk.dim(`Audit Log: ${options.log}\n`) : "") +
        "\n"
      );
    }

    const engine = new SecurityEngine({
      blockedTools: options.blockTool,
      maskSecrets: options.mask
    });

    const logger = new AuditLogger({
      logFile: options.log,
      silent: options.silent
    });

    // Start proxy
    new StdioProxy(cmd, cmdArgs, engine, logger);
  });

program.parse(process.argv);
