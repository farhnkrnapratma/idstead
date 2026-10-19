<script lang="ts">
    import Button from '@fkp/ui/components/Button.svelte';
    import ImageWithSkeleton from '@fkp/ui/components/ImageWithSkeleton.svelte';
    import ThemeSelect from '@fkp/ui/components/filter/ThemeSelect.svelte';
    import AccessibilitySelect from '@fkp/ui/components/filter/AccessibilitySelect.svelte';
    import { themeStore } from '@fkp/ui/stores/themeStore.svelte.ts';
    import { sectionCommandKey } from '@fkp/ui/shortcuts.ts';
    import type { Project } from '@fkp/domain/types.ts';
    import { page } from '$app/state';
    import { avatarSources, avatarWebpSource } from '#lib/siteIdentity.ts';
    import SpotlightSearch from './SpotlightSearch.svelte';
    import { SITE_SECTIONS, sectionForPath } from '../siteSections';

    interface Props {
        author?: { name?: string; avatar?: string; avatarVersion?: string | null } | null;
        projects?: Project[];
    }

    let { author, projects = [] }: Props = $props();

    const name = $derived(author?.name || '');
    const avatar = $derived(author?.avatar || '');
    const avatarWebp = $derived(avatarWebpSource(author) || avatar);
    const avatarFormats = $derived(avatarSources(author));
    const activeSection = $derived(sectionForPath(page.url.pathname));
</script>

<nav
    class="fixed inset-x-2 top-2 z-40 flex h-12 items-center justify-between rounded-md glass-card border border-border-subtle/30 px-3 font-sans shadow-2xs sm:inset-x-3 sm:top-3 sm:h-14 sm:px-5"
    aria-label="Main navigation">
    <div class="flex shrink-0 items-center lg:w-1/4 lg:flex-none">
        <Button
            type="ghost"
            size="sm"
            href="/"
            aria-label={name}
            class="flex h-9 items-center gap-2 rounded-md border-0 px-1.5 sm:px-2">
            {#snippet leading()}
                {#if avatar}
                    <ImageWithSkeleton
                        src={avatarWebp}
                        sources={avatarFormats}
                        alt={`Profile picture of ${name}`}
                        variant="avatar"
                        rounded="rounded-full"
                        class="h-7 w-7 shrink-0 sm:h-8 sm:w-8" />
                {/if}
            {/snippet}
            <span
                class="truncate text-sm font-semibold text-text-primary {avatar ? 'hidden lg:inline'
                :   'inline'}">
                {name}
            </span>
        </Button>
    </div>

    <nav
        class="hidden md:flex md:flex-1 md:items-center md:justify-center"
        aria-label="Section navigation">
        <ul class="flex items-center gap-1">
            {#each SITE_SECTIONS as item (item.id)}
                <li>
                    <Button
                        type={activeSection === item.id ? 'primary' : 'ghost'}
                        size="sm"
                        href={item.path}
                        aria-current={activeSection === item.id ? 'page' : undefined}
                        keyboardShortcut={sectionCommandKey(item.id)}
                        shortcutLabel={item.label}
                        class="h-9 px-3 text-sm {activeSection === item.id ?
                            ''
                        :   'font-medium hover:bg-surface-hover'}">
                        {item.label}
                    </Button>
                </li>
            {/each}
        </ul>
    </nav>

    <div class="flex shrink-0 items-center justify-end gap-1 sm:gap-2 lg:w-1/4 lg:flex-none">
        <SpotlightSearch
            {projects}
            variant="responsive" />
        <ThemeSelect
            theme={themeStore.current}
            onThemeChange={themeStore.apply} />
        <AccessibilitySelect />
    </div>
</nav>
