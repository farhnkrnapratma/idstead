// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { runImageWorker } from './imageWorker';
import type { RasterOutput } from './rasterImage';

export function processBanner(file: Blob, signal: AbortSignal): Promise<RasterOutput> {
    return runImageWorker(
        () =>
            new Worker(new URL('./workers/banner.worker.ts', import.meta.url), { type: 'module' }),
        { file },
        { signal }
    );
}
