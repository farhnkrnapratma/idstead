import {expect, test} from 'bun:test';

test('server telemetry omits credentials and never captures request bodies', async () => {
  const child = Bun.spawn(
    [
      process.execPath,
      '--conditions=worker',
      'tests/helpers/passwordTelemetry.ts'
    ],
    {stdout: 'pipe', stderr: 'pipe'}
  );
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited
  ]);
  if (code !== 0) throw new Error(stdout + stderr);
  expect(stdout).toContain('Password telemetry regressions passed');
});
