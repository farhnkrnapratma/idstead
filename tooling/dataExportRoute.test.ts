// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { admin } from './routes/support.ts';

const state = { stamp: '', warnings: [] as string[] };

mock.module('../packages/lib/src/server/dataExport.ts', () => ({
    buildDataExport: async (_service: unknown, _platform: unknown, stampInput: string | null) => ({
        zip: new Uint8Array([80, 75]),
        stamp: stampInput ?? 'generated',
        warnings: state.warnings
    })
}));

const dataExport =
    await import('../apps/admin/src/routes/api/internal/admin/data/export/+server.ts');

function get(path: string) {
    const url = new URL(`https://admin.example.com/api/internal/admin/${path}`);
    return { request: new Request(url), url, platform: {} } as any;
}

beforeEach(() => {
    admin.response = null;
    admin.service = {};
    state.stamp = '';
    state.warnings = [];
});

describe('admin data export route', () => {
    test('streams a zip named for the stamp and reports how many parts failed', async () => {
        state.warnings = ['siteData: store down', 'activity: store down'];
        const response = await dataExport.GET(get('data/export?stamp=20260102T030405Z'));
        expect(response.status).toBe(200);
        expect(response.headers.get('content-type')).toBe('application/zip');
        expect(response.headers.get('content-disposition')).toBe(
            'attachment; filename="data-export_20260102T030405Z.zip"'
        );
        expect(response.headers.get('x-export-warnings')).toBe('2');
        expect(response.headers.get('cache-control')).toBe('no-store');
    });

    test('reports zero warnings for a complete export', async () => {
        const response = await dataExport.GET(get('data/export'));
        expect(response.headers.get('x-export-warnings')).toBe('0');
    });

    test('refuses the export when the admin check fails', async () => {
        admin.response = Response.json({ code: 'DATA_STORAGE_UNAVAILABLE' }, { status: 503 });
        expect((await dataExport.GET(get('data/export'))).status).toBe(503);
    });
});
