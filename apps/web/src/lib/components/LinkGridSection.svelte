<script lang="ts">
    import type { Component } from 'svelte';
    import { SquareArrowOutUpRight, Inbox } from '@lucide/svelte';
    import SectionHeader from '@idstead/ui/components/SectionHeader.svelte';
    import EmptyState from '@idstead/ui/components/EmptyState.svelte';
    import BrandIcon from '#lib/components/BrandIcon.svelte';
    import Section from '@idstead/ui/layout/Section.svelte';
    import PageContainer from '@idstead/ui/layout/PageContainer.svelte';
    import { cn } from '@idstead/ui/utils/cn.ts';
    import { shortcut } from '@idstead/ui/utils/shortcut.svelte.ts';

    interface GridItem {
        label: string;
        value: string;
        href: string;
        icon?: string;
        color?: string;
        description?: string;
    }

    interface Props {
        title: string;
        subtitle: string;
        items: GridItem[];
        emptyIcon?: Component<{ class?: string }>;
        emptyTitle?: string;
        emptyDescription?: string;
        shortcutGroup?: string;
        class?: string;
    }

    let {
        title,
        subtitle,
        items,
        emptyIcon = Inbox,
        emptyTitle = 'Nothing here yet',
        emptyDescription = 'Check back soon.',
        shortcutGroup,
        class: className = ''
    }: Props = $props();
</script>

<Section
    spacing="none"
    class={cn('pt-6 pb-6 sm:pt-8 md:pb-8', className)}>
    <PageContainer width="standard">
        <SectionHeader
            {title}
            {subtitle} />

        {#if items.length === 0}
            <div class="mt-6">
                <EmptyState
                    icon={emptyIcon}
                    title={emptyTitle}
                    description={emptyDescription} />
            </div>
        {:else}
            <div class="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {#each items as item, idx (item.href || item.label || idx)}
                    <a
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        use:shortcut={{ group: shortcutGroup, label: item.label }}
                        class="group relative flex flex-col gap-0.5 rounded-md glass-card border border-line-subtle/60 p-2 transition-all duration-200 hover:border-accent/40 hover:bg-surface-hover hover:shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring sm:p-3">
                        <div
                            class="flex flex-1 items-center justify-between gap-3 sm:flex-col sm:items-stretch">
                            <div class="contents items-start justify-between gap-3 sm:flex">
                                {#if item.icon}
                                    <div
                                        class="flex size-10 shrink-0 items-center justify-center rounded-sm bg-fg/5 text-fg-muted transition-colors duration-200 group-hover:border-accent/40 group-hover:bg-accent/10 group-hover:text-fg-accent">
                                        <BrandIcon
                                            icon={item.icon}
                                            class="size-5 text-xl leading-none sm:size-6 sm:text-2xl" />
                                    </div>
                                {/if}
                                <SquareArrowOutUpRight
                                    class="order-last size-3 shrink-0 text-fg-muted/60 transition-colors duration-200 group-hover:text-fg-accent sm:order-0" />
                            </div>
                            <div class="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-none">
                                <span
                                    class="truncate text-sm font-semibold text-fg transition-colors group-hover:text-fg-accent">
                                    {item.label}
                                </span>
                                {#if item.value}
                                    <span
                                        class="truncate font-mono text-2xs text-fg-muted transition-colors group-hover:text-fg-secondary"
                                        title={item.value}>
                                        {item.value}
                                    </span>
                                {/if}
                            </div>
                        </div>
                        {#if item.description}
                            <span class="mt-0.5 text-2xs wrap-break-word text-fg-secondary">
                                {item.description}
                            </span>
                        {/if}
                        <span class="sr-only">(opens in a new tab)</span>
                    </a>
                {/each}
            </div>
        {/if}
    </PageContainer>
</Section>
