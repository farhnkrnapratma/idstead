<script lang="ts">
    import FileUploadField from '../FileUploadField.svelte';
    import Button from '../Button.svelte';
    import Dialog from '../Dialog.svelte';
    import { processSiteBanner } from '../../processSiteBanner.js';
    import { toastStore } from '../../stores/toastStore.svelte';

    interface Props {
        currentVersion?: string | null;
        onUpload?: (versionId: string) => void;
        onRemove?: () => void;
    }

    let { currentVersion = $bindable(), onUpload, onRemove }: Props = $props();

    let isOpen = $state(false);
    let selectedFile: File | null = $state(null);
    let isProcessing = $state(false);
    let widePreview = $state<{ size: string; webp: number; avif: number } | null>(null);
    let ogPreview = $state<{ size: string } | null>(null);

    async function handleFileSelect(file: File | null) {
        if (!file) {
            selectedFile = null;
            widePreview = null;
            ogPreview = null;
            return;
        }

        selectedFile = file;
        isProcessing = true;

        try {
            const result = await processSiteBanner(file);
            widePreview = {
                size: `${result.width} × ${result.height}`,
                webp: Math.round(result.wide.webp.size / 1024),
                avif: Math.round(result.wide.avif.size / 1024)
            };
            ogPreview = { size: `${Math.round(result.og.webp.size / 1024)} KiB` };
        } catch (error) {
            toastStore.error(error instanceof Error ? error.message : 'Failed to process banner');
            selectedFile = null;
            widePreview = null;
            ogPreview = null;
        } finally {
            isProcessing = false;
        }
    }

    async function handleUpload() {
        if (!selectedFile) return;

        isProcessing = true;
        try {
            const result = await processSiteBanner(selectedFile);
            const formData = new FormData();
            formData.set('operation', 'replace');
            formData.set('wideWebp', result.wide.webp, 'wide.webp');
            formData.set('wideAvif', result.wide.avif, 'wide.avif');
            formData.set('ogWebp', result.og.webp, 'og.webp');

            const response = await fetch('/api/internal/admin/profile/banner', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error?.message || 'Upload failed');
            }

            const data = await response.json();
            currentVersion = data.versionId;
            toastStore.success('Banner uploaded successfully');
            isOpen = false;
            selectedFile = null;
            widePreview = null;
            ogPreview = null;
            onUpload?.(data.versionId);
        } catch (error) {
            toastStore.error(error instanceof Error ? error.message : 'Upload failed');
        } finally {
            isProcessing = false;
        }
    }

    async function handleRemove() {
        if (!currentVersion) return;

        isProcessing = true;
        try {
            const formData = new FormData();
            formData.set('operation', 'remove');

            const response = await fetch('/api/internal/admin/profile/banner', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error?.message || 'Remove failed');
            }

            currentVersion = null;
            toastStore.success('Banner removed');
            onRemove?.();
        } catch (error) {
            toastStore.error(error instanceof Error ? error.message : 'Remove failed');
        } finally {
            isProcessing = false;
        }
    }
</script>

<div class="space-y-4">
    <div>
        <h3 class="text-sm font-semibold">Website Banner</h3>
        <p class="text-xs text-slate-600 dark:text-slate-400">
            Used for Open Graph previews and on-page display
        </p>
    </div>

    {#if currentVersion}
        <div class="flex gap-2">
            <Button
                size="sm"
                onclick={() => (isOpen = true)}>Change banner</Button>
            <Button
                size="sm"
                onclick={handleRemove}
                disabled={isProcessing}>
                Remove
            </Button>
        </div>
    {:else}
        <Button
            size="sm"
            onclick={() => (isOpen = true)}>Upload banner</Button>
    {/if}

    <Dialog
        bind:isOpen
        title="Upload Website Banner"
        onClose={() => (isOpen = false)}>
        <div class="space-y-4">
            <FileUploadField
                id="site-banner-upload"
                label="Click to upload or drag & drop"
                accept="image/*"
                onFileSelect={handleFileSelect}
                disabled={isProcessing} />

            {#if widePreview && ogPreview}
                <div class="space-y-3 rounded-lg bg-slate-50 p-4 dark:bg-slate-900">
                    <div>
                        <p class="text-xs font-semibold text-slate-700 dark:text-slate-300">
                            Wide crop
                        </p>
                        <p class="text-xs text-slate-600 dark:text-slate-400">
                            WebP {widePreview.webp} KiB · AVIF {widePreview.avif} KiB · {widePreview.size}
                        </p>
                    </div>
                    <div>
                        <p class="text-xs font-semibold text-slate-700 dark:text-slate-300">
                            OG crop
                        </p>
                        <p class="text-xs text-slate-600 dark:text-slate-400">
                            WebP {ogPreview.size}
                        </p>
                    </div>
                </div>
            {/if}

            <div class="flex justify-end gap-2">
                <Button
                    onclick={() => (isOpen = false)}
                    disabled={isProcessing}>
                    Cancel
                </Button>
                <Button
                    onclick={handleUpload}
                    disabled={!selectedFile || isProcessing}>
                    {isProcessing ? 'Processing...' : 'Upload'}
                </Button>
            </div>
        </div>
    </Dialog>
</div>
