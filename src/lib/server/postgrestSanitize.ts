export function escapePostgrestFilter(term: string): string {
    if (!term) return '';

    return term
        .replace(/\\/g, '\\\\')
        .replace(/%/g, '\\%')
        .replace(/_/g, '\\_')
        .replace(/[,().\n\r\t]/g, ' ')
        .trim();
}
