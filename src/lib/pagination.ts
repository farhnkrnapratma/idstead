export function pageCount(total: number, size: number) {
    return Math.max(1, Math.ceil(total / size));
}

export function clampPage(page: number, total: number, size: number) {
    return Math.min(Math.max(1, page), pageCount(total, size));
}

export function pageSlice<T>(items: T[], page: number, size: number) {
    const current = clampPage(page, items.length, size);
    return items.slice((current - 1) * size, current * size);
}

export function pageOfIndex(index: number, size: number) {
    return Math.floor(index / size) + 1;
}
