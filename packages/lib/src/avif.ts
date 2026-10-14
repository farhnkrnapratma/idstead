export function inspectAvif(
    bytes: Uint8Array,
    limits: { maxBytes: number; width: number; height: number }
) {
    const invalid = (): never => {
        throw new Error(
            `Image must be a valid AVIF at ${limits.width} × ${limits.height} pixels and no larger than ${Math.round(limits.maxBytes / 1024)} KiB.`
        );
    };
    if (bytes.length < 16 || bytes.length > limits.maxBytes) return invalid();
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const tag = (offset: number) => String.fromCharCode(...bytes.subarray(offset, offset + 4));

    function boxes(start: number, end: number) {
        const found: { type: string; start: number; end: number }[] = [];
        let offset = start;
        while (offset < end) {
            if (offset + 8 > end) return invalid();
            let size = view.getUint32(offset);
            let header = 8;
            if (size === 1) {
                if (offset + 16 > end) return invalid();
                const high = view.getUint32(offset + 8);
                if (high) return invalid();
                size = view.getUint32(offset + 12);
                header = 16;
            } else if (size === 0) size = end - offset;
            if (size < header || offset + size > end) return invalid();
            found.push({ type: tag(offset + 4), start: offset + header, end: offset + size });
            offset += size;
        }
        return found;
    }

    const top = boxes(0, bytes.length);
    const ftyp = top[0];
    if (ftyp?.type !== 'ftyp' || !['avif', 'avis'].includes(tag(ftyp.start))) return invalid();
    const meta = top.find(box => box.type === 'meta');
    if (!meta || !top.some(box => box.type === 'mdat')) return invalid();
    const iprp = boxes(meta.start + 4, meta.end).find(box => box.type === 'iprp');
    const ipco = iprp && boxes(iprp.start, iprp.end).find(box => box.type === 'ipco');
    const ispe = ipco && boxes(ipco.start, ipco.end).find(box => box.type === 'ispe');
    if (!ispe || ispe.end - ispe.start < 12) return invalid();
    const width = view.getUint32(ispe.start + 4);
    const height = view.getUint32(ispe.start + 8);
    if (width !== limits.width || height !== limits.height) return invalid();
    return { width, height, bytes: bytes.length, type: 'image/avif' as const };
}
