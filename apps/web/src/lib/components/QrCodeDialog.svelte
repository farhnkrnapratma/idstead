<script lang="ts">
    import { Download } from '@lucide/svelte';
    import Dialog from '@idstead/ui/components/Dialog.svelte';
    import Button from '@idstead/ui/components/Button.svelte';
    import ErrorState from '@idstead/ui/components/ErrorState.svelte';
    import LoadingState from '@idstead/ui/components/LoadingState.svelte';
    import { toastStore } from '@idstead/ui/stores/toastStore.svelte.ts';
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

    let attempt = $state(0);

    const targetUrl = $derived(url || (typeof window !== 'undefined' ? window.location.href : ''));
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

    async function createQrSvg(target: string, avatar: string): Promise<string> {
        try {
            const logoDataUrl = await prepareLogoDataUrl(avatar);
            return renderQrSvg(target, { logoDataUrl });
        } catch (err) {
            console.error('QR code generation error:', err);
            throw err;
        }
    }

    const qrSvg = $derived.by(() => {
        void attempt;
        return isOpen && targetUrl ? createQrSvg(targetUrl, resolvedAvatarUrl) : null;
    });

    function downloadSvg(svgString: string) {
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

    function downloadPng(svgString: string) {
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
        img.onerror = () => {
            URL.revokeObjectURL(blobUrl);
            toastStore.error('Could not create the PNG QR code.');
        };
        img.src = blobUrl;
    }
</script>

{#snippet generating()}
    <LoadingState
        variant="spinner"
        label="Generating QR code..."
        class="size-full rounded-md bg-accent-subtle" />
{/snippet}

{#snippet downloads(svg: string | null)}
    <div class="grid w-full grid-cols-2 gap-2 pt-1">
        <Button
            type="secondary"
            size="sm"
            fullWidth
            onclick={() => svg && downloadSvg(svg)}
            disabled={!svg}>
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
            onclick={() => svg && downloadPng(svg)}
            disabled={!svg}>
            {#snippet leading()}
                <Download
                    class="size-3.5"
                    aria-hidden="true" />
            {/snippet}
            <span>Download PNG</span>
        </Button>
    </div>
{/snippet}

<Dialog
    bind:isOpen
    title="Scan QR code"
    description="Scan with your smartphone camera to open this page directly."
    size="md"
    {onClose}>
    <div class="flex flex-col items-center justify-center gap-4 pt-1 pb-1">
        <div class="relative flex aspect-square w-full max-w-80 items-center justify-center">
            {#await qrSvg}
                {@render generating()}
            {:then svg}
                {#if svg}
                    <div
                        class="flex size-full items-center justify-center drop-shadow-sm [&>svg]:size-full">
                        {@html svg}
                    </div>
                {:else}
                    {@render generating()}
                {/if}
            {:catch}
                <ErrorState
                    title="Couldn't generate the QR code"
                    description="Try again, or share the page link instead."
                    onRetry={() => attempt++}
                    class="size-full" />
            {/await}
        </div>

        {#if title}
            <div class="w-full text-center">
                <p class="truncate text-sm font-semibold text-text-primary">
                    {title}
                </p>
                <p class="mt-0.5 truncate text-xs text-text-muted">
                    {targetUrl}
                </p>
            </div>
        {/if}

        {#await qrSvg}
            {@render downloads(null)}
        {:then svg}
            {@render downloads(svg)}
        {:catch}
            {@render downloads(null)}
        {/await}
    </div>
</Dialog>
