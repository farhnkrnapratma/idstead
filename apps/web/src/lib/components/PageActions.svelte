<!--
SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama

SPDX-License-Identifier: AGPL-3.0-only
-->

<script lang="ts">
    import type { Component } from 'svelte';
    import {
        ArrowUpRight,
        ChevronDown,
        Copy,
        CopyCheck,
        FileText,
        Hash,
        Link2,
        ScanText,
        TextAlignStart
    } from '@lucide/svelte';
    import { page } from '$app/state';
    import { markdownToPlainText } from '@mdrs/core';
    import Dropdown from '@idstead/ui/components/Dropdown.svelte';
    import { toastStore } from '@idstead/ui/stores/toastStore.svelte.ts';
    import { cn } from '@idstead/ui/utils/cn.ts';
    import { MENU_ITEM_TONE_CLASSES } from '@idstead/ui/utils/menuItemStyles.ts';
    import { shortcut, type ShortcutParams } from '@idstead/ui/utils/shortcut.svelte.ts';
    import { argKey, buttonKey, VIEW_FORMAT_KEYS } from '@idstead/ui/shortcuts.ts';

    interface Props {
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

    interface ActionItem {
        id: string;
        label: string;
        description: string;
        icon?: Component<{ class?: string }>;
        iconClass?: string;
        href?: string;
        external?: boolean;
        shortcut: ShortcutParams;
        run?: () => void;
    }

    let cachedMarkdown = $state<string | null>(null);
    let copied = $state<string | null>(null);
    let copiedTimer: ReturnType<typeof setTimeout> | undefined;

    const markdownUrl = $derived(new URL(viewMarkdownUrl, page.url.origin).href);
    const claudeUrl = $derived(
        `https://claude.ai/new?q=${encodeURIComponent(
            `Read ${markdownUrl} so I can ask questions about it.`
        )}`
    );

    async function getMarkdown(): Promise<string> {
        if (markdownContent) return markdownContent;
        if (cachedMarkdown) return cachedMarkdown;
        const res = await fetch(viewMarkdownUrl);
        if (!res.ok) throw new Error('Failed to fetch Markdown');
        cachedMarkdown = await res.text();
        return cachedMarkdown;
    }

    async function getPlainText(): Promise<string> {
        const text = markdownToPlainText(await getMarkdown());
        return title ? `${title}\n\n${text}` : text;
    }

    async function copy(id: string, read: () => Promise<string> | string, done: string) {
        try {
            await navigator.clipboard.writeText(await read());
            copied = id;
            clearTimeout(copiedTimer);
            copiedTimer = setTimeout(() => (copied = null), 2000);
            toastStore.success(done);
        } catch {
            toastStore.error('Copy failed');
        }
    }

    function downloadFile(filename: string, content: string, mimeType: string) {
        const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    }

    async function save(read: () => Promise<string>, extension: string, mimeType: string) {
        try {
            downloadFile(`${slug || 'document'}.${extension}`, await read(), mimeType);
            toastStore.success('File downloaded');
        } catch {
            toastStore.error('Download failed');
        }
    }

    const copyPage = () => copy('markdown', getMarkdown, 'Markdown copied to clipboard');

    const groups = $derived<ActionItem[][]>([
        [
            {
                id: 'markdown',
                label: 'Copy page',
                description: 'Markdown, ready to paste into an LLM',
                icon: Copy,
                shortcut: { group: 'copy', chordKey: argKey('/copy', 'md'), label: 'Copy page' },
                run: copyPage
            },
            {
                id: 'view-markdown',
                label: 'View as Markdown',
                description: 'This page as plain Markdown',
                iconClass: 'bi bi-markdown',
                href: viewMarkdownUrl,
                shortcut: {
                    group: 'view',
                    chordKey: VIEW_FORMAT_KEYS.md,
                    label: 'View as Markdown'
                }
            },
            {
                id: 'claude',
                label: 'Open in Claude',
                description: 'Ask Claude about this page',
                iconClass: 'bi bi-claude',
                href: claudeUrl,
                external: true,
                shortcut: { disabled: true }
            }
        ],
        [
            ...(showCopyUrl ?
                [
                    {
                        id: 'url',
                        label: 'Copy URL',
                        description: 'Link to this page',
                        icon: Link2,
                        shortcut: {
                            group: 'copy',
                            chordKey: argKey('/copy', 'url'),
                            label: 'Copy URL'
                        },
                        run: () =>
                            copy('url', () => pageUrl || window.location.href, 'Page URL copied')
                    }
                ]
            :   []),
            ...(pageId ?
                [
                    {
                        id: 'pid',
                        label: 'Copy PID',
                        description: 'Permanent ID of this post',
                        icon: Hash,
                        shortcut: {
                            group: 'copy',
                            chordKey: argKey('/copy', 'pid'),
                            label: 'Copy PID'
                        },
                        run: () => copy('pid', () => pageId ?? '', 'Post ID copied')
                    }
                ]
            :   [])
        ],
        [
            {
                id: 'text',
                label: 'Copy as text',
                description: 'Plain text without Markdown',
                icon: ScanText,
                shortcut: {
                    group: 'copy',
                    chordKey: argKey('/copy', 'txt'),
                    label: 'Copy as text'
                },
                run: () => copy('text', getPlainText, 'Text copied to clipboard')
            },
            {
                id: 'view-text',
                label: 'View as text',
                description: 'This page as plain text',
                icon: TextAlignStart,
                href: viewTextUrl,
                shortcut: { group: 'view', chordKey: VIEW_FORMAT_KEYS.txt, label: 'View as text' }
            }
        ],
        [
            {
                id: 'save-markdown',
                label: 'Save as Markdown',
                description: 'Download a .md file',
                iconClass: 'bi bi-filetype-md',
                shortcut: {
                    group: 'save',
                    chordKey: argKey('/save', 'md'),
                    label: 'Save as Markdown'
                },
                run: () => save(getMarkdown, 'md', 'text/markdown;charset=utf-8')
            },
            {
                id: 'save-text',
                label: 'Save as text',
                description: 'Download a .txt file',
                icon: FileText,
                shortcut: {
                    group: 'save',
                    chordKey: argKey('/save', 'txt'),
                    label: 'Save as text'
                },
                run: () => save(getPlainText, 'txt', 'text/plain;charset=utf-8')
            }
        ]
    ]);

    const actions = $derived(groups.flat().filter(item => !item.shortcut.disabled));
</script>

{#snippet itemIcon(item: ActionItem)}
    {#if copied === item.id}
        <CopyCheck class="size-4 text-fg-accent" />
    {:else if item.icon}
        <item.icon class="size-4" />
    {:else}
        <i
            class={cn(
                item.iconClass,
                'inline-flex size-4 items-center justify-center text-sm leading-none [&::before]:align-[0] [&::before]:leading-none'
            )}
            aria-hidden="true"></i>
    {/if}
{/snippet}

<div class="hidden">
    {#each actions as item (item.id)}
        {#if item.href}
            <a
                href={item.href}
                target={item.external ? '_blank' : undefined}
                rel={item.external ? 'noopener noreferrer' : undefined}
                data-sveltekit-reload={item.external ? undefined : true}
                tabindex="-1"
                use:shortcut={item.shortcut}>{item.label}</a>
        {:else}
            <button
                type="button"
                tabindex="-1"
                onclick={item.run}
                use:shortcut={item.shortcut}>{item.label}</button>
        {/if}
    {/each}
</div>

<div
    role="group"
    aria-label="Page actions"
    class={cn('inline-flex shrink-0 items-stretch rounded-md glass-button select-none', className)}>
    <button
        type="button"
        onclick={copyPage}
        use:shortcut={{ group: 'copy', chordKey: argKey('/copy', 'md'), label: 'Copy page' }}
        class="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-l-md px-2.5 text-xs font-medium text-fg-secondary transition-colors hover:text-fg-accent focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none">
        {#if copied === 'markdown'}
            <CopyCheck class="size-3.5 text-fg-accent" />
            Copied
        {:else}
            <Copy class="size-3.5" />
            Copy page
        {/if}
    </button>
    <Dropdown
        ariaLabel="More page actions"
        placement="bottom-end">
        {#snippet trigger({ isOpen, toggle })}
            <button
                type="button"
                onclick={toggle}
                use:shortcut={{ combo: buttonKey('moreActions'), label: 'More page actions' }}
                aria-label="More page actions"
                aria-expanded={isOpen}
                aria-haspopup="dialog"
                class={cn(
                    'inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-r-md border-l border-line-subtle transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none',
                    isOpen ? 'text-fg-accent' : 'text-fg-muted hover:text-fg-accent'
                )}>
                <ChevronDown
                    class={cn(
                        'size-3.5 transition-transform duration-200 ease-out',
                        isOpen && 'rotate-180'
                    )} />
            </button>
        {/snippet}
        {#snippet children({ close })}
            <div
                class="flex w-80 max-w-[calc(100vw-1rem)] scrollbar-none flex-col overflow-y-auto [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                {#each groups.filter(group => group.length > 0) as group, index (group[0].id)}
                    {#if index > 0}
                        <hr class="my-0.5 border-line-subtle" />
                    {/if}
                    {#each group as item (item.id)}
                        {@const rowClass = cn(
                            'flex w-full cursor-pointer items-center gap-3 px-3 py-1.5 text-left no-underline transition-colors focus-visible:outline-none',
                            MENU_ITEM_TONE_CLASSES.default
                        )}
                        {#if item.href}
                            <a
                                href={item.href}
                                target={item.external ? '_blank' : undefined}
                                rel={item.external ? 'noopener noreferrer' : undefined}
                                data-sveltekit-reload={item.external ? undefined : true}
                                onclick={close}
                                use:shortcut={item.shortcut}
                                class={rowClass}>
                                <span
                                    class="inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-line-subtle text-fg-secondary">
                                    {@render itemIcon(item)}
                                </span>
                                <span class="flex min-w-0 flex-col">
                                    <span
                                        class="inline-flex items-center gap-1 text-xs font-medium">
                                        {item.label}
                                        {#if item.external}
                                            <ArrowUpRight
                                                strokeWidth={1.5}
                                                class="size-3 text-fg-muted"
                                                aria-hidden="true" />
                                            <span class="sr-only">(opens in new tab)</span>
                                        {/if}
                                    </span>
                                    <span class="text-2xs text-fg-muted">{item.description}</span>
                                </span>
                            </a>
                        {:else}
                            <button
                                type="button"
                                onclick={() => {
                                    close();
                                    item.run?.();
                                }}
                                use:shortcut={item.shortcut}
                                class={rowClass}>
                                <span
                                    class="inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-line-subtle text-fg-secondary">
                                    {@render itemIcon(item)}
                                </span>
                                <span class="flex min-w-0 flex-col">
                                    <span class="text-xs font-medium">{item.label}</span>
                                    <span class="text-2xs text-fg-muted">{item.description}</span>
                                </span>
                            </button>
                        {/if}
                    {/each}
                {/each}
            </div>
        {/snippet}
    </Dropdown>
</div>
