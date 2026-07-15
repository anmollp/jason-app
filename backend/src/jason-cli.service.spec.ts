import { EventEmitter } from 'node:events';
import { spawn } from 'node:child_process';
import { JasonCliService } from './jason-cli.service';

jest.mock('node:child_process', () => ({
  spawn: jest.fn(),
}));

const spawnMock = spawn as jest.MockedFunction<typeof spawn>;

function createMockChild() {
  const child = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
    stdin: { end: jest.Mock };
    kill: jest.Mock;
  };

  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.stdin = { end: jest.fn() };
  child.kill = jest.fn();

  return child;
}

describe('JasonCliService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.JASON_CLI_PATH;
  });

  it('streams large formatter output without an execFile maxBuffer limit', async () => {
    const child = createMockChild();
    spawnMock.mockReturnValue(child as ReturnType<typeof spawn>);
    const service = new JasonCliService();
    const largeChunk = 'x'.repeat(1024 * 1024 + 1);

    const result = service.format('{"a":1}');

    child.stdout.emit('data', Buffer.from(largeChunk));
    child.stdout.emit('data', Buffer.from('done\n'));
    child.emit('close', 0);

    await expect(result).resolves.toBe(`${largeChunk}done`);
    expect(spawnMock).toHaveBeenCalledWith('jason', ['format', '--stdin'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    expect(child.stdin.end).toHaveBeenCalledWith('{"a":1}');
  });

  it('rejects failed CLI runs with stderr output', async () => {
    const child = createMockChild();
    spawnMock.mockReturnValue(child as ReturnType<typeof spawn>);
    const service = new JasonCliService();

    const result = service.format('{broken}');

    child.stderr.emit('data', Buffer.from('expected value at line 1 column 1'));
    child.emit('close', 1);

    await expect(result).rejects.toThrow('expected value at line 1 column 1');
  });

  it('returns a setup hint when the Jason CLI is missing', async () => {
    process.env.JASON_CLI_PATH = '/tmp/missing-jason';
    const child = createMockChild();
    spawnMock.mockReturnValue(child as ReturnType<typeof spawn>);
    const service = new JasonCliService();
    const error = new Error('spawn ENOENT') as NodeJS.ErrnoException;
    error.code = 'ENOENT';

    const result = service.format('{"a":1}');

    child.emit('error', error);

    await expect(result).rejects.toThrow(
      'Jason CLI not found at "/tmp/missing-jason"',
    );
  });
});
