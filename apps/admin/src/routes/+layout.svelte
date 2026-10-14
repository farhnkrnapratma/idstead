<script lang="ts">
    import '#lib/global.css';
    import { onMount } from 'svelte';
    import { themeColors } from '#lib/themeColors.ts';
    import { Toast } from '#lib/index.ts';
    import { shortcutStore } from '#lib/stores/shortcutStore.svelte.ts';
    import { themeStore } from '#lib/stores/themeStore.svelte.ts';
    import { a11yStore } from '#lib/stores/a11yStore.svelte.ts';
    import { codeBlockPrefsStore } from '#lib/stores/codeBlockPrefsStore.svelte.ts';
    import { refreshCodeBlockPrefs } from '#lib/utils/codeBlocks.ts';

    const { data, children } = $props();

    shortcutStore.disable();

    const iconVersion = $derived(
        data?.author?.avatarVersion ? `?v=${data.author.avatarVersion}` : ''
    );

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
        href={`/favicon.ico${iconVersion}`} />
    <link
        rel="icon"
        type="image/png"
        sizes="32x32"
        href={`/favicon-32x32.png${iconVersion}`} />
    <link
        rel="apple-touch-icon"
        sizes="180x180"
        href={`/apple-touch-icon.png${iconVersion}`} />
    <meta
        name="theme-color"
        content={themeColors(themeStore.isDark ? 'dark' : 'light').theme_color} />
</svelte:head>

{@render children()}

<Toast />
