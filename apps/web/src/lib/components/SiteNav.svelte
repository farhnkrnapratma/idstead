<script lang="ts">
    import ThemeSelect from '@fkp/ui/components/filter/ThemeSelect.svelte';
    import AccessibilitySelect from '@fkp/ui/components/filter/AccessibilitySelect.svelte';
    import { themeStore } from '@fkp/ui/stores/themeStore.svelte.ts';
    import type { Project } from '@fkp/domain/types.ts';
    import SpotlightSearch from './SpotlightSearch.svelte';

    interface Props {
        projects?: Project[];
    }

    let { projects = [] }: Props = $props();
</script>

<div
    class="fixed top-2 right-2 z-40 flex items-center gap-1.5 font-sans sm:top-3 sm:right-3 sm:gap-2"
    role="toolbar"
    aria-label="Site tools">
    <SpotlightSearch
        {projects}
        variant="responsive" />
    <ThemeSelect
        theme={themeStore.current}
        onThemeChange={themeStore.apply} />
    <AccessibilitySelect />
</div>
