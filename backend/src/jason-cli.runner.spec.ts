import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import {
  JasonCliError,
  JasonCliRunner,
  minimalJasonEnvironment,
} from './jason-cli.runner';

jest.mock('node:child_process', () => ({ spawn: jest.fn() }));

const spawnMock = spawn as jest.MockedFunction<typeof spawn>;

function mockChild() {
  const child = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
    stdin: EventEmitter & { end: jest.Mock };
    kill: jest.Mock;
  };
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.stdin = Object.assign(new EventEmitter(), { end: jest.fn() });
  child.kill = jest.fn();
  return child;
}

describe('JasonCliRunner', () => {
  beforeEach(() => jest.clearAllMocks());

  it.each([
    ['format', ['format', '--stdin'], ['{}'], '{}'],
    ['diff', ['diff', '--stdin'], ['{"a":1}', '{"a":2}'], '{"a":1}\0{"a":2}'],
    [
      'patch',
      ['patch', '--stdin'],
      ['{"a":1}', '[{"op":"remove","path":"/a"}]'],
      '{"a":1}\0[{"op":"remove","path":"/a"}]',
    ],
    ['pointer', ['pointer', '--stdin'], ['{"a":1}', '/a'], '{"a":1}\0/a'],
  ] as const)(
    'uses the fixed %s mapping, stdin, no shell, and supplied environment',
    async (method, args, inputs, expectedInput) => {
      const child = mockChild();
      spawnMock.mockReturnValue(child as ReturnType<typeof spawn>);
      const runner = new JasonCliRunner({
        cliPath: '/opt/jason',
        environment: { PATH: '/usr/bin' },
      });

      const result = runner[method](...inputs);
      child.stdout.emit('data', Buffer.from('{}\n'));
      child.emit('close', 0);

      await expect(result).resolves.toBe('{}');
      expect(spawnMock).toHaveBeenCalledWith('/opt/jason', args, {
        env: { PATH: '/usr/bin' },
        shell: false,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      expect(child.stdin.end).toHaveBeenCalledWith(expectedInput);
    },
  );

  it('stops output that exceeds the configured cap', async () => {
    const child = mockChild();
    spawnMock.mockReturnValue(child as ReturnType<typeof spawn>);
    const runner = new JasonCliRunner({ maxStdoutBytes: 3 });

    const result = runner.format('{}');
    child.stdout.emit('data', Buffer.from('four'));

    await expect(result).rejects.toMatchObject({ code: 'OUTPUT_LIMIT' });
    expect(child.kill).toHaveBeenCalledWith('SIGTERM');
  });

  it('bounds error output before a failed process can disclose it', async () => {
    const child = mockChild();
    spawnMock.mockReturnValue(child as ReturnType<typeof spawn>);
    const runner = new JasonCliRunner({ maxStderrBytes: 3 });

    const result = runner.format('{}');
    child.stderr.emit('data', Buffer.from('secret'));

    await expect(result).rejects.toMatchObject({ code: 'OUTPUT_LIMIT' });
    expect(child.kill).toHaveBeenCalledWith('SIGTERM');
  });

  it('times out, supports cancellation, and does not queue concurrent calls', async () => {
    jest.useFakeTimers();
    try {
      const child = mockChild();
      spawnMock.mockReturnValue(child as ReturnType<typeof spawn>);
      const runner = new JasonCliRunner({
        maxConcurrentRuns: 1,
        timeoutMs: 25,
      });

      const first = runner.format('{}');
      const timedOut = expect(first).rejects.toMatchObject({ code: 'TIMEOUT' });
      await expect(runner.format('{}')).rejects.toMatchObject({ code: 'BUSY' });
      await jest.advanceTimersByTimeAsync(25);
      await timedOut;
      child.emit('error', new Error('termination failed'));
      await expect(runner.format('{}')).rejects.toMatchObject({ code: 'BUSY' });
      await jest.advanceTimersByTimeAsync(250);
      expect(child.kill).toHaveBeenCalledWith('SIGKILL');
      child.emit('close', null);

      const nextChild = mockChild();
      spawnMock.mockReturnValue(nextChild as ReturnType<typeof spawn>);
      const cancellation = new AbortController();
      const cancelled = runner.format('{}', cancellation.signal);
      cancellation.abort();
      await expect(cancelled).rejects.toMatchObject({ code: 'ABORTED' });
      expect(nextChild.kill).toHaveBeenCalledWith('SIGTERM');
      nextChild.emit('close', null);
    } finally {
      jest.useRealTimers();
    }
  });

  it('sanitizes a missing executable and strips unrelated environment values', async () => {
    const child = mockChild();
    spawnMock.mockReturnValue(child as ReturnType<typeof spawn>);
    const runner = new JasonCliRunner({ cliPath: '/secret/location/jason' });
    const error = new Error('spawn ENOENT') as NodeJS.ErrnoException;
    error.code = 'ENOENT';

    const result = runner.format('{}');
    child.emit('error', error);

    await expect(result).rejects.toEqual(
      new JasonCliError(
        'CLI_NOT_FOUND',
        'The Jason CLI executable could not be found.',
      ),
    );
    expect(
      minimalJasonEnvironment({
        PATH: '/usr/bin',
        OPENAI_API_KEY: 'must-not-leak',
        SECRET: 'must-not-leak',
      }),
    ).toEqual({ PATH: '/usr/bin' });
  });
});
