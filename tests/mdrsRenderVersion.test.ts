import { expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { RENDER_VERSION } from '../packages/mdrs-core/src/version.ts';

const pinned = {
    renderVersion: 2,
    snapshotSha256: 'da374b4b8a6f1cf3c4cfc6a89fd1ff0e260bc351fbaa8ca08702f6e5886696b9'
};

test('RENDER_VERSION changes whenever MDRS output changes', () => {
    const snapshot = readFileSync(
        path.resolve(import.meta.dir, '__snapshots__/mdrsDocsSnapshot.test.ts.snap')
    );
    const hash = createHash('sha256').update(snapshot).digest('hex');
    const message =
        'The MDRS snapshot changed. Stored post renders are now stale: bump RENDER_VERSION in packages/mdrs-core/src/version.ts, then update renderVersion and snapshotSha256 here.';
    expect(hash, message).toBe(pinned.snapshotSha256);
    expect(RENDER_VERSION, message).toBe(pinned.renderVersion);
});
