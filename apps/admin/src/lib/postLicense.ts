import type { BannerCredit, BannerOrigin } from '@idstead/domain/contentLicense.ts';

export interface BannerCreditForm {
    origin: BannerOrigin;
    author: string;
    url: string;
    license: string;
    tool: string;
}

export function bannerCreditForm(credit: BannerCredit | null): BannerCreditForm {
    const form: BannerCreditForm = { origin: 'own', author: '', url: '', license: '', tool: '' };
    if (credit?.origin === 'third-party')
        return {
            ...form,
            origin: 'third-party',
            author: credit.author,
            url: credit.url ?? '',
            license: credit.license ?? ''
        };
    if (credit?.origin === 'ai-generated')
        return { ...form, origin: 'ai-generated', tool: credit.tool ?? '' };
    return form;
}

export function bannerCreditPayload(form: BannerCreditForm) {
    if (form.origin === 'third-party')
        return {
            origin: form.origin,
            author: form.author.trim(),
            url: form.url.trim() || null,
            license: form.license.trim() || null
        };
    if (form.origin === 'ai-generated')
        return { origin: form.origin, tool: form.tool.trim() || null };
    return null;
}
