// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, test } from 'bun:test';
import {
    resumeBundleKey,
    resumeChecksums,
    resumeKey
} from '../packages/lib/src/server/resumeChecksums.ts';

describe('Resume checksums', () => {
    test('match coreutils output for "abc"', async () => {
        const { files } = await resumeChecksums(new TextEncoder().encode('abc'), 'resume.pdf');
        expect(files.md5).toBe('900150983cd24fb0d6963f7d28e17f72  resume.pdf\n');
        expect(files.sha256).toBe(
            'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad  resume.pdf\n'
        );
        expect(files.sha512.startsWith('ddaf35a193617aba')).toBe(true);
        expect(files.b2.startsWith('ba80a53f981c4d0d6a2797b69f12f6e9')).toBe(true);
    });

    test('keys stay inside resume/', () => {
        expect(resumeKey('Resume-Ada-1234567-v1.0.pdf', 'b2')).toBe(
            'resume/Resume-Ada-1234567-v1.0.pdf.b2'
        );
        expect(() => resumeKey('../x.pdf')).toThrow('Invalid resume filename.');
        expect(resumeBundleKey('Resume-Ada-1234567-v1.0.pdf')).toBe(
            'resume/Resume-Ada-1234567-v1.0-verify.zip'
        );
        expect(() => resumeBundleKey('../x.pdf')).toThrow('Invalid resume filename.');
    });
});
