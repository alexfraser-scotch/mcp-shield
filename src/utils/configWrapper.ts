import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import chalk from "chalk";

export function getClaudeDesktopConfigPath(): string {
  const platform = os.platform();
  const home = os.homedir();

  if (platform === "darwin") {
    return path.join(home, "Library", "Application Support", "Claude", "claude_desktop_config.json");
  } else if (platform === "win32") {
    return path.join(process.env.APPDATA || path.join(home, "AppData", "Roaming"), "Claude", "claude_desktop_config.json");
  } else {
    // Linux / default
    return path.join(home, ".config", "Claude", "claude_desktop_config.json");
  }
}

export function wrapClaudeConfig(): void {
  const configPath = getClaudeDesktopConfigPath();

  if (!fs.existsSync(configPath)) {
    process.stderr.write(chalk.red(`[mcp-shield] Claude Desktop config not found at: ${configPath}\n`));
    return;
  }

  const raw = fs.readFileSync(configPath, "utf8");
  let config: any;
  try {
    config = JSON.parse(raw);
  } catch {
    process.stderr.write(chalk.red(`[mcp-shield] Failed to parse JSON at ${configPath}\n`));
    return;
  }

  if (!config.mcpServers || Object.keys(config.mcpServers).length === 0) {
    process.stderr.write(chalk.yellow(`[mcp-shield] No MCP servers found in config.\n`));
    return;
  }

  // Create backup
  const backupPath = `${configPath}.backup.${Date.now()}`;
  fs.writeFileSync(backupPath, raw, "utf8");
  process.stderr.write(chalk.green(`✔ Created configuration backup at: ${backupPath}\n`));

  let modifiedCount = 0;
  for (const [serverName, serverDef] of Object.entries<any>(config.mcpServers)) {
    // Skip if already shielded
    if (serverDef.command === "npx" && Array.isArray(serverDef.args) && serverDef.args.includes("mcp-shield")) {
      continue;
    }
    if (serverDef.command === "mcp-shield") {
      continue;
    }

    const originalCommand = serverDef.command;
    const originalArgs = serverDef.args || [];

    serverDef.command = "npx";
    serverDef.args = ["-y", "mcp-shield", "--", originalCommand, ...originalArgs];
    modifiedCount++;
  }

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf8");
  process.stderr.write(
    chalk.cyan.bold(`🛡️  mcp-shield successfully wrapped ${modifiedCount} MCP server(s) in Claude Desktop!\n`) +
    chalk.dim(`Restart Claude Desktop to activate runtime protection.\n`)
  );
}

export function unwrapClaudeConfig(): void {
  const configPath = getClaudeDesktopConfigPath();

  if (!fs.existsSync(configPath)) {
    process.stderr.write(chalk.red(`[mcp-shield] Claude Desktop config not found.\n`));
    return;
  }

  const raw = fs.readFileSync(configPath, "utf8");
  const config = JSON.parse(raw);

  if (!config.mcpServers) return;

  let restoredCount = 0;
  for (const [_, serverDef] of Object.entries<any>(config.mcpServers)) {
    if (serverDef.command === "npx" && Array.isArray(serverDef.args) && serverDef.args[1] === "mcp-shield") {
      const doubleDashIdx = serverDef.args.indexOf("--");
      if (doubleDashIdx !== -1 && serverDef.args.length > doubleDashIdx + 1) {
        serverDef.command = serverDef.args[doubleDashIdx + 1];
        serverDef.args = serverDef.args.slice(doubleDashIdx + 2);
        restoredCount++;
      }
    }
  }

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf8");
  process.stderr.write(
    chalk.green.bold(`✔ Successfully unwrapped ${restoredCount} MCP server(s) in Claude Desktop.\n`)
  );
}
