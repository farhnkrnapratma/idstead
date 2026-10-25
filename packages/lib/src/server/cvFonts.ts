import sans from '@fontsource/ia-writer-quattro/files/ia-writer-quattro-latin-400-normal.woff?inline';
import sansBold from '@fontsource/ia-writer-quattro/files/ia-writer-quattro-latin-700-normal.woff?inline';
import sansItalic from '@fontsource/ia-writer-quattro/files/ia-writer-quattro-latin-400-italic.woff?inline';
import mono from '@fontsource/lilex/files/lilex-latin-400-normal.woff?inline';
import type { CvFontBytes } from './pdfGenerator';

function decode(dataUri: string): Uint8Array {
    const binary = atob(dataUri.slice(dataUri.indexOf(',') + 1));
    return Uint8Array.from(binary, char => char.charCodeAt(0));
}

let cached: CvFontBytes | null = null;

export function loadCvFonts(): CvFontBytes {
    cached ??= {
        sans: decode(sans),
        sansBold: decode(sansBold),
        sansItalic: decode(sansItalic),
        mono: decode(mono)
    };
    return cached;
}
