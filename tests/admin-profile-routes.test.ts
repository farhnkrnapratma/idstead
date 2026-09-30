import {expect, test} from 'bun:test';

test('admin profile routes preserve user RPC context, auth guards, partial import and cleanup failures', async () => {
  const child = Bun.spawn(
    [process.execPath, 'tests/helpers/adminProfileRoutes.ts'],
    {stdout: 'pipe', stderr: 'pipe'}
  );
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited
  ]);
  if (code !== 0) throw new Error(stdout + stderr);
  expect(stdout).toContain('Admin profile route regressions passed');
}, 30000);
