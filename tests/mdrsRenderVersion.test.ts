import { expect, test } from 'bun:test';
import path from 'node:path';
import { RENDER_VERSION } from '../packages/mdrs/core/src/version.ts';

const pinned = {
    renderVersion: 4,
    snapshotSha256: '0e17622c397ca4f6f96aa24d9579ea4b8bf3070708198734c9b3fe9326598d3e'
};

test('RENDER_VERSION changes whenever MDRS output changes', async () => {
    const snapshot = await Bun.file(
        path.resolve(import.meta.dir, '__snapshots__/mdrsDocsSnapshot.test.ts.snap')
    ).bytes();
    const hash = new Bun.CryptoHasher('sha256').update(snapshot).digest('hex');
    const message =
        'The MDRS snapshot changed. Stored post renders are now stale: bump RENDER_VERSION in packages/mdrs/core/src/version.ts, then update renderVersion and snapshotSha256 here.';
    expect(hash, message).toBe(pinned.snapshotSha256);
    expect(RENDER_VERSION, message).toBe(pinned.renderVersion);
});
