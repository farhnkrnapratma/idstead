<script lang="ts">
    import '#lib/global.css';
    import { onMount } from 'svelte';
    import { themeColors } from '@fkp/ui/themeColors.ts';
    import { Toast } from '@fkp/ui';
    import { shortcutStore } from '@fkp/ui/stores/shortcutStore.svelte.ts';
    import { themeStore } from '@fkp/ui/stores/themeStore.svelte.ts';
    import { a11yStore } from '@fkp/ui/stores/a11yStore.svelte.ts';
    import { codeBlockPrefsStore } from '@fkp/mdrs-ui/codeBlockPrefsStore.svelte.ts';
    import { refreshCodeBlockPrefs } from '@fkp/mdrs-ui/codeBlocks.ts';

    const { children } = $props();

    shortcutStore.disable();

    onMount(() => {
        const cleanupTheme = themeStore.init();
        const cleanupA11y = a11yStore.init();
        const cleanupCodeBlockPrefs = codeBlockPrefsStore.init(refreshCodeBlockPrefs);
        return () => {
            cleanupTheme?.();
            cleanupA11y?.();
            cleanupCodeBlockPrefs?.();
        };
    });
</script>

<svelte:head>
    <link
        rel="icon"
        type="image/x-icon"
        href="/favicon.ico" />
    <link
        rel="icon"
        type="image/png"
        sizes="32x32"
        href="/favicon-32x32.png" />
    <link
        rel="apple-touch-icon"
        sizes="180x180"
        href="/apple-touch-icon.png" />
    <meta
        name="theme-color"
        content={themeColors(themeStore.isDark ? 'dark' : 'light').theme_color} />
</svelte:head>

{@render children()}

<Toast />
