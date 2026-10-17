<script lang="ts">
    import { House, FolderOpen, Quote, FileUser, AtSign } from '@lucide/svelte';
    import { cn } from '../utils/cn';
    import { shortcut } from '../utils/shortcut.svelte';
    import { sectionCommandKey } from '#lib/shortcuts.ts';
    import type { Section } from '../types';

    interface NavItem {
        id: Section;
        label: string;
        icon: any;
    }

    interface Props {
        activeSection?: Section;
        onNavigate?: (id: Section) => void;
        items?: NavItem[];
        class?: string;
    }

    const defaultItems: NavItem[] = [
        { id: 'home', label: 'Home', icon: House },
        { id: 'projects', label: 'Projects', icon: FolderOpen },
        { id: 'blog', label: 'Blog', icon: Quote },
        { id: 'cv', label: 'CV', icon: FileUser },
        { id: 'contact', label: 'Contact', icon: AtSign }
    ];

    let {
        activeSection = 'home',
        onNavigate,
        items = defaultItems,
        class: className = ''
    }: Props = $props();
</script>

<nav
    class={cn(
        'fixed right-0 bottom-0 left-0 z-50 flex h-14 w-full items-center justify-around gap-1 border-t border-border-subtle/60 bg-surface-card/90 px-1 pb-[env(safe-area-inset-bottom)] shadow-lg backdrop-blur-md md:hidden dark:border-white/10 dark:bg-surface-card/85',
        className
    )}
    aria-label="Mobile bottom navigation">
    {#each items as item (item.id)}
        {@const isActive = activeSection === item.id}
        {@const IconComponent = item.icon}
        <button
            type="button"
            onclick={() => onNavigate?.(item.id)}
            aria-label={item.label}
            aria-current={isActive ? 'page' : undefined}
            use:shortcut={{ combo: sectionCommandKey(item.id), label: item.label }}
            class={cn(
                'group relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-md px-0.5 py-1 transition select-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none active:inset-shadow-button-pressed motion-safe:active:translate-y-px [&>span>svg]:block',
                isActive ?
                    'bg-accent-contrast-bg bg-linear-to-b from-accent-sheen to-accent-contrast-bg font-bold text-text-on-accent shadow-button-accent inset-shadow-button-fill'
                :   'text-text-muted hover:bg-surface-hover hover:text-text-primary'
            )}>
            <span class="flex size-6 items-center justify-center">
                <IconComponent class="size-4.5" />
            </span>
            <span
                class={cn(
                    'max-w-full truncate text-2xs leading-none tracking-tight transition-colors',
                    isActive ? 'font-bold' : 'font-medium'
                )}>
                {item.label}
            </span>
        </button>
    {/each}
</nav>
