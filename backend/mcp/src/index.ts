import {
  serveStdio,
  StdioServerTransport,
} from '@modelcontextprotocol/server/stdio';
import { createJasonMcpServer, MCP_MAX_PROTOCOL_BYTES } from './server.js';

const transport = new StdioServerTransport(process.stdin, process.stdout, {
  maxBufferSize: MCP_MAX_PROTOCOL_BYTES,
});

try {
  const handle = serveStdio(() => createJasonMcpServer(), {
    transport,
    onerror: () => process.stderr.write('Jason MCP protocol error.\n'),
  });
  let shuttingDown = false;
  const shutdown = () => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    void handle.close().then(
      () => {
        process.exitCode = 0;
      },
      () => {
        process.stderr.write('Jason MCP server could not stop cleanly.\n');
        process.exitCode = 1;
      },
    );
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
} catch {
  process.stderr.write('Jason MCP server could not start.\n');
  process.exitCode = 1;
}
