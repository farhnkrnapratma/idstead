<script lang="ts">
  import {Download, QrCode as QrCodeIcon} from '@lucide/svelte';
  import {getSVG} from 'qreator/lib/svg';
  import Dialog from './Dialog.svelte';
  import Button from './Button.svelte';
  import {toastStore} from '../stores/toastStore.svelte';

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

  async function generateQrCode() {
    if (!url && typeof window !== 'undefined') {
      url = window.location.href;
    }
    if (!url) return;

    isGenerating = true;

    let logoBuffer: ArrayBuffer | undefined = undefined;
    if (avatarUrl) {
      try {
        const res = await fetch(avatarUrl);
        if (res.ok) {
          logoBuffer = await res.arrayBuffer();
        }
      } catch {}
    }

    try {
      const options: Parameters<typeof getSVG>[1] = {
        ec_level: 'H',
        size: 7,
        margin: 2,
        color: '#101411',
        bgColor: '#ffffff',
        borderRadius: 2,
        cornerMode: 'merge',
        finderOuterShape: 'rounded',
        finderInnerShape: 'circle'
      };

      if (logoBuffer) {
        options.logo = logoBuffer;
        options.logoWidth = 22;
        options.logoHeight = 22;
      }

      const svgBytes = getSVG(url, options);
      svgString = new TextDecoder().decode(svgBytes);
    } catch (err) {
      console.error('QR code generation error:', err);
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
    const blob = new Blob([svgString], {type: 'image/svg+xml;charset=utf-8'});
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
    const blob = new Blob([svgString], {type: 'image/svg+xml;charset=utf-8'});
    const blobUrl = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width || 400;
      canvas.height = img.height || 400;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
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
  title="Scan QR Code"
  description="Scan with your smartphone camera to open this page directly."
  size="sm"
  {onClose}>
  <div class="flex flex-col items-center justify-center gap-3.5 pt-1 pb-1">
    <div
      class="relative flex size-48 items-center justify-center overflow-hidden rounded-sm border border-border-default/80 bg-white p-2 shadow-sm">
      {#if isGenerating}
        <div class="flex flex-col items-center gap-2 text-xs text-text-muted">
          <QrCodeIcon class="size-7 animate-pulse text-copilot" />
          <span>Generating QR Code...</span>
        </div>
      {:else if svgString}
        <div
          class="flex size-full items-center justify-center [&>svg]:size-full">
          {@html svgString}
        </div>
      {:else}
        <div class="text-xs text-text-muted">Failed to generate QR code</div>
      {/if}
    </div>

    {#if title}
      <div class="w-full text-center">
        <p class="truncate text-xs font-semibold text-text-primary">
          {title}
        </p>
        <p class="truncate text-2xs text-text-muted">
          {url}
        </p>
      </div>
    {/if}

    <div class="grid w-full grid-cols-2 gap-2 pt-1">
      <Button
        type="secondary"
        size="xs"
        onclick={downloadSvg}
        disabled={!svgString}
        class="w-full justify-center text-2xs">
        {#snippet leading()}
          <Download class="size-3" />
        {/snippet}
        <span>Download SVG</span>
      </Button>

      <Button
        type="secondary"
        size="xs"
        onclick={downloadPng}
        disabled={!svgString}
        class="w-full justify-center text-2xs">
        {#snippet leading()}
          <Download class="size-3" />
        {/snippet}
        <span>Download PNG</span>
      </Button>
    </div>
  </div>
</Dialog>
