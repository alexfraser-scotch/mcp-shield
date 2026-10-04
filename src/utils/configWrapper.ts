import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import chalk from "chalk";

export type ClientTarget = "claude" | "cursor" | "windsurf" | "all";

export interface TargetConfigMeta {
  name: string;
  configPath: string;
}

export function getClientConfigPath(target: ClientTarget): TargetConfigMeta[] {
  const home = os.homedir();
  const platform = os.platform();

  const configs: Record<string, string> = {
    claude: platform === "darwin"
      ? path.join(home, "Library", "Application Support", "Claude", "claude_desktop_config.json")
      : platform === "win32"
        ? path.join(process.env.APPDATA || path.join(home, "AppData", "Roaming"), "Claude", "claude_desktop_config.json")
        : path.join(home, ".config", "Claude", "claude_desktop_config.json"),
    cursor: path.join(home, ".cursor", "mcp.json"),
    windsurf: path.join(home, ".codeium", "windsurf", "mcp_config.json")
  };

  if (target === "all") {
    return Object.entries(configs).map(([name, configPath]) => ({ name, configPath }));
  }

  const foundPath = configs[target];
  if (!foundPath) {
    throw new Error(`Unknown client target: ${target}. Supported: claude, cursor, windsurf, all`);
  }

  return [{ name: target, configPath: foundPath }];
}

export function wrapConfig(target: ClientTarget = "all"): void {
  const targets = getClientConfigPath(target);
  let totalWrapped = 0;

  for (const { name, configPath } of targets) {
    if (!fs.existsSync(configPath)) {
      if (target !== "all") {
        process.stderr.write(chalk.yellow(`[mcp-shield] ${name} config not found at: ${configPath}\n`));
      }
      continue;
    }

    const raw = fs.readFileSync(configPath, "utf8");
    let config: any;
    try {
      config = JSON.parse(raw);
    } catch {
      process.stderr.write(chalk.red(`[mcp-shield] Failed to parse JSON for ${name} at ${configPath}\n`));
      continue;
    }

    if (!config.mcpServers || Object.keys(config.mcpServers).length === 0) {
      process.stderr.write(chalk.dim(`[mcp-shield] No MCP servers found in ${name}.\n`));
      continue;
    }

    // Backup
    const backupPath = `${configPath}.backup.${Date.now()}`;
    fs.writeFileSync(backupPath, raw, "utf8");

    let modified = 0;
    for (const [_, serverDef] of Object.entries<any>(config.mcpServers)) {
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
      modified++;
    }

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf8");
    totalWrapped += modified;
    process.stderr.write(
      chalk.green(`✔ Shielded ${modified} server(s) in ${chalk.bold(name)} (${configPath})\n`)
    );
  }

  if (totalWrapped > 0) {
    process.stderr.write(
      chalk.cyan.bold(`\n🛡️  mcp-shield active! Restart your AI client(s) to apply.\n`)
    );
  } else {
    process.stderr.write(
      chalk.yellow(`[mcp-shield] No active MCP servers were modified.\n`)
    );
  }
}

export function unwrapConfig(target: ClientTarget = "all"): void {
  const targets = getClientConfigPath(target);
  let totalRestored = 0;

  for (const { name, configPath } of targets) {
    if (!fs.existsSync(configPath)) continue;

    const raw = fs.readFileSync(configPath, "utf8");
    let config: any;
    try {
      config = JSON.parse(raw);
    } catch {
      continue;
    }

    if (!config.mcpServers) continue;

    let restored = 0;
    for (const [_, serverDef] of Object.entries<any>(config.mcpServers)) {
      if (serverDef.command === "npx" && Array.isArray(serverDef.args) && serverDef.args.includes("mcp-shield")) {
        const doubleDashIdx = serverDef.args.indexOf("--");
        if (doubleDashIdx !== -1 && serverDef.args.length > doubleDashIdx + 1) {
          serverDef.command = serverDef.args[doubleDashIdx + 1];
          serverDef.args = serverDef.args.slice(doubleDashIdx + 2);
          restored++;
        }
      }
    }

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf8");
    totalRestored += restored;
    process.stderr.write(chalk.green(`✔ Unwrapped ${restored} server(s) in ${chalk.bold(name)}\n`));
  }

  process.stderr.write(chalk.cyan(`Restored ${totalRestored} server(s) across clients.\n`));
}
