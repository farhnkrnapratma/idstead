// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { expect, test } from 'bun:test';
import path from 'node:path';
import { RENDER_VERSION } from '../packages/mdrs/core/src/version.ts';

const pinned = {
    renderVersion: 5,
    snapshotSha256: 'a268436593e208d29bbe5238fc3754b0d36b9c3bf5a283fd663defe13725a19f'
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
