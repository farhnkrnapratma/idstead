import { requiredText } from '@idstead/domain/fieldValidation.ts';

export function listFieldError(
    field: string,
    label: string,
    value: string,
    optional: boolean
): string {
    if (optional && !value.trim()) return '';
    const required = requiredText(label)(value);
    if (required) return required;
    if (['url', 'href'].includes(field) && !/^(https?:\/\/|mailto:|tel:).+/i.test(value))
        return 'Must start with http://, https://, mailto:, or tel:';
    return '';
}
