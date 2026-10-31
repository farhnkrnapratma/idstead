<!--
SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama

SPDX-License-Identifier: AGPL-3.0-only
-->

<script lang="ts">
    import { onDestroy, untrack } from 'svelte';
    import FileUploadField from '@idstead/ui/components/FileUploadField.svelte';
    import FieldMessage from '@idstead/ui/components/FieldMessage.svelte';
    import Button from '@idstead/ui/components/Button.svelte';
    import RefineImage from '@idstead/ui/components/RefineImage.svelte';
    import { processBanner } from '../processBanner.ts';
    import { blogBannerAlt } from '#lib/blogBanner.ts';
    import type { BannerChange } from '#lib/blogBanner.ts';

    let {
        savedUrl,
        title,
        savedRevision,
        disabled = false,
        validationError = '',
        onprepared,
        onblocked
    }: {
        savedUrl: string | null;
        title: string;
        savedRevision: number;
        disabled?: boolean;
        validationError?: string;
        onprepared: (change: BannerChange) => void;
        onblocked: (blocked: boolean) => void;
    } = $props();
    let busy = $state(false);
    let error = $state('');
    let loadError = $state('');
    let filename = $state('');
    let preview = $state('');
    let size = $state('');
    let loadedSource = $state('');
    let controller: AbortController | undefined;
    let generation = 0;
    let previousRevision: number | undefined;

    function clearPreview() {
        if (preview) URL.revokeObjectURL(preview);
        preview = '';
        filename = '';
        size = '';
    }

    function watchSaved(source: string | null, revision: number) {
        return () =>
            untrack(() => {
                const committed = previousRevision !== undefined && previousRevision !== revision;
                previousRevision = revision;
                const current = generation;
                loadError = '';
                if (!source) {
                    loadedSource = '';
                    if (committed) {
                        clearPreview();
                    }
                    return;
                }
                const image = new Image();
                image.onload = () => {
                    loadedSource = source;
                    if (committed && current === generation) {
                        clearPreview();
                    }
                };
                image.onerror = () => {
                    loadError =
                        preview ?
                            'Saved banner could not be loaded. Your local preview is retained.'
                        :   'Saved banner could not be loaded. Choose the image again.';
                    loadedSource = '';
                };
                image.src = source;
                return () => {
                    image.onload = null;
                    image.onerror = null;
                };
            });
    }

    async function select(file: File | null) {
        if (disabled) return;
        const current = ++generation;
        controller?.abort();
        clearPreview();
        error = '';
        onprepared({ operation: 'keep' });
        busy = !!file;
        onblocked(busy);
        if (!file) return;
        filename = file.name;
        controller = new AbortController();
        try {
            const { webp, avif } = await processBanner(file, controller.signal);
            if (current !== generation) return;
            preview = URL.createObjectURL(webp);
            size = `WebP ${Math.ceil(webp.size / 1024)} KiB · AVIF ${Math.ceil(avif.size / 1024)} KiB · 1280 × 640`;
            onprepared({ operation: 'replace', webp, avif });
        } catch (failure) {
            if (current !== generation) return;
            error = failure instanceof Error ? failure.message : 'Image processing failed.';
        } finally {
            if (current === generation) {
                busy = false;
                onblocked(!!error);
            }
        }
    }

    onDestroy(() => {
        generation++;
        controller?.abort();
        clearPreview();
    });
</script>

<section
    aria-labelledby="banner-image-title"
    class="flex min-w-0 flex-col gap-3">
    <h3
        id="banner-image-title"
        class="text-xxs font-bold tracking-widest text-fg-secondary uppercase">
        Banner image <span class="font-normal text-fg-muted">(required)</span>
    </h3>
    <div
        class="@container min-w-0"
        {@attach watchSaved(savedUrl, savedRevision)}>
        <div class="grid min-w-0 grid-cols-1 gap-4 @2xl:grid-cols-[auto_1fr]">
            <div
                data-banner-preview
                class="relative aspect-2/1 w-full max-w-120 self-start overflow-hidden rounded-md border border-line-subtle bg-surface-subtle bg-[conic-gradient(var(--color-surface)_25%,transparent_0_50%,var(--color-surface)_0_75%,transparent_0)] bg-size-[1rem_1rem] @2xl:w-80">
                <RefineImage
                    src={preview || (loadedSource === savedUrl ? savedUrl : null)}
                    alt={`${blogBannerAlt(title || 'untitled post')} — preview`}
                    loading="eager"
                    class="absolute inset-0 size-full bg-transparent!"
                    imgClass="object-cover" />
            </div>
            <FileUploadField
                id="post-banner"
                class="min-w-0"
                required
                accept="image/png,image/jpeg,image/webp,image/avif,image/gif,image/bmp"
                hint="PNG, JPEG, WebP, AVIF, GIF, BMP · up to 10 MB / 40 MP · at least 1280 × 640"
                {disabled}
                isUploading={busy}
                allowReselectWhileUploading
                uploadingLabel="Preparing banner…"
                selectedFileName={filename}
                fileSize={size}
                error={error || validationError}
                onFileSelect={select} />
        </div>
    </div>
    {#if loadError}<FieldMessage
            variant="error"
            message={loadError} />{/if}
    {#if preview}<p
            class="text-xs text-fg-muted"
            aria-live="polite">
            Banner is ready. Save draft or Publish post to apply it.
        </p>{/if}
    <div class="flex flex-wrap gap-2">
        {#if busy || error || filename}<Button
                type="ghost"
                size="xs"
                {disabled}
                onclick={() => select(null)}
                >{busy ? 'Cancel processing' : 'Discard banner change'}</Button
            >{/if}
    </div>
</section>
