export function pluralize(
    count: number,
    singular: string,
    plural: string = `${singular}s`,
    format: (count: number) => string = String
): string {
    return `${format(count)} ${count === 1 ? singular : plural}`;
}
