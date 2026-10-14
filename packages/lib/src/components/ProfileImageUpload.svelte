<script lang="ts">
    import { onDestroy } from 'svelte';
    import { UserRound } from '@lucide/svelte';
    import FieldMessage from './FieldMessage.svelte';
    import FileUploadField from './FileUploadField.svelte';
    import { processAvatar } from '#lib/processAvatar.ts';
    import type { ImagePackage } from '#lib/siteIdentity.ts';

    let {
        avatar,
        name,
        disabled = false,
        validationError = '',
        onprepared,
        onbusy
    }: {
        avatar: string;
        name: string;
        disabled?: boolean;
        validationError?: string;
        onprepared: (value: ImagePackage | null) => void;
        onbusy: (busy: boolean) => void;
    } = $props();
    let busy = $state(false);
    let error = $state('');
    let filename = $state('');
    let preview = $state('');
    let size = $state('');
    let loadedSource = $state('');
    let loadError = $state('');
    let previousSource = '';

    function loadSavedImage() {
        const source = avatar;
        const changed = previousSource !== source;
        previousSource = source;
        loadError = '';
        if (!source) return;
        const current = generation;
        const image = new Image();
        image.onload = () => {
            loadedSource = source;
            if (changed && current === generation) {
                if (preview) URL.revokeObjectURL(preview);
                preview = '';
                filename = '';
                size = '';
            }
        };
        image.onerror = () => {
            loadError = 'Saved image could not be loaded. Try reloading the page.';
        };
        image.src = source;
        return () => {
            image.onload = null;
            image.onerror = null;
        };
    }
    let controller: AbortController | undefined;
    let generation = 0;

    async function select(file: File | null) {
        const current = ++generation;
        controller?.abort();
        if (preview) URL.revokeObjectURL(preview);
        preview = '';
        error = '';
        filename = file?.name ?? '';
        onprepared(null);
        busy = !!file;
        onbusy(busy);
        if (!file) return;
        controller = new AbortController();
        try {
            const result = await processAvatar(file, controller.signal);
            if (current !== generation) return;
            preview = URL.createObjectURL(
                new Blob([result.files['avatar.png']], { type: 'image/png' })
            );
            size = `${Math.ceil(result.files['avatar.png'].byteLength / 1000)} KB · 512 × 512`;
            onprepared(result);
        } catch (failure) {
            if (current !== generation) return;
            error = failure instanceof Error ? failure.message : 'Image processing failed.';
            filename = '';
        } finally {
            if (current === generation) {
                busy = false;
                onbusy(false);
            }
        }
    }

    onDestroy(() => {
        generation++;
        controller?.abort();
        if (preview) URL.revokeObjectURL(preview);
    });
</script>

<section
    aria-labelledby="profile-image-title"
    class="flex flex-col gap-3">
    <h3
        id="profile-image-title"
        class="text-xxs font-bold tracking-widest text-text-secondary uppercase">
        Profile image <span class="font-normal text-text-muted">(required)</span>
    </h3>
    <div
        class="grid min-w-0 grid-cols-1 items-stretch gap-4 sm:grid-cols-[auto_1fr]"
        {@attach loadSavedImage}>
        <div
            class="relative aspect-square size-40 overflow-hidden rounded-md border border-border-subtle bg-surface-subtle bg-[conic-gradient(var(--color-surface)_25%,transparent_0_50%,var(--color-surface)_0_75%,transparent_0)] bg-size-[1rem_1rem] sm:size-auto sm:h-full">
            {#if preview || (avatar && loadedSource === avatar)}
                <img
                    src={preview || avatar}
                    alt={`Profile picture of ${name} — preview`}
                    width="512"
                    height="512"
                    onerror={() => {
                        if (preview) URL.revokeObjectURL(preview);
                        preview = '';
                        loadedSource = '';
                        loadError =
                            'Image could not be loaded. Choose the file again or reload the page.';
                        onprepared(null);
                    }}
                    class="absolute inset-0 size-full object-contain" />
            {:else}
                <div
                    class="flex size-full min-h-40 items-center justify-center"
                    role="img"
                    aria-label="Profile image unavailable">
                    <UserRound class="size-12 text-text-muted" />
                </div>
            {/if}
        </div>
        <FileUploadField
            id="profile-image-file"
            required
            class="min-w-0"
            accept="image/png,image/jpeg,image/webp,image/avif,image/gif,image/bmp"
            hint="PNG, JPEG, WebP, AVIF, GIF, BMP · up to 10 MB · at least 512 × 512"
            {disabled}
            isUploading={busy}
            uploadingLabel="Preparing avatar and icons…"
            selectedFileName={filename}
            fileSize={size}
            error={error || validationError}
            onFileSelect={select} />
    </div>
    {#if loadError}<FieldMessage
            variant="error"
            message={loadError} />{/if}
    <p
        class="text-xs text-text-muted"
        aria-live="polite">
        {preview ?
            'Image and icons are ready. Save Profile to publish your changes.'
        :   'Images are cropped to a square from the center. Animated images use their first frame.'}
    </p>
</section>
