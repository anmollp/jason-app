import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('agent architecture boundaries', () => {
  it('isolates OpenAI SDK imports inside the OpenAI adapter', () => {
    const agentRoot = join(__dirname);
    const vendorImports = walkTypeScriptFiles(agentRoot)
      .filter((file) => !file.endsWith('.spec.ts'))
      .filter((file) => readFileSync(file, 'utf8').includes("from 'openai"))
      .map((file) => file.slice(agentRoot.length + 1));

    expect(vendorImports).toEqual(['providers/openai-responses.provider.ts']);
  });

  it('keeps PR 1 internal with no agent controllers or routes', () => {
    const productionSources = walkTypeScriptFiles(join(__dirname)).filter(
      (file) => !file.endsWith('.spec.ts'),
    );
    const combinedSource = productionSources
      .map((file) => readFileSync(file, 'utf8'))
      .join('\n');

    expect(combinedSource).not.toContain('@Controller');
    expect(combinedSource).not.toContain("@Post('");
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
