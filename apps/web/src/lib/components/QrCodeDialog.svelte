<script lang="ts">
    import { Copy, Download, Info } from '@lucide/svelte';
    import Dialog from '@idstead/ui/components/Dialog.svelte';
    import Button from '@idstead/ui/components/Button.svelte';
    import ErrorState from '@idstead/ui/components/ErrorState.svelte';
    import Input from '@idstead/ui/components/Input.svelte';
    import LoadingState from '@idstead/ui/components/LoadingState.svelte';
    import Tooltip from '@idstead/ui/components/Tooltip.svelte';
    import { toastStore } from '@idstead/ui/stores/toastStore.svelte.ts';
    import { copyText } from '@idstead/ui/utils/fileActions.ts';
    import { renderQrSvg } from '../qrSvg';

    import { page } from '$app/state';

    interface Props {
        isOpen: boolean;
        url?: string;
        slug?: string;
        avatarUrl?: string;
        onClose: () => void;
    }

    let {
        isOpen = $bindable(false),
        url = '',
        slug = 'document',
        avatarUrl = '',
        onClose
    }: Props = $props();

    const PNG_SIZE = 1024;
    const SCAN_HINT = "To scan this code, use a QR scanner app or your phone's camera.";

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
                    ctx.filter = 'grayscale(1)';
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

    function renderPng(svgString: string): Promise<Blob> {
        return new Promise((resolve, reject) => {
            const svgUrl = URL.createObjectURL(
                new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
            );
            const img = new Image();
            img.onload = () => {
                URL.revokeObjectURL(svgUrl);
                const canvas = document.createElement('canvas');
                canvas.width = PNG_SIZE;
                canvas.height = PNG_SIZE;
                const ctx = canvas.getContext('2d');
                if (!ctx) return reject(new Error('Canvas is unavailable.'));
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, 0, 0, PNG_SIZE, PNG_SIZE);
                canvas.toBlob(blob =>
                    blob ? resolve(blob) : reject(new Error('PNG export failed.'))
                );
            };
            img.onerror = () => {
                URL.revokeObjectURL(svgUrl);
                reject(new Error('The QR code could not be drawn.'));
            };
            img.src = svgUrl;
        });
    }

    async function copyQr(svgString: string) {
        try {
            if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write)
                throw new Error('Image clipboard is unavailable.');
            await navigator.clipboard.write([
                new ClipboardItem({ 'image/png': renderPng(svgString) })
            ]);
            toastStore.success('QR code copied.');
        } catch {
            await copyText(targetUrl, 'Link');
        }
    }

    async function downloadQr(svgString: string) {
        try {
            const pngUrl = URL.createObjectURL(await renderPng(svgString));
            const a = document.createElement('a');
            a.href = pngUrl;
            a.download = `${slug || 'page'}-qr.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(pngUrl);
            toastStore.success('QR code downloaded.');
        } catch {
            toastStore.error('Could not create the QR code image.');
        }
    }
</script>

{#snippet generating()}
    <LoadingState
        variant="spinner"
        label="Generating QR code..."
        class="size-full rounded-md bg-white" />
{/snippet}

{#snippet actions(svg: string | null)}
    <div class="flex w-full items-center justify-between gap-2">
        <Tooltip
            content={SCAN_HINT}
            align="left"
            class="max-w-64 leading-relaxed wrap-anywhere whitespace-normal!">
            <button
                type="button"
                aria-label={SCAN_HINT}
                class="inline-flex size-7 shrink-0 cursor-help items-center justify-center rounded-sm text-text-muted transition-colors hover:text-text-primary focus-visible:outline-2 focus-visible:outline-focus-ring">
                <Info
                    class="size-4"
                    aria-hidden="true" />
            </button>
        </Tooltip>
        <div class="flex items-center gap-2">
            <Button
                type="secondary"
                size="sm"
                onclick={() => svg && copyQr(svg)}
                disabled={!svg}>
                {#snippet leading()}
                    <Copy
                        class="size-3.5"
                        aria-hidden="true" />
                {/snippet}
                <span>Copy</span>
            </Button>
            <Button
                type="secondary"
                size="sm"
                onclick={() => svg && downloadQr(svg)}
                disabled={!svg}>
                {#snippet leading()}
                    <Download
                        class="size-3.5"
                        aria-hidden="true" />
                {/snippet}
                <span>Download</span>
            </Button>
        </div>
    </div>
{/snippet}

<Dialog
    bind:isOpen
    title="Scan QR code"
    size="sm"
    {onClose}>
    <div class="flex flex-col items-center gap-4 pt-1 pb-1">
        <div
            class="relative flex aspect-square w-full max-w-60 items-center justify-center rounded-md border border-border-subtle bg-white p-3">
            {#await qrSvg}
                {@render generating()}
            {:then svg}
                {#if svg}
                    <img
                        src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`}
                        alt={`QR code for ${targetUrl}`}
                        class="size-full select-none"
                        draggable="false" />
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

        <Input
            value={targetUrl}
            readonly
            size="sm"
            aria-label="Link in the QR code"
            class="font-mono"
            onfocus={(event: FocusEvent) => (event.currentTarget as HTMLInputElement).select()} />

        {#await qrSvg}
            {@render actions(null)}
        {:then svg}
            {@render actions(svg)}
        {:catch}
            {@render actions(null)}
        {/await}
    </div>
</Dialog>
