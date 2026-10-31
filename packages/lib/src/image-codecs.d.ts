// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

declare module 'upng-js' {
    const codec: {
        encode(images: ArrayBuffer[], width: number, height: number, colors: number): ArrayBuffer;
        decode(data: ArrayBuffer): { width: number; height: number };
        toRGBA8(image: unknown): ArrayBuffer[];
    };
    export default codec;
}
declare module 'imagetracerjs' {
    const tracer: { imagedataToSVG(image: ImageData, options: Record<string, unknown>): string };
    export default tracer;
}
