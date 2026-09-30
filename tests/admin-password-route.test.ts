import {expect, test} from 'bun:test';

test('admin password changes enforce auth, MFA, policy, and rate limits without breach requests', async () => {
  const child = Bun.spawn(
    [process.execPath, 'tests/helpers/adminPasswordRoute.ts'],
    {stdout: 'pipe', stderr: 'pipe'}
  );
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited
  ]);
  if (code !== 0) throw new Error(stdout + stderr);
  expect(stdout).toContain('Admin password route regressions passed');
});
