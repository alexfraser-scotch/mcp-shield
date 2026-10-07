# Contributing to mcp-shield 🛡️

Thank you for your interest in contributing! `mcp-shield` is an open-source security proxy for the Model Context Protocol ecosystem.

## 🛠️ Local Development Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/alexfraser-scotch/mcp-shield.git
   cd mcp-shield
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Run the test suite:**
   ```bash
   npm test
   ```

4. **Build and test the CLI locally:**
   ```bash
   npm run build
   node dist/cli.js --help
   ```

---

## 🎯 How to Contribute

We actively welcome contributions in the following areas:

### 1. Security Rules (`src/rules/engine.ts`)
Help expand our detection engine with patterns for:
* Dangerous database operations (e.g., dropping databases, truncating production tables).
* Destructive CLI commands (e.g., cloud CLI deletions, dangerous Docker flags).
* Sensitive credentials and secrets (API keys, tokens, certificate files).

### 2. Client Integrations (`src/utils/configWrapper.ts`)
Help add auto-wrapping detection for other AI editors and tools (e.g., Zed editor, local agent frameworks).

### 3. Reporting Issues & Proposing Features
* Check existing [GitHub Issues](https://github.com/alexfraser-scotch/mcp-shield/issues) before opening a new one.
* When submitting security vulnerabilities or bypass techniques, please include reproduction steps with mock JSON-RPC payloads.

---

## 📜 Pull Request Guidelines

1. Make sure all existing and new tests pass: `npm test`.
2. Ensure TypeScript compilation passes with zero errors: `npm run lint`.
3. Keep pull requests focused on a single feature or bug fix.
4. Follow conventional commit messages (e.g., `feat: ...`, `fix: ...`, `docs: ...`).

---

## License
By contributing to `mcp-shield`, you agree that your contributions will be licensed under the [MIT License](LICENSE).
