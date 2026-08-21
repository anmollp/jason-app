# Jason MCP

Private, local-only MCP server for Jason's deterministic JSON formatter, diff,
patch, and pointer tools. It uses standard MCP over stdio and does not depend on
Codex, OpenAI, or any model provider.

## Requirements

- Node.js 22 or newer
- Rust and Cargo to install Jason

Install the v1.7.1 Jason CLI release by its immutable commit:

```sh
cargo install --git https://github.com/anmollp/jason \
  --rev a47a1266567b57c00b18d6ff0447c90e63186cde --locked
```

## Build and run locally

From `backend/`:

```sh
pnpm install
pnpm --filter @anmollp/jason-mcp build
node mcp/dist/index.js
```

The process reads MCP messages from stdin and writes only MCP messages to
stdout. Set `JASON_CLI_PATH` if `jason` is not available on `PATH`:

```sh
JASON_CLI_PATH=/absolute/path/to/jason node mcp/dist/index.js
```

The MCP package is not published to a registry; it is installed from its local
directory. A first dependency install may still download declared dependencies
from the configured npm registry. To expose the `jason-mcp` executable locally:

```sh
npm install --global /absolute/path/to/jason-app/backend/mcp
```

## Configure an MCP host

Use the standard local stdio configuration supported by your MCP host:

```json
{
  "mcpServers": {
    "jason": {
      "command": "node",
      "args": ["/absolute/path/to/jason-app/backend/mcp/dist/index.js"],
      "env": {
        "JASON_CLI_PATH": "/absolute/path/to/jason"
      }
    }
  }
}
```

### Optional Codex example

Codex is one possible MCP host, not a dependency:

```sh
codex mcp add jason \
  --env JASON_CLI_PATH=/absolute/path/to/jason \
  -- node /absolute/path/to/jason-app/backend/mcp/dist/index.js
```

## Tools and boundaries

- `format_json`
- `diff_json`
- `apply_json_patch`
- `resolve_json_pointer`

The MCP server exposes no network or filesystem tools, invokes the configured
binary with fixed arguments and stdin, and never uses a shell. It has no model,
API-key, or hosted AskJason access. `apply_json_patch` returns an in-memory
result and does not modify a workspace.

`JASON_CLI_PATH` is a trusted local boundary: configure only the pinned Jason
binary. Like any local executable, it runs with the current user's OS
permissions; use OS sandboxing if stronger process isolation is required.

Each tool call accepts at most 16 KiB of combined UTF-8 input. The server permits
one Rust execution at a time, waits at most five seconds, and bounds protocol,
stdout, and stderr buffers. Tool errors are sanitized before they are returned.
