#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import { SecurityEngine } from "./rules/engine.js";
import { AuditLogger } from "./logger.js";
import { StdioProxy } from "./proxy.js";
import { wrapClaudeConfig, unwrapClaudeConfig } from "./utils/configWrapper.js";

const program = new Command();

program
  .name("mcp-shield")
  .description("Zero-overhead runtime security proxy, secret vault, and audit firewall for Model Context Protocol (MCP) servers")
  .version("0.1.0");

// Subcommand: wrap
program
  .command("wrap [target]")
  .description("Automatically inject mcp-shield protection into Claude Desktop configuration")
  .action((target) => {
    wrapClaudeConfig();
  });

// Subcommand: unwrap
program
  .command("unwrap [target]")
  .description("Restore original Claude Desktop configuration")
  .action((target) => {
    unwrapClaudeConfig();
  });

// Default proxy execution
program
  .argument("[command]", "Target MCP server command (e.g., 'npx', 'node', 'python')")
  .argument("[args...]", "Arguments to pass to target MCP server")
  .option("-l, --log <path>", "File path to write JSON audit logs")
  .option("-s, --silent", "Suppress live terminal audit logging to stderr", false)
  .option("--no-mask", "Disable automatic secret/credential redaction")
  .option("-b, --block-tool <tools...>", "Explicit list of tool names to block completely")
  .action((cmd, cmdArgs, options) => {
    if (!cmd) {
      program.help();
      return;
    }

    if (!options.silent) {
      process.stderr.write(
        chalk.cyan.bold("\n🛡️  mcp-shield v0.1.0 active\n") +
        chalk.dim(`Target: ${cmd} ${cmdArgs.join(" ")}\n`) +
        chalk.dim(`Secret Vault: ${options.mask ? "ACTIVE" : "OFF"}\n`) +
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

    new StdioProxy(cmd, cmdArgs, engine, logger);
  });

program.parse(process.argv);
