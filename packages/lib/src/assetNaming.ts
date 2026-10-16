const MAX_NAME_LENGTH = 80;

function baseName(original: string) {
    const name = original.split(/[\\/]/).pop() ?? '';
    const dot = name.lastIndexOf('.');
    return dot > 0 ? name.slice(0, dot) : name;
}

function words(original: string) {
    return baseName(original)
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '')
        .split(/[^\p{L}\p{N}]+/u)
        .filter(Boolean);
}

export function assetFileName(original: string, fallback: 'image' | 'video' = 'image') {
    const name = words(original)
        .join('-')
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, '')
        .replace(/-+/g, '-')
        .slice(0, MAX_NAME_LENGTH)
        .replace(/^-+|-+$/g, '');
    return name || fallback;
}

export function assetAltText(original: string, fallback = 'Image') {
    const parts = words(original).map(word =>
        word.length > 1 && word === word.toUpperCase() && /\p{L}/u.test(word) ?
            word
        :   word.toLowerCase()
    );
    if (!parts.length) return fallback;
    const [first, ...rest] = parts;
    return [first.charAt(0).toUpperCase() + first.slice(1), ...rest].join(' ');
}
