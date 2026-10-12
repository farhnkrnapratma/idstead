<script lang="ts">
    import { buttonKey } from '#lib/shortcuts.ts';
    import { Sun, Moon, SunMoon } from '@lucide/svelte';
    import { cn } from '../../utils/cn';
    import IconButton from '../IconButton.svelte';
    import { themeStore } from '../../stores/themeStore.svelte';
    import { toastStore } from '../../stores/toastStore.svelte';

    type Theme = 'auto' | 'dark' | 'light';

    interface Props {
        variant?: 'default' | 'ghost';
        size?: '2xs' | 'xs' | 'sm' | 'md' | 'lg';
        label?: string;
        theme?: Theme;
        onThemeChange?: (newTheme: Theme) => void;
        class?: string;
        dropdownDirection?: 'up' | 'down';
    }

    let {
        label,
        variant = 'default',
        size = 'sm',
        theme = 'auto',
        onThemeChange,
        class: className = '',
        dropdownDirection = 'down'
    }: Props = $props();

    let iconState = $state<'idle' | 'out' | 'in'>('idle');

    let currentTheme = $derived(themeStore.current || theme);

    let themeInfo = $derived.by(() => {
        switch (currentTheme) {
            case 'light':
                return { currentLabel: 'Light', nextTheme: 'dark' as Theme, icon: Sun };
            case 'dark':
                return { currentLabel: 'Dark', nextTheme: 'auto' as Theme, icon: Moon };
            case 'auto':
            default:
                return { currentLabel: 'Auto', nextTheme: 'light' as Theme, icon: SunMoon };
        }
    });

    let tooltipText = $derived(`Theme: ${themeInfo.currentLabel}`);

    function handleToggle() {
        if (iconState !== 'idle') return;

        const next = themeInfo.nextTheme;
        if (onThemeChange) {
            onThemeChange(next);
        } else {
            themeStore.apply(next);
        }
        const toastLabel =
            next === 'auto' ? 'system'
            : next === 'light' ? 'light'
            : 'dark';
        toastStore.show(`Switched to ${toastLabel} theme`);

        iconState = 'out';
        setTimeout(() => {
            iconState = 'in';
            setTimeout(() => {
                iconState = 'idle';
            }, 150);
        }, 120);
    }
</script>

<div
    class={cn(
        'items-center gap-2 select-none',
        className.includes('hidden') ? className : `inline-flex ${className}`
    )}>
    {#if label}
        <span class="text-xs font-medium whitespace-nowrap text-text-secondary">
            {label}
        </span>
    {/if}

    <IconButton
        ariaLabel={tooltipText}
        shortcutLabel="Toggle theme"
        keyboardShortcut={buttonKey('themeToggle')}
        tooltip={tooltipText}
        tooltipPlacement={dropdownDirection === 'up' ? 'top' : 'bottom'}
        {size}
        {variant}
        onclick={handleToggle}
        class={variant === 'ghost' ? 'hover:bg-surface-hover' : (
            cn(
                'border-border-subtle bg-surface backdrop-blur-none hover:border-accent hover:bg-surface-hover hover:text-accent',
                size !== '2xs' && 'sm:h-9 sm:w-9'
            )
        )}>
        <span
            class={cn(
                'inline-flex items-center justify-center',
                iconState === 'out' && 'code-icon-out',
                iconState === 'in' && 'code-icon-in'
            )}>
            <themeInfo.icon class={size === 'xs' ? 'size-3.5' : 'size-4'} />
        </span>
    </IconButton>
</div>
