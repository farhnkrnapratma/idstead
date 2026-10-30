import { expect, test } from 'bun:test';
import path from 'node:path';
import { RENDER_VERSION } from '../packages/mdrs/core/src/version.ts';

const pinned = {
    renderVersion: 3,
    snapshotSha256: '806dccff3cf8119e2258085d46dfcf1e0a5196d22af256ded6813224da0d65ac'
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
