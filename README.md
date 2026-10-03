# mcp-audit 🛡️

[![CI](https://github.com/mcp-audit/mcp-audit/actions/workflows/ci.yml/badge.svg)](https://github.com/mcp-audit/mcp-audit/actions)
[![npm version](https://img.shields.io/npm/v/mcp-audit.svg)](https://www.npmjs.com/package/mcp-audit)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

> **Zero-overhead security proxy, credential redactor, and audit firewall for [Model Context Protocol (MCP)](https://modelcontextprotocol.io) servers.**

When AI assistants (Claude Desktop, Cursor, Zed, or agent frameworks) connect to local MCP servers, they often receive unrestricted access to system files, shell commands, and production databases. 

**`mcp-audit`** acts as an intermediary stdio proxy between your AI client and any target MCP server. It inspects tool calls, blocks dangerous operations, masks exposed credentials, and logs an immutable audit trail.

---

## ⚡ Quickstart

No configuration required. Prefix your existing MCP server command with `mcp-audit`:

```bash
# Direct execution via npx
npx mcp-audit -- npx -y @modelcontextprotocol/server-postgres "postgresql://localhost/mydb"
```

### In Claude Desktop (`claude_desktop_config.json`)

Wrap your existing MCP command with `mcp-audit`:

```json
{
  "mcpServers": {
    "postgres-secure": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-audit",
        "--log",
        "/tmp/mcp-audit.jsonl",
        "--",
        "npx",
        "-y",
        "@modelcontextprotocol/server-postgres",
        "postgresql://localhost/mydb"
      ]
    }
  }
}
```

---

## 🚀 Key Features

* 🚫 **Destructive Command Interception:** Automatically flags and drops destructive shell and database actions (`rm -rf`, `mkfs`, `DROP TABLE`, `TRUNCATE`).
* 🔒 **Sensitive Path Protection:** Prevents unauthorized reads of SSH keys (`id_rsa`), `.env` files, and AWS credentials.
* 🎭 **Zero-Leak Secret Redactor:** Intercepts and masks API tokens (OpenAI, GitHub, AWS, JWTs, Bearer headers) before they reach model context.
* 📊 **Live Terminal HUD:** Formats real-time tool execution latencies and security decisions directly to stderr without corrupting the JSON-RPC pipe.
* 📝 **JSON-Lines Audit Trail:** Writes structured logs (`--log audit.jsonl`) for enterprise compliance and review.

---

## 🛠️ CLI Reference

```bash
Usage: mcp-audit [options] <command> [args...]

Arguments:
  command                      Target MCP server command (e.g., 'npx', 'node', 'python')
  args                         Arguments to pass to target MCP server

Options:
  -V, --version                output the version number
  -l, --log <path>             File path to write JSON audit logs
  -s, --silent                 Suppress live terminal audit logging to stderr (default: false)
  --no-mask                    Disable automatic secret/credential redaction
  -b, --block-tool <tools...>  Explicit list of tool names to block completely
  -h, --help                   Display help instructions
```

---

## 🧪 Testing

```bash
git clone https://github.com/mcp-audit/mcp-audit.git
cd mcp-audit
npm install
npm test
```

---

## 🤝 Contributing & License

Contributions, bug reports, and rule suggestions are welcome! Distributed under the [MIT License](LICENSE).
