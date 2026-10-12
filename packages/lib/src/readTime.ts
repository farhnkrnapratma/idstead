const SCRIPTED_CHARS_RE =
    /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff01-\uff60\uff66-\uff9f]/g;

const WORDS_PER_MINUTE = 200;
const SCRIPTED_CHARS_PER_MINUTE = 400;

export function countReadingMinutes(text: string): number {
    const scripted = text.match(SCRIPTED_CHARS_RE)?.length ?? 0;
    const words = text.replace(SCRIPTED_CHARS_RE, ' ').trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE + scripted / SCRIPTED_CHARS_PER_MINUTE));
}

export function estimateReadTime(text: string): string {
    const minutes = countReadingMinutes(text);
    return `${minutes} min${minutes > 1 ? 's' : ''} read`;
}
