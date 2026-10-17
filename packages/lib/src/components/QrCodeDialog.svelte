<script lang="ts">
    import { Download } from '@lucide/svelte';
    import Dialog from './Dialog.svelte';
    import Button from './Button.svelte';
    import ErrorState from './ErrorState.svelte';
    import LoadingState from './LoadingState.svelte';
    import { toastStore } from '../stores/toastStore.svelte';
    import { renderQrSvg } from '../qrSvg';

    import { page } from '$app/state';

    interface Props {
        isOpen: boolean;
        title?: string;
        url?: string;
        slug?: string;
        avatarUrl?: string;
        onClose: () => void;
    }

    let {
        isOpen = $bindable(false),
        title = '',
        url = '',
        slug = 'document',
        avatarUrl = '',
        onClose
    }: Props = $props();

    let svgString = $state<string>('');
    let isGenerating = $state<boolean>(false);
    let failed = $state(false);

    const resolvedAvatarUrl = $derived(avatarUrl || (page?.data as any)?.author?.avatar || '');

    async function prepareLogoDataUrl(imageUrl: string): Promise<string | undefined> {
        if (typeof window === 'undefined' || !imageUrl) return undefined;
        return new Promise(resolve => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                try {
                    const size = 256;
                    const canvas = document.createElement('canvas');
                    canvas.width = size;
                    canvas.height = size;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) return resolve(undefined);

                    const scale = Math.max(size / img.naturalWidth, size / img.naturalHeight);
                    const width = img.naturalWidth * scale;
                    const height = img.naturalHeight * scale;
                    ctx.beginPath();
                    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
                    ctx.clip();
                    ctx.drawImage(img, (size - width) / 2, 0, width, height);
                    resolve(canvas.toDataURL('image/png'));
                } catch {
                    resolve(undefined);
                }
            };
            img.onerror = () => resolve(undefined);
            img.src = imageUrl;
        });
    }

    async function generateQrCode() {
        if (typeof window === 'undefined') return;
        if (!url) {
            url = window.location.href;
        }
        if (!url) return;

        isGenerating = true;
        failed = false;
        try {
            const logoDataUrl = await prepareLogoDataUrl(resolvedAvatarUrl);
            svgString = renderQrSvg(url, { logoDataUrl });
        } catch (err) {
            console.error('QR code generation error:', err);
            svgString = '';
            failed = true;
        } finally {
            isGenerating = false;
        }
    }

    $effect(() => {
        if (isOpen) {
            generateQrCode();
        }
    });

    function downloadSvg() {
        if (!svgString) return;
        const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `${slug || 'page'}-qr.svg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
        toastStore.success('SVG QR code downloaded');
    }

    function downloadPng() {
        if (!svgString) return;
        const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const blobUrl = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = 1024;
            canvas.height = 1024;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                const pngUrl = canvas.toDataURL('image/png');
                const a = document.createElement('a');
                a.href = pngUrl;
                a.download = `${slug || 'page'}-qr.png`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                toastStore.success('PNG QR code downloaded');
            }
            URL.revokeObjectURL(blobUrl);
        };
        img.src = blobUrl;
    }
</script>

<Dialog
    bind:isOpen
    title="Scan QR code"
    description="Scan with your smartphone camera to open this page directly."
    size="md"
    {onClose}>
    <div class="flex flex-col items-center justify-center gap-4 pt-1 pb-1">
        <div class="relative flex aspect-square w-full max-w-80 items-center justify-center">
            {#if svgString && !isGenerating}
                <div
                    class="flex size-full items-center justify-center drop-shadow-sm [&>svg]:size-full">
                    {@html svgString}
                </div>
            {:else if failed}
                <ErrorState
                    title="Couldn't generate the QR code"
                    description="Try again, or copy the link below instead."
                    onRetry={generateQrCode}
                    class="size-full" />
            {:else}
                <LoadingState
                    variant="spinner"
                    label="Generating QR code..."
                    class="size-full rounded-md bg-accent-subtle" />
            {/if}
        </div>

        {#if title}
            <div class="w-full text-center">
                <p class="truncate text-sm font-semibold text-text-primary">
                    {title}
                </p>
                <p class="mt-0.5 truncate text-xs text-text-muted">
                    {url}
                </p>
            </div>
        {/if}

        <div class="grid w-full grid-cols-2 gap-2 pt-1">
            <Button
                type="secondary"
                size="sm"
                fullWidth
                onclick={downloadSvg}
                disabled={!svgString}>
                {#snippet leading()}
                    <Download
                        class="size-3.5"
                        aria-hidden="true" />
                {/snippet}
                <span>Download SVG</span>
            </Button>

            <Button
                type="secondary"
                size="sm"
                fullWidth
                onclick={downloadPng}
                disabled={!svgString}>
                {#snippet leading()}
                    <Download
                        class="size-3.5"
                        aria-hidden="true" />
                {/snippet}
                <span>Download PNG</span>
            </Button>
        </div>
    </div>
</Dialog>
