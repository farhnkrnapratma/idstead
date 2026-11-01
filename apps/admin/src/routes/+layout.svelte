<!--
SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama

SPDX-License-Identifier: AGPL-3.0-only
-->

<script lang="ts">
    import '#lib/global.css';
    import { onMount } from 'svelte';
    import { themeColors } from '@idstead/ui/themeColors.ts';
    import { Toast } from '@idstead/ui';
    import { shortcutStore } from '@idstead/ui/stores/shortcutStore.svelte.ts';
    import { themeStore } from '@idstead/ui/stores/themeStore.svelte.ts';
    import { a11yStore } from '@idstead/ui/stores/a11yStore.svelte.ts';
    import { codeBlockPrefsStore } from '@mdrs/dom/codeBlockPrefsStore.svelte.ts';
    import { refreshCodeBlockPrefs } from '@mdrs/dom/codeBlocks.ts';
    import { identityAssetUrl } from '#lib/siteIdentity.ts';

    const { data, children } = $props();

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
    {#if data.author?.avatarVersion}
        <link
            rel="icon"
            type="image/x-icon"
            href={identityAssetUrl('favicon.ico', data.author.avatarVersion)} />
        <link
            rel="icon"
            type="image/png"
            sizes="32x32"
            href={identityAssetUrl('favicon-32x32.png', data.author.avatarVersion)} />
        <link
            rel="apple-touch-icon"
            sizes="180x180"
            href={identityAssetUrl('apple-touch-icon.png', data.author.avatarVersion)} />
    {/if}
    <meta
        name="theme-color"
        content={themeColors(themeStore.isDark ? 'dark' : 'light').theme_color} />
</svelte:head>

{@render children()}

<Toast />
