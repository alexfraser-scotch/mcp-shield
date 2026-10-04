# mcp-shield 🛡️

[![npm version](https://img.shields.io/npm/v/mcp-shield.svg)](https://www.npmjs.com/package/mcp-shield)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

> **Zero-overhead runtime security proxy, reversible secret vault, and audit firewall for [Model Context Protocol (MCP)](https://modelcontextprotocol.io) servers.**

When AI assistants (**Cursor**, **Claude Desktop**, **Windsurf**, or agent frameworks) connect to local MCP servers, they often receive unrestricted access to system files, shell commands, and databases. 

Unlike offline scanners that only check configuration files once, **`mcp-shield`** runs in real time between your AI client and any target MCP server. It intercepts destructive tool calls, prevents sensitive file exfiltration, and redacts credentials before they can leak into external LLM prompts.

---

## ⚡ 1-Click Protection (Universal Client Support)

Shield your MCP servers across all installed AI editors with a single command:

```bash
# Auto-detects and protects Claude Desktop, Cursor, and Windsurf
npx mcp-shield wrap all

# Or target a specific editor:
npx mcp-shield wrap cursor
npx mcp-shield wrap claude
npx mcp-shield wrap windsurf
```

To revert back at any time:
```bash
npx mcp-shield unwrap all
```

---

## 🚀 Why `mcp-shield` Outperforms Alternative Tools

| Capability | Static Config Scanners | Standard Proxies | `mcp-shield` 🛡️ |
| :--- | :---: | :---: | :---: |
| **Real-time Runtime Blocking** | ❌ | ✅ | ✅ |
| **Universal 1-Click Auto-Wrap** | ❌ | ❌ | ✅ (Cursor, Claude, Windsurf) |
| **Reversible Secret Vault** | ❌ | ❌ (hard redacts, breaks APIs) | ✅ (masks outbound, re-hydrates inbound) |
| **Destructive Command Guard** | ❌ | Partial | ✅ (`rm -rf`, `DROP TABLE`, `mkfs`) |
| **Sensitive Path Shield** | ❌ | Partial | ✅ (`.env`, `id_rsa`, `~/.aws`) |
| **Zero-Corrupt Terminal HUD** | ❌ | ❌ | ✅ (Live latency & status to stderr) |

---

## 🔒 The Reversible Secret Vault

Standard redactors replace secrets with `[REDACTED]`, which breaks downstream APIs when the tool actually needs the token. 

`mcp-shield` uses an in-memory cryptographic token vault:
1. **Outbound to LLM:** Replaces raw API keys, JWTs, and passwords with synthetic placeholders (`[[MCP_SHIELD_REF_8f91]]`). The LLM never sees your real credentials.
2. **Inbound from LLM:** When the LLM calls a downstream tool with the placeholder, `mcp-shield` securely re-hydrates the placeholder with the real secret before dispatching to the target service.

---

## 🛠️ Manual CLI Usage

You can also run `mcp-shield` directly as a transparent wrapper:

```bash
# Run any MCP server protected through mcp-shield
npx mcp-shield -- npx -y @modelcontextprotocol/server-postgres "postgresql://localhost/mydb"

# Enable persistent JSON audit logging
npx mcp-shield --log /tmp/audit.jsonl -- npx -y @modelcontextprotocol/server-filesystem /path/to/dir
```

### Options

```text
Usage: mcp-shield [options] [command] [args...]

Subcommands:
  wrap [target]                Inject mcp-shield into AI clients: 'cursor', 'claude', 'windsurf', or 'all' (default: all)
  unwrap [target]              Restore original configuration

Arguments:
  command                      Target MCP server command (e.g., 'npx', 'node', 'python')
  args                         Arguments to pass to target MCP server

Options:
  -l, --log <path>             File path to write JSON audit logs
  -s, --silent                 Suppress live terminal HUD to stderr (default: false)
  --no-mask                    Disable automatic secret vault tokenization
  -b, --block-tool <tools...>  Explicit list of tool names to block completely
  -h, --help                   Display help instructions
```

---

## 🧪 Testing

```bash
git clone https://github.com/alexfraser-scotch/mcp-shield.git
cd mcp-shield
npm install
npm test
```

---

## 🤝 Contributing & License

Contributions, rules, and suggestions are welcome! Distributed under the [MIT License](LICENSE).
