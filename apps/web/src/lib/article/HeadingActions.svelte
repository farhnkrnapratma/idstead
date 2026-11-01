<!--
SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama

SPDX-License-Identifier: AGPL-3.0-only
-->

<script lang="ts">
    import type { Component } from 'svelte';
    import { ChevronDown, Link, Pilcrow, QrCode, Share2 } from '@lucide/svelte';
    import Dropdown from '@idstead/ui/components/Dropdown.svelte';
    import { cn } from '@idstead/ui/utils/cn.ts';
    import { copyText } from '@idstead/ui/utils/fileActions.ts';
    import { MENU_ITEM_TONE_CLASSES } from '@idstead/ui/utils/menuItemStyles.ts';
    import { activateHeadingAnchor } from '@mdrs/dom/headingAnchors.ts';
    import QrCodeDialog from '#app/components/QrCodeDialog.svelte';

    interface Props {
        href: string;
        url: string;
        title: string;
        qrSlug: string;
        scope?: 'page' | 'section';
        active?: boolean;
        onPermalink?: () => void;
    }

    let {
        href,
        url,
        title,
        qrSlug,
        scope = 'section',
        active = false,
        onPermalink
    }: Props = $props();

    interface LinkAction {
        id: string;
        label: string;
        description: string;
        icon?: Component<{ class?: string }>;
        iconClass?: string;
        run: () => void;
    }

    let isQrOpen = $state(false);
    let qrRequested = $state(false);
    const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

    const markdownLink = $derived(`[${title.replace(/([\\[\]])/g, '\\$1')}](${url})`);

    function showQr() {
        qrRequested = true;
        isQrOpen = true;
    }

    async function share() {
        try {
            await navigator.share({ title, url });
        } catch (error) {
            if ((error as DOMException)?.name !== 'AbortError') void copyText(url, 'Link');
        }
    }

    const actions = $derived<LinkAction[]>([
        {
            id: 'copy',
            label: 'Copy link',
            description: scope === 'page' ? 'Link to this page' : 'Link to this section',
            icon: Link,
            run: () => void copyText(url, 'Link')
        },
        {
            id: 'markdown',
            label: 'Copy Markdown link',
            description: 'Titled link, ready to paste',
            iconClass: 'bi bi-markdown',
            run: () => void copyText(markdownLink, 'Markdown link')
        },
        {
            id: 'qr',
            label: 'Show QR code',
            description: scope === 'page' ? 'Scan to open this page' : 'Scan to open this section',
            icon: QrCode,
            run: showQr
        },
        ...(canShare ?
            [
                {
                    id: 'share',
                    label: 'Share',
                    description: 'Open the share sheet',
                    icon: Share2,
                    run: () => void share()
                }
            ]
        :   [])
    ]);
</script>

<span
    role="group"
    aria-label={scope === 'page' ? 'Page link' : 'Section link'}
    class="inline-flex h-[clamp(1.5rem,1em,2rem)] items-stretch rounded-md border border-transparent text-fg-muted transition-colors has-focus-visible:border-line-subtle has-[[aria-expanded=true]]:border-line-subtle max-sm:border-line-subtle [.mdrs-heading:hover_&]:border-line-subtle">
    <a
        {href}
        aria-label="Permanent link"
        data-tooltip="Permanent link"
        class={cn(
            'mdrs-anchor aspect-square h-full w-auto rounded-l-md rounded-r-none',
            active && 'mdrs-is-active'
        )}
        onclick={event => {
            activateHeadingAnchor(event.currentTarget);
            if (!onPermalink) return;
            event.preventDefault();
            onPermalink();
        }}>
        <Pilcrow
            class="size-[clamp(0.75rem,0.55em,1rem)]"
            aria-hidden="true" />
    </a>
    <Dropdown
        ariaLabel={scope === 'page' ? 'Page link options' : 'Section link options'}
        placement="bottom-end">
        {#snippet trigger({ isOpen, toggle })}
            <button
                type="button"
                onclick={toggle}
                aria-label={scope === 'page' ? 'Page link options' : 'Section link options'}
                aria-expanded={isOpen}
                aria-haspopup="dialog"
                class={cn(
                    'heading-menu-trigger inline-flex aspect-square h-full cursor-pointer items-center justify-center rounded-r-md border-l border-line-subtle transition-[color,opacity] focus-visible:outline-2 focus-visible:outline-focus-ring',
                    isOpen ? 'text-fg-accent' : 'hover:text-fg'
                )}>
                <ChevronDown
                    class={cn(
                        'size-[clamp(0.75rem,0.55em,1rem)] transition-transform duration-200 ease-out',
                        isOpen && 'rotate-180'
                    )}
                    aria-hidden="true" />
            </button>
        {/snippet}
        {#snippet children({ close })}
            <div class="flex w-72 max-w-[calc(100vw-1rem)] flex-col py-0.5">
                {#each actions as action (action.id)}
                    <button
                        type="button"
                        onclick={() => {
                            close();
                            action.run();
                        }}
                        class={cn(
                            'flex w-full cursor-pointer items-center gap-3 px-3 py-1.5 text-left transition-colors focus-visible:outline-none',
                            MENU_ITEM_TONE_CLASSES.default
                        )}>
                        <span
                            class="inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-line-subtle text-fg-secondary">
                            {#if action.icon}
                                <action.icon class="size-4" />
                            {:else}
                                <i
                                    class={cn(
                                        action.iconClass,
                                        'inline-flex size-4 items-center justify-center text-sm leading-none [&::before]:align-[0] [&::before]:leading-none'
                                    )}
                                    aria-hidden="true"></i>
                            {/if}
                        </span>
                        <span class="flex min-w-0 flex-col">
                            <span class="text-xs font-medium">{action.label}</span>
                            <span class="text-2xs text-fg-muted">{action.description}</span>
                        </span>
                    </button>
                {/each}
            </div>
        {/snippet}
    </Dropdown>
</span>

{#if qrRequested}
    <QrCodeDialog
        bind:isOpen={isQrOpen}
        {url}
        slug={qrSlug}
        onClose={() => (isQrOpen = false)} />
{/if}

<style>
    @reference "@idstead/ui/styles/global.css";

    @media (hover: hover) and (pointer: fine) and (width >= 40rem) {
        :global(.mdrs-heading:not(:hover, :focus-within))
            .heading-menu-trigger:not([aria-expanded='true']) {
            @apply opacity-0;
        }
    }
</style>
