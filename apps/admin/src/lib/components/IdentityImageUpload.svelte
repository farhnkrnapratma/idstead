<script
    lang="ts"
    module>
    export interface IdentityImageResult<V> {
        value: V;
        preview: Blob;
        sizeLabel: string;
    }
</script>

<script
    lang="ts"
    generics="T">
    import { onDestroy } from 'svelte';
    import { ImageOff, LoaderCircle, Trash } from '@lucide/svelte';
    import Button from '@idstead/ui/components/Button.svelte';
    import FileUploadField from '@idstead/ui/components/FileUploadField.svelte';
    import ImageWithSkeleton from '@idstead/ui/components/ImageWithSkeleton.svelte';
    import { cn } from '@idstead/ui/utils/cn.ts';

    let {
        id,
        title,
        alt,
        aspect,
        hint,
        uploadingLabel,
        note,
        readyNote,
        saved,
        generated,
        useGenerated,
        generating = false,
        canRemove,
        disabled = false,
        validationError = '',
        process,
        onprepared,
        onbusy,
        onremove
    }: {
        id: string;
        title: string;
        alt: string;
        aspect: 'square' | 'wide';
        hint: string;
        uploadingLabel: string;
        note: string;
        readyNote: string;
        saved: string;
        generated: string;
        useGenerated: boolean;
        generating?: boolean;
        canRemove: boolean;
        disabled?: boolean;
        validationError?: string;
        process: (file: File, signal: AbortSignal) => Promise<IdentityImageResult<T>>;
        onprepared: (value: T | null) => void;
        onbusy: (busy: boolean) => void;
        onremove: () => void;
    } = $props();

    let busy = $state(false);
    let error = $state('');
    let filename = $state('');
    let preview = $state('');
    let size = $state('');
    let loadedSource = $state('');
    let loadError = $state('');
    let previousSource = '';
    let controller: AbortController | undefined;
    let generation = 0;

    const source = $derived(
        preview
            || (useGenerated ? generated
            : saved && loadedSource === saved ? saved
            : '')
    );

    function clearPreview() {
        if (preview) URL.revokeObjectURL(preview);
        preview = '';
        filename = '';
        size = '';
    }

    function loadSavedImage() {
        const current = saved;
        const changed = previousSource !== current;
        previousSource = current;
        loadError = '';
        if (!current) return;
        const pending = generation;
        const image = new Image();
        image.onload = () => {
            loadedSource = current;
            if (changed && pending === generation) clearPreview();
        };
        image.onerror = () => {
            loadError = 'Saved image could not be loaded. Try reloading the page.';
        };
        image.src = current;
        return () => {
            image.onload = null;
            image.onerror = null;
        };
    }

    async function select(file: File | null) {
        const current = ++generation;
        controller?.abort();
        clearPreview();
        error = '';
        filename = file?.name ?? '';
        onprepared(null);
        busy = !!file;
        onbusy(busy);
        if (!file) return;
        controller = new AbortController();
        try {
            const result = await process(file, controller.signal);
            if (current !== generation) return;
            preview = URL.createObjectURL(result.preview);
            size = result.sizeLabel;
            onprepared(result.value);
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

    function remove() {
        generation++;
        controller?.abort();
        clearPreview();
        error = '';
        if (busy) {
            busy = false;
            onbusy(false);
        }
        onprepared(null);
        onremove();
    }

    onDestroy(() => {
        generation++;
        controller?.abort();
        if (preview) URL.revokeObjectURL(preview);
    });
</script>

<section
    aria-labelledby={`${id}-title`}
    class="flex min-w-0 flex-col gap-3">
    <div class="flex min-h-7 items-center justify-between gap-3">
        <h3
            id={`${id}-title`}
            class="text-xxs font-bold tracking-widest text-fg-secondary uppercase select-none">
            {title}
            {#if useGenerated && !preview}<span class="font-normal text-fg-muted">(generated)</span
                >{/if}
        </h3>
        {#if canRemove && !preview}
            <Button
                type="ghost"
                tone="critical"
                size="2xs"
                htmlType="button"
                aria-label={`Remove ${title.toLowerCase()}`}
                disabled={disabled || busy}
                onclick={remove}>
                {#snippet leading()}<Trash
                        class="size-3.5"
                        aria-hidden="true" />{/snippet}
                Remove
            </Button>
        {/if}
    </div>
    <div
        class="@container min-w-0"
        {@attach loadSavedImage}>
        <div
            class={cn(
                'flex min-w-0 flex-col gap-4',
                aspect === 'square' ? '@md:flex-row' : '@2xl:flex-row'
            )}>
            <div
                class={cn(
                    'relative shrink-0 self-start overflow-hidden rounded-md border border-line-subtle bg-surface-subtle bg-[conic-gradient(var(--color-surface)_25%,transparent_0_50%,var(--color-surface)_0_75%,transparent_0)] bg-size-[1rem_1rem]',
                    aspect === 'square' ? 'aspect-square w-40' : 'aspect-2/1 w-80 max-w-full'
                )}>
                {#if source}
                    <ImageWithSkeleton
                        src={source}
                        {alt}
                        loading="eager"
                        class="absolute inset-0 size-full bg-transparent!"
                        imgClass="object-contain"
                        onerror={() => {
                            if (!preview) return;
                            clearPreview();
                            loadError =
                                'Image could not be loaded. Choose the file again or reload the page.';
                            onprepared(null);
                        }} />
                {:else}
                    <div
                        class="absolute inset-0 flex items-center justify-center"
                        role="img"
                        aria-busy={generating}
                        aria-label={generating ?
                            `Generating ${title.toLowerCase()} preview`
                        :   `${title} unavailable`}>
                        {#if generating}
                            <LoaderCircle
                                class="size-10 animate-spin text-fg-muted"
                                aria-hidden="true" />
                        {:else}
                            <ImageOff
                                class="size-10 text-fg-muted"
                                aria-hidden="true" />
                        {/if}
                    </div>
                {/if}
            </div>
            <FileUploadField
                {id}
                class="min-w-0 flex-1"
                accept="image/png,image/jpeg,image/webp,image/avif,image/gif,image/bmp"
                {hint}
                {disabled}
                isUploading={busy}
                {uploadingLabel}
                selectedFileName={filename}
                fileSize={size}
                error={error || loadError || validationError}
                onFileSelect={select} />
        </div>
    </div>
    <p
        class="text-xs text-fg-muted"
        aria-live="polite">
        {preview ? readyNote : note}
    </p>
</section>
