<script lang="ts">
    import ThemeSelect from '@idstead/ui/components/filter/ThemeSelect.svelte';
    import AccessibilitySelect from '@idstead/ui/components/filter/AccessibilitySelect.svelte';
    import PageContainer from '@idstead/ui/layout/PageContainer.svelte';
    import { themeStore } from '@idstead/ui/stores/themeStore.svelte.ts';
    import type { Project } from '@idstead/domain/types.ts';
    import SpotlightSearch from './SpotlightSearch.svelte';

    interface Props {
        projects?: Project[];
    }

    let { projects = [] }: Props = $props();
</script>

<PageContainer
    width="standard"
    class="relative z-40 pt-6 font-sans sm:pt-8">
    <div
        class="flex items-center justify-between gap-3"
        role="toolbar"
        aria-label="Site tools">
        <SpotlightSearch
            {projects}
            variant="responsive" />
        <div class="flex items-center gap-1.5 sm:gap-2">
            <ThemeSelect
                theme={themeStore.current}
                onThemeChange={themeStore.apply} />
            <AccessibilitySelect />
        </div>
    </div>
</PageContainer>
