import { encode, QrCodeDataType } from 'uqr';

export const QR_COLOR = '#000000';
export const QR_BACKGROUND = '#ffffff';

const QUIET_ZONE = 3;
const DOT_RADIUS = 0.44;
const FINDER_SIZE = 7;
const MODULE_PX = 16;
const DATA_URL_PATTERN = /^data:image\/(png|webp|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/;
const COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

export interface QrSvgOptions {
    logoDataUrl?: string;
    color?: string;
    background?: string;
}

function round(value: number) {
    return Number(value.toFixed(2));
}

function logoZone(size: number) {
    const span = Math.max(5, Math.round(size * 0.22) | 1);
    const start = (size - span) / 2;
    return { start, end: start + span, span };
}

function dotPath(x: number, y: number) {
    const cx = round(x + 0.5 - DOT_RADIUS);
    const cy = round(y + 0.5);
    const d = round(DOT_RADIUS * 2);
    return `M${cx} ${cy}a${DOT_RADIUS} ${DOT_RADIUS} 0 1 0 ${d} 0a${DOT_RADIUS} ${DOT_RADIUS} 0 1 0 -${d} 0`;
}

function finder(x: number, y: number, color: string) {
    const ring = `<rect x="${x + 0.5}" y="${y + 0.5}" width="6" height="6" rx="1.9" fill="none" stroke="${color}" stroke-width="1"/>`;
    const eye = `<circle cx="${x + 3.5}" cy="${y + 3.5}" r="1.5" fill="${color}"/>`;
    return `<g data-qr-finder="">${ring}${eye}</g>`;
}

function alignment(cx: number, cy: number, color: string) {
    const ring = `<rect x="${cx - 1.5}" y="${cy - 1.5}" width="4" height="4" rx="1.3" fill="none" stroke="${color}" stroke-width="1"/>`;
    const eye = `<circle cx="${cx + 0.5}" cy="${cy + 0.5}" r="0.5" fill="${color}"/>`;
    return `<g data-qr-alignment="">${ring}${eye}</g>`;
}

function isAlignmentCenter(types: QrCodeDataType[][], data: boolean[][], x: number, y: number) {
    if (!data[y][x]) return false;
    for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            if (types[y + dy]?.[x + dx] !== QrCodeDataType.Alignment || data[y + dy][x + dx])
                return false;
        }
    }
    return true;
}

export function renderQrSvg(text: string, options: QrSvgOptions = {}) {
    const color = COLOR_PATTERN.test(options.color ?? '') ? options.color! : QR_COLOR;
    const background =
        COLOR_PATTERN.test(options.background ?? '') ? options.background! : QR_BACKGROUND;
    const logo =
        options.logoDataUrl && DATA_URL_PATTERN.test(options.logoDataUrl) ?
            options.logoDataUrl
        :   undefined;

    const qr = encode(text, { ecc: 'H', border: 0 });
    const size = qr.size;
    const zone = logo ? logoZone(size) : null;
    const inZone = (x: number, y: number) =>
        zone !== null && x >= zone.start && x < zone.end && y >= zone.start && y < zone.end;

    let dots = '';
    let alignments = '';
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const type = qr.types[y][x];
            if (inZone(x, y) || type === QrCodeDataType.Position) continue;
            if (type === QrCodeDataType.Alignment) {
                if (isAlignmentCenter(qr.types, qr.data, x, y))
                    alignments += alignment(x, y, color);
                continue;
            }
            if (qr.data[y][x]) dots += dotPath(x, y);
        }
    }

    const finders = [
        finder(0, 0, color),
        finder(size - FINDER_SIZE, 0, color),
        finder(0, size - FINDER_SIZE, color)
    ].join('');

    let logoMarkup = '';
    if (zone && logo) {
        const center = size / 2;
        const plate = zone.span / 2;
        const image = zone.span - 1;
        logoMarkup =
            `<circle cx="${center}" cy="${center}" r="${plate}" fill="${background}"/>`
            + `<image href="${logo}" x="${round(center - image / 2)}" y="${round(center - image / 2)}" width="${image}" height="${image}" preserveAspectRatio="xMidYMid slice"/>`;
    }

    const total = size + QUIET_ZONE * 2;
    const px = total * MODULE_PX;
    return (
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${px}" height="${px}" shape-rendering="geometricPrecision">`
        + `<rect width="${total}" height="${total}" rx="${QUIET_ZONE}" fill="${background}"/>`
        + `<g transform="translate(${QUIET_ZONE} ${QUIET_ZONE})">`
        + `<path fill="${color}" d="${dots}"/>`
        + finders
        + alignments
        + logoMarkup
        + `</g></svg>`
    );
}
