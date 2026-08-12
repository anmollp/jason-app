import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('agent architecture boundaries', () => {
  it('isolates OpenAI SDK imports inside the OpenAI adapter', () => {
    const agentRoot = join(__dirname);
    const vendorImports = walkTypeScriptFiles(agentRoot)
      .filter((file) => !file.endsWith('.spec.ts'))
      .filter((file) => readFileSync(file, 'utf8').includes("from 'openai"))
      .map((file) => file.slice(agentRoot.length + 1));

    expect(vendorImports).toEqual([
      'providers/openai-moderation.client.ts',
      'providers/openai-responses.provider.ts',
    ]);
  });

  it('exposes only the approved session and message routes', () => {
    const source = readFileSync(join(__dirname, 'agent.controller.ts'), 'utf8');

    expect(source).toContain("@Controller('api/agent')");
    expect(source.match(/@Post\(/g)).toHaveLength(2);
    expect(source).toContain("@Post('session')");
    expect(source).toContain("@Post('message')");
  });
});

function walkTypeScriptFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory()
      ? walkTypeScriptFiles(path)
      : entry.name.endsWith('.ts')
        ? [path]
        : [];
  });
}
