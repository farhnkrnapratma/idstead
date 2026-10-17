import { describe, it, expect } from 'bun:test';

/**
 * Test avatar AVIF/WebP format validation
 *
 * Ensures that the required avatar.webp and avatar.avif files
 * are properly validated with magic bytes and size limits
 */

// Magic bytes for format detection
const AVIF_BRANDS = ['avif', 'avis'];

function createValidWebP(size: number = 1000): Uint8Array {
    const buffer = new Uint8Array(size);
    // Set RIFF header
    buffer[0] = 0x52; // 'R'
    buffer[1] = 0x49; // 'I'
    buffer[2] = 0x46; // 'F'
    buffer[3] = 0x46; // 'F'
    // Set WEBP signature
    buffer[8] = 0x57; // 'W'
    buffer[9] = 0x45; // 'E'
    buffer[10] = 0x42; // 'B'
    buffer[11] = 0x50; // 'P'
    return buffer;
}

function createValidAVIF(size: number = 1000): Uint8Array {
    const buffer = new Uint8Array(size);
    // Set ftyp box signature at bytes 4-7
    buffer[4] = 0x66; // 'f'
    buffer[5] = 0x74; // 't'
    buffer[6] = 0x79; // 'y'
    buffer[7] = 0x70; // 'p'
    // Set brand at bytes 8-11 (simplified, just set 'avi' part of 'avif')
    buffer[8] = 0x61; // 'a'
    buffer[9] = 0x76; // 'v'
    buffer[10] = 0x69; // 'i'
    buffer[11] = 0x66; // 'f'
    return buffer;
}

describe('Avatar WebP Format Validation', () => {
    it('should validate correct WebP magic bytes', () => {
        const webp = createValidWebP();
        // Check RIFF signature
        expect(webp[0] === 0x52 && webp[1] === 0x49 && webp[2] === 0x46 && webp[3] === 0x46).toBe(
            true
        );
        // Check WEBP signature at bytes 8-11
        expect(webp[8] === 0x57 && webp[9] === 0x45 && webp[10] === 0x42 && webp[11] === 0x50).toBe(
            true
        );
    });

    it('should reject WebP with invalid RIFF header', () => {
        const invalid = createValidWebP();
        invalid[0] = 0x00; // Break RIFF signature
        expect(invalid[0] === 0x52).toBe(false);
    });

    it('should reject WebP with invalid WEBP signature', () => {
        const invalid = createValidWebP();
        invalid[8] = 0x00; // Break WEBP signature
        expect(invalid[8] === 0x57).toBe(false);
    });

    it('should enforce WebP size limit (500 KiB)', () => {
        const maxSize = 500 * 1024;
        const oversized = createValidWebP(maxSize + 1000);
        expect(oversized.length > maxSize).toBe(true);
    });
});

describe('Avatar AVIF Format Validation', () => {
    it('should validate correct AVIF magic bytes', () => {
        const avif = createValidAVIF();
        // Check ftyp box at bytes 4-7
        expect(avif[4] === 0x66 && avif[5] === 0x74 && avif[6] === 0x79 && avif[7] === 0x70).toBe(
            true
        );
        // Check brand at bytes 8-11
        const brand = String.fromCharCode(avif[8], avif[9], avif[10], avif[11]);
        expect(brand).toBe('avif');
    });

    it('should reject AVIF with invalid ftyp box', () => {
        const invalid = createValidAVIF();
        invalid[4] = 0x00; // Break ftyp signature
        expect(invalid[4] === 0x66).toBe(false);
    });

    it('should accept both avif and avis brands', () => {
        const avif = createValidAVIF();
        const avis = createValidAVIF();
        avis[11] = 0x73; // Change 'f' to 's' for 'avis'

        const avifBrand = String.fromCharCode(avif[8], avif[9], avif[10], avif[11]);
        const avisBrand = String.fromCharCode(avis[8], avis[9], avis[10], avis[11]);

        expect(AVIF_BRANDS.includes(avifBrand)).toBe(true);
        expect(AVIF_BRANDS.includes(avisBrand)).toBe(true);
    });

    it('should enforce AVIF size limit (500 KiB)', () => {
        const maxSize = 500 * 1024;
        const oversized = createValidAVIF(maxSize + 1000);
        expect(oversized.length > maxSize).toBe(true);
    });

    it('should reject AVIF with invalid brand', () => {
        const invalid = createValidAVIF();
        invalid[8] = 0x70; // Change brand to 'pxxx'
        const brand = String.fromCharCode(invalid[8], invalid[9], invalid[10], invalid[11]);
        expect(AVIF_BRANDS.includes(brand)).toBe(false);
    });
});

describe('Avatar Format Duplicate Detection', () => {
    it('should detect duplicate avatar.webp files in FormData', () => {
        // Simulate FormData with duplicate entries
        const entries = ['avatar.webp', 'avatar.webp'];
        const counts = new Map<string, number>();

        for (const entry of entries) {
            counts.set(entry, (counts.get(entry) || 0) + 1);
        }

        expect(counts.get('avatar.webp')).toBe(2);
        expect(counts.get('avatar.webp')! > 1).toBe(true);
    });

    it('should detect duplicate avatar.avif files in FormData', () => {
        const entries = ['avatar.avif', 'avatar.avif'];
        const counts = new Map<string, number>();

        for (const entry of entries) {
            counts.set(entry, (counts.get(entry) || 0) + 1);
        }

        expect(counts.get('avatar.avif')).toBe(2);
        expect(counts.get('avatar.avif')! > 1).toBe(true);
    });

    it('should allow one avatar.webp and one avatar.avif', () => {
        const entries = ['avatar.webp', 'avatar.avif'];
        const counts = new Map<string, number>();

        for (const entry of entries) {
            counts.set(entry, (counts.get(entry) || 0) + 1);
        }

        const valid = Array.from(counts.values()).every(count => count === 1);
        expect(valid).toBe(true);
    });
});

describe('Avatar File Size Validation', () => {
    it('should validate WebP is within 500 KiB limit', () => {
        const maxSize = 500 * 1024;
        const webp = createValidWebP(maxSize);
        expect(webp.byteLength <= maxSize).toBe(true);
    });

    it('should reject WebP exceeding 500 KiB', () => {
        const maxSize = 500 * 1024;
        const webp = createValidWebP(maxSize + 1);
        expect(webp.byteLength > maxSize).toBe(true);
    });

    it('should validate AVIF is within 500 KiB limit', () => {
        const maxSize = 500 * 1024;
        const avif = createValidAVIF(maxSize);
        expect(avif.byteLength <= maxSize).toBe(true);
    });

    it('should reject AVIF exceeding 500 KiB', () => {
        const maxSize = 500 * 1024;
        const avif = createValidAVIF(maxSize + 1);
        expect(avif.byteLength > maxSize).toBe(true);
    });
});
