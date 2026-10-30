import { expect, test } from 'bun:test';
import path from 'node:path';
import { RENDER_VERSION } from '../packages/mdrs/core/src/version.ts';

const pinned = {
    renderVersion: 3,
    snapshotSha256: 'f1cf3d34f030dc79ac047222d1ec6fcab371af72c388507701a293dedd291d7b'
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
