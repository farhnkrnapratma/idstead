<script
    lang="ts"
    module>
    export interface NavMenuItem {
        label: string;
        href: string;
        external?: boolean;
        current?: boolean;
        combo?: string;
    }

    export interface NavMenuGroup {
        label: string;
        items: NavMenuItem[];
    }
</script>

<script lang="ts">
    import { ChevronDown, SquareArrowOutUpRight } from '@lucide/svelte';
    import { cn } from '../utils/cn';
    import Button from './Button.svelte';
    import Dropdown from './Dropdown.svelte';

    interface Props {
        label: string;
        groups: NavMenuGroup[];
        active?: boolean;
        shortcut?: string;
        placement?: 'bottom-start' | 'bottom-end';
        class?: string;
    }

    let {
        label,
        groups,
        active = false,
        shortcut,
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
        <Button
            type="ghost"
            size="sm"
            onclick={toggle}
            aria-expanded={isOpen}
            aria-haspopup="dialog"
            keyboardShortcut={shortcut}
            shortcutLabel="Open the {label} menu"
            class={cn(
                'gap-1 px-2 text-sm font-medium',
                isOpen || active ? 'text-fg!' : 'text-fg-muted! hover:text-fg!'
            )}>
            {label}
            <ChevronDown
                class={cn(
                    'size-3 transition-transform duration-200 ease-out',
                    isOpen && 'rotate-180'
                )} />
        </Button>
    {/snippet}
    {#snippet children({ close })}
        <nav
            aria-label={label}
            class="flex min-w-52 scrollbar-none flex-col overflow-y-auto pt-1 [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {#each visibleGroups as group, index (group.label)}
                {#if index > 0}
                    <hr class="my-1 border-line-subtle" />
                {/if}
                <p
                    class="px-3 pt-1.5 pb-1 text-2xs font-semibold tracking-wider text-fg-muted uppercase">
                    {group.label}
                </p>
                {#each group.items as item (item.href)}
                    <Button
                        href={item.href}
                        target={item.external ? '_blank' : undefined}
                        rel={item.external ? 'noopener noreferrer' : undefined}
                        type="ghost"
                        size="sm"
                        aria-current={item.current ? 'page' : undefined}
                        onclick={close}
                        keyboardShortcut={item.combo}
                        shortcutLabel={item.label}
                        shortcutPlacement="inline"
                        class={cn(
                            'h-auto! w-full justify-start! gap-2 rounded-none! py-2 ps-3 pe-12 text-sm font-medium no-underline focus-visible:-outline-offset-2!',
                            item.current ?
                                'bg-accent/10 font-semibold text-fg-accent!'
                            :   'text-fg! hover:bg-surface-hover hover:text-fg-accent! focus-visible:bg-surface-hover'
                        )}>
                        <span class="min-w-0 flex-1 truncate text-left">{item.label}</span>
                        {#if item.external}
                            <SquareArrowOutUpRight class="size-3 shrink-0 text-fg-muted" />
                            <span class="sr-only">(opens in new tab)</span>
                        {/if}
                    </Button>
                {/each}
            {/each}
        </nav>
    {/snippet}
</Dropdown>
