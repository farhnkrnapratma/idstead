import UPNG from 'upng-js';
import { Inflate } from 'pako';
import { crc32 } from '#lib/png.ts';
import { IMAGE_LIMIT, iconSizes, buildSvg, type SvgPath } from '#lib/siteIdentity.ts';

export function validatePng(buffer: ArrayBuffer, size: number) {
    const bytes = new Uint8Array(buffer);
    const view = new DataView(buffer);
    if (
        bytes.length < 45
        || bytes.length > IMAGE_LIMIT
        || [137, 80, 78, 71, 13, 10, 26, 10].some((byte, i) => bytes[i] !== byte)
        || view.getUint32(16) !== size
        || view.getUint32(20) !== size
        || ![1, 2, 4, 8].includes(bytes[24])
        || bytes[28] !== 0
    )
        throw new Error('Invalid PNG dimensions or format.');
    const inflater = new Inflate();
    let inflated = 0;
    let dataSeen = false;
    let ended = false;
    inflater.onData = chunk => {
        inflated += chunk.length;
        if (inflated > (size * 4 + 1) * size)
            throw new Error('Image decompression limit exceeded.');
    };
    for (let pos = 8; pos < bytes.length;) {
        if (pos + 12 > bytes.length) throw new Error('Truncated PNG.');
        const length = view.getUint32(pos);
        if (pos + length + 12 > bytes.length) throw new Error('Truncated PNG.');
        const name = String.fromCharCode(...bytes.subarray(pos + 4, pos + 8));
        if (crc32(bytes.subarray(pos + 4, pos + 8 + length)) !== view.getUint32(pos + 8 + length))
            throw new Error('Invalid PNG checksum.');
        if ((pos === 8 && (name !== 'IHDR' || length !== 13)) || (pos !== 8 && name === 'IHDR'))
            throw new Error('Invalid PNG header.');
        if (!['IHDR', 'PLTE', 'tRNS', 'IDAT', 'IEND', 'sRGB'].includes(name))
            throw new Error('Unsupported image metadata.');
        if (name === 'IDAT') {
            dataSeen = true;
            inflater.push(bytes.subarray(pos + 8, pos + 8 + length));
        }
        if (name === 'IEND') {
            ended = length === 0 && pos + 12 === bytes.length;
            break;
        }
        pos += length + 12;
    }
    inflater.push(new Uint8Array(), true);
    if (!dataSeen || !ended || inflater.err || !inflated) throw new Error('Invalid PNG data.');
    const decoded = UPNG.decode(buffer);
    const pixels = UPNG.toRGBA8(decoded);
    if (pixels.length !== 1 || pixels[0].byteLength !== size * size * 4)
        throw new Error('Invalid image pixels.');
}

export function validateIco(buffer: ArrayBuffer) {
    if (buffer.byteLength < 54 || buffer.byteLength > IMAGE_LIMIT) throw new Error('Invalid ICO.');
    const view = new DataView(buffer);
    if (
        view.getUint16(0, true) !== 0
        || view.getUint16(2, true) !== 1
        || view.getUint16(4, true) !== 3
    )
        throw new Error('Invalid ICO.');
    let position = 54;
    for (const [i, size] of [16, 32, 48].entries()) {
        const entry = 6 + i * 16;
        const length = view.getUint32(entry + 8, true);
        if (
            view.getUint8(entry) !== size
            || view.getUint8(entry + 1) !== size
            || view.getUint32(entry + 12, true) !== position
            || position + length > buffer.byteLength
        )
            throw new Error('Invalid ICO directory.');
        validatePng(buffer.slice(position, position + length), size);
        position += length;
    }
    if (position !== buffer.byteLength) throw new Error('Invalid ICO length.');
}

export async function validateAvatar(form: FormData): Promise<Record<string, ArrayBuffer> | null> {
    const required = [...Object.keys(iconSizes), 'favicon.ico', 'vector'];
    const optional = ['avatar.webp', 'avatar.avif'];
    const entries = Array.from(form.keys()).filter(key => key !== 'profile');
    if (!entries.length) return null;
    // Check that all required fields are present and optional fields don't have duplicates
    const missingRequired = required.filter(key => form.getAll(key).length !== 1);
    if (missingRequired.length > 0) throw new Error('Upload the complete icon package.');
    const extraEntries = entries.filter(key => !required.includes(key) && !optional.includes(key));
    if (extraEntries.length > 0) throw new Error('Upload the complete icon package.');
    const files: Record<string, ArrayBuffer> = {};
    for (const [name, size] of Object.entries(iconSizes)) {
        const file = form.get(name);
        if (!(file instanceof File) || file.size > IMAGE_LIMIT)
            throw new Error('Invalid image file.');
        const bytes = await file.arrayBuffer();
        validatePng(bytes, size);
        files[name] = bytes;
    }
    const ico = form.get('favicon.ico');
    if (!(ico instanceof File)) throw new Error('Missing ICO.');
    files['favicon.ico'] = await ico.arrayBuffer();
    validateIco(files['favicon.ico']);
    const vector = form.get('vector');
    if (typeof vector !== 'string' || vector.length > IMAGE_LIMIT)
        throw new Error('Invalid vector icon.');
    files['favicon.svg'] = new TextEncoder().encode(
        buildSvg(JSON.parse(vector) as SvgPath[])
    ).buffer;
    // Handle optional avatar.webp and avatar.avif with validation
    for (const name of optional) {
        const instances = form.getAll(name);
        if (instances.length > 1) throw new Error(`Duplicate ${name} file.`);
        const file = instances[0];
        if (file instanceof File) {
            if (file.size > IMAGE_LIMIT) throw new Error(`${name} must be no larger than 500 KiB.`);
            const bytes = new Uint8Array(await file.arrayBuffer());
            // Validate magic bytes: WebP starts with 'RIFF...WEBP', AVIF has 'ftyp' box
            if (name === 'avatar.webp') {
                if (
                    bytes.length < 12
                    || String.fromCharCode(...bytes.slice(0, 4)) !== 'RIFF'
                    || String.fromCharCode(...bytes.slice(8, 12)) !== 'WEBP'
                )
                    throw new Error('Invalid WebP format.');
            } else if (name === 'avatar.avif') {
                if (
                    bytes.length < 12
                    || String.fromCharCode(...bytes.slice(4, 8)) !== 'ftyp'
                    || (String.fromCharCode(...bytes.slice(8, 12)) !== 'avif'
                        && String.fromCharCode(...bytes.slice(8, 12)) !== 'avis')
                )
                    throw new Error('Invalid AVIF format.');
            }
            files[name] = bytes.buffer;
        }
    }
    return files;
}
