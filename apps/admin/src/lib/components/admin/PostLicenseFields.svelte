<script lang="ts">
    import {
        BANNER_CREDIT_LIMITS,
        CONTENT_LICENSES,
        CONTENT_LICENSE_INFO,
        type BannerOrigin,
        type ContentLicenseId
    } from '@idstead/domain/contentLicense.ts';
    import { Dropdown, FieldMessage, FormField, Input } from '@idstead/ui';
    import type { BannerCreditForm } from '../../postLicense.ts';

    interface Props {
        license: ContentLicenseId | null;
        credit: BannerCreditForm;
        error?: { field: string; message: string } | null;
        onchange?: () => void;
    }

    let { license = $bindable(), credit = $bindable(), error = null, onchange }: Props = $props();

    const SITE = 'site';

    const licenseOptions = [
        { value: SITE, label: 'Site license' },
        ...CONTENT_LICENSES.map(value => ({ value, label: CONTENT_LICENSE_INFO[value].label }))
    ];

    const originOptions: { value: BannerOrigin; label: string }[] = [
        { value: 'own', label: 'Own work' },
        { value: 'third-party', label: 'Third party' },
        { value: 'ai-generated', label: 'AI-generated' }
    ];

    function setLicense(value: string) {
        license = value === SITE ? null : (value as ContentLicenseId);
        onchange?.();
    }

    function setOrigin(value: BannerOrigin) {
        credit = { ...credit, origin: value };
        onchange?.();
    }

    function fieldError(field: string) {
        return error?.field === field ? error.message : '';
    }
</script>

<div class="flex flex-col gap-4">
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Dropdown
            id="post-license"
            label="License"
            value={license ?? SITE}
            options={licenseOptions}
            fullWidth
            onChange={setLicense} />
        <Dropdown
            id="post-banner-origin"
            label="Banner source"
            value={credit.origin}
            options={originOptions}
            fullWidth
            onChange={setOrigin} />
    </div>
    {#if fieldError('bannerOrigin')}<FieldMessage message={fieldError('bannerOrigin')} />{/if}
    {#if credit.origin === 'third-party'}
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <FormField
                id="post-banner-author"
                label="Creator"
                variant="floating"
                required
                hideAsterisk
                error={fieldError('bannerCreditAuthor')}>
                <Input
                    id="post-banner-author"
                    maxlength={BANNER_CREDIT_LIMITS.author}
                    bind:value={credit.author}
                    error={!!fieldError('bannerCreditAuthor')}
                    oninput={onchange} />
            </FormField>
            <FormField
                id="post-banner-url"
                label="Source URL"
                variant="floating"
                error={fieldError('bannerCreditUrl')}>
                <Input
                    id="post-banner-url"
                    type="url"
                    autocapitalize="none"
                    spellcheck={false}
                    placeholder="https://"
                    maxlength={BANNER_CREDIT_LIMITS.url}
                    bind:value={credit.url}
                    error={!!fieldError('bannerCreditUrl')}
                    oninput={onchange} />
            </FormField>
            <FormField
                id="post-banner-license"
                label="Banner license"
                variant="floating"
                error={fieldError('bannerCreditLicense')}>
                <Input
                    id="post-banner-license"
                    placeholder="Unsplash License"
                    maxlength={BANNER_CREDIT_LIMITS.license}
                    bind:value={credit.license}
                    error={!!fieldError('bannerCreditLicense')}
                    oninput={onchange} />
            </FormField>
        </div>
    {:else if credit.origin === 'ai-generated'}
        <FormField
            id="post-banner-tool"
            label="Tool"
            variant="floating"
            hint="The post shows that no license is claimed for the banner."
            error={fieldError('bannerCreditTool')}>
            <Input
                id="post-banner-tool"
                maxlength={BANNER_CREDIT_LIMITS.tool}
                bind:value={credit.tool}
                error={!!fieldError('bannerCreditTool')}
                oninput={onchange} />
        </FormField>
    {/if}
</div>
