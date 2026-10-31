<script lang="ts">
    import { onMount } from 'svelte';
    import { Search } from '@lucide/svelte';
    import type { Project } from '@idstead/domain/types.ts';
    import { isTextEntryTarget } from '@idstead/ui/shortcuts.ts';
    import { cn } from '@idstead/ui/utils/cn.ts';
    import { spotlightStore } from '../stores/spotlightStore.svelte';
    import ShortcutBadge from '@idstead/ui/components/ShortcutBadge.svelte';
    import Tooltip from '@idstead/ui/components/Tooltip.svelte';

    interface Props {
        projects?: Project[];
        class?: string;
        wrapperClass?: string;
        variant?: 'default' | 'expanded' | 'responsive' | 'icon';
    }

    let {
        projects = [],
        class: className = '',
        wrapperClass = '',
        variant = 'default'
    }: Props = $props();

    const hostId = Symbol('spotlight-host');
    const isHost = $derived(spotlightStore.isHost(hostId));
    const Dialog = $derived(spotlightStore.dialog);

    $effect(() => {
        spotlightStore.setProjects(projects);
    });

    onMount(() => {
        const leave = spotlightStore.join(
            hostId,
            projects,
            () => import('./SpotlightDialog.svelte')
        );
        const prefetch = () => spotlightStore.prefetch();
        const idle = window.requestIdleCallback?.(prefetch, { timeout: 4000 });
        const timer = idle === undefined ? setTimeout(prefetch, 2000) : undefined;
        return () => {
            if (idle !== undefined) window.cancelIdleCallback(idle);
            clearTimeout(timer);
            leave();
        };
    });

    function handleGlobalKeydown(e: KeyboardEvent) {
        if (e.defaultPrevented || !isHost) return;

        const isK = e.key?.toLowerCase() === 'k' || e.code === 'KeyK';
        if ((e.ctrlKey || e.metaKey) && !e.altKey && isK) {
            e.preventDefault();
            spotlightStore.toggle();
            return;
        }

        const isSlash =
            e.key === '/'
            || (!e.shiftKey
                && !e.ctrlKey
                && !e.metaKey
                && !e.altKey
                && (e.code === 'Slash' || e.code === 'NumpadDivide'));

        if (isSlash && !isTextEntryTarget(e.target)) {
            e.preventDefault();
            spotlightStore.focusOrOpen('/');
        }
    }
</script>

<svelte:window onkeydown={handleGlobalKeydown} />

<div
    class={cn(
        'group relative',
        variant === 'expanded' ? 'flex w-full' : 'inline-flex',
        wrapperClass
    )}>
    {#snippet triggerButton()}
        <button
            type="button"
            onclick={() => spotlightStore.open()}
            onpointerenter={() => spotlightStore.prefetch()}
            onfocus={() => spotlightStore.prefetch()}
            class={cn(
                variant === 'expanded' ?
                    'flex h-8 w-full cursor-pointer items-center justify-between gap-2 rounded-md glass-button px-2.5 text-xs font-medium text-fg-secondary hover:border-accent hover:text-fg-accent sm:h-9 sm:px-3'
                : variant === 'icon' ?
                    'flex h-8 w-8 cursor-pointer items-center justify-center rounded-md glass-button p-0 text-xs font-semibold text-fg-secondary transition-colors hover:border-accent hover:bg-surface-hover hover:text-fg-accent sm:h-9 sm:w-9'
                : variant === 'responsive' ?
                    'flex h-8 w-8 cursor-pointer items-center justify-center rounded-md glass-button p-0 text-xs font-semibold text-fg-secondary transition-colors hover:border-accent hover:bg-surface-hover hover:text-fg-accent sm:h-9 sm:w-auto sm:justify-between sm:gap-2 sm:px-3'
                :   'flex h-8 w-8 cursor-pointer items-center justify-center rounded-md glass-button p-0 text-xs font-semibold text-fg-secondary transition-colors hover:border-accent hover:bg-surface-hover hover:text-fg-accent sm:h-9 sm:w-9 lg:h-9 lg:w-auto lg:justify-between lg:gap-2 lg:px-3',
                className
            )}
            aria-label={variant === 'icon' ? 'Search' : undefined}
            aria-keyshortcuts="Control+K Meta+K /">
            {#if variant === 'expanded'}
                <div class="flex min-w-0 items-center gap-2">
                    <Search class="size-4 shrink-0" />
                    <span class="truncate font-sans text-xs text-fg-muted">Search...</span>
                </div>
                <kbd
                    class="inline-flex h-5 items-center justify-center rounded-md border border-line-subtle bg-canvas px-1.5 align-middle font-mono text-xxs leading-none font-semibold text-fg-secondary shadow-2xs">
                    /
                </kbd>
            {:else if variant === 'icon'}
                <Search class="size-4 shrink-0" />
            {:else if variant === 'responsive'}
                <div class="flex min-w-0 items-center gap-2">
                    <Search class="size-4 shrink-0 sm:text-fg-muted" />
                    <span class="sr-only sm:hidden">Search</span>
                    <span class="hidden truncate font-sans text-xs text-fg-muted sm:inline"
                        >Search...</span>
                </div>
                <div class="ml-1.5 hidden items-center gap-1 sm:flex">
                    <ShortcutBadge combo="Mod+K" />
                    <span class="text-xxs text-fg-muted">or</span>
                    <ShortcutBadge combo="/" />
                </div>
            {:else}
                <div class="flex min-w-0 items-center gap-2">
                    <Search class="size-4 shrink-0 lg:text-fg-muted" />
                    <span class="sr-only lg:hidden">Search</span>
                    <span class="hidden truncate font-sans text-xs text-fg-muted lg:inline"
                        >Search...</span>
                </div>
                <div class="ml-1.5 hidden items-center gap-1 lg:flex">
                    <ShortcutBadge combo="Mod+K" />
                    <span class="text-xxs text-fg-muted">or</span>
                    <ShortcutBadge combo="/" />
                </div>
            {/if}
        </button>
    {/snippet}

    {#if variant === 'expanded'}
        {@render triggerButton()}
    {:else if variant === 'icon'}
        <Tooltip
            content="Search (ctrl+k or /)"
            placement="bottom"
            align="center">
            {@render triggerButton()}
        </Tooltip>
    {:else}
        <Tooltip
            content="Search (ctrl+k or /)"
            placement="bottom"
            align="center"
            class={variant === 'responsive' ? 'sm:hidden' : 'lg:hidden'}>
            {@render triggerButton()}
        </Tooltip>
    {/if}
</div>

{#if isHost && Dialog}
    <Dialog />
{/if}
