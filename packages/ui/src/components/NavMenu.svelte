<script
    lang="ts"
    module>
    import type { Component } from 'svelte';

    export interface NavMenuItem {
        label: string;
        href: string;
        icon?: Component<{ class?: string }>;
        external?: boolean;
        current?: boolean;
    }

    export interface NavMenuGroup {
        label: string;
        items: NavMenuItem[];
    }
</script>

<script lang="ts">
    import { ChevronDown, SquareArrowOutUpRight } from '@lucide/svelte';
    import { cn } from '../utils/cn';
    import { MENU_ITEM_TONE_CLASSES } from '../utils/menuItemStyles';
    import Dropdown from './Dropdown.svelte';

    interface Props {
        label: string;
        groups: NavMenuGroup[];
        active?: boolean;
        placement?: 'bottom-start' | 'bottom-end';
        class?: string;
    }

    let {
        label,
        groups,
        active = false,
        placement = 'bottom-start',
        class: className = ''
    }: Props = $props();

    const visibleGroups = $derived(groups.filter(group => group.items.length > 0));
</script>

<Dropdown
    ariaLabel={label}
    {placement}
    class={className}>
    {#snippet trigger({ isOpen, toggle })}
        <button
            type="button"
            onclick={toggle}
            aria-expanded={isOpen}
            aria-haspopup="dialog"
            class={cn(
                'inline-flex h-8 cursor-pointer items-center gap-1 rounded-md px-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none',
                isOpen || active ? 'text-fg' : 'text-fg-muted hover:text-fg'
            )}>
            {label}
            <ChevronDown
                class={cn(
                    'size-3 transition-transform duration-200 ease-out',
                    isOpen && 'rotate-180'
                )} />
        </button>
    {/snippet}
    {#snippet children({ close })}
        <nav
            aria-label={label}
            class="flex max-h-[min(70vh,32rem)] min-w-48 flex-col overflow-y-auto py-1">
            {#each visibleGroups as group, index (group.label)}
                {#if index > 0}
                    <hr class="my-1 border-line-subtle" />
                {/if}
                <p
                    class="px-3 pt-1.5 pb-1 text-2xs font-semibold tracking-wider text-fg-muted uppercase">
                    {group.label}
                </p>
                {#each group.items as item (item.href)}
                    <a
                        href={item.href}
                        target={item.external ? '_blank' : undefined}
                        rel={item.external ? 'noopener noreferrer' : undefined}
                        aria-current={item.current ? 'page' : undefined}
                        onclick={close}
                        class={cn(
                            'flex items-center gap-2 px-3 py-2 text-xs font-medium no-underline transition-colors focus-visible:outline-none',
                            item.current ?
                                'bg-accent/10 font-semibold text-fg-accent'
                            :   MENU_ITEM_TONE_CLASSES.default
                        )}>
                        {#if item.icon}
                            <item.icon class="size-3.5 shrink-0" />
                        {/if}
                        <span class="min-w-0 flex-1 truncate">{item.label}</span>
                        {#if item.external}
                            <SquareArrowOutUpRight class="size-3 shrink-0 text-fg-muted" />
                            <span class="sr-only">(opens in new tab)</span>
                        {/if}
                    </a>
                {/each}
            {/each}
        </nav>
    {/snippet}
</Dropdown>
