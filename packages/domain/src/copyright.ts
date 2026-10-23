export const PRODUCT_NAME = 'Idstead';

export function copyrightLine(name: string | null | undefined, year: number): string {
    const holder = name?.trim() || PRODUCT_NAME;
    return `© ${year} ${holder}.`;
}
