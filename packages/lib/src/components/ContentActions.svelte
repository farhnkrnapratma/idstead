<script lang="ts">
    import {
        Copy,
        CopyCheck,
        Link2,
        EllipsisVertical,
        Hash,
        ScanText,
        TextAlignStart,
        FileText,
        ChevronDown
    } from '@lucide/svelte';
    import { toastStore } from '@fkp/ui/stores/toastStore.svelte.ts';
    import Dropdown from '@fkp/ui/components/Dropdown.svelte';
    import { markdownToPlainText } from '@fkp/mdrs';
    import { cn } from '@fkp/ui/utils/cn.ts';
    import Button from '@fkp/ui/components/Button.svelte';
    import { shortcut } from '@fkp/ui/utils/shortcut.svelte.ts';
    import { buttonKey, argKey, VIEW_FORMAT_KEYS } from '@fkp/ui/shortcuts.ts';

    interface Props {
        variant?: 'inline' | 'sidebar' | 'toolbar';
        slug: string;
        pageId?: string | null;
        title?: string;
        markdownContent?: string;
        viewMarkdownUrl: string;
        viewTextUrl: string;
        pageUrl?: string;
        showCopyUrl?: boolean;
        class?: string;
    }

    let {
        variant = 'inline',
        slug,
        pageId = null,
        title = '',
        markdownContent,
        viewMarkdownUrl,
        viewTextUrl,
        pageUrl,
        showCopyUrl = true,
        class: className = ''
    }: Props = $props();

    let cachedMarkdown = $state<string | null>(null);

    let copiedMarkdown = $state(false);
    let copiedText = $state(false);
    let copiedUrl = $state(false);
    let copiedId = $state(false);

    async function getMarkdown(): Promise<string> {
        if (markdownContent) return markdownContent;
        if (cachedMarkdown) return cachedMarkdown;
        const res = await fetch(viewMarkdownUrl);
        if (!res.ok) throw new Error('Failed to fetch Markdown');
        const text = await res.text();
        cachedMarkdown = text;
        return text;
    }

    async function getPlainText(): Promise<string> {
        const md = await getMarkdown();
        return markdownToPlainText(md);
    }

    async function handleCopyMarkdown() {
        try {
            const md = await getMarkdown();
            await navigator.clipboard.writeText(md);
            copiedMarkdown = true;
            toastStore.success('Markdown copied to clipboard');
            setTimeout(() => {
                copiedMarkdown = false;
            }, 2000);
        } catch {
            toastStore.error('Failed to copy Markdown');
        }
    }

    async function handleCopyPlainText() {
        try {
            const plainText = await getPlainText();
            const headerTitle = title ? `${title}\n\n` : '';
            await navigator.clipboard.writeText(`${headerTitle}${plainText}`);
            copiedText = true;
            toastStore.success('Text copied to clipboard');
            setTimeout(() => {
                copiedText = false;
            }, 2000);
        } catch {
            toastStore.error('Failed to copy Text');
        }
    }

    async function handleCopyPageUrl() {
        try {
            const url = pageUrl || (typeof window !== 'undefined' ? window.location.href : '');
            await navigator.clipboard.writeText(url);
            copiedUrl = true;
            toastStore.success('Page URL copied to clipboard');
            setTimeout(() => {
                copiedUrl = false;
            }, 2000);
        } catch {
            toastStore.error('Failed to copy URL');
        }
    }

    async function handleCopyPageId() {
        if (!pageId) return;
        try {
            await navigator.clipboard.writeText(pageId);
            copiedId = true;
            toastStore.success('Page ID copied to clipboard');
            setTimeout(() => {
                copiedId = false;
            }, 2000);
        } catch {
            toastStore.error('Failed to copy Page ID');
        }
    }

    function downloadFile(filename: string, content: string, mimeType: string) {
        if (typeof window === 'undefined') return;
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    async function handleSaveMarkdown() {
        try {
            const md = await getMarkdown();
            const filename = `${slug || 'document'}.md`;
            downloadFile(filename, md, 'text/markdown;charset=utf-8');
            toastStore.success('Markdown file downloaded');
        } catch {
            toastStore.error('Failed to download Markdown');
        }
    }

    async function handleSaveText() {
        try {
            const plainText = await getPlainText();
            const headerTitle = title ? `${title}\n\n` : '';
            const filename = `${slug || 'document'}.txt`;
            downloadFile(filename, `${headerTitle}${plainText}`, 'text/plain;charset=utf-8');
            toastStore.success('Text file downloaded');
        } catch {
            toastStore.error('Failed to download Text file');
        }
    }
</script>

{#snippet popoverMenu(close: () => void)}
    <div class="flex max-h-[85vh] flex-row divide-x divide-border-subtle/60 overflow-y-auto">
        {#if showCopyUrl || pageId}
            <div class="flex flex-col pt-2">
                <span
                    class="px-3 pb-1 text-2xs font-semibold tracking-wider text-text-muted uppercase"
                    >Copy</span>
                {#if showCopyUrl}
                    <Button
                        shortcutGroup="copy"
                        shortcutChordKey={argKey('/copy', 'url')}
                        shortcutLabel="Post URL"
                        type="ghost"
                        size="2xs"
                        label={copiedUrl ? 'Copied!' : 'Post URL'}
                        truncateMiddle
                        class="w-full justify-start rounded-none! px-3 text-xs font-normal! whitespace-nowrap text-text-secondary!"
                        onclick={() => {
                            close();
                            handleCopyPageUrl();
                        }}>
                        {#snippet leading()}
                            {#if copiedUrl}
                                <CopyCheck class="size-3.5 text-accent-text" />
                            {:else}
                                <Link2 class="size-3.5" />
                            {/if}
                        {/snippet}
                    </Button>
                {/if}
                {#if pageId}
                    <Button
                        shortcutGroup="copy"
                        shortcutChordKey={argKey('/copy', 'pid')}
                        shortcutLabel="Post ID"
                        type="ghost"
                        size="2xs"
                        label={copiedId ? 'Copied!' : 'Post ID'}
                        truncateMiddle
                        class="w-full justify-start rounded-none! px-3 text-xs font-normal! whitespace-nowrap text-text-secondary!"
                        onclick={() => {
                            close();
                            handleCopyPageId();
                        }}>
                        {#snippet leading()}
                            {#if copiedId}
                                <CopyCheck class="size-3.5 text-accent-text" />
                            {:else}
                                <Hash class="size-3.5" />
                            {/if}
                        {/snippet}
                    </Button>
                {/if}
            </div>
        {/if}

        <div class="flex flex-col sm:contents">
            <div class="flex flex-col pt-2">
                <span
                    class="px-3 pb-1 text-2xs font-semibold tracking-wider text-text-muted uppercase"
                    >Text</span>
                <Button
                    shortcutGroup="copy"
                    shortcutChordKey={argKey('/copy', 'txt')}
                    shortcutLabel="Copy as TXT"
                    type="ghost"
                    size="2xs"
                    label={copiedText ? 'Copied!' : 'Copy as TXT'}
                    truncateMiddle
                    class="w-full justify-start rounded-none! px-3 text-xs font-normal! whitespace-nowrap text-text-secondary!"
                    onclick={() => {
                        close();
                        handleCopyPlainText();
                    }}>
                    {#snippet leading()}
                        {#if copiedText}
                            <CopyCheck class="size-3.5 text-accent-text" />
                        {:else}
                            <ScanText class="size-3.5" />
                        {/if}
                    {/snippet}
                </Button>
                <Button
                    shortcutGroup="view"
                    shortcutChordKey={VIEW_FORMAT_KEYS.txt}
                    shortcutLabel="View as TXT"
                    type="ghost"
                    size="2xs"
                    href={viewTextUrl}
                    data-sveltekit-reload
                    label="View as TXT"
                    truncateMiddle
                    class="w-full justify-start rounded-none! px-3 text-xs font-normal! whitespace-nowrap text-text-secondary!"
                    onclick={close}>
                    {#snippet leading()}
                        <TextAlignStart class="size-3.5" />
                    {/snippet}
                </Button>
            </div>

            <div class="flex flex-col border-t border-border-subtle/60 pt-2 sm:border-t-0">
                <span
                    class="px-3 pb-1 text-2xs font-semibold tracking-wider text-text-muted uppercase"
                    >Save</span>
                <Button
                    shortcutGroup="save"
                    shortcutChordKey={argKey('/save', 'md')}
                    shortcutLabel="Save as MD"
                    type="ghost"
                    size="2xs"
                    label="Save as MD"
                    truncateMiddle
                    class="w-full justify-start rounded-none! px-3 text-xs font-normal! whitespace-nowrap text-text-secondary!"
                    onclick={() => {
                        close();
                        handleSaveMarkdown();
                    }}>
                    {#snippet leading()}
                        <i
                            class="bi bi-filetype-md inline-flex size-3.5 shrink-0 items-center justify-center text-xs leading-none [&::before]:align-[0] [&::before]:leading-none"
                            aria-hidden="true"></i>
                    {/snippet}
                </Button>
                <Button
                    shortcutGroup="save"
                    shortcutChordKey={argKey('/save', 'txt')}
                    shortcutLabel="Save as TXT"
                    type="ghost"
                    size="2xs"
                    label="Save as TXT"
                    truncateMiddle
                    class="w-full justify-start rounded-none! px-3 text-xs font-normal! whitespace-nowrap text-text-secondary!"
                    onclick={() => {
                        close();
                        handleSaveText();
                    }}>
                    {#snippet leading()}
                        <FileText class="size-3.5" />
                    {/snippet}
                </Button>
            </div>
        </div>
    </div>
{/snippet}

{#if variant === 'sidebar'}
    <nav
        aria-label="Content actions"
        class={cn(
            'flex shrink-0 flex-col gap-2.5 rounded-md glass-card p-3.5 text-left select-none sm:p-4',
            className
        )}>
        <div class="text-xs font-bold tracking-wider text-text-secondary uppercase select-none">
            Actions
        </div>

        <div class="grid grid-cols-2 gap-1.5">
            <Button
                shortcutGroup="copy"
                shortcutChordKey={argKey('/copy', 'md')}
                shortcutLabel="Copy as MD"
                type="secondary"
                size="2xs"
                class="w-full justify-start gap-1.5 px-2 py-1.5 text-xs font-normal! text-text-secondary!"
                onclick={handleCopyMarkdown}
                label={copiedMarkdown ? 'Copied!' : 'Copy as MD'}
                truncateMiddle>
                {#snippet leading()}
                    {#if copiedMarkdown}
                        <CopyCheck class="size-3.5 text-accent-text" />
                    {:else}
                        <Copy class="size-3.5 text-text-secondary" />
                    {/if}
                {/snippet}
            </Button>

            <Button
                shortcutGroup="view"
                shortcutChordKey={VIEW_FORMAT_KEYS.md}
                shortcutLabel="View as MD"
                href={viewMarkdownUrl}
                data-sveltekit-reload
                type="secondary"
                size="2xs"
                class="w-full justify-start gap-1.5 px-2 py-1.5 text-xs font-normal! text-text-secondary!"
                label="View as MD"
                truncateMiddle>
                {#snippet leading()}
                    <i
                        class="bi bi-markdown inline-flex size-3.5 shrink-0 items-center justify-center text-xs leading-none text-text-secondary [&::before]:align-[0] [&::before]:leading-none"
                        aria-hidden="true"></i>
                {/snippet}
            </Button>
        </div>

        <details class="group my-0 overflow-hidden pt-0.5">
            <summary
                use:shortcut={{
                    combo: buttonKey('moreActions'),
                    label: 'All actions',
                    placement: 'trailing'
                }}
                class="group/summary relative flex min-h-0 cursor-pointer list-none items-center justify-between gap-1 border-0! bg-transparent! px-0 py-0.5 text-2xs font-semibold tracking-wider text-text-muted uppercase no-underline! transition-colors select-none group-open:border-b-0! group-open:bg-transparent! hover:bg-transparent! hover:text-accent-text [&::-webkit-details-marker]:hidden">
                <span>All actions</span>
                <ChevronDown
                    class="size-3.5 text-text-secondary transition-transform duration-200 group-open:rotate-180 group-hover/summary:text-accent-text" />
            </summary>

            <div class="flex flex-col gap-2.5 pt-1.5">
                {#if showCopyUrl || pageId}
                    <div class="flex flex-col gap-1.5">
                        <span
                            class="text-3xs font-semibold tracking-wider text-text-muted uppercase select-none"
                            >Post</span>
                        <div
                            class="grid {showCopyUrl && pageId ? 'grid-cols-2' : (
                                'grid-cols-1'
                            )} gap-1.5">
                            {#if showCopyUrl}
                                <Button
                                    shortcutGroup="copy"
                                    shortcutChordKey={argKey('/copy', 'url')}
                                    shortcutLabel="Copy URL"
                                    type="secondary"
                                    size="2xs"
                                    class="w-full justify-start gap-1.5 px-2 py-1 text-xs font-normal! text-text-secondary!"
                                    onclick={handleCopyPageUrl}
                                    label={copiedUrl ? 'Copied!' : 'Copy URL'}
                                    truncateMiddle>
                                    {#snippet leading()}
                                        {#if copiedUrl}
                                            <CopyCheck class="size-3.5 text-accent-text" />
                                        {:else}
                                            <Link2 class="size-3.5 text-text-secondary" />
                                        {/if}
                                    {/snippet}
                                </Button>
                            {/if}

                            {#if pageId}
                                <Button
                                    shortcutGroup="copy"
                                    shortcutChordKey={argKey('/copy', 'pid')}
                                    shortcutLabel="Copy PID"
                                    type="secondary"
                                    size="2xs"
                                    class="w-full justify-start gap-1.5 px-2 py-1 text-xs font-normal! text-text-secondary!"
                                    onclick={handleCopyPageId}
                                    label={copiedId ? 'Copied!' : 'Copy PID'}
                                    truncateMiddle>
                                    {#snippet leading()}
                                        {#if copiedId}
                                            <CopyCheck class="size-3.5 text-accent-text" />
                                        {:else}
                                            <Hash class="size-3.5 text-text-secondary" />
                                        {/if}
                                    {/snippet}
                                </Button>
                            {/if}
                        </div>
                    </div>
                {/if}

                <div class="flex flex-col gap-1.5">
                    <span
                        class="text-3xs font-semibold tracking-wider text-text-muted uppercase select-none"
                        >Text</span>
                    <div class="grid grid-cols-2 gap-1.5">
                        <Button
                            shortcutGroup="copy"
                            shortcutChordKey={argKey('/copy', 'txt')}
                            shortcutLabel="Copy as TXT"
                            type="secondary"
                            size="2xs"
                            class="w-full justify-start gap-1.5 px-2 py-1 text-xs font-normal! text-text-secondary!"
                            onclick={handleCopyPlainText}
                            label={copiedText ? 'Copied!' : 'Copy as TXT'}
                            truncateMiddle>
                            {#snippet leading()}
                                {#if copiedText}
                                    <CopyCheck class="size-3.5 text-accent-text" />
                                {:else}
                                    <ScanText class="size-3.5 text-text-secondary" />
                                {/if}
                            {/snippet}
                        </Button>

                        <Button
                            shortcutGroup="view"
                            shortcutChordKey={VIEW_FORMAT_KEYS.txt}
                            shortcutLabel="View as TXT"
                            href={viewTextUrl}
                            data-sveltekit-reload
                            type="secondary"
                            size="2xs"
                            class="w-full justify-start gap-1.5 px-2 py-1 text-xs font-normal! text-text-secondary!"
                            label="View as TXT"
                            truncateMiddle>
                            {#snippet leading()}
                                <TextAlignStart class="size-3.5 text-text-secondary" />
                            {/snippet}
                        </Button>
                    </div>
                </div>

                <div class="flex flex-col gap-1.5">
                    <span
                        class="text-3xs font-semibold tracking-wider text-text-muted uppercase select-none"
                        >Save</span>
                    <div class="grid grid-cols-2 gap-1.5">
                        <Button
                            shortcutGroup="save"
                            shortcutChordKey={argKey('/save', 'md')}
                            shortcutLabel="Save as MD"
                            type="secondary"
                            size="2xs"
                            class="w-full justify-start gap-1.5 px-2 py-1 text-xs font-normal! text-text-secondary!"
                            onclick={handleSaveMarkdown}
                            label="Save as MD"
                            truncateMiddle>
                            {#snippet leading()}
                                <i
                                    class="bi bi-filetype-md inline-flex size-3.5 shrink-0 items-center justify-center text-xs leading-none text-text-secondary [&::before]:align-[0] [&::before]:leading-none"
                                    aria-hidden="true"></i>
                            {/snippet}
                        </Button>
                        <Button
                            shortcutGroup="save"
                            shortcutChordKey={argKey('/save', 'txt')}
                            shortcutLabel="Save as TXT"
                            type="secondary"
                            size="2xs"
                            class="w-full justify-start gap-1.5 px-2 py-1 text-xs font-normal! text-text-secondary!"
                            onclick={handleSaveText}
                            label="Save as TXT"
                            truncateMiddle>
                            {#snippet leading()}
                                <FileText class="size-3.5 text-text-secondary" />
                            {/snippet}
                        </Button>
                    </div>
                </div>
            </div>
        </details>
    </nav>
{:else}
    <div class={cn('flex flex-nowrap items-center gap-1.5 text-2xs select-none', className)}>
        <Button
            shortcutGroup="copy"
            shortcutChordKey={argKey('/copy', 'md')}
            shortcutLabel="Copy as MD"
            type="secondary"
            size="2xs"
            onclick={handleCopyMarkdown}
            label={copiedMarkdown ? 'Copied!' : 'Copy as MD'}
            truncateMiddle
            class="h-7 min-w-0 flex-1 justify-center gap-1.5 px-2 py-0.5 text-2xs font-normal! text-text-secondary! hover:text-accent-text">
            {#snippet leading()}
                {#if copiedMarkdown}
                    <CopyCheck class="size-3.5 shrink-0 text-accent-text" />
                {:else}
                    <Copy class="size-3.5 shrink-0" />
                {/if}
            {/snippet}
        </Button>

        <Button
            shortcutGroup="view"
            shortcutChordKey={VIEW_FORMAT_KEYS.md}
            shortcutLabel="View as MD"
            type="secondary"
            size="2xs"
            href={viewMarkdownUrl}
            data-sveltekit-reload
            label="View as MD"
            truncateMiddle
            class="h-7 min-w-0 flex-1 justify-center gap-1.5 px-2 py-0.5 text-2xs font-normal! text-text-secondary! hover:text-accent-text">
            {#snippet leading()}
                <i
                    class="bi bi-markdown inline-flex size-3.5 shrink-0 items-center justify-center text-xs leading-none [&::before]:align-[0] [&::before]:leading-none"
                    aria-hidden="true"></i>
            {/snippet}
        </Button>

        <Dropdown
            ariaLabel="More actions"
            placement="bottom-end">
            {#snippet trigger({ isOpen, toggle })}
                <Button
                    keyboardShortcut={buttonKey('moreActions')}
                    shortcutLabel="More actions"
                    type="ghost"
                    size="2xs"
                    onclick={toggle}
                    aria-label="More actions"
                    aria-expanded={isOpen}
                    aria-haspopup="dialog"
                    class={cn(
                        'size-7 px-0 text-text-muted hover:text-accent-text',
                        isOpen && 'border border-accent text-accent-text'
                    )}>
                    <EllipsisVertical class="size-3.5" />
                </Button>
            {/snippet}
            {#snippet children({ close })}
                {@render popoverMenu(close)}
            {/snippet}
        </Dropdown>
    </div>
{/if}
