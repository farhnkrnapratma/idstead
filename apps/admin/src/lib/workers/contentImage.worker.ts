// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { rasterContentImage } from '../rasterImage';

self.onmessage = async (event: MessageEvent<{ file: Blob }>) => {
    try {
        self.postMessage(await rasterContentImage(event.data.file));
    } catch (error) {
        self.postMessage({
            error: error instanceof Error ? error.message : 'Image processing failed.'
        });
    }
};
