<script lang="ts">
    import '#lib/global.css';
    import { onMount } from 'svelte';
    import { themeColors } from '#lib/themeColors.ts';
    import { installSubmitShortcut } from '#lib/utils/submitShortcut.ts';
    import { Toast } from '#lib/index.ts';
    import ShortcutCatalogDialog from '#lib/components/ShortcutCatalogDialog.svelte';
    import ShortcutModeIndicator from '#lib/components/ShortcutModeIndicator.svelte';
    import { platformStore } from '#lib/stores/platformStore.svelte.ts';
    import { themeStore } from '#lib/stores/themeStore.svelte.ts';
    import { a11yStore } from '#lib/stores/a11yStore.svelte.ts';
    import { codeBlockPrefsStore } from '#lib/stores/codeBlockPrefsStore.svelte.ts';
    import { refreshCodeBlockPrefs } from '#lib/utils/codeBlocks.ts';

    const { data, children } = $props();

    const iconVersion = $derived(
        data?.author?.avatarVersion ? `?v=${data.author.avatarVersion}` : ''
    );

    onMount(() => {
        platformStore.detect();
        const cleanupTheme = themeStore.init();
        const cleanupA11y = a11yStore.init();
        const cleanupCodeBlockPrefs = codeBlockPrefsStore.init(refreshCodeBlockPrefs);
        const cleanupSubmitShortcut = installSubmitShortcut();
        return () => {
            cleanupTheme?.();
            cleanupA11y?.();
            cleanupCodeBlockPrefs?.();
            cleanupSubmitShortcut();
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
<ShortcutCatalogDialog />
<ShortcutModeIndicator />
